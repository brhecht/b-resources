import { useState, useEffect, useRef, useCallback } from "react"
import { subscribeMessages, addMessage, updateMsgMeta, markMsgMetaRead } from "../firebase"
import { getUserByEmail, getUserByHandle, parseMentions, getAllHandles } from "../users"

const NOTIFY_ENDPOINT = "/api/notify"

function formatTime(ts) {
  if (!ts) return ""
  const d = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24))
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  if (diffDays === 0) return time
  if (diffDays === 1) return `Yesterday ${time}`
  if (diffDays < 7) return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${time}`
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`
}

/**
 * MessageThread — iMessage-style chat for a resource.
 *
 * Props:
 *   collectionName — "library" or "vault"
 *   docId          — Firestore doc ID
 *   user           — Firebase auth user object
 *   resourceTitle  — for notification context
 *   accentColor    — page accent color
 */
export default function MessageThread({ collectionName, docId, user, resourceTitle, accentColor }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState("")
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState("")
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const accent = accentColor || "#2563EB"

  const currentUser = getUserByEmail(user?.email)
  const handles = getAllHandles()

  // Subscribe to messages
  useEffect(() => {
    if (!collectionName || !docId) return
    const unsub = subscribeMessages(collectionName, docId, (msgs) => {
      setMessages(msgs)
    })
    return unsub
  }, [collectionName, docId])

  // Mark as read when thread opens or new messages arrive
  useEffect(() => {
    if (!collectionName || !docId || !user?.email) return
    markMsgMetaRead(collectionName, docId, user.email).catch(() => {})
  }, [collectionName, docId, user?.email, messages.length])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  // Send message
  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || !user?.email) return

    const mentions = parseMentions(text)
    const msg = {
      text,
      authorEmail: user.email,
      authorName: currentUser?.displayName || user.displayName || user.email.split("@")[0],
      mentions,
      timestamp: Date.now(),
      readBy: { [user.email.replace(/\./g, "_")]: true },
    }

    setDraft("")
    setShowMentions(false)

    try {
      await addMessage(collectionName, docId, msg)
      await updateMsgMeta(collectionName, docId, user.email)

      // Notify mentioned users (except self)
      for (const handle of mentions) {
        const mentioned = getUserByHandle(handle)
        if (mentioned && mentioned.email !== user.email) {
          const section = collectionName
          const resourceUrl = `https://b-resources.vercel.app/${section}#${docId}`
          const preview = text.length > 200 ? text.slice(0, 200) + "\u2026" : text
          const payload = `\u{1F4AC} ${msg.authorName} in B Resources: "${resourceTitle}"\n${preview}\n\u2192 ${resourceUrl}`
          fetch(NOTIFY_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              project: "B Resources",
              summary: payload,
              recipient: mentioned.email,
              recipientSlackId: mentioned.slackUserId,
            }),
          }).catch((err) => console.error("Notify failed:", err))
        }
      }
    } catch (err) {
      console.error("Send message failed:", err)
      setDraft(text)
    }
  }, [draft, user, currentUser, collectionName, docId, resourceTitle])

  // Input change — detect @ for autocomplete
  const handleInputChange = (e) => {
    const val = e.target.value
    setDraft(val)
    const cursor = e.target.selectionStart
    const textBefore = val.slice(0, cursor)
    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) {
      setShowMentions(true)
      setMentionFilter(atMatch[1].toLowerCase())
    } else {
      setShowMentions(false)
    }
  }

  // Insert @mention
  const insertMention = (handle) => {
    const cursor = inputRef.current?.selectionStart || draft.length
    const textBefore = draft.slice(0, cursor)
    const textAfter = draft.slice(cursor)
    const replaced = textBefore.replace(/@\w*$/, `@${handle} `)
    setDraft(replaced + textAfter)
    setShowMentions(false)
    inputRef.current?.focus()
  }

  // Keyboard: Enter to send, Shift+Enter for newline, Escape to close mentions
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setShowMentions(false)
      return
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      handleSend()
    }
  }

  // Filter handles for autocomplete
  const filteredHandles = handles.filter(
    (h) => h.handle.startsWith(mentionFilter) && h.handle !== currentUser?.handle
  )

  // Render @mentions as styled spans
  const renderText = (text, isOwn) => {
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, i) => {
      if (/^@\w+$/.test(part)) {
        const mentioned = getUserByHandle(part.slice(1))
        return (
          <span key={i} style={{
            fontWeight: 600,
            color: isOwn ? "#BFDBFE" : (mentioned?.color || "#2563EB"),
          }}>
            {part}
          </span>
        )
      }
      return part
    })
  }

  const isOwnMessage = (msg) => msg.authorEmail === user?.email

  return (
    <div style={{ display: "flex", flexDirection: "column", maxHeight: 360 }}>
      {/* Message thread */}
      {messages.length > 0 && (
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", maxHeight: 280, padding: "4px 4px 8px" }}>
          {messages.map((msg) => {
            const own = isOwnMessage(msg)
            const authorUser = getUserByEmail(msg.authorEmail)
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start", marginBottom: 8 }}>
                <div style={{
                  maxWidth: "80%",
                  borderRadius: 16,
                  padding: "8px 12px",
                  ...(own
                    ? { background: "#2563EB", color: "#fff", borderBottomRightRadius: 4 }
                    : { background: "#F1F5F9", color: "#1E293B", borderBottomLeftRadius: 4 }
                  ),
                }}>
                  {!own && (
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2, color: authorUser?.color || "#7C3AED" }}>
                      {msg.authorName}
                    </div>
                  )}
                  <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {own ? msg.text : renderText(msg.text, own)}
                  </div>
                  <div style={{ fontSize: 10, marginTop: 4, color: own ? "#93C5FD" : "#94A3B8" }}>
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {messages.length === 0 && (
        <div style={{ padding: "12px 0", fontSize: 13, color: "#94A3B8", textAlign: "center" }}>
          No messages yet. Use @ to mention someone.
        </div>
      )}

      {/* Input bar */}
      <div style={{ position: "relative", ...(messages.length > 0 ? { borderTop: "1px solid #E2E8F0", paddingTop: 8 } : {}) }}>
        {/* @mention autocomplete dropdown */}
        {showMentions && filteredHandles.length > 0 && (
          <div style={{
            position: "absolute", bottom: "100%", left: 0, marginBottom: 4,
            background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)", overflow: "hidden", zIndex: 10,
          }}>
            {filteredHandles.map((h) => (
              <div
                key={h.handle}
                onClick={() => insertMention(h.handle)}
                style={{
                  padding: "8px 14px", cursor: "pointer", fontSize: 13,
                  display: "flex", alignItems: "center", gap: 8,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#F8FAFC"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff",
                  background: h.color,
                }}>
                  {h.displayName[0]}
                </span>
                <span style={{ fontWeight: 600 }}>@{h.handle}</span>
                <span style={{ color: "#94A3B8", fontSize: 12 }}>{h.displayName}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message\u2026 use @ to mention"
            rows={1}
            style={{
              flex: 1, border: "1px solid #E2E8F0", borderRadius: 12,
              padding: "8px 12px", fontSize: 14, outline: "none",
              resize: "none", fontFamily: "inherit", minHeight: 36, maxHeight: 80,
              boxSizing: "border-box", lineHeight: 1.4,
            }}
            onFocus={(e) => e.target.style.borderColor = accent}
            onBlur={(e) => e.target.style.borderColor = "#E2E8F0"}
            onInput={(e) => {
              e.target.style.height = "36px"
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px"
            }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim()}
            style={{
              background: draft.trim() ? "#2563EB" : "#F1F5F9",
              color: draft.trim() ? "#fff" : "#94A3B8",
              border: "none", borderRadius: 12, padding: "8px 14px",
              cursor: draft.trim() ? "pointer" : "not-allowed",
              fontWeight: 600, fontSize: 13, whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * CollapsibleMessages — drop-in replacement for CollapsibleComments.
 * Shows message count, unread indicator, and expands to MessageThread.
 */
export function CollapsibleMessages({ collectionName, docId, user, resourceTitle, accentColor }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const accent = accentColor || "#7B8FA8"

  useEffect(() => {
    if (!collectionName || !docId) return
    const unsub = subscribeMessages(collectionName, docId, (msgs) => {
      setCount(msgs.length)
    })
    return unsub
  }, [collectionName, docId])

  return (
    <div style={{ marginTop: 24, borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
          color: accent, display: "flex", alignItems: "center", gap: 8, padding: 0,
        }}
      >
        <span style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>&#9654;</span>
        Messages
        {count > 0 && (
          <span style={{
            background: accent + "22", color: accent, fontSize: 11, fontWeight: 700,
            padding: "1px 7px", borderRadius: 10, minWidth: 18, textAlign: "center",
          }}>
            {count}
          </span>
        )}
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          <MessageThread
            collectionName={collectionName}
            docId={docId}
            user={user}
            resourceTitle={resourceTitle}
            accentColor={accentColor}
          />
        </div>
      )}
    </div>
  )
}
