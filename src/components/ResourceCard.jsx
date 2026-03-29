import { useState } from "react"
import { getTagColor } from "./tagColors"

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
  if (!ts) return ""
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function displayTitle(item) {
  if (item.title) return item.title
  const name = item.name || "Untitled"
  if (/\.[a-z0-9]{1,5}$/i.test(name)) {
    return name.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }
  return name
}

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

export default function ResourceCard({ item, group, onView, onEdit, onDelete, onPin, accentColor = "#7B8FA8", borderColor = "#E2E8F0", mutedColor = "#6B7A99", userEmail }) {
  const [hovered, setHovered] = useState(false)

  const title = displayTitle(item)
  const description = item.description || ""
  const tags = item.tags || []
  const isImage = item.fileType?.startsWith("image/")

  // Unread message indicator
  const meta = item._msgMeta
  const emailKey = userEmail ? userEmail.replace(/\./g, "_") : ""
  const hasUnread = meta?.lastAt && emailKey && !meta.readBy?.[emailKey]

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onView}
      style={{
        background: "#fff",
        border: `1px solid ${hovered ? accentColor : borderColor}`,
        borderRadius: 12,
        overflow: "visible",
        transition: "all 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? `0 4px 16px ${accentColor}1A` : "none",
        cursor: "pointer",
        position: "relative",
      }}
    >
      {hovered && item.summary && (
        <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 6, background: "#1A1A2E", color: "#fff", fontSize: 11, lineHeight: 1.4, padding: "8px 12px", borderRadius: 8, zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", pointerEvents: "none" }}>
          {item.summary}
        </div>
      )}
      {hasUnread && (
        <div style={{
          position: "absolute", top: 8, right: 8, width: 10, height: 10,
          borderRadius: "50%", background: "#2563EB", zIndex: 2,
          boxShadow: "0 0 0 2px #fff",
        }} />
      )}
      {isImage && item.fileUrl && (
        <div style={{ height: 120, overflow: "hidden", background: "#F8FAFC", borderBottom: `1px solid ${borderColor}` }}>
          <img src={item.fileUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
            {!isImage && <span style={{ fontSize: 20, flexShrink: 0 }}>{fileIcon(item.fileType)}</span>}
            {group && (
              <span style={{
                background: group.color + "22",
                color: group.color,
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 10,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}>
                {group.icon} {group.name}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {onPin && (item.pinned || hovered) && (
              <button onClick={e => { e.stopPropagation(); onPin() }} title={item.pinned ? "Unpin" : "Pin"} style={{ background: "none", border: "none", color: item.pinned ? "#F59E0B" : "#CBD5E1", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>
                {item.pinned ? "★" : "☆"}
              </button>
            )}
            {hovered && (
              <>
                <button onClick={e => { e.stopPropagation(); onEdit() }} title="Edit" style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>✏️</button>
                <button onClick={e => { e.stopPropagation(); onDelete() }} title="Delete" style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
              </>
            )}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 2px", lineHeight: 1.3, wordBreak: "break-word" }}>{title}</h3>
          {item.fileUrl && !isImage && item.fileName && (
            <div style={{ fontSize: 11, color: mutedColor, marginBottom: 4, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.fileName}
            </div>
          )}
          {description && (
            <p style={{ fontSize: 12, color: mutedColor, margin: "0 0 8px", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {description}
            </p>
          )}
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {tags.map(t => {
                const tc = getTagColor(t)
                return <span key={t} style={{ background: tc.bg, color: tc.text, fontSize: 10, padding: "2px 7px", borderRadius: 10 }}>{t}</span>
              })}
            </div>
          )}
          {(item.updatedAt || item.createdAt) && (
            <div style={{ fontSize: 10, color: mutedColor, marginTop: 6, opacity: 0.6 }}>
              {timeAgo(item.updatedAt || item.createdAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
