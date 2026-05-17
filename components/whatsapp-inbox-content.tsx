"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { WaConversation, WaMessage } from "@/lib/whatsapp/types"
import {
  Send,
  MessageSquare,
  ArrowLeft,
  RefreshCw,
  Phone,
  AlertTriangle,
  CheckCheck,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type FilterTab = "todas" | "no-leidas" | "escaladas" | "cerradas"

interface ConvWithPreview extends WaConversation {
  lastMsgBody?: string | null
  lastMsgDirection?: "inbound" | "outbound"
}

function fmtTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)
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

function initials(name: string | null | undefined, phone: string): string {
  if (name && name !== phone) return name.charAt(0).toUpperCase()
  return phone.slice(-2)
}

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  escalated: "Escalada",
  closed: "Cerrada",
}
const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-500",
  escalated: "bg-yellow-500",
  closed: "bg-gray-400",
}

// ─── Conversation list item ────────────────────────────────────────────────────
function ConvItem({
  conv,
  selected,
  onClick,
}: {
  conv: ConvWithPreview
  selected: boolean
  onClick: () => void
}) {
  const name = conv.display_name && conv.display_name !== conv.phone_number
    ? conv.display_name
    : `+${conv.phone_number}`

  const preview = conv.lastMsgBody
    ? (conv.lastMsgDirection === "outbound" ? "Tú: " : "") + conv.lastMsgBody
    : "Sin mensajes"

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/60 transition-colors text-left",
        selected && "bg-muted"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold text-white",
          conv.status === "escalated" ? "bg-yellow-500" : "bg-emerald-600"
        )}
      >
        {initials(conv.display_name, conv.phone_number)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate text-foreground">{name}</span>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {fmtTime(conv.last_message_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">{preview}</span>
          {conv.unread_count > 0 && (
            <span className="shrink-0 h-5 min-w-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center px-1">
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Message bubble ─────────────────────────────────────────────────────────
function MsgBubble({ msg }: { msg: WaMessage }) {
  const isOut = msg.direction === "outbound"
  const body = msg.body ?? (msg.message_type !== "text" ? `[${msg.message_type}]` : "[vacío]")

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
        {msg.sender_type === "bot" && (
          <span className="block text-[10px] font-semibold mb-1 opacity-70">🤖 Bot</span>
        )}
        <p className="whitespace-pre-wrap break-words leading-relaxed">{body}</p>
        <div
          className={cn(
            "flex items-center gap-1 mt-1",
            isOut ? "justify-end" : "justify-start"
          )}
        >
          <span className={cn("text-[10px]", isOut ? "text-emerald-100" : "text-muted-foreground")}>
            {fmtFull(msg.created_at)}
          </span>
          {isOut && <CheckCheck className="h-3 w-3 text-emerald-200" />}
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyChat() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/20">
      <MessageSquare className="h-14 w-14 opacity-20" />
      <p className="text-sm">Seleccioná una conversación para ver los mensajes</p>
    </div>
  )
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────
function FilterTabs({
  active,
  onChange,
  unreadCount,
  escalatedCount,
}: {
  active: FilterTab
  onChange: (t: FilterTab) => void
  unreadCount: number
  escalatedCount: number
}) {
  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: "todas", label: "Todas" },
    { id: "no-leidas", label: "No leídas", count: unreadCount },
    { id: "escaladas", label: "Escaladas", count: escalatedCount },
    { id: "cerradas", label: "Cerradas" },
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

  const [conversations, setConversations] = useState<ConvWithPreview[]>([])
  const [messages, setMessages] = useState<WaMessage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterTab, setFilterTab] = useState<FilterTab>("todas")
  const [replyText, setReplyText] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showChat, setShowChat] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selectedId

  // ── Load conversations + last message preview ──────────────────────────────
  const loadConversations = useCallback(async () => {
    const { data: convs } = await supabase
      .from("wa_conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(200)

    if (!convs) return

    // Fetch recent messages to build last-message preview
    const { data: recentMsgs } = await supabase
      .from("wa_messages")
      .select("conversation_id, body, direction, created_at")
      .order("created_at", { ascending: false })
      .limit(500)

    // Map last message per conversation (messages are already ordered newest-first)
    const lastMap = new Map<string, { body: string | null; direction: "inbound" | "outbound" }>()
    for (const m of recentMsgs ?? []) {
      if (!lastMap.has(m.conversation_id)) {
        lastMap.set(m.conversation_id, { body: m.body, direction: m.direction })
      }
    }

    setConversations(
      (convs as WaConversation[]).map((c) => ({
        ...c,
        lastMsgBody: lastMap.get(c.id)?.body ?? undefined,
        lastMsgDirection: lastMap.get(c.id)?.direction ?? undefined,
      }))
    )
    setLoading(false)
  }, [supabase])

  // ── Load messages for selected conversation ────────────────────────────────
  const loadMessages = useCallback(
    async (convId: string) => {
      const { data } = await supabase
        .from("wa_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(500)

      setMessages(data ?? [])

      // Mark as read
      await supabase
        .from("wa_conversations")
        .update({ unread_count: 0 })
        .eq("id", convId)

      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      )
    },
    [supabase]
  )

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("wa-inbox-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wa_messages" },
        (payload) => {
          const msg = payload.new as WaMessage
          if (msg.conversation_id === selectedIdRef.current) {
            setMessages((prev) => [...prev, msg])
          }
          loadConversations()
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wa_conversations" },
        () => loadConversations()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, loadConversations])

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // ── Load messages on selection change ─────────────────────────────────────
  useEffect(() => {
    if (selectedId) loadMessages(selectedId)
    else setMessages([])
  }, [selectedId, loadMessages])

  // ── Scroll to bottom on new messages ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Derived state ─────────────────────────────────────────────────────────
  const filteredConvs = useMemo(() => {
    switch (filterTab) {
      case "no-leidas": return conversations.filter((c) => c.unread_count > 0)
      case "escaladas": return conversations.filter((c) => c.status === "escalated")
      case "cerradas":  return conversations.filter((c) => c.status === "closed")
      default:          return conversations
    }
  }, [conversations, filterTab])

  const unreadCount   = useMemo(() => conversations.filter((c) => c.unread_count > 0).length, [conversations])
  const escalatedCount = useMemo(() => conversations.filter((c) => c.status === "escalated").length, [conversations])
  const selectedConv  = useMemo(() => conversations.find((c) => c.id === selectedId), [conversations, selectedId])

  // ── Actions ───────────────────────────────────────────────────────────────
  const selectConversation = (id: string) => {
    setSelectedId(id)
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
          conversationId: selectedConv.id,
          to: selectedConv.phone_number,
          body: replyText.trim(),
        }),
      })
      setReplyText("")
    } finally {
      setSending(false)
    }
  }

  const closeConversation = async () => {
    if (!selectedId) return
    await supabase
      .from("wa_conversations")
      .update({ status: "closed" })
      .eq("id", selectedId)
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, status: "closed" } : c))
    )
  }

  const contactName = selectedConv
    ? selectedConv.display_name && selectedConv.display_name !== selectedConv.phone_number
      ? selectedConv.display_name
      : `+${selectedConv.phone_number}`
    : null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-3.5rem-2rem)] lg:h-[calc(100vh-3.5rem-3rem)] overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      {/* ── Left panel: conversation list ─────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col border-r border-border",
          // On mobile: full width when showing list, hidden when showing chat
          showChat ? "hidden md:flex md:w-80 lg:w-96" : "flex w-full md:w-80 lg:w-96"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="font-semibold text-base">WhatsApp Minorista</h2>
          <button
            onClick={loadConversations}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            title="Actualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Filter tabs */}
        <FilterTabs
          active={filterTab}
          onChange={setFilterTab}
          unreadCount={unreadCount}
          escalatedCount={escalatedCount}
        />

        {/* List */}
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
                key={conv.id}
                conv={conv}
                selected={conv.id === selectedId}
                onClick={() => selectConversation(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: chat view ────────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col flex-1 min-w-0",
          !showChat && "hidden md:flex"
        )}
      >
        {!selectedConv ? (
          <EmptyChat />
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
              {/* Back button (mobile) */}
              <button
                onClick={() => { setShowChat(false); setSelectedId(null) }}
                className="md:hidden p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              {/* Avatar */}
              <div className="h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                {initials(selectedConv.display_name, selectedConv.phone_number)}
              </div>

              {/* Name + status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{contactName}</span>
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      STATUS_COLOR[selectedConv.status] ?? "bg-gray-400"
                    )}
                    title={STATUS_LABEL[selectedConv.status]}
                  />
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>+{selectedConv.phone_number}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {selectedConv.status === "escalated" && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-[11px]">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Escalada
                  </Badge>
                )}
                {selectedConv.status !== "closed" && (
                  <button
                    onClick={closeConversation}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                    title="Cerrar conversación"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-muted/10">
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm mt-8">
                  No hay mensajes todavía
                </p>
              ) : (
                messages.map((msg) => <MsgBubble key={msg.id} msg={msg} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
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
                disabled={selectedConv.status === "closed"}
              />
              <Button
                size="icon"
                onClick={sendReply}
                disabled={!replyText.trim() || sending || selectedConv.status === "closed"}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 w-10 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {selectedConv.status === "closed" && (
              <p className="text-center text-xs text-muted-foreground pb-2">
                Conversación cerrada — no se pueden enviar mensajes
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
