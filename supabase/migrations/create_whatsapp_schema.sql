-- ============================================
-- WhatsApp bot: catálogo, conversaciones y pedidos
-- Sección 5 del handoff document
-- ============================================

-- Catálogo retail trozado
CREATE TABLE productos_trozado (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    unidad TEXT NOT NULL CHECK (unidad IN ('kg', 'maple', 'unidad')),
    precio_por_unidad NUMERIC(10,2) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE combos_trozado (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio_total NUMERIC(10,2) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE combo_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combo_id UUID NOT NULL REFERENCES combos_trozado(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos_trozado(id),
    cantidad NUMERIC(10,2) NOT NULL,
    UNIQUE(combo_id, producto_id)
);

-- Zonas de entrega configurables
CREATE TABLE zonas_entrega (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    codigos_postales TEXT[] DEFAULT ARRAY[]::TEXT[],
    barrios TEXT[] DEFAULT ARRAY[]::TEXT[],
    dia_reparto TEXT CHECK (dia_reparto IN ('lunes', 'miercoles', 'viernes')),
    minimo_pedido NUMERIC(10,2),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversaciones de WhatsApp
CREATE TABLE wa_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL UNIQUE,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    display_name TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'escalated', 'closed')),
    bot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    last_inbound_at TIMESTAMPTZ,
    unread_count INT NOT NULL DEFAULT 0,
    escalation_reason TEXT,
    assigned_to UUID REFERENCES auth.users(id),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mensajes individuales (in/out)
CREATE TABLE wa_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
    wa_message_id TEXT UNIQUE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'bot', 'human')),
    sender_user_id UUID REFERENCES auth.users(id),
    message_type TEXT NOT NULL DEFAULT 'text',
    body TEXT,
    template_name TEXT,
    template_components JSONB,
    media_url TEXT,
    raw_payload JSONB,
    status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Estado del bot por conversación (state machine)
CREATE TABLE wa_bot_state (
    conversation_id UUID PRIMARY KEY REFERENCES wa_conversations(id) ON DELETE CASCADE,
    current_state TEXT NOT NULL DEFAULT 'idle',
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pedidos generados por el bot
CREATE TABLE pedidos_trozado (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES wa_conversations(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES clientes(id),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    combos JSONB NOT NULL DEFAULT '[]'::jsonb,
    total NUMERIC(10,2) NOT NULL,
    direccion_entrega TEXT,
    zona_id UUID REFERENCES zonas_entrega(id),
    dia_entrega DATE,
    forma_pago TEXT CHECK (forma_pago IN ('transferencia', 'efectivo')),
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'preparando', 'en_ruta', 'entregado', 'cancelado')),
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_wa_conv_status ON wa_conversations(status);
CREATE INDEX idx_wa_conv_last_msg ON wa_conversations(last_message_at DESC);
CREATE INDEX idx_wa_conv_bot ON wa_conversations(bot_enabled);
CREATE INDEX idx_wa_msg_conv ON wa_messages(conversation_id, created_at);
CREATE INDEX idx_wa_msg_direction ON wa_messages(direction);
CREATE INDEX idx_pedidos_estado ON pedidos_trozado(estado);
CREATE INDEX idx_pedidos_cliente ON pedidos_trozado(cliente_id);

-- RLS (mismo patrón que tablas existentes — webhook usa service role key que bypassea RLS)
ALTER TABLE productos_trozado ENABLE ROW LEVEL SECURITY;
ALTER TABLE combos_trozado ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE zonas_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_bot_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_trozado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth full" ON productos_trozado FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth full" ON combos_trozado FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth full" ON combo_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth full" ON zonas_entrega FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth full" ON wa_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth full" ON wa_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth full" ON wa_bot_state FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth full" ON pedidos_trozado FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed productos (precios en 0 — actualizarlos desde admin antes de lanzar)
INSERT INTO productos_trozado (nombre, descripcion, unidad, precio_por_unidad, orden) VALUES
    ('Pata muslo', 'Pata muslo de pollo trozado', 'kg', 0, 1),
    ('Pechuga', 'Pechuga de pollo trozada', 'kg', 0, 2),
    ('Maple de huevos', 'Maple de 30 huevos', 'maple', 0, 3);

-- Combo de ejemplo para testing (precio TBD)
INSERT INTO combos_trozado (nombre, descripcion, precio_total, orden) VALUES
    ('Combo Familiar', '2 kg pata muslo + 1 kg pechuga', 0, 1);

-- Habilitar Realtime para inbox en vivo
ALTER PUBLICATION supabase_realtime ADD TABLE wa_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE wa_messages;
