import { getTagColor } from "./tagColors"
import TagInput from "./TagInput"
import InlineNotes from "./InlineNotes"
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

function FilePreview({ fileUrl, fileType, fileName, borderColor = "#E2E8F0" }) {
  if (!fileUrl) return null
  if (fileType?.startsWith("image/")) {
    return (
      <div style={{ marginBottom: 16, borderRadius: 10, overflow: "hidden", border: `1px solid ${borderColor}` }}>
        <img src={fileUrl} alt={fileName} style={{ width: "100%", maxHeight: 400, objectFit: "contain", display: "block", background: "#F8FAFC" }} />
      </div>
    )
  }
  if (fileType === "application/pdf") {
    return (
      <div style={{ marginBottom: 16, borderRadius: 10, overflow: "hidden", border: `1px solid ${borderColor}` }}>
        <iframe src={fileUrl} title={fileName} style={{ width: "100%", height: 400, border: "none" }} />
      </div>
    )
  }
  if (fileType?.startsWith("video/")) {
    return (
      <div style={{ marginBottom: 16, borderRadius: 10, overflow: "hidden", border: `1px solid ${borderColor}` }}>
        <video src={fileUrl} controls style={{ width: "100%", maxHeight: 300, display: "block", background: "#000" }} />
      </div>
    )
  }
  if (fileType?.startsWith("audio/")) {
    return (
      <div style={{ marginBottom: 16, padding: 16, background: "#F8FAFC", borderRadius: 10, border: `1px solid ${borderColor}` }}>
        <audio src={fileUrl} controls style={{ width: "100%" }} />
      </div>
    )
  }
  return null
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
  if (!item) return null

  const title = displayTitle ? displayTitle(item) : (item.title || item.name || "Untitled")
  const group = groupMap[item.groupId]

  return (
    <div style={{
      width: 420,
      minWidth: 420,
      height: "100%",
      background: "#fff",
      borderLeft: `1px solid ${borderColor}`,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: `1px solid ${borderColor}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 20 }}>{fileIcon(item.fileType)}</span>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h3>
          {item.pinned && <span style={{ fontSize: 12 }}>📌</span>}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: mutedColor, padding: "0 4px" }}>×</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {/* Group + pinned badges */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          {group && (
            <span style={{ background: group.color + "22", color: group.color, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10 }}>
              {group.icon} {group.name}
            </span>
          )}
          {item.fileSize ? <span style={{ fontSize: 11, color: mutedColor }}>{fmtSize(item.fileSize)}</span> : null}
          {item.pinned && <span style={{ fontSize: 11, color: "#F59E0B" }}>📌 Pinned</span>}
        </div>

        {/* Tags — editable */}
        <div style={{ marginBottom: 12 }}>
          <TagInput tags={item.tags || []} onChange={tags => onTagsChange(item.id, tags)} allTags={allTags} accentColor={accentColor} />
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

        {/* Notes — editable */}
        <InlineNotes value={item.description || ""} onSave={text => onNotesChange(item.id, text)} accentColor={accentColor} mutedColor={mutedColor} />

        {/* File Preview */}
        <FilePreview fileUrl={item.fileUrl} fileType={item.fileType} fileName={item.fileName} borderColor={borderColor} />

        {/* Download link */}
        {item.fileUrl && (
          <a href={item.fileUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: accentColor + "18", color: accentColor, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none", marginBottom: 16 }}>
            {fileIcon(item.fileType)} {item.fileName || "Download"}
          </a>
        )}

        {/* Markdown content */}
        {item.content && (
          <div style={{ background: "#F8FAFC", padding: 16, borderRadius: 8, maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
            <MarkdownRenderer content={item.content} accentColor={accentColor} />
          </div>
        )}

        {/* Messages */}
        {MessagesComponent && (
          <MessagesComponent collectionName={collectionName} docId={item.id} user={user} resourceTitle={title} accentColor={accentColor} />
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, paddingBottom: 16 }}>
          <button onClick={() => onEdit(item)} style={{ background: accentColor + "18", color: accentColor, border: `1px solid ${accentColor}44`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️ Edit</button>
          <button onClick={() => onPin(item)} style={{ background: item.pinned ? "#FEF3C7" : "#F9FAFB", color: item.pinned ? "#D97706" : mutedColor, border: `1px solid ${item.pinned ? "#FDE68A" : borderColor}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>
            {item.pinned ? "📌 Unpin" : "📌 Pin"}
          </button>
          <button onClick={() => onDelete(item)} style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>🗑 Delete</button>
        </div>
      </div>
    </div>
  )
}
