import { useState, useRef, useEffect } from "react"

export default function InlineNotes({ value = "", onSave, accentColor = "#7B8FA8", mutedColor = "#6B7A99" }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  const textareaRef = useRef(null)

  useEffect(() => { setText(value) }, [value])

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"
    }
  }, [editing])

  function handleBlur() {
    setEditing(false)
    const trimmed = text.trim()
    if (trimmed !== (value || "").trim()) {
      onSave(trimmed)
    }
  }

  function handleInput(e) {
    setText(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = e.target.scrollHeight + "px"
  }

  if (editing) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: mutedColor, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Notes</div>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onBlur={handleBlur}
          onKeyDown={e => { if (e.key === "Escape") { setText(value); setEditing(false) } }}
          style={{
            width: "100%",
            minHeight: 60,
            padding: "10px 12px",
            border: `1px solid ${accentColor}44`,
            borderRadius: 8,
            fontSize: 14,
            lineHeight: 1.5,
            color: "#1F2937",
            background: "#FAFBFC",
            resize: "vertical",
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
          placeholder="Add notes..."
        />
        <div style={{ fontSize: 10, color: mutedColor, marginTop: 2, opacity: 0.6 }}>Click outside to save · Esc to cancel</div>
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        marginBottom: 16,
        cursor: "pointer",
        borderRadius: 8,
        padding: value ? "10px 12px" : "8px 12px",
        border: `1px dashed ${value ? "transparent" : accentColor + "44"}`,
        background: value ? "#FAFBFC" : "transparent",
        transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: mutedColor, marginBottom: value ? 4 : 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Notes</div>
      {value ? (
        <p style={{ fontSize: 14, color: "#374151", margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{value}</p>
      ) : (
        <p style={{ fontSize: 13, color: mutedColor, margin: 0, opacity: 0.6, fontStyle: "italic" }}>Click to add notes...</p>
      )}
    </div>
  )
}
