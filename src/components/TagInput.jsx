import { useState, useRef } from "react"
import { getTagColor } from "./tagColors"

const MAX_TAGS = 10

export default function TagInput({ tags = [], onChange, allTags = [], accentColor = "#2563EB" }) {
  const [input, setInput] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef(null)

  const suggestions = input.trim()
    ? allTags
        .filter(t => t.includes(input.trim().toLowerCase()) && !tags.includes(t))
        .slice(0, 8)
    : allTags.filter(t => !tags.includes(t)).slice(0, 12)

  function addTag(raw) {
    const tag = raw.trim().toLowerCase()
    if (!tag || tags.includes(tag)) return
    if (tags.length >= MAX_TAGS) return
    onChange([...tags, tag])
    setInput("")
    setShowDropdown(false)
  }

  function removeTag(tag) {
    onChange(tags.filter(t => t !== tag))
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(input)
    } else if (e.key === "Backspace" && !input && tags.length) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
        padding: "8px",
        border: "1px solid #D1D5DB",
        borderRadius: "8px",
        background: "#fff",
        minHeight: "42px",
        alignItems: "center",
        cursor: "text",
      }} onClick={() => inputRef.current?.focus()}>
        {tags.map(tag => {
          const color = getTagColor(tag)
          return (
            <span key={tag} style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 8px",
              borderRadius: "9999px",
              fontSize: "13px",
              fontWeight: 500,
              background: color.bg,
              color: color.text,
            }}>
              {tag}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0 2px",
                  fontSize: "14px",
                  lineHeight: 1,
                  color: color.text,
                  opacity: 0.7,
                }}
              >×</button>
            </span>
          )
        })}
        <input
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setShowDropdown(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder={tags.length === 0 ? "Add tags (e.g. investor-facing, draft, template)..." : ""}
          style={{
            border: "none",
            outline: "none",
            flex: 1,
            minWidth: "80px",
            fontSize: "14px",
            background: "transparent",
          }}
        />
      </div>

      {tags.length >= MAX_TAGS && (
        <div style={{ fontSize: "12px", color: "#DC2626", marginTop: "4px" }}>
          Maximum of {MAX_TAGS} tags reached
        </div>
      )}

      {showDropdown && suggestions.length > 0 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          marginTop: "4px",
          background: "#fff",
          border: "1px solid #D1D5DB",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          zIndex: 50,
          maxHeight: "200px",
          overflowY: "auto",
        }}>
          {suggestions.map(tag => {
            const color = getTagColor(tag)
            return (
              <button
                key={tag}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addTag(tag) }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "14px",
                  textAlign: "left",
                }}
              >
                <span style={{
                  padding: "1px 8px",
                  borderRadius: "9999px",
                  fontSize: "12px",
                  background: color.bg,
                  color: color.text,
                }}>{tag}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
