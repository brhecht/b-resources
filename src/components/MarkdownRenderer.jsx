import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export default function MarkdownRenderer({ content, accentColor = "#7B8FA8" }) {
  if (!content) return null

  return (
    <div style={{ fontSize: 14, lineHeight: 1.7, color: "#1A1A2E" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: "24px 0 12px", lineHeight: 1.3 }}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "20px 0 10px", lineHeight: 1.3 }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: "16px 0 8px", lineHeight: 1.4 }}>{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 style={{ fontSize: 16, fontWeight: 600, margin: "14px 0 6px", lineHeight: 1.4 }}>{children}</h4>
          ),
          p: ({ children }) => (
            <p style={{ margin: "0 0 12px", lineHeight: 1.7 }}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul style={{ margin: "0 0 12px", paddingLeft: 24 }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: "0 0 12px", paddingLeft: 24 }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li style={{ marginBottom: 4, lineHeight: 1.6 }}>{children}</li>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: "underline" }}>{children}</a>
          ),
          code: ({ inline, className, children }) => {
            if (inline) {
              return (
                <code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, fontSize: 13, fontFamily: "monospace" }}>{children}</code>
              )
            }
            return (
              <pre style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: 16, overflow: "auto", margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>
                <code style={{ fontFamily: "monospace" }}>{children}</code>
              </pre>
            )
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote style={{ borderLeft: `3px solid ${accentColor}`, margin: "0 0 12px", paddingLeft: 16, color: "#6B7A99", fontStyle: "italic" }}>{children}</blockquote>
          ),
          hr: () => (
            <hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: "20px 0" }} />
          ),
          table: ({ children }) => (
            <div style={{ overflowX: "auto", marginBottom: 12 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th style={{ border: "1px solid #E2E8F0", padding: "8px 12px", background: "#F8FAFC", fontWeight: 600, textAlign: "left" }}>{children}</th>
          ),
          td: ({ children }) => (
            <td style={{ border: "1px solid #E2E8F0", padding: "8px 12px" }}>{children}</td>
          ),
          strong: ({ children }) => (
            <strong style={{ fontWeight: 600 }}>{children}</strong>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt} style={{ maxWidth: "100%", borderRadius: 8, margin: "8px 0" }} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
