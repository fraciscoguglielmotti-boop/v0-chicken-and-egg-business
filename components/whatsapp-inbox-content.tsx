"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Send, MessageSquare, ArrowLeft, RefreshCw, Phone,
  AlertTriangle, CheckCheck, ShoppingCart, MapPin,
  CreditCard, Bot, UserCheck, BotOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

// ─── Tipos (wa_conversaciones + wa_mensajes de Supabase) ──────────────────────
interface WaConversacion {
  id: number
  telefono: string
  nombre_cliente: string | null
  ultimo_mensaje_at: string | null
  estado_actual: string | null
  carrito: CartItem[] | null
  producto_pendiente: Record<string, unknown> | null
  zona_entrega: string | null
  direccion_completa: string | null
  metodo_pago: string | null
  pausado_por_humano: boolean
  created_at: string
}

interface CartItem {
  codigo: string
  nombre: string
  unidad: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface WaMensaje {
  id: number
  conversacion_id: number
  telefono: string
  tipo: string
  contenido: string | null
  direccion: "entrante" | "saliente"
  wa_message_id: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

type FilterTab = "todas" | "agente" | "activas" | "confirmados"

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 1) return "Ayer"
  if (diffDays < 7) return d.toLocaleDateString("es-AR", { weekday: "short" })
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
}

function fmtFull(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit",
    day: "2-digit", month: "2-digit",
  })
}

function fmtPhone(phone: string): string {
  if (phone.startsWith("549") && phone.length === 13)
    return `+54 9 ${phone.slice(3, 5)} ${phone.slice(5, 9)}-${phone.slice(9)}`
  return `+${phone}`
}

function initials(name: string | null, phone: string): string {
  if (name) return name.charAt(0).toUpperCase()
  return phone.slice(-2)
}

function cartTotal(items: CartItem[] | null): number {
  return (items ?? []).reduce((s, i) => s + i.subtotal, 0)
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
}

// ─── Config de estados ────────────────────────────────────────────────────────
const ESTADO_LABEL: Record<string, string> = {
  MENU_PRINCIPAL: "Menú",
  SELECCIONANDO_PRODUCTO: "Eligiendo producto",
  INGRESANDO_CANTIDAD: "Ingresando cantidad",
  CARRITO_ACCIONES: "Carrito",
  SUGIRIENDO_COMBO: "Combo sugerido",
  INGRESANDO_DIRECCION: "Ingresando dirección",
  ELIGIENDO_PAGO: "Eligiendo pago",
  CONFIRMANDO_PEDIDO: "Confirmando pedido",
  PEDIDO_CONFIRMADO: "Pedido confirmado",
  MENU_EDITAR: "Editando pedido",
  HUMANO: "Agente humano",
}

const ESTADO_COLOR: Record<string, string> = {
  PEDIDO_CONFIRMADO: "bg-emerald-100 text-emerald-800 border-emerald-300",
  HUMANO: "bg-red-100 text-red-700 border-red-300",
  CONFIRMANDO_PEDIDO: "bg-amber-100 text-amber-800 border-amber-300",
  CARRITO_ACCIONES: "bg-blue-100 text-blue-800 border-blue-300",
}

// ─── Conversation list item ────────────────────────────────────────────────────
function ConvItem({ conv, selected, lastMsg, onClick }: {
  conv: WaConversacion
  selected: boolean
  lastMsg: WaMensaje | null
  onClick: () => void
}) {
  const name = conv.nombre_cliente ?? fmtPhone(conv.telefono)
  const preview = lastMsg
    ? (lastMsg.direccion === "saliente" ? "Tú: " : "") + (lastMsg.contenido ?? `[${lastMsg.tipo}]`)
    : "Sin mensajes"

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/60 transition-colors text-left",
        selected && "bg-muted"
      )}
    >
      <div className={cn(
        "h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold text-white relative",
        conv.pausado_por_humano ? "bg-red-500" : "bg-emerald-600"
      )}>
        {initials(conv.nombre_cliente, conv.telefono)}
        {conv.pausado_por_humano && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-600 rounded-full border-2 border-background flex items-center justify-center">
            <AlertTriangle className="h-2.5 w-2.5 text-white" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate">{name}</span>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {fmtTime(conv.ultimo_mensaje_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className={cn(
            "text-xs truncate",
            lastMsg?.direccion === "entrante" ? "text-foreground" : "text-muted-foreground"
          )}>
            {preview}
          </span>
          {conv.estado_actual && (
            <span className={cn(
              "shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-medium",
              ESTADO_COLOR[conv.estado_actual] ?? "bg-muted text-muted-foreground border-border"
            )}>
              {ESTADO_LABEL[conv.estado_actual] ?? conv.estado_actual}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Message bubble ────────────────────────────────────────────────────────────
function MsgBubble({ msg }: { msg: WaMensaje }) {
  const isOut = msg.direccion === "saliente"
  const body = msg.contenido?.startsWith("[") ? null : msg.contenido
  const label = msg.contenido?.startsWith("[") ? msg.contenido : null

  return (
    <div className={cn("flex mb-2", isOut ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[72%] rounded-2xl px-3 py-2 text-sm shadow-sm",
        isOut
          ? "bg-emerald-600 text-white rounded-tr-sm"
          : "bg-card border border-border rounded-tl-sm",
        label && "opacity-60 italic"
      )}>
        {label ? (
          <p className="text-xs">{label}</p>
        ) : (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{body}</p>
        )}
        <div className={cn("flex items-center gap-1 mt-1", isOut ? "justify-end" : "justify-start")}>
          <span className={cn("text-[10px]", isOut ? "text-emerald-100" : "text-muted-foreground")}>
            {fmtFull(msg.created_at)}
          </span>
          {isOut && <CheckCheck className="h-3 w-3 text-emerald-200" />}
        </div>
      </div>
    </div>
  )
}

// ─── Filter tabs ───────────────────────────────────────────────────────────────
function FilterTabs({ active, onChange, counts }: {
  active: FilterTab
  onChange: (t: FilterTab) => void
  counts: Record<FilterTab, number>
}) {
  const tabs: { id: FilterTab; label: string; urgent?: boolean }[] = [
    { id: "todas", label: "Todas" },
    { id: "agente", label: "Agente humano", urgent: true },
    { id: "activas", label: "Activas" },
    { id: "confirmados", label: "Confirmados" },
  ]

  return (
    <div className="flex border-b border-border overflow-x-auto shrink-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2",
            active === t.id
              ? t.urgent && counts[t.id] > 0
                ? "border-red-500 text-red-600"
                : "border-emerald-600 text-emerald-700 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
          {counts[t.id] > 0 && (
            <span className={cn(
              "h-4 min-w-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1",
              t.urgent ? "bg-red-500" : "bg-emerald-600"
            )}>
              {counts[t.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Panel info de conversación ────────────────────────────────────────────────
function ConvInfoPanel({ conv }: { conv: WaConversacion }) {
  const total = cartTotal(conv.carrito)
  const items = conv.carrito ?? []

  return (
    <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2 shrink-0">
      {items.length > 0 && (
        <div className="text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-muted-foreground mb-1">
            <ShoppingCart className="h-3.5 w-3.5" />
            Carrito ({fmtCurrency(total)})
          </div>
          {items.map((item) => (
            <div key={item.codigo} className="flex justify-between text-foreground/80 pl-5">
              <span>{item.cantidad} {item.unidad} {item.nombre}</span>
              <span>{fmtCurrency(item.subtotal)}</span>
            </div>
          ))}
        </div>
      )}
      {conv.direccion_completa && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{conv.direccion_completa}{conv.zona_entrega ? ` (${conv.zona_entrega})` : ""}</span>
        </div>
      )}
      {conv.metodo_pago && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5" />
          <span>{conv.metodo_pago}</span>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function WhatsappInboxContent() {
  const supabase = createClient()

  const [convs, setConvs] = useState<WaConversacion[]>([])
  const [mensajes, setMensajes] = useState<WaMensaje[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filterTab, setFilterTab] = useState<FilterTab>("todas")
  const [replyText, setReplyText] = useState("")
  const [sending, setSending] = useState(false)
  const [togglingBot, setTogglingBot] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showChat, setShowChat] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selectedIdRef = useRef<number | null>(null)
  selectedIdRef.current = selectedId

  // ── Carga de datos ─────────────────────────────────────────────────────────
  const loadConvs = useCallback(async () => {
    const { data } = await supabase
      .from("wa_conversaciones")
      .select("*")
      .order("ultimo_mensaje_at", { ascending: false })
      .limit(200)
    setConvs((data as WaConversacion[]) ?? [])
    setLoading(false)
  }, [supabase])

  const loadMensajes = useCallback(async (convId: number) => {
    const { data } = await supabase
      .from("wa_mensajes")
      .select("*")
      .eq("conversacion_id", convId)
      .order("created_at", { ascending: true })
      .limit(500)
    setMensajes((data as WaMensaje[]) ?? [])
  }, [supabase])

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    loadConvs()

    const channel = supabase
      .channel("wa-inbox-v2")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_mensajes" },
        (payload) => {
          const msg = payload.new as WaMensaje
          if (msg.conversacion_id === selectedIdRef.current) {
            setMensajes((prev) => [...prev, msg])
          }
          loadConvs()
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wa_conversaciones" },
        () => loadConvs()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, loadConvs])

  useEffect(() => {
    if (selectedId !== null) loadMensajes(selectedId)
    else setMensajes([])
  }, [selectedId, loadMensajes])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensajes.length])

  // ── Último mensaje por conversación (para preview) ─────────────────────────
  const lastMsgMap = useMemo(() => {
    const map = new Map<number, WaMensaje>()
    // mensajes no está cargado por conv aquí — usamos los de la conv seleccionada
    // Para preview cargamos los últimos mensajes de todas las convs
    return map
  }, [])

  // Cargamos últimos mensajes para preview al cargar convs
  const [lastMsgs, setLastMsgs] = useState<Map<number, WaMensaje>>(new Map())

  useEffect(() => {
    if (convs.length === 0) return
    ;(async () => {
      const { data } = await supabase
        .from("wa_mensajes")
        .select("id, conversacion_id, contenido, direccion, tipo, created_at")
        .order("created_at", { ascending: false })
        .limit(500)
      const map = new Map<number, WaMensaje>()
      for (const m of (data ?? []) as WaMensaje[]) {
        if (!map.has(m.conversacion_id)) map.set(m.conversacion_id, m)
      }
      setLastMsgs(map)
    })()
  }, [convs.length, supabase])

  // ── Filtros ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    switch (filterTab) {
      case "agente":      return convs.filter((c) => c.pausado_por_humano)
      case "activas":     return convs.filter((c) => !c.pausado_por_humano && c.estado_actual !== "PEDIDO_CONFIRMADO")
      case "confirmados": return convs.filter((c) => c.estado_actual === "PEDIDO_CONFIRMADO")
      default:            return convs
    }
  }, [convs, filterTab])

  const counts = useMemo<Record<FilterTab, number>>(() => ({
    todas:       convs.length,
    agente:      convs.filter((c) => c.pausado_por_humano).length,
    activas:     convs.filter((c) => !c.pausado_por_humano && c.estado_actual !== "PEDIDO_CONFIRMADO").length,
    confirmados: convs.filter((c) => c.estado_actual === "PEDIDO_CONFIRMADO").length,
  }), [convs])

  const selectedConv = convs.find((c) => c.id === selectedId) ?? null
  const contactName = selectedConv
    ? (selectedConv.nombre_cliente ?? fmtPhone(selectedConv.telefono))
    : null

  const hasCart = (selectedConv?.carrito?.length ?? 0) > 0 || !!selectedConv?.direccion_completa

  // ── Enviar respuesta ───────────────────────────────────────────────────────
  const sendReply = async () => {
    if (!replyText.trim() || !selectedConv || sending) return
    setSending(true)
    try {
      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversacion_id: selectedConv.id,
          telefono: selectedConv.telefono,
          contenido: replyText.trim(),
        }),
      })
      setReplyText("")
    } finally {
      setSending(false)
    }
  }

  // ── Tomar / liberar control del bot ───────────────────────────────────────
  const toggleBot = async () => {
    if (!selectedConv || togglingBot) return
    setTogglingBot(true)
    try {
      await supabase
        .from("wa_conversaciones")
        .update({ pausado_por_humano: !selectedConv.pausado_por_humano })
        .eq("id", selectedConv.id)
      await loadConvs()
    } finally {
      setTogglingBot(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-3.5rem-2rem)] lg:h-[calc(100vh-3.5rem-3rem)] overflow-hidden rounded-lg border border-border bg-background shadow-sm">

      {/* ── Lista de conversaciones ──────────────────────────────────────── */}
      <div className={cn(
        "flex flex-col border-r border-border",
        showChat ? "hidden md:flex md:w-80 lg:w-96" : "flex w-full md:w-80 lg:w-96"
      )}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <h2 className="font-semibold text-base">WhatsApp Minorista</h2>
          <button onClick={loadConvs} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground" title="Actualizar">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <FilterTabs active={filterTab} onChange={setFilterTab} counts={counts} />

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-30" />
              <span className="text-sm">Sin conversaciones</span>
            </div>
          ) : (
            filtered.map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                selected={conv.id === selectedId}
                lastMsg={lastMsgs.get(conv.id) ?? null}
                onClick={() => { setSelectedId(conv.id); setShowChat(true) }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Vista de chat ────────────────────────────────────────────────── */}
      <div className={cn("flex flex-col flex-1 min-w-0", !showChat && "hidden md:flex")}>
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/20">
            <MessageSquare className="h-14 w-14 opacity-20" />
            <p className="text-sm">Seleccioná una conversación</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
              <button onClick={() => { setShowChat(false); setSelectedId(null) }} className="md:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0",
                selectedConv.pausado_por_humano ? "bg-red-500" : "bg-emerald-600"
              )}>
                {initials(selectedConv.nombre_cliente, selectedConv.telefono)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{contactName}</span>
                  {selectedConv.pausado_por_humano ? (
                    <Badge variant="outline" className="text-[11px] gap-1 border-red-300 text-red-600 bg-red-50">
                      <AlertTriangle className="h-3 w-3" />
                      Agente activo
                    </Badge>
                  ) : (
                    selectedConv.estado_actual && (
                      <Badge variant="outline" className={cn("text-[11px] gap-1", ESTADO_COLOR[selectedConv.estado_actual] ?? "")}>
                        <Bot className="h-3 w-3" />
                        {ESTADO_LABEL[selectedConv.estado_actual] ?? selectedConv.estado_actual}
                      </Badge>
                    )
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Phone className="h-3 w-3" />
                  <span>{fmtPhone(selectedConv.telefono)}</span>
                </div>
              </div>

              {/* Botón tomar / liberar control */}
              <Button
                size="sm"
                variant={selectedConv.pausado_por_humano ? "outline" : "secondary"}
                className={cn(
                  "shrink-0 text-xs h-8 gap-1.5",
                  selectedConv.pausado_por_humano
                    ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    : "text-muted-foreground"
                )}
                onClick={toggleBot}
                disabled={togglingBot}
              >
                {selectedConv.pausado_por_humano ? (
                  <><Bot className="h-3.5 w-3.5" /> Devolver al bot</>
                ) : (
                  <><UserCheck className="h-3.5 w-3.5" /> Tomar control</>
                )}
              </Button>
            </div>

            {/* Info del carrito/pedido si hay */}
            {hasCart && <ConvInfoPanel conv={selectedConv} />}

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-muted/10">
              {mensajes.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm mt-8">Sin mensajes</p>
              ) : (
                mensajes.map((msg) => <MsgBubble key={msg.id} msg={msg} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de respuesta — siempre visible */}
            <div className="border-t border-border bg-background shrink-0">
              {!selectedConv.pausado_por_humano && (
                <div className="px-4 pt-2 pb-0">
                  <p className="text-[11px] text-amber-600 flex items-center gap-1">
                    <Bot className="h-3 w-3" />
                    El bot está activo. Tu mensaje se enviará igual, pero el bot puede seguir respondiendo.
                  </p>
                </div>
              )}
              <div className="flex items-end gap-2 px-4 py-3">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply() }
                  }}
                  placeholder={selectedConv.pausado_por_humano ? "Respondé como agente..." : "Escribí un mensaje manual..."}
                  rows={1}
                  className="resize-none min-h-[40px] max-h-[120px] flex-1 text-sm"
                />
                <Button
                  size="icon"
                  onClick={sendReply}
                  disabled={!replyText.trim() || sending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 w-10 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
