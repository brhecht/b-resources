import { useState, useEffect } from "react"
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

function isTextFile(fileType, fileName) {
  if (!fileType && !fileName) return false
  const textTypes = ["text/", "application/json", "application/xml", "application/javascript"]
  if (textTypes.some(t => fileType?.startsWith(t) || fileType?.includes(t))) return true
  const textExts = [".md", ".txt", ".json", ".xml", ".csv", ".html", ".htm", ".js", ".jsx", ".ts", ".tsx", ".css", ".yaml", ".yml", ".toml", ".py", ".rb", ".sh"]
  if (fileName && textExts.some(ext => fileName.toLowerCase().endsWith(ext))) return true
  return false
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
  const [activeTab, setActiveTab] = useState("preview")

  // Fetch text/markdown content from fileUrl when item changes
  useEffect(() => {
    if (!item) return
    setFetchedContent(null)
    setActiveTab("preview")

    if (item.content) {
      // Library items may already have inline content
      setFetchedContent(item.content)
      return
    }

    if (item.fileUrl && isTextFile(item.fileType, item.fileName)) {
      setFetchingContent(true)
      fetch(item.fileUrl)
        .then(r => {
          if (r.ok) return r.text()
          throw new Error("Failed to fetch")
        })
        .then(text => {
          setFetchedContent(text)
          setFetchingContent(false)
        })
        .catch(() => {
          setFetchedContent(null)
          setFetchingContent(false)
        })
    }
  }, [item?.id])

  if (!item) return null

  const title = displayTitle ? displayTitle(item) : (item.title || item.name || "Untitled")
  const group = groupMap[item.groupId]
  const isMarkdown = item.fileName?.toLowerCase().endsWith(".md") || item.fileType === "text/markdown"
  const hasRenderedContent = !!fetchedContent || item.fileType?.startsWith("image/") || item.fileType === "application/pdf" || item.fileType?.startsWith("video/") || item.fileType?.startsWith("audio/")

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

      {/* Tabs: Preview | Details */}
      <div style={{ display: "flex", borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
        {["preview", "details"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab ? `2px solid ${accentColor}` : "2px solid transparent",
              color: activeTab === tab ? accentColor : mutedColor,
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: 13,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {tab === "preview" ? "📄 Preview" : "📋 Details"}
          </button>
        ))}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {activeTab === "preview" ? (
          <>
            {/* CONTENT RENDERING — the main point of this panel */}
            {fetchingContent && (
              <div style={{ textAlign: "center", padding: 40, color: mutedColor, fontSize: 13 }}>Loading content...</div>
            )}

            {fetchedContent && (isMarkdown || item.fileName?.toLowerCase().endsWith(".md")) ? (
              <div style={{ background: "#FAFBFC", border: `1px solid ${borderColor}`, borderRadius: 10, padding: "20px 24px", minHeight: 200 }}>
                <MarkdownRenderer content={fetchedContent} accentColor={accentColor} />
              </div>
            ) : fetchedContent && !isMarkdown ? (
              <pre style={{ background: "#FAFBFC", border: `1px solid ${borderColor}`, borderRadius: 10, padding: "16px 20px", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", minHeight: 200, overflow: "auto", margin: 0 }}>
                {fetchedContent}
              </pre>
            ) : null}

            {/* Image preview */}
            {item.fileUrl && item.fileType?.startsWith("image/") && (
              <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${borderColor}` }}>
                <img src={item.fileUrl} alt={item.fileName} style={{ width: "100%", maxHeight: 500, objectFit: "contain", display: "block", background: "#F8FAFC" }} />
              </div>
            )}

            {/* PDF preview */}
            {item.fileUrl && item.fileType === "application/pdf" && (
              <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${borderColor}` }}>
                <iframe src={item.fileUrl} title={item.fileName} style={{ width: "100%", height: 500, border: "none" }} />
              </div>
            )}

            {/* Video preview */}
            {item.fileUrl && item.fileType?.startsWith("video/") && (
              <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${borderColor}` }}>
                <video src={item.fileUrl} controls style={{ width: "100%", maxHeight: 400, display: "block", background: "#000" }} />
              </div>
            )}

            {/* Audio preview */}
            {item.fileUrl && item.fileType?.startsWith("audio/") && (
              <div style={{ padding: 16, background: "#F8FAFC", borderRadius: 10, border: `1px solid ${borderColor}` }}>
                <audio src={item.fileUrl} controls style={{ width: "100%" }} />
              </div>
            )}

            {/* Fallback: no previewable content */}
            {!fetchingContent && !fetchedContent && !item.fileType?.startsWith("image/") && item.fileType !== "application/pdf" && !item.fileType?.startsWith("video/") && !item.fileType?.startsWith("audio/") && (
              <div style={{ textAlign: "center", padding: 40, color: mutedColor }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{fileIcon(item.fileType)}</div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>{item.fileName || "No preview available"}</div>
                {item.fileUrl && (
                  <a href={item.fileUrl} target="_blank" rel="noopener noreferrer"
                    style={{ color: accentColor, fontSize: 13, textDecoration: "underline" }}>
                    Open in new tab
                  </a>
                )}
              </div>
            )}

            {/* Download link below content */}
            {item.fileUrl && hasRenderedContent && (
              <div style={{ marginTop: 12 }}>
                <a href={item.fileUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, color: accentColor, fontSize: 12, textDecoration: "none", opacity: 0.7 }}>
                  {fileIcon(item.fileType)} Open in new tab
                </a>
              </div>
            )}
          </>
        ) : (
          <>
            {/* DETAILS TAB */}
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
              <div style={{ fontSize: 11, fontWeight: 600, color: mutedColor, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Tags</div>
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

            {/* Messages */}
            {MessagesComponent && (
              <MessagesComponent collectionName={collectionName} docId={item.id} user={user} resourceTitle={title} accentColor={accentColor} />
            )}
          </>
        )}
      </div>

      {/* Action bar — always visible */}
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
