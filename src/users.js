// ── B Resources User Registry ────────────────────────────────────
// Mirrors B Things users.js. Central config for @mention routing,
// notifications, and display. Keyed by email.

export const USERS = {
  'brhnyc1970@gmail.com': {
    displayName: 'Brian',
    handle: 'brian',
    slackUserId: 'U096WPV71KK',
    color: '#2563EB',
  },
  'nico@humbleconviction.com': {
    displayName: 'Nico',
    handle: 'nico',
    slackUserId: 'U09GRAMET4H',
    color: '#7C3AED',
  },
  'nmejiawork@gmail.com': {
    displayName: 'Nico',
    handle: 'nico',
    slackUserId: 'U09GRAMET4H',
    color: '#7C3AED',
  },
}

export function getUserByEmail(email) {
  return USERS[email] ? { email, ...USERS[email] } : null
}

export function getUserByHandle(handle) {
  const h = handle.toLowerCase().replace(/^@/, '')
  const entry = Object.entries(USERS).find(([, u]) => u.handle === h)
  return entry ? { email: entry[0], ...entry[1] } : null
}

export function getAllHandles() {
  const seen = new Set()
  return Object.values(USERS)
    .filter((u) => {
      if (seen.has(u.handle)) return false
      seen.add(u.handle)
      return true
    })
    .map((u) => ({ handle: u.handle, displayName: u.displayName, color: u.color }))
}

export function parseMentions(text) {
  const matches = text.match(/@(\w+)/g) || []
  return matches
    .map((m) => m.slice(1).toLowerCase())
    .filter((h) => getUserByHandle(h))
}
