"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Send,
  MessageSquare,
  ArrowLeft,
  RefreshCw,
  Phone,
  Bot,
  ShoppingCart,
  CheckCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

// ─── Tipos de las tablas mn_* (manejadas por Make.com) ────────────────────────
interface MnMensaje {
  id: string
  telefono: string
  direccion: "inbound" | "outbound"
  tipo: string
  contenido: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface MnSesion {
  id: string
  telefono: string
  cliente_id: string | null
  estado: string | null
  contexto: Record<string, unknown> | null
  pedido_id_activo: string | null
  created_at: string
}

interface ClienteMini {
  id: string
  nombre: string
}

interface Conversacion {
  telefono: string
  clienteNombre: string | null
  estado: string | null
  pedidoActivo: string | null
  lastMsg: MnMensaje | null
  msgCount: number
  inboundSinResponder: boolean
}

type FilterTab = "todas" | "sin-responder" | "hoy"

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
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  })
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function initials(name: string | null, phone: string): string {
  if (name) return name.charAt(0).toUpperCase()
  return phone.slice(-2)
}

function fmtPhone(phone: string): string {
  // Argentina: 5491121568981 → +54 9 11 2156-8981
  if (phone.startsWith("549") && phone.length === 13) {
    return `+54 9 ${phone.slice(3, 5)} ${phone.slice(5, 9)}-${phone.slice(9)}`
  }
  return `+${phone}`
}

// ─── Conversation list item ────────────────────────────────────────────────────
function ConvItem({
  conv,
  selected,
  onClick,
}: {
  conv: Conversacion
  selected: boolean
  onClick: () => void
}) {
  const displayName = conv.clienteNombre ?? fmtPhone(conv.telefono)
  const lastMsgBody = conv.lastMsg?.contenido ?? "Sin mensajes"
  const preview = conv.lastMsg?.direccion === "outbound" ? `Tú: ${lastMsgBody}` : lastMsgBody

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/60 transition-colors text-left",
        selected && "bg-muted"
      )}
    >
      <div
        className={cn(
          "h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold text-white",
          conv.inboundSinResponder ? "bg-emerald-600" : "bg-muted-foreground/50"
        )}
      >
        {initials(conv.clienteNombre, conv.telefono)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate text-foreground">{displayName}</span>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {fmtTime(conv.lastMsg?.created_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className={cn(
            "text-xs truncate",
            conv.inboundSinResponder ? "text-foreground font-medium" : "text-muted-foreground"
          )}>
            {preview}
          </span>
          {conv.inboundSinResponder && (
            <span className="shrink-0 h-2 w-2 rounded-full bg-emerald-600" title="Sin responder" />
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Message bubble ────────────────────────────────────────────────────────────
function MsgBubble({ msg }: { msg: MnMensaje }) {
  const isOut = msg.direccion === "outbound"
  const body = msg.contenido ?? (msg.tipo !== "text" ? `[${msg.tipo}]` : "[vacío]")

  return (
    <div className={cn("flex mb-2", isOut ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          isOut
            ? "bg-emerald-600 text-white rounded-tr-sm"
            : "bg-card border border-border rounded-tl-sm"
        )}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">{body}</p>
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

function EmptyChat() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/20">
      <MessageSquare className="h-14 w-14 opacity-20" />
      <p className="text-sm">Seleccioná una conversación para ver los mensajes</p>
    </div>
  )
}

function FilterTabs({
  active,
  onChange,
  sinResponderCount,
  hoyCount,
}: {
  active: FilterTab
  onChange: (t: FilterTab) => void
  sinResponderCount: number
  hoyCount: number
}) {
  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: "todas", label: "Todas" },
    { id: "sin-responder", label: "Sin responder", count: sinResponderCount },
    { id: "hoy", label: "Hoy", count: hoyCount },
  ]

  return (
    <div className="flex border-b border-border overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2",
            active === t.id
              ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
          {t.count != null && t.count > 0 && (
            <span className="h-4 min-w-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function WhatsappInboxContent() {
  const supabase = createClient()

  const [messages, setMessages] = useState<MnMensaje[]>([])
  const [sesiones, setSesiones] = useState<MnSesion[]>([])
  const [clientes, setClientes] = useState<Map<string, ClienteMini>>(new Map())
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [filterTab, setFilterTab] = useState<FilterTab>("todas")
  const [replyText, setReplyText] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showChat, setShowChat] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selectedPhoneRef = useRef<string | null>(null)
  selectedPhoneRef.current = selectedPhone

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const [{ data: msgs }, { data: ses }] = await Promise.all([
      supabase
        .from("mn_mensajes_whatsapp")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("mn_sesiones_whatsapp")
        .select("*"),
    ])

    setMessages((msgs as MnMensaje[]) ?? [])
    setSesiones((ses as MnSesion[]) ?? [])

    // Load linked clientes for name display
    const clienteIds = Array.from(
      new Set((ses ?? []).map((s: MnSesion) => s.cliente_id).filter(Boolean) as string[])
    )
    if (clienteIds.length > 0) {
      const { data: cls } = await supabase
        .from("clientes")
        .select("id, nombre")
        .in("id", clienteIds)
      const map = new Map<string, ClienteMini>()
      for (const c of (cls as ClienteMini[]) ?? []) map.set(c.id, c)
      setClientes(map)
    }

    setLoading(false)
  }, [supabase])

  // ── Initial load + realtime ────────────────────────────────────────────────
  useEffect(() => {
    loadAll()

    const channel = supabase
      .channel("mn-whatsapp-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mn_mensajes_whatsapp" },
        (payload) => {
          const msg = payload.new as MnMensaje
          setMessages((prev) => [msg, ...prev])
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mn_sesiones_whatsapp" },
        () => loadAll()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mn_sesiones_whatsapp" },
        () => loadAll()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, loadAll])

  // ── Build conversations from messages + sessions ───────────────────────────
  const conversations = useMemo<Conversacion[]>(() => {
    // Group messages by telefono (already ordered by created_at desc)
    const byPhone = new Map<string, MnMensaje[]>()
    for (const m of messages) {
      const list = byPhone.get(m.telefono)
      if (list) list.push(m)
      else byPhone.set(m.telefono, [m])
    }

    // Map sessions by telefono
    const sesPorTel = new Map<string, MnSesion>()
    for (const s of sesiones) {
      const existing = sesPorTel.get(s.telefono)
      if (!existing || new Date(s.created_at) > new Date(existing.created_at)) {
        sesPorTel.set(s.telefono, s)
      }
    }

    const result: Conversacion[] = []
    for (const [telefono, msgs] of byPhone) {
      const sesion = sesPorTel.get(telefono)
      const clienteNombre = sesion?.cliente_id ? clientes.get(sesion.cliente_id)?.nombre ?? null : null
      const lastMsg = msgs[0] ?? null
      result.push({
        telefono,
        clienteNombre,
        estado: sesion?.estado ?? null,
        pedidoActivo: sesion?.pedido_id_activo ?? null,
        lastMsg,
        msgCount: msgs.length,
        inboundSinResponder: lastMsg?.direccion === "inbound",
      })
    }

    result.sort((a, b) => {
      const aT = a.lastMsg?.created_at ?? ""
      const bT = b.lastMsg?.created_at ?? ""
      return bT.localeCompare(aT)
    })

    return result
  }, [messages, sesiones, clientes])

  // ── Filtered conversations ─────────────────────────────────────────────────
  const filteredConvs = useMemo(() => {
    switch (filterTab) {
      case "sin-responder": return conversations.filter((c) => c.inboundSinResponder)
      case "hoy":           return conversations.filter((c) => isToday(c.lastMsg?.created_at ?? null))
      default:              return conversations
    }
  }, [conversations, filterTab])

  const sinResponderCount = useMemo(
    () => conversations.filter((c) => c.inboundSinResponder).length,
    [conversations]
  )
  const hoyCount = useMemo(
    () => conversations.filter((c) => isToday(c.lastMsg?.created_at ?? null)).length,
    [conversations]
  )

  // ── Messages for selected conversation ─────────────────────────────────────
  const selectedConv = useMemo(
    () => conversations.find((c) => c.telefono === selectedPhone) ?? null,
    [conversations, selectedPhone]
  )

  const selectedMessages = useMemo(() => {
    if (!selectedPhone) return []
    return messages
      .filter((m) => m.telefono === selectedPhone)
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }, [messages, selectedPhone])

  // ── Scroll to bottom when messages change ──────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selectedMessages.length])

  // ── Actions ───────────────────────────────────────────────────────────────
  const selectConversation = (telefono: string) => {
    setSelectedPhone(telefono)
    setShowChat(true)
  }

  const sendReply = async () => {
    if (!replyText.trim() || !selectedConv || sending) return
    setSending(true)
    try {
      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono: selectedConv.telefono,
          contenido: replyText.trim(),
        }),
      })
      setReplyText("")
    } finally {
      setSending(false)
    }
  }

  const contactName = selectedConv
    ? selectedConv.clienteNombre ?? fmtPhone(selectedConv.telefono)
    : null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-3.5rem-2rem)] lg:h-[calc(100vh-3.5rem-3rem)] overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      {/* ── Conversation list ───────────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col border-r border-border",
          showChat ? "hidden md:flex md:w-80 lg:w-96" : "flex w-full md:w-80 lg:w-96"
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="font-semibold text-base">WhatsApp Minorista</h2>
          <button
            onClick={loadAll}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            title="Actualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <FilterTabs
          active={filterTab}
          onChange={setFilterTab}
          sinResponderCount={sinResponderCount}
          hoyCount={hoyCount}
        />

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Cargando...
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-30" />
              <span className="text-sm">Sin conversaciones</span>
            </div>
          ) : (
            filteredConvs.map((conv) => (
              <ConvItem
                key={conv.telefono}
                conv={conv}
                selected={conv.telefono === selectedPhone}
                onClick={() => selectConversation(conv.telefono)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Chat view ───────────────────────────────────────────────────── */}
      <div className={cn("flex flex-col flex-1 min-w-0", !showChat && "hidden md:flex")}>
        {!selectedConv ? (
          <EmptyChat />
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
              <button
                onClick={() => { setShowChat(false); setSelectedPhone(null) }}
                className="md:hidden p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                {initials(selectedConv.clienteNombre, selectedConv.telefono)}
              </div>

              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm truncate block">{contactName}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>{fmtPhone(selectedConv.telefono)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {selectedConv.estado && (
                  <Badge variant="outline" className="text-[11px] gap-1 border-emerald-300 text-emerald-700 dark:text-emerald-400">
                    <Bot className="h-3 w-3" />
                    {selectedConv.estado}
                  </Badge>
                )}
                {selectedConv.pedidoActivo && (
                  <Badge variant="outline" className="text-[11px] gap-1 border-amber-300 text-amber-700 dark:text-amber-400">
                    <ShoppingCart className="h-3 w-3" />
                    Pedido
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 bg-muted/10">
              {selectedMessages.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm mt-8">
                  No hay mensajes todavía
                </p>
              ) : (
                selectedMessages.map((msg) => <MsgBubble key={msg.id} msg={msg} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex items-end gap-2 px-4 py-3 border-t border-border bg-background">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    sendReply()
                  }
                }}
                placeholder="Escribí un mensaje..."
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
          </>
        )}
      </div>
    </div>
  )
}
