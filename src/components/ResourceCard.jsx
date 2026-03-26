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

export default function ResourceCard({ item, group, onView, onEdit, onDelete, onPin, accentColor = "#7B8FA8", borderColor = "#E2E8F0", mutedColor = "#6B7A99" }) {
  const [hovered, setHovered] = useState(false)

  const title = item.title || item.name || "Untitled"
  const description = item.description || ""
  const tags = item.tags || []
  const isImage = item.fileType?.startsWith("image/")

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff",
        border: `1px solid ${hovered ? accentColor : borderColor}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "all 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? `0 4px 16px ${accentColor}1A` : "none",
      }}
    >
      {isImage && item.fileUrl && (
        <div onClick={onView} style={{ cursor: "pointer", height: 120, overflow: "hidden", background: "#F8FAFC", borderBottom: `1px solid ${borderColor}` }}>
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
          {hovered && (
            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
              {onPin && (
                <button onClick={e => { e.stopPropagation(); onPin() }} title={item.pinned ? "Unpin" : "Pin"} style={{ background: "none", border: "none", color: item.pinned ? "#F59E0B" : "#CBD5E1", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>
                  {item.pinned ? "★" : "☆"}
                </button>
              )}
              <button onClick={e => { e.stopPropagation(); onEdit() }} title="Edit" style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>✏️</button>
              <button onClick={e => { e.stopPropagation(); onDelete() }} title="Delete" style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
            </div>
          )}
        </div>

        <div onClick={onView} style={{ cursor: "pointer" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", lineHeight: 1.3, wordBreak: "break-word" }}>{title}</h3>
          {description && (
            <p style={{ fontSize: 12, color: mutedColor, margin: "0 0 8px", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {description}
            </p>
          )}
          {item.fileUrl && !isImage && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6, fontSize: 11, color: mutedColor }}>
              <span>{fileIcon(item.fileType)}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.fileName}</span>
            </div>
          )}
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {tags.slice(0, 3).map(t => {
                const tc = getTagColor(t)
                return <span key={t} style={{ background: tc.bg, color: tc.text, fontSize: 10, padding: "2px 7px", borderRadius: 10 }}>{t}</span>
              })}
              {tags.length > 3 && <span style={{ fontSize: 10, color: mutedColor, padding: "2px 4px" }}>+{tags.length - 3}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
