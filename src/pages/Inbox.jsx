import { useState, useEffect } from "react"
import { db } from "../firebase"
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore"

const ACCENT = "#5B8DEF"
const BG = "#F6F8FA"
const MUTED = "#6B7A99"
const BORDER = "#E2E8F0"

const TYPE_ICONS = {
  youtube: "🎬",
  linkedin: "💼",
  email: "📧",
  webpage: "🌐",
}

function timeAgo(ts) {
  if (!ts) return ""
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function Inbox({ user }) {
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [moving, setMoving] = useState(null) // "library" | "vault" | null
  const [moveTarget, setMoveTarget] = useState(null) // the item being moved

  // Real-time listener
  useEffect(() => {
    const q = query(collection(db, "inbox"), orderBy("createdAt", "desc"))
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // Move to Library or Vault
  async function handleMove(item, destination) {
    try {
      const { id, ...data } = item
      // Write to destination collection
      await addDoc(collection(db, destination), {
        title: data.title || data.url,
        description: data.description || "",
        summary: data.summary || "",
        tags: data.tags || [],
        fileUrl: data.url || "",
        fileName: "",
        fileType: "",
        fileSize: 0,
        content: data.note || "",
        pinned: false,
        groupId: "",
        sourceUrl: data.url || "",
        sourceType: data.contentType || "webpage",
        sourceImage: data.image || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      // Remove from inbox
      await deleteDoc(doc(db, "inbox", id))
      setSelected(null)
      setMoving(null)
      setMoveTarget(null)
    } catch (err) {
      console.error("Move failed:", err)
      alert("Failed to move item: " + err.message)
    }
  }

  // Delete from inbox
  async function handleDelete(item) {
    if (!confirm("Remove from inbox?")) return
    try {
      await deleteDoc(doc(db, "inbox", item.id))
      setSelected(null)
    } catch (err) {
      console.error("Delete failed:", err)
    }
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: BG, minHeight: "100vh", color: "#1A1A2E" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 32px 64px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
          <a href="/" style={{ width: 36, height: 36, borderRadius: 10, background: ACCENT + "18", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: ACCENT, fontSize: 16 }}>&#8592;</a>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>
              Inbox
            </h1>
            <p style={{ fontSize: 13, color: MUTED, margin: "2px 0 0" }}>
              Captured links land here. Triage to Library, Vault, or References when ready.
            </p>
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ background: ACCENT + "18", color: ACCENT, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: MUTED }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📥</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Inbox is empty</div>
            <div style={{ fontSize: 14 }}>Use the iOS Shortcut or share menu to capture links here.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelected(selected?.id === item.id ? null : item)}
                style={{
                  background: "#fff",
                  border: `1px solid ${selected?.id === item.id ? ACCENT : BORDER}`,
                  borderRadius: 12,
                  padding: "16px 20px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {/* Row: icon + title + meta + actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>
                    {TYPE_ICONS[item.contentType] || "🌐"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title || item.url}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.url}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                    {(item.tags || []).slice(0, 2).map((t) => (
                      <span key={t} style={{ background: ACCENT + "14", color: ACCENT, fontSize: 10, padding: "2px 7px", borderRadius: 10 }}>{t}</span>
                    ))}
                    <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 4 }}>{timeAgo(item.createdAt)}</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {selected?.id === item.id && (
                  <div style={{ marginTop: 14, borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                    {item.image && (
                      <div style={{ marginBottom: 12, borderRadius: 8, overflow: "hidden", maxHeight: 180 }}>
                        <img src={item.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                    {item.summary && (
                      <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.5, marginBottom: 12 }}>
                        {item.summary}
                      </p>
                    )}
                    {item.note && (
                      <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
                        <strong>Note:</strong> {item.note}
                      </div>
                    )}
                    {(item.tags || []).length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
                        {item.tags.map((t) => (
                          <span key={t} style={{ background: ACCENT + "14", color: ACCENT, fontSize: 11, padding: "2px 8px", borderRadius: 10 }}>{t}</span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          background: "#F1F5F9", color: "#475569", border: `1px solid ${BORDER}`,
                          borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600,
                          textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                        }}
                      >
                        ↗ Open Link
                      </a>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMove(item, "library") }}
                        style={{
                          background: "#7B8FA8" + "18", color: "#7B8FA8", border: `1px solid ${"#7B8FA8"}44`,
                          borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        📚 → Library
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMove(item, "vault") }}
                        style={{
                          background: "#A89078" + "18", color: "#A89078", border: `1px solid ${"#A89078"}44`,
                          borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        🔒 → Vault
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMove(item, "references") }}
                        style={{
                          background: "#5B9E8F" + "18", color: "#5B9E8F", border: `1px solid ${"#5B9E8F"}44`,
                          borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        🌐 → References
                      </button>
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item) }}
                        style={{
                          background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA",
                          borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer",
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
