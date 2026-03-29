import { useState, useEffect } from "react"
import TagInput from "./TagInput"
import MarkdownRenderer from "./MarkdownRenderer"

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

function fmtSize(bytes) {
  if (!bytes) return ""
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / 1048576).toFixed(1) + " MB"
}

function isTextFile(fileType, fileName) {
  if (!fileType && !fileName) return false
  const textTypes = ["text/", "application/json", "application/xml", "application/javascript"]
  if (textTypes.some(t => fileType?.startsWith(t) || fileType?.includes(t))) return true
  const textExts = [".md", ".txt", ".json", ".xml", ".csv", ".html", ".htm", ".js", ".jsx", ".ts", ".tsx", ".css", ".yaml", ".yml", ".toml", ".py", ".rb", ".sh"]
  if (fileName && textExts.some(ext => fileName.toLowerCase().endsWith(ext))) return true
  return false
}

function CollapsibleSection({ title, defaultOpen = false, children, accentColor, mutedColor }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "6px 0", fontSize: 12, fontWeight: 600, color: mutedColor, textTransform: "uppercase", letterSpacing: "0.5px", width: "100%" }}
      >
        <span style={{ fontSize: 10, transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
        {title}
      </button>
      {open && <div style={{ paddingTop: 4 }}>{children}</div>}
    </div>
  )
}

export default function SidePanel({
  item,
  onClose,
  onEdit,
  onDelete,
  onPin,
  onTagsChange,
  onNotesChange,
  onGenerateSummary,
  allTags = [],
  groupMap = {},
  collectionName,
  user,
  displayTitle,
  accentColor = "#7B8FA8",
  borderColor = "#E2E8F0",
  mutedColor = "#6B7A99",
  MessagesComponent,
}) {
  const [fetchedContent, setFetchedContent] = useState(null)
  const [fetchingContent, setFetchingContent] = useState(false)

  // Fetch text/markdown content via server proxy (avoids CORS)
  useEffect(() => {
    if (!item) return
    setFetchedContent(null)

    // Library items may have inline content
    if (item.content) {
      setFetchedContent(item.content)
      return
    }

    // Fetch text files from Firebase Storage via proxy
    if (item.fileUrl && isTextFile(item.fileType, item.fileName)) {
      setFetchingContent(true)
      fetch("/api/fetch-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.fileUrl }),
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          setFetchedContent(data.content || null)
          setFetchingContent(false)
        })
        .catch(() => {
          // Fallback: try direct fetch in case CORS is allowed
          fetch(item.fileUrl)
            .then(r => r.ok ? r.text() : Promise.reject())
            .then(text => { setFetchedContent(text); setFetchingContent(false) })
            .catch(() => { setFetchedContent(null); setFetchingContent(false) })
        })
    }
  }, [item?.id])

  if (!item) return null

  const title = displayTitle ? displayTitle(item) : (item.title || item.name || "Untitled")
  const group = groupMap[item.groupId]
  const isMarkdown = item.fileName?.toLowerCase().endsWith(".md") || item.fileType === "text/markdown"

  return (
    <div style={{
      width: 480,
      minWidth: 480,
      height: "100%",
      background: "#fff",
      borderLeft: `1px solid ${borderColor}`,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      boxShadow: "-4px 0 16px rgba(0,0,0,0.06)",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 20px",
        borderBottom: `1px solid ${borderColor}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 18 }}>{fileIcon(item.fileType)}</span>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h3>
          {item.pinned && <span style={{ fontSize: 12 }}>📌</span>}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: mutedColor, padding: "0 4px", lineHeight: 1 }}>×</button>
      </div>

      {/* Single scrollable body — content first, then details */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

        {/* ═══ RENDERED CONTENT (the whole point of this panel) ═══ */}
        {fetchingContent && (
          <div style={{ textAlign: "center", padding: 30, color: mutedColor, fontSize: 13 }}>Loading content...</div>
        )}

        {/* Markdown rendered */}
        {fetchedContent && isMarkdown && (
          <div style={{ background: "#FAFBFC", border: `1px solid ${borderColor}`, borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
            <MarkdownRenderer content={fetchedContent} accentColor={accentColor} />
          </div>
        )}

        {/* Plain text rendered */}
        {fetchedContent && !isMarkdown && (
          <pre style={{ background: "#FAFBFC", border: `1px solid ${borderColor}`, borderRadius: 10, padding: "16px 20px", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", overflow: "auto", margin: "0 0 16px" }}>
            {fetchedContent}
          </pre>
        )}

        {/* Image */}
        {item.fileUrl && item.fileType?.startsWith("image/") && (
          <div style={{ marginBottom: 16, borderRadius: 10, overflow: "hidden", border: `1px solid ${borderColor}` }}>
            <img src={item.fileUrl} alt={item.fileName} style={{ width: "100%", maxHeight: 500, objectFit: "contain", display: "block", background: "#F8FAFC" }} />
          </div>
        )}

        {/* PDF */}
        {item.fileUrl && item.fileType === "application/pdf" && (
          <div style={{ marginBottom: 16, borderRadius: 10, overflow: "hidden", border: `1px solid ${borderColor}` }}>
            <iframe src={item.fileUrl} title={item.fileName} style={{ width: "100%", height: 500, border: "none" }} />
          </div>
        )}

        {/* Video */}
        {item.fileUrl && item.fileType?.startsWith("video/") && (
          <div style={{ marginBottom: 16, borderRadius: 10, overflow: "hidden", border: `1px solid ${borderColor}` }}>
            <video src={item.fileUrl} controls style={{ width: "100%", maxHeight: 400, display: "block", background: "#000" }} />
          </div>
        )}

        {/* Audio */}
        {item.fileUrl && item.fileType?.startsWith("audio/") && (
          <div style={{ marginBottom: 16, padding: 16, background: "#F8FAFC", borderRadius: 10, border: `1px solid ${borderColor}` }}>
            <audio src={item.fileUrl} controls style={{ width: "100%" }} />
          </div>
        )}

        {/* Fallback for non-previewable files */}
        {!fetchingContent && !fetchedContent && !item.content && item.fileUrl &&
         !item.fileType?.startsWith("image/") && item.fileType !== "application/pdf" &&
         !item.fileType?.startsWith("video/") && !item.fileType?.startsWith("audio/") && (
          <div style={{ textAlign: "center", padding: 30, color: mutedColor, marginBottom: 16, background: "#FAFBFC", borderRadius: 10, border: `1px solid ${borderColor}` }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{fileIcon(item.fileType)}</div>
            <div style={{ fontSize: 12, marginBottom: 6 }}>{item.fileName}</div>
            <a href={item.fileUrl} target="_blank" rel="noopener noreferrer"
              style={{ color: accentColor, fontSize: 12 }}>
              Open in new tab
            </a>
          </div>
        )}

        {/* Open in new tab link (for files with rendered content) */}
        {item.fileUrl && (fetchedContent || item.fileType?.startsWith("image/") || item.fileType === "application/pdf") && (
          <div style={{ marginBottom: 16 }}>
            <a href={item.fileUrl} target="_blank" rel="noopener noreferrer"
              style={{ color: accentColor, fontSize: 11, textDecoration: "none", opacity: 0.6 }}>
              ↗ Open in new tab
            </a>
          </div>
        )}

        {/* ═══ DIVIDER ═══ */}
        <div style={{ height: 1, background: borderColor, margin: "4px 0 16px" }} />

        {/* ═══ DETAILS / EDITING (the primary interaction area) ═══ */}

        {/* Group + metadata badges */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          {group && (
            <span style={{ background: group.color + "22", color: group.color, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10 }}>
              {group.icon} {group.name}
            </span>
          )}
          {item.fileSize ? <span style={{ fontSize: 11, color: mutedColor }}>{fmtSize(item.fileSize)}</span> : null}
          {item.pinned && <span style={{ fontSize: 11, color: "#F59E0B" }}>📌 Pinned</span>}
        </div>

        {/* Dates */}
        {(item.createdAt || item.updatedAt) && (
          <div style={{ fontSize: 11, color: mutedColor, marginBottom: 12, display: "flex", gap: 12 }}>
            {item.createdAt && <span>Created {fmtDate(item.createdAt)}</span>}
            {item.updatedAt && <span>Updated {fmtDate(item.updatedAt)}</span>}
          </div>
        )}

        {/* AI Summary */}
        {item.summary ? (
          <div style={{ background: accentColor + "0A", border: `1px solid ${accentColor}22`, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: mutedColor, lineHeight: 1.5, fontStyle: "italic" }}>
            {item.summary}
          </div>
        ) : onGenerateSummary ? (
          <button onClick={() => onGenerateSummary(item)} style={{ background: accentColor + "12", color: accentColor, border: `1px solid ${accentColor}33`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, marginBottom: 12 }}>
            ✨ Generate AI Summary
          </button>
        ) : null}

        {/* Tags — editable */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: mutedColor, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Tags</div>
          <TagInput tags={item.tags || []} onChange={tags => onTagsChange(item.id, tags)} allTags={allTags} accentColor={accentColor} />
        </div>

        {/* Notes — collapsible */}
        <CollapsibleSection title="Notes" defaultOpen={!!item.description} accentColor={accentColor} mutedColor={mutedColor}>
          <NoteEditor value={item.description || ""} onSave={text => onNotesChange(item.id, text)} accentColor={accentColor} mutedColor={mutedColor} />
        </CollapsibleSection>

        {/* Messages — uses its own built-in collapsible UI */}
        {MessagesComponent && (
          <MessagesComponent collectionName={collectionName} docId={item.id} user={user} resourceTitle={title} accentColor={accentColor} />
        )}
      </div>

      {/* Action bar — always visible at bottom */}
      <div style={{ padding: "12px 20px", borderTop: `1px solid ${borderColor}`, display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={() => onEdit(item)} style={{ background: accentColor + "18", color: accentColor, border: `1px solid ${accentColor}44`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️ Edit</button>
        <button onClick={() => onPin(item)} style={{ background: item.pinned ? "#FEF3C7" : "#F9FAFB", color: item.pinned ? "#D97706" : mutedColor, border: `1px solid ${item.pinned ? "#FDE68A" : borderColor}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>
          {item.pinned ? "📌 Unpin" : "📌 Pin"}
        </button>
        <button onClick={() => onDelete(item)} style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>🗑</button>
      </div>
    </div>
  )
}

// Inline note editor (simpler than InlineNotes, no separate component needed)
function NoteEditor({ value, onSave, accentColor, mutedColor }) {
  const [text, setText] = useState(value)
  const [editing, setEditing] = useState(false)

  useEffect(() => { setText(value) }, [value])

  function handleBlur() {
    setEditing(false)
    if (text.trim() !== (value || "").trim()) {
      onSave(text.trim())
    }
  }

  if (editing) {
    return (
      <div>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={e => { if (e.key === "Escape") { setText(value); setEditing(false) } }}
          style={{ width: "100%", minHeight: 60, padding: "8px 10px", border: `1px solid ${accentColor}44`, borderRadius: 8, fontSize: 13, lineHeight: 1.5, color: "#1F2937", background: "#FAFBFC", resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          placeholder="Add notes..."
        />
        <div style={{ fontSize: 10, color: mutedColor, marginTop: 2, opacity: 0.6 }}>Click outside to save · Esc to cancel</div>
      </div>
    )
  }

  return (
    <div onClick={() => setEditing(true)} style={{ cursor: "pointer", padding: "8px 10px", borderRadius: 8, border: `1px dashed ${value ? "transparent" : accentColor + "44"}`, background: value ? "#FAFBFC" : "transparent", minHeight: 32 }}>
      {value ? (
        <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{value}</p>
      ) : (
        <p style={{ fontSize: 12, color: mutedColor, margin: 0, opacity: 0.5, fontStyle: "italic" }}>Click to add notes...</p>
      )}
    </div>
  )
}
