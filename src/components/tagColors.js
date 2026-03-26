const TAG_COLORS = [
  { bg: "#EFF6FF", text: "#2563EB" },
  { bg: "#F0FDF4", text: "#16A34A" },
  { bg: "#FFF7ED", text: "#EA580C" },
  { bg: "#FDF2F8", text: "#DB2777" },
  { bg: "#F5F3FF", text: "#7C3AED" },
  { bg: "#ECFDF5", text: "#059669" },
  { bg: "#FEF3C7", text: "#D97706" },
  { bg: "#F0F9FF", text: "#0284C7" },
]

export function getTagColor(tag) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}
