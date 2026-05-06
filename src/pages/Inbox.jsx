import { useState, useEffect, useMemo } from "react"
import { db } from "../firebase"
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  deleteDoc,
  updateDoc,
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore"

const ACCENT = "#7B8FA8"
const BG = "#F6F8FA"
const MUTED = "#6B7A99"
const BORDER = "#E2E8F0"

const SECTIONS = [
  { key: "library", label: "Library", emoji: "📚", color: "#7B8FA8" },
  { key: "vault", label: "Vault", emoji: "🔒", color: "#A89078" },
  { key: "references", label: "References", emoji: "🌐", color: "#5B9E8F" },
]
const SECTION_MAP = Object.fromEntries(SECTIONS.map((s) => [s.key, s]))

const TYPE_ICONS = {
  youtube: "🎬",
  linkedin: "💼",
  twitter: "🐦",
  github: "🐙",
  blog: "📝",
  podcast: "🎙",
  webpage: "🌐",
  file: "📎",
  text: "📝",
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
  const [bySection, setBySection] = useState({ library: [], vault: [], references: [] })
  const [filter, setFilter] = useState("all") // all | library | vault | references | untagged
  const [selected, setSelected] = useState(null)
  const [tagDraft, setTagDraft] = useState("")

  // Subscribe to last 50 of each collection
  useEffect(() => {
    const unsubs = SECTIONS.map((s) => {
      const q = query(collection(db, s.key), orderBy("createdAt", "desc"), limit(50))
      return onSnapshot(q, (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, _section: s.key, ...d.data() }))
        setBySection((prev) => ({ ...prev, [s.key]: items }))
      })
    })
    return () => unsubs.forEach((u) => u())
  }, [])

  // Merge + sort + filter
  const items = useMemo(() => {
    const merged = [...bySection.library, ...bySection.vault, ...bySection.references]
    merged.sort((a, b) => {
      const am = a.createdAt?.toMillis?.() || 0
      const bm = b.createdAt?.toMillis?.() || 0
      return bm - am
    })
    if (filter === "all") return merged
    if (filter === "untagged") return merged.filter((i) => !i.tags || i.tags.length === 0)
    return merged.filter((i) => i._section === filter)
  }, [bySection, filter])

  const counts = useMemo(
    () => ({
      all: bySection.library.length + bySection.vault.length + bySection.references.length,
      library: bySection.library.length,
      vault: bySection.vault.length,
      references: bySection.references.length,
      untagged: [...bySection.library, ...bySection.vault, ...bySection.references].filter(
        (i) => !i.tags || i.tags.length === 0
      ).length,
    }),
    [bySection]
  )

  // Move item to a different section (copy then delete)
  async function handleMove(item, targetSection) {
    if (item._section === targetSection) return
    try {
      const { id, _section, ...data } = item
      await setDoc(doc(db, targetSection, id), { ...data, updatedAt: serverTimestamp() })
      await deleteDoc(doc(db, _section, id))
      setSelected(null)
    } catch (err) {
      console.error("Move failed:", err)
      alert("Move failed: " + err.message)
    }
  }

  // Add a tag (comma or enter to commit)
  async function handleAddTag(item) {
    const raw = tagDraft.trim().replace(/,$/, "")
    if (!raw) return
    const newTags = Array.from(new Set([...(item.tags || []), ...raw.split(",").map((t) => t.trim()).filter(Boolean)]))
    try {
      await updateDoc(doc(db, item._section, item.id), { tags: newTags, updatedAt: serverTimestamp() })
      setTagDraft("")
    } catch (err) {
      console.error("Tag update failed:", err)
    }
  }

  async function handleRemoveTag(item, tag) {
    const newTags = (item.tags || []).filter((t) => t !== tag)
    try {
      await updateDoc(doc(db, item._section, item.id), { tags: newTags, updatedAt: serverTimestamp() })
    } catch (err) {
      console.error("Tag remove failed:", err)
    }
  }

  async function handleDelete(item) {
    if (!confirm("Delete this item permanently?")) return
    try {
      await deleteDoc(doc(db, item._section, item.id))
      setSelected(null)
    } catch (err) {
      console.error("Delete failed:", err)
    }
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: BG, minHeight: "100vh", color: "#1A1A2E" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 32px 64px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <a
            href="/"
            style={{
              width: 36, height: 36, borderRadius: 10, background: ACCENT + "18",
              display: "flex", alignItems: "center", justifyContent: "center",
              textDecoration: "none", color: ACCENT, fontSize: 16,
            }}
          >&#8592;</a>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>
              Inbox
            </h1>
            <p style={{ fontSize: 13, color: MUTED, margin: "2px 0 0" }}>
              Recently captured across Library, Vault, and References. Tag, move, or delete.
            </p>
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ background: ACCENT + "18", color: ACCENT, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>
            {items.length} shown
          </span>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { key: "all", label: "All" },
            ...SECTIONS.map((s) => ({ key: s.key, label: `${s.emoji} ${s.label}`, color: s.color })),
            { key: "untagged", label: "Untagged" },
          ].map((p) => {
            const active = filter === p.key
            return (
              <button
                key={p.key}
                onClick={() => setFilter(p.key)}
                style={{
                  background: active ? (p.color || ACCENT) : "#fff",
                  color: active ? "#fff" : (p.color || "#475569"),
                  border: `1px solid ${active ? (p.color || ACCENT) : BORDER}`,
                  borderRadius: 20,
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {p.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{counts[p.key] ?? 0}</span>
              </button>
            )
          })}
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: MUTED }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📥</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nothing here yet</div>
            <div style={{ fontSize: 14 }}>
              Drop a link or file in #b-resources. The bot will route it and it shows up here.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item) => {
              const section = SECTION_MAP[item._section]
              const url = item.url || item.fileUrl || (item.urls?.[0] ?? "")
              const typeIcon = TYPE_ICONS[item.contentType] || section.emoji
              const isOpen = selected?.id === item.id && selected?._section === item._section
              return (
                <div
                  key={`${item._section}-${item.id}`}
                  onClick={() => setSelected(isOpen ? null : item)}
                  style={{
                    background: "#fff",
                    border: `1px solid ${isOpen ? section.color : BORDER}`,
                    borderRadius: 12,
                    padding: "16px 20px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{typeIcon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title || url || "Untitled"}
                      </div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {url || item.description?.slice(0, 80) || ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                      <span style={{
                        background: section.color + "18", color: section.color,
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12,
                      }}>
                        {section.emoji} {section.label}
                      </span>
                      {(item.tags || []).slice(0, 2).map((t) => (
                        <span key={t} style={{ background: ACCENT + "14", color: ACCENT, fontSize: 10, padding: "2px 7px", borderRadius: 10 }}>{t}</span>
                      ))}
                      <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 4 }}>{timeAgo(item.createdAt)}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: 14, borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                      {item.description && item.description !== item.title && (
                        <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.5, marginBottom: 12 }}>
                          {item.description}
                        </p>
                      )}

                      {/* Tag editor */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Tags
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {(item.tags || []).map((t) => (
                            <span
                              key={t}
                              onClick={(e) => { e.stopPropagation(); handleRemoveTag(item, t) }}
                              style={{
                                background: ACCENT + "14", color: ACCENT,
                                fontSize: 12, padding: "3px 10px", borderRadius: 12,
                                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                              }}
                              title="Click to remove"
                            >
                              {t} <span style={{ opacity: 0.5 }}>×</span>
                            </span>
                          ))}
                          <input
                            type="text"
                            placeholder="add tag…"
                            value={tagDraft}
                            onChange={(e) => setTagDraft(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === ",") {
                                e.preventDefault()
                                handleAddTag(item)
                              }
                            }}
                            style={{
                              border: `1px solid ${BORDER}`, borderRadius: 12,
                              padding: "3px 10px", fontSize: 12, outline: "none",
                              background: "#fff", minWidth: 80,
                            }}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              background: "#F1F5F9", color: "#475569", border: `1px solid ${BORDER}`,
                              borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600,
                              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                            }}
                          >
                            ↗ Open
                          </a>
                        )}
                        {SECTIONS.filter((s) => s.key !== item._section).map((s) => (
                          <button
                            key={s.key}
                            onClick={(e) => { e.stopPropagation(); handleMove(item, s.key) }}
                            style={{
                              background: s.color + "18", color: s.color, border: `1px solid ${s.color}44`,
                              borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                            }}
                          >
                            {s.emoji} → {s.label}
                          </button>
                        ))}
                        <div style={{ flex: 1 }} />
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(item) }}
                          style={{
                            background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA",
                            borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
