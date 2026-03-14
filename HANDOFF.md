# HANDOFF — B Resources
*Last updated: March 14, 2026 ~2:00 PM*
*Deploy: https://b-resources.vercel.app*

## What This App Does
B Resources is the knowledge and asset hub for Humble Conviction. It has two main sections: **Library** (documents, frameworks, playbooks, SOPs) and **Vault** (brand assets, templates, credentials, files). Used by Brian and the HC team to store and manage internal resources.

## Tech Stack
- **Frontend:** React 19 + Vite 6 + Tailwind CSS 4 + React Router 7
- **Database:** Firebase Firestore (project `b-things` — shared with Things, Content Calendar, B Nico)
- **Auth:** Firebase Auth (Google OAuth)
- **Storage:** Firebase Storage (gs://b-things.firebasestorage.app)
- **Hosting:** Vercel (frontend) + Firebase (rules/storage)
- **Repo:** https://github.com/brhecht/b-resources (private)

## Folder Structure
- `src/App.jsx` — Router: / → Home, /library → Library, /vault → Vault
- `src/pages/Library.jsx` — Full CRUD for documents with file preview
- `src/pages/Vault.jsx` — Full CRUD for assets with file preview and image thumbnails
- `src/pages/Home.jsx` — Dashboard/landing page
- `src/firebase.js` — Firebase init, exports db, auth, storage
- `firestore.rules` — Security rules for vault and library collections
- `storage.rules` — Firebase Storage security rules
- `vercel.json` — SPA rewrites

## Current Status
**Fully functional.** Both Library and Vault pages support:
- **Create** — Upload files via drag-and-drop or click, add metadata (title, category, description, tags)
- **Read** — View documents/assets in cards with search and category filters
- **Update** — Edit all metadata fields, replace attached files
- **Delete** — Remove documents/assets with storage cleanup
- **Preview** — Inline preview for images, PDFs, video, and audio directly in the view modal
- Image thumbnails show on Vault cards

## What Changed This Session
1. **Fixed Firestore rules deployment** — Added `library` collection rule that was blocking uploads (root cause of the 100% upload → error bug)
2. **Deployed Firestore rules** via Firebase CLI using `nico@humbleconviction.com` account (Brian granted Editor access on `b-things` project)
3. **Added file preview** — Images, PDFs, videos, and audio render inline in view modals instead of just showing a download link
4. **Added Edit (Update) functionality** — Both Library and Vault now have edit modals to update title, category, description, tags, and optionally replace the attached file
5. **Added edit/delete buttons to cards** — Quick access without opening the view modal first
6. **Deployed to production** — Pushed to main, Vercel auto-deployed

## Known Issues / Bugs
- Library shows "No documents found" when not authenticated (expected — Firestore rules require auth)
- `nmejiawork@gmail.com` does NOT have Firebase access to `b-things` project — must use `nico@humbleconviction.com` for any Firebase deploys
- Git remote auth: HTTPS push works without token to `brhecht/b-resources`, but SSH keys are not configured

## Backlog / Next Steps
- Add file type icons to Library cards (currently only Vault has them)
- Consider adding a "preview" button directly on cards without opening the full modal
- Mobile responsiveness polish
- Bulk upload support
- File versioning (keep history of replaced files)

## Design Decisions
- **Inline preview over new tab**: Files preview inside the modal rather than opening a new browser tab — keeps the user in context
- **Edit replaces file optionally**: When editing, the user can change metadata without re-uploading the file. Only uploads a new file if they explicitly click "Replace"
- **Image thumbnails on Vault cards**: Since Vault is more asset-focused, image files show a thumbnail preview directly on the card
- **Firestore rules require auth**: All reads and writes require `request.auth != null` — no public access

## Environment Variables
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

Set in: `.env` (local — currently hardcoded in firebase.js) and Vercel dashboard → Settings → Environment Variables (production)

## Firebase Access
- **Project:** `b-things`
- **Account with access:** `nico@humbleconviction.com` (Editor, granted by Brian)
- **Account WITHOUT access:** `nmejiawork@gmail.com`
- **Firebase CLI deploy command:** `firebase deploy --only firestore:rules --project b-things --account nico@humbleconviction.com`

## QA Checklist
- [x] Upload file via drag-and-drop in Library
- [x] Upload file via drag-and-drop in Vault
- [x] View uploaded file with inline preview (image, PDF)
- [x] Edit document metadata in Library
- [x] Edit asset metadata in Vault
- [x] Replace file during edit
- [x] Delete document/asset (confirms, removes from storage)
- [x] Search works across title, description, tags
- [x] Category filter works
- [ ] Mobile responsive testing
- [ ] Test with video and audio file uploads

## Open Questions
None.
