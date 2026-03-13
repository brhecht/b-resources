# HANDOFF — B Resources
*Last updated: March 12, 2026 ~9:30 PM ET*

## Project Overview
B Resources is a knowledge and asset hub for Humble Conviction, part of the B-Suite ecosystem. Two functional sections: Library (frameworks, playbooks, reference materials) and Vault (brand assets, templates, credentials, key documents). Both backed by Firestore and Firebase Storage. Nico (nmejiawork) is actively contributing — submitted 3 PRs that were merged.

## Tech Stack
- **Frontend:** React 19, Vite 6, Tailwind CSS 4 (@tailwindcss/vite plugin), React Router 7
- **Backend:** Firebase Firestore + Firebase Storage + Firebase Auth (Google sign-in)
- **Firebase project:** b-things (shared with B-Suite)
- **Hosting:** Vercel
- **Fonts:** Playfair Display (serif) + DM Sans (sans-serif)
- **Repo:** github.com/brhecht/b-resources
- **Local path:** `~/Developer/B-Suite/b-resources`

## Folder Structure
```
b-resources/
├── src/
│   ├── App.jsx              — Router + auth gate (3 routes: /, /library, /vault)
│   ├── main.jsx             — React root render
│   ├── firebase.js          — Firebase config (HARDCODED, not env vars) + auth/db/storage
│   ├── index.css            — Tailwind import
│   ├── pages/
│   │   ├── Home.jsx         — Sub-menu landing: Library & Vault cards
│   │   ├── Library.jsx      — Doc manager with drag-drop upload, search, categories
│   │   └── Vault.jsx        — Asset manager with drag-drop file upload
│   └── components/
│       └── SignIn.jsx       — Google OAuth sign-in modal
├── api/                     — Empty (ready for serverless functions)
├── vercel.json              — SPA rewrites + API routing
├── .env.example             — Firebase env var template (currently unused)
└── package.json
```

## Current Status

### Working
- Google Auth sign-in (all routes gated behind auth)
- Home page with Library and Vault tool cards (no more "coming soon" badges)
- Library page: search, category filters (Framework/Playbook/SOP/Reference), document CRUD, drag-drop file upload with progress bar, file downloads, delete (removes both Firestore doc and Storage object)
- Vault page: search, category filters (Brand/Template/Credentials/Document), asset CRUD, drag-drop file upload, file type icons, download, delete
- Firebase Storage integration for both Library and Vault
- Real-time Firestore loading

### Design
- Library theme: cool gray (#F6F8FA), steel blue accents (#7B8FA8)
- Vault theme: warm beige (#FAF7F4), warm taupe accents (#A89078)

## Recent Changes (March 8–12, 2026)
- Library and Vault pages built from scratch with full Firestore + Storage integration (Nico, PR #1)
- Routes wired in App.jsx, Storage export added to firebase.js (Nico, PR #2)
- Google Auth added to fix Firestore permission errors (Nico, PR #3)
- Firebase config hardcoded (Vercel env vars not set)
- Drag-and-drop upload zones replaced bare file inputs in both Library and Vault
- Fixed Firebase Storage bucket URL
- Removed "coming soon" badges from Home page
- Enhanced error logging for upload failures

## Known Bugs / Issues
- Firebase config is hardcoded in firebase.js (not using env vars)
- No email allowlist — anyone with a Google account can sign in
- No input validation on forms (empty title, no content/file)
- No pagination — loads all docs at once (will slow with 1000+ docs)
- No data ownership model — all users see all docs/assets
- Storage cleanup on delete is best-effort (orphaned files possible)

## Planned Features / Backlog
- Email allowlist to restrict access to team
- Tighten Firestore security rules (user-scoped data)
- Input validation + file size limits
- Pagination or infinite scroll
- Doc/asset sharing with permissions
- Version history for document updates

## Design Decisions & Constraints
- Firebase config inline for simplicity (API key is not sensitive; project ID is public)
- User-scoped storage paths: library/{uid}/{timestamp}_{filename} and vault/{uid}/{timestamp}_{filename}
- Drag-and-drop UX with hidden native file input + custom styled zone
- Firestore over Realtime DB for structured queries
- No dedicated API layer yet — all DB calls from React components

## Environment & Config
- **Production URL:** https://b-resources.vercel.app
- **GitHub:** github.com/brhecht/b-resources
- **Firebase project:** b-things
- **Firestore collections:** library, vault
- **Storage bucket:** gs://b-things.firebasestorage.app

## Open Questions / Decisions Pending
- Should Firebase config move to env vars? (Currently hardcoded)
- Email allowlist scope — same 3 users as other B-Suite apps?
- Firestore rules need hardening for user-scoped access
