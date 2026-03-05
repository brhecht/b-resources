# HANDOFF — B Resources
*Last updated: March 5, 2026 ~12:30 PM ET*

## Project Overview
B Resources is the knowledge and asset hub for Humble Conviction — a sub-menu/routing app within the B-Suite ecosystem. Currently has two sections (Library and Vault), both in "coming soon" state. Built as a standalone React app so it's ready to add Firestore-backed functionality (document storage, asset management, etc.) without migrating later.

## Tech Stack
- **Frontend:** React 19 + Vite 6 + Tailwind CSS 4 + React Router 7
- **Database:** Firebase (will use `b-things` project when DB is needed — shared with Things, Content Calendar, B Nico)
- **Auth:** Firebase Auth (configured but not yet enforced)
- **Hosting:** Vercel — will deploy to `b-resources.vercel.app`
- **Repo:** Will be `brhecht/b-resources` (private) on GitHub
- **Design:** Cool gray background (#F6F8FA), steel blue accent (#7B8FA8), Playfair Display + DM Sans fonts

## Folder Structure
```
b-resources/
├── src/
│   ├── App.jsx              # Router: / → Home, /library → ComingSoon, /vault → ComingSoon
│   ├── main.jsx             # React root render
│   ├── firebase.js          # Firebase config (Firestore + Auth)
│   ├── index.css            # Tailwind import
│   ├── pages/
│   │   ├── Home.jsx         # Sub-menu hub: Library + Vault rows
│   │   └── ComingSoon.jsx   # Config-driven coming-soon page (renders both Library and Vault)
│   └── components/          # Empty — ready for shared components
├── api/                     # Empty — ready for Vercel serverless functions
├── index.html               # Entry point with Google Fonts
├── package.json
├── vite.config.js
├── vercel.json              # SPA rewrites + API routing
├── .env.example             # Documents required env vars
└── .gitignore
```

## Current Status
**Phase: Just scaffolded — sub-menu and coming-soon pages only. No DB functionality yet.**

### Working:
- Home page with Library and Vault tool rows
- `/library` route → coming-soon page (steel blue theme, book icon)
- `/vault` route → coming-soon page (warm taupe theme, lock icon)
- Back arrow on home → bhub, back arrow on coming-soon → home
- ComingSoon component is config-driven — add new tools by adding to the config object

### Not yet built:
- No Firebase/Firestore usage yet (configured but unused)
- No auth wall
- No actual Library or Vault functionality
- Not yet deployed (needs `npm install`, git init, GitHub repo, Vercel deploy)

## Recent Changes (This Session — built from scratch)
1. Scaffolded `b-resources/` as standalone Vite + React project matching B-Suite stack
2. Created Home page with sub-menu layout (same pattern as B Marketing)
3. Created config-driven ComingSoon component that serves both Library and Vault pages
4. Set up React Router with 3 routes (/, /library, /vault)
5. Configured Firebase for `b-things` project (matching Things, Content Calendar, B Nico)
6. Updated bhub's B Resources card to point to `https://b-resources.vercel.app`

## Known Bugs / Issues
- **Not yet deployed** — needs git init, GitHub repo creation, and Vercel deploy
- **Old static pages still in bhub** — `b-resources.html`, `b-library.html`, `b-vault.html` are orphans once this app is deployed. Can clean up later.
- **Firebase project choice:** `.env.example` references `b-things` but `.env` hasn't been created yet. Could use either `b-things` or `eddy-tracker-82486` — depends on what data Resources will store.

## Planned Features / Backlog
1. **Library:** Markdown/doc viewer for frameworks, playbooks, SOPs. Firestore-backed document list with categories/tags.
2. **Vault:** Secure asset storage — brand files, templates, credentials reference. Firebase Storage for files, Firestore for metadata.
3. **Auth wall:** Firebase Google Auth with B-Suite email allowlist once there's real data.
4. **Search:** Cross-resource search across Library and Vault content.

## Design Decisions & Constraints
- **Config-driven ComingSoon:** Both Library and Vault coming-soon pages render from the same component with different config (color, icon, copy). Easy to add more resource types.
- **Uses `b-things` Firebase project:** Library/Vault content is internal team resources, which fits with the operational tools (Things, Content Calendar, B Nico) rather than the marketing stack (eddy-tracker).
- **React Router from day one:** Library and Vault are routes, not external links. This means future functionality (document viewer, asset browser) can be built as sub-routes without restructuring.
- **Steel blue + warm taupe palette:** Deliberately cooler/more muted than B Marketing's coral. Resources = reference/archival feel vs. Marketing = action/conversion feel.

## Environment & Config
- **Target live URL:** https://b-resources.vercel.app
- **Target GitHub repo:** brhecht/b-resources (private)
- **Firebase project:** `b-things` (to be confirmed — env vars not yet created)
- **bhub link:** Updated to `https://b-resources.vercel.app`

## Open Questions / Decisions Pending
- **Which Firebase project?** `b-things` (operational tools) or `eddy-tracker-82486` (marketing tools)?
- **What goes in Library first?** Pitch frameworks? SOPs? Course content outlines?
- **What goes in Vault first?** Brand guide? Logo files? API key reference?
- **Auth requirement:** Should Resources be auth-gated from the start, or open until there's sensitive content?
