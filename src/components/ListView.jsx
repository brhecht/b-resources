import { useState } from "react"
import { getTagColor } from "./tagColors"

function fileIcon(type) {
  if (!type) return "📄"
  if (type.startsWith("image/")) return "🖼️"
  if (type === "application/pdf") return "📋"
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return "📊"
  if (type.includes("word") || type.includes("document")) return "📝"
  if (type.includes("zip") || type.includes("archive")) return "🗜️"
  if (type.includes("video")) return "🎬"
  if (type.includes("audio")) return "🎵"
  return "📄"
}

function fmtDate(ts) {
  if (!ts) return ""
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function ListView({ items, groups, onView, onEdit, onDelete, onPin, accentColor = "#7B8FA8", borderColor = "#E2E8F0", mutedColor = "#6B7A99", userEmail }) {
  const [sortKey, setSortKey] = useState("createdAt")
  const [sortDir, setSortDir] = useState("desc")

  const groupMap = {}
  ;(groups || []).forEach(g => { groupMap[g.id] = g })

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sorted = [...items].sort((a, b) => {
    // Pinned items always first
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    const dir = sortDir === "asc" ? 1 : -1
    const aVal = a[sortKey] || ""
    const bVal = b[sortKey] || ""
    if (sortKey === "createdAt") {
      const aTime = aVal?.toDate ? aVal.toDate().getTime() : new Date(aVal).getTime() || 0
      const bTime = bVal?.toDate ? bVal.toDate().getTime() : new Date(bVal).getTime() || 0
      return (aTime - bTime) * dir
    }
    const aStr = (typeof aVal === "string" ? aVal : (a.title || a.name || "")).toLowerCase()
    const bStr = (typeof bVal === "string" ? bVal : (b.title || b.name || "")).toLowerCase()
    return aStr.localeCompare(bStr) * dir
  })

  const columns = [
    { key: "title", label: "Name", flex: 3 },
    { key: "groupId", label: "Group", flex: 1.5 },
    { key: "tags", label: "Tags", flex: 2 },
    { key: "createdAt", label: "Date Added", flex: 1.2 },
    { key: "fileType", label: "Type", flex: 0.8 },
  ]

  const sortArrow = (key) => {
    if (sortKey !== key) return ""
    return sortDir === "asc" ? " ▲" : " ▼"
  }

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 12, overflow: "hidden", background: "#fff" }}>
      {/* Header */}
      <div style={{ display: "flex", background: "#F9FAFB", borderBottom: `1px solid ${borderColor}`, padding: "10px 16px", gap: 12 }}>
        {columns.map(col => (
          <div
            key={col.key}
            onClick={() => handleSort(col.key)}
            style={{ flex: col.flex, fontSize: 12, fontWeight: 600, color: "#6B7280", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
          >
            {col.label}{sortArrow(col.key)}
          </div>
        ))}
        <div style={{ width: 60 }} />
      </div>

      {/* Rows */}
      {sorted.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: mutedColor, fontSize: 14 }}>No items found.</div>
      ) : (
        sorted.map(item => {
          const title = item.title || item.name || "Untitled"
          const group = groupMap[item.groupId]
          const tags = item.tags || []

          return (
            <div
              key={item.id}
              onClick={() => onView(item)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 16px",
                gap: 12,
                borderBottom: `1px solid ${borderColor}`,
                cursor: "pointer",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ flex: 3, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                {(() => { const meta = item._msgMeta; const ek = userEmail ? userEmail.replace(/\./g, "_") : ""; return meta?.lastAt && ek && !meta.readBy?.[ek] ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB", flexShrink: 0 }} /> : null })()}
                <span style={{ fontSize: 16, flexShrink: 0 }}>{fileIcon(item.fileType)}</span>
                <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                {item.pinned && <span style={{ fontSize: 12 }}>★</span>}
              </div>

              <div style={{ flex: 1.5, minWidth: 0 }}>
                {group ? (
                  <span style={{ background: group.color + "22", color: group.color, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>
                    {group.icon} {group.name}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>—</span>
                )}
              </div>

              <div style={{ flex: 2, display: "flex", gap: 4, flexWrap: "wrap", minWidth: 0 }}>
                {tags.slice(0, 3).map(t => {
                  const tc = getTagColor(t)
                  return <span key={t} style={{ background: tc.bg, color: tc.text, fontSize: 10, padding: "1px 6px", borderRadius: 8, whiteSpace: "nowrap" }}>{t}</span>
                })}
              </div>

              <div style={{ flex: 1.2, fontSize: 12, color: mutedColor, whiteSpace: "nowrap" }}>
                {fmtDate(item.createdAt)}
              </div>

              <div style={{ flex: 0.8, fontSize: 11, color: mutedColor, whiteSpace: "nowrap" }}>
                {item.fileType ? item.fileType.split("/")[1]?.toUpperCase() || item.fileType : "—"}
              </div>

              <div style={{ width: 60, display: "flex", gap: 4, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                {onPin && (
                  <button onClick={() => onPin(item)} title={item.pinned ? "Unpin" : "Pin"} style={{ background: "none", border: "none", color: item.pinned ? "#F59E0B" : "#CBD5E1", cursor: "pointer", fontSize: 13, padding: 0 }}>
                    {item.pinned ? "★" : "☆"}
                  </button>
                )}
                <button onClick={() => onEdit(item)} title="Edit" style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 13, padding: 0 }}>✏️</button>
                <button onClick={() => onDelete(item)} title="Delete" style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
