import { useState } from "react"
import { getTagColor } from "./tagColors"

const VISIBLE_COUNT = 15

export default function TagFilter({ allTags = [], activeTags = [], onToggle, onClear, accentColor = "#2563EB" }) {
  const [expanded, setExpanded] = useState(false)

  if (allTags.length === 0) return null

  const visible = expanded ? allTags : allTags.slice(0, VISIBLE_COUNT)
  const hasMore = allTags.length > VISIBLE_COUNT

  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      alignItems: "center",
      padding: "8px 0",
    }}>
      {visible.map(tag => {
        const active = activeTags.includes(tag)
        const color = getTagColor(tag)
        return (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 12px",
              borderRadius: "9999px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              border: active ? "none" : `1.5px solid ${color.text}33`,
              background: active ? color.bg : "transparent",
              color: color.text,
              opacity: active ? 1 : 0.7,
              transition: "all 0.15s ease",
            }}
          >
            {tag}
          </button>
        )
      })}

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: "4px 12px",
            borderRadius: "9999px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            border: "1px dashed #9CA3AF",
            background: "transparent",
            color: "#6B7280",
          }}
        >
          {expanded ? "Show less" : `+${allTags.length - VISIBLE_COUNT} more`}
        </button>
      )}

      {activeTags.length > 0 && (
        <button
          onClick={onClear}
          style={{
            padding: "4px 12px",
            borderRadius: "9999px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            border: "none",
            background: "#FEE2E2",
            color: "#DC2626",
          }}
        >
          Clear all
        </button>
      )}
    </div>
  )
}
