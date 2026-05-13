# WhatsApp Bot — AviGest

Módulo de WhatsApp para ventas retail de pollo trozado al consumidor final.

## Arquitectura

El bot vive 100% dentro de AviGest (Next.js + Supabase). No hay servicios externos ni Make.com.

```
WhatsApp Cloud API → webhook POST → app/api/whatsapp/webhook/ → Supabase
                                                                     ↓
                                                               lib/whatsapp/
                                                              persistence.ts
                                                                 client.ts
```

## Setup inicial

### 1. Variables de entorno

Agregar en Vercel (Settings → Environment Variables):

| Variable | Descripción |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID de Meta (`1148812161641223` para el sandbox) |
| `WHATSAPP_ACCESS_TOKEN` | Token permanente del System User (ver 1Password) |
| `WHATSAPP_VERIFY_TOKEN` | String random que vos elegís; debe coincidir en Vercel y en el panel de Meta |
| `WHATSAPP_API_VERSION` | Versión de la API (`v21.0`) |
| `ANTHROPIC_API_KEY` | Para M3+ (clasificación de intents con Claude) |

**Generar `WHATSAPP_VERIFY_TOKEN`:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Configurar el webhook en Meta

1. Ir a [developers.facebook.com](https://developers.facebook.com) → tu app → WhatsApp → Configuración
2. En **Webhook**, hacer click en "Editar"
3. **URL del Callback**: `https://tu-dominio.vercel.app/api/whatsapp/webhook`
4. **Token de verificación**: el mismo valor de `WHATSAPP_VERIFY_TOKEN`
5. Suscribirse a los eventos: `messages` (el mínimo para M1)
6. Guardar — Meta hará un GET al endpoint para verificarlo

### 3. Correr la migración de Supabase

Ejecutar `supabase/migrations/create_whatsapp_schema.sql` en el SQL Editor de Supabase.

Esto crea las tablas: `productos_trozado`, `combos_trozado`, `combo_items`, `zonas_entrega`, `wa_conversations`, `wa_messages`, `wa_bot_state`, `pedidos_trozado`.

### 4. Registrar número de prueba en Meta

Para que el sandbox (`+61 405 615 504`) pueda recibir mensajes, el número desde el que se testea debe estar registrado en:
developers.facebook.com → tu app → WhatsApp → API Setup → "To" number

## Estructura de archivos

```
app/api/whatsapp/
  route.ts              # Envío de mensajes B2B (existente, no tocar)
  webhook/
    route.ts            # GET (verify) + POST (recepción de mensajes)

lib/whatsapp/
  types.ts              # Tipos TypeScript compartidos
  client.ts             # sendTextMessage(), sendTemplateMessage(), markAsRead()
  persistence.ts        # upsertConversation(), saveInboundMessage(), parseInboundPayload()
  bot/                  # (M2+) router, intent classifier, state machine
```

## Verificar que M1 funciona

1. Mandar un mensaje de WhatsApp al número sandbox desde un número registrado
2. Verificar en Supabase:
   - `wa_conversations`: debe aparecer una fila con el número del remitente
   - `wa_messages`: debe aparecer el mensaje con `direction='inbound'`

## Roadmap

- **M1** ✅ Plumbing del webhook — recibir y guardar mensajes
- **M2** Echo + FAQ estática (respuestas por keywords)
- **M3** Intent classification con Claude Haiku
- **M4** Toma de pedido (state machine)
- **M5** Escalado a humano
- **M6** Inbox en AviGest (Realtime + UI)

## Notas de seguridad

- El webhook usa `SUPABASE_SERVICE_ROLE_KEY` (bypasea RLS) porque no hay sesión de usuario autenticado
- TODO M2: validar HMAC en el header `x-hub-signature-256` de cada POST
- Nunca commitear tokens ni keys — siempre en variables de entorno
