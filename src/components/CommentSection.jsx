import { useState, useEffect, useRef } from "react"
import { db } from "../firebase"
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore"

const TEAM = [
  { name: "Brian", email: "brhnyc1970@gmail.com" },
  { name: "Nico", email: "nico@humbleconviction.com" },
]

const MENTION_COLOR = "#6366F1"

async function notifyMention(mentionedName, resourceTitle, commentText, resourceUrl) {
  if (mentionedName === "Brian") {
    try {
      await fetch("https://brain-inbox-six.vercel.app/api/handoff-notify", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          project: "B Resources",
          summary: `\u{1F4AC} You were mentioned in "${resourceTitle}": "${commentText.slice(0, 200)}" \u2014 View: ${resourceUrl}`,
          recipient: "brhnyc1970@gmail.com",
          recipientSlackId: "U096WPV71KK",
          dmOnly: true,
        }),
      })
    } catch (e) {
      console.error("Failed to send mention notification:", e)
    }
  }
}

function timeAgo(date) {
  if (!date) return ""
  const now = Date.now()
  const ts = date instanceof Date ? date.getTime() : date?.toDate?.()?.getTime?.() || date?.seconds * 1000
  if (!ts) return ""
  const diff = Math.floor((now - ts) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return Math.floor(diff / 60) + "m ago"
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago"
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago"
  return new Date(ts).toLocaleDateString()
}

function renderText(text) {
  const parts = text.split(/(@\w+)/g)
  return parts.map((part, i) => {
    if (/^@\w+$/.test(part)) {
      return (
        <span key={i} style={{ background: MENTION_COLOR + "18", color: MENTION_COLOR, fontWeight: 600, padding: "1px 6px", borderRadius: 6, fontSize: 13 }}>
          {part}
        </span>
      )
    }
    return part
  })
}

export function CollapsibleComments({ collectionName, docId, user, resourceTitle, accentColor }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const accent = accentColor || "#7B8FA8"

  useEffect(() => {
    const q = query(
      collection(db, collectionName, docId, "comments"),
      orderBy("createdAt", "asc")
    )
    const unsub = onSnapshot(q, snap => setCount(snap.size))
    return unsub
  }, [collectionName, docId])

  return (
    <div style={{ marginTop: 24, borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
          color: accent, display: "flex", alignItems: "center", gap: 8, padding: 0,
        }}
      >
        <span style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>&#9654;</span>
        Comments
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
        <CommentSection collectionName={collectionName} docId={docId} user={user} resourceTitle={resourceTitle} accentColor={accentColor} />
      )}
    </div>
  )
}

export default function CommentSection({ collectionName, docId, user, resourceTitle, accentColor }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState("")
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const accent = accentColor || "#7B8FA8"

  useEffect(() => {
    const q = query(
      collection(db, collectionName, docId, "comments"),
      orderBy("createdAt", "asc")
    )
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => {
      console.error("Comments listener error:", err)
    })
    return unsub
  }, [collectionName, docId])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [comments.length])

  function handleInput(e) {
    const val = e.target.value
    setText(val)

    const cursor = e.target.selectionStart
    const before = val.slice(0, cursor)
    const atMatch = before.match(/@(\w*)$/)
    if (atMatch) {
      setShowMentions(true)
      setMentionFilter(atMatch[1].toLowerCase())
    } else {
      setShowMentions(false)
      setMentionFilter("")
    }
  }

  function insertMention(name) {
    const cursor = inputRef.current.selectionStart
    const before = text.slice(0, cursor)
    const after = text.slice(cursor)
    const replaced = before.replace(/@\w*$/, `@${name} `)
    setText(replaced + after)
    setShowMentions(false)
    setMentionFilter("")
    setTimeout(() => {
      inputRef.current?.focus()
      const pos = replaced.length
      inputRef.current.setSelectionRange(pos, pos)
    }, 0)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    try {
      const mentions = [...new Set((trimmed.match(/@(\w+)/g) || []).map(m => m.slice(1)))]
      const resourceUrl = `https://b-resources.vercel.app/${collectionName === "library" ? "library" : "vault"}#${docId}`

      await addDoc(collection(db, collectionName, docId, "comments"), {
        text: trimmed,
        authorUid: user.uid,
        authorName: user.displayName || user.email?.split("@")[0] || "Unknown",
        authorEmail: user.email || "",
        mentions,
        createdAt: serverTimestamp(),
      })

      for (const name of mentions) {
        await notifyMention(name, resourceTitle || "a resource", trimmed, resourceUrl)
      }

      setText("")
      setShowMentions(false)
    } catch (e) {
      console.error("Failed to post comment:", e)
      alert("Failed to post comment.")
    }
    setSending(false)
  }

  const filteredTeam = TEAM.filter(m => m.name.toLowerCase().startsWith(mentionFilter))

  return (
    <div style={{ marginTop: 16 }}>
      {comments.length > 0 && (
        <div ref={listRef} style={{ maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: accent + "22", color: accent,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700,
                flexShrink: 0,
              }}>
                {(c.authorName || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{c.authorName}</span>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>{timeAgo(c.createdAt)}</span>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5, wordBreak: "break-word" }}>
                  {renderText(c.text)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, position: "relative" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            ref={inputRef}
            value={text}
            onChange={handleInput}
            placeholder="Add a comment... use @ to mention"
            style={{
              width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 8,
              fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
            }}
            onKeyDown={e => {
              if (e.key === "Escape") setShowMentions(false)
            }}
          />
          {showMentions && filteredTeam.length > 0 && (
            <div style={{
              position: "absolute", bottom: "100%", left: 0, marginBottom: 4,
              background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)", overflow: "hidden", zIndex: 10,
            }}>
              {filteredTeam.map(m => (
                <div
                  key={m.name}
                  onClick={() => insertMention(m.name)}
                  style={{
                    padding: "8px 14px", cursor: "pointer", fontSize: 13,
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: "50%", background: accent + "22", color: accent,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                  }}>
                    {m.name[0]}
                  </span>
                  <span style={{ fontWeight: 600 }}>{m.name}</span>
                  <span style={{ color: "#94A3B8", fontSize: 12 }}>{m.email}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={sending || !text.trim()}
          style={{
            background: accent, color: "#fff", border: "none", borderRadius: 8,
            padding: "8px 16px", cursor: sending || !text.trim() ? "not-allowed" : "pointer",
            fontWeight: 600, fontSize: 13, opacity: sending || !text.trim() ? 0.5 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  )
}
