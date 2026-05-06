import { Link } from "react-router-dom"

const BHUB_URL = "https://b-hub-liard.vercel.app/"
const ACCENT = "#7B8FA8"

const tools = [
  {
    name: "Inbox",
    desc: "Recently captured items across all sections — tag, move, or organize",
    to: "/inbox",
    status: "coming",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
    iconBg: "linear-gradient(135deg, #5B8DEF, #8AB1F4)",
  },
  {
    name: "Library",
    desc: "Frameworks, playbooks, and reference material for the team",
    to: "/library",
    status: "coming",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    iconBg: "linear-gradient(135deg, #7B8FA8, #9AADBE)",
  },
  {
    name: "Vault",
    desc: "Brand assets, templates, credentials, and key documents",
    to: "/vault",
    status: "coming",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    iconBg: "linear-gradient(135deg, #A89078, #C0AA96)",
  },
  {
    name: "References",
    desc: "External articles, videos, research, and tools worth keeping",
    to: "/references",
    status: "coming",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    iconBg: "linear-gradient(135deg, #5B9E8F, #7BB8AA)",
  },
]

function ToolRow({ tool }) {
  return (
    <Link
      to={tool.to}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "24px 28px",
        background: "white",
        borderRadius: 16,
        textDecoration: "none",
        border: "1px solid rgba(0,0,0,0.04)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)"
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)"
        e.currentTarget.style.borderColor = "rgba(123,143,168,0.2)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ""
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"
        e.currentTarget.style.borderColor = "rgba(0,0,0,0.04)"
      }}
    >
      <div
        style={{
          width: 48, height: 48, borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: tool.iconBg, color: "white", flexShrink: 0,
        }}
      >
        {tool.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#2D2A26", marginBottom: 3, letterSpacing: "-0.3px" }}>
          {tool.name}
        </div>
        <div style={{ fontSize: 14, color: "#A0A8B0", lineHeight: 1.45 }}>{tool.desc}</div>
      </div>
      <span style={{ color: "#D0D4DA", fontSize: 16, flexShrink: 0, transition: "color 0.2s, transform 0.2s" }}>&#8594;</span>
    </Link>
  )
}

export default function Home() {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#F6F8FA", minHeight: "100vh", color: "#2D2A26" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 48px 64px" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 56 }}>
          <a
            href={BHUB_URL}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(123,143,168,0.12)", display: "flex", alignItems: "center",
              justifyContent: "center", textDecoration: "none", color: ACCENT, fontSize: 16,
            }}
            title="Back to B Suite"
          >&#8592;</a>
          <div style={{
            width: 40, height: 40, background: ACCENT, borderRadius: 11,
            display: "flex", alignItems: "center", justifyContent: "center", color: "white",
            fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700,
          }}>R</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#2D2A26", letterSpacing: "-0.3px" }}>B Resources</div>
            <div style={{ fontSize: 11, color: "#B0B8C4", fontWeight: 500, letterSpacing: "0.3px" }}>Humble Conviction</div>
          </div>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, fontWeight: 800, letterSpacing: "-1.2px", color: "#2D2A26", marginBottom: 10 }}>
            Knowledge &amp; <span style={{ color: ACCENT }}>assets.</span>
          </h1>
          <p style={{ fontSize: 16, color: "#A0A8B0", lineHeight: 1.6, maxWidth: 520 }}>
            Frameworks, playbooks, brand assets, and key documents &mdash; everything the team needs in one place.
          </p>
        </div>

        {/* Tool rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {tools.map(tool => <ToolRow key={tool.name} tool={tool} />)}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 64, textAlign: "center" }}>
          <span style={{ fontSize: 11, color: "#D0D4DA", fontWeight: 500, letterSpacing: "1.5px", textTransform: "uppercase" }}>Humble Conviction</span>
        </div>
      </div>
    </div>
  )
}
