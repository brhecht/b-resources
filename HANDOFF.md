# HANDOFF — B Resources
*Last updated: March 29, 2026 ~afternoon ET*
*Deploy: https://b-resources.vercel.app*

## What This App Does
B Resources is the knowledge and asset hub for Humble Conviction. It has three main sections: **Library** (documents, frameworks, playbooks, SOPs), **Vault** (brand assets, templates, credentials, files), and **Groups** (kanban-style boards for organizing resources). Used by Brian and the HC team to store and manage internal resources.

## Tech Stack
- **Frontend:** React 19 + Vite 6 + Tailwind CSS 4 + React Router 7
- **Database:** Firebase Firestore (project `b-things` — shared with Things, Content Calendar, B Nico)
- **Auth:** Firebase Auth (Google OAuth)
- **Storage:** Firebase Storage (gs://b-things.firebasestorage.app)
- **Hosting:** Vercel (frontend) + Firebase (rules/storage)
- **Serverless:** Vercel serverless functions (`/api/` directory) for Slack bot + content proxy
- **Repo:** https://github.com/brhecht/b-resources (private)

## Folder Structure
- `src/App.jsx` — Router: / → Home, /library → Library, /vault → Vault
- `src/pages/Library.jsx` — Full CRUD, view modal is single editing surface (inline-edit title, group, tags, notes, messages), side panel preview, CollapsibleMessages
- `src/pages/Vault.jsx` — Full CRUD, same modal pattern as Library, "Replace File" instead of "Edit Content"
- `src/pages/Home.jsx` — Dashboard/landing page
- `src/components/GroupKanban.jsx` — Vertical kanban layout. Card click → modal. Preview 👁 button → side panel. Inline tag editing, pin toggle, download link, AI summary hover tooltip, displayTitle dominant with filename secondary.
- `src/components/SidePanel.jsx` — Right-side panel for rendered document preview (markdown, plain text). Fetches content via server proxy. Single-scroll layout: rendered content at top, details (group, dates, summary, tags, notes, messages) below. Action bar pinned at bottom (edit, pin, delete).
- `src/components/ResourceCard.jsx` — Grid/card view with displayTitle, pin 📌, styled AI summary tooltip
- `src/components/ListView.jsx` — List/table view with displayTitle, all tags, pin 📌
- `src/components/InlineNotes.jsx` — Click-to-edit textarea for persistent notes/descriptions. Auto-save on blur, Esc to cancel.
- `src/components/TagInput.jsx` — Pill-based tag input with autocomplete dropdown, max 10 tags, used in kanban cards and modals
- `src/components/MessageThread.jsx` — Exports `CollapsibleMessages` with built-in expand/collapse, message count, iMessage-style thread
- `src/components/tagColors.js` — `getTagColor()` deterministic hash-based color mapping for tag pills
- `api/fetch-content.js` — Vercel serverless proxy for fetching Firebase Storage content (CORS bypass). POST only, validates firebasestorage.googleapis.com URLs.
- `api/slack-events.js` — Slack Events API handler (auto-classifies messages → Firestore)
- `api/slack-inbox-reminder.js` — Daily cron (9 AM) for stale inbox items
- `api/firebase-admin.js` — Firebase Admin SDK init from env
- `firestore.rules` — ⚠️ STALE/INCORRECT — do NOT deploy (see Firebase Rules warning below)
- `storage.rules` — Firebase Storage security rules
- `vercel.json` — SPA rewrites + serverless function config

## Current Status
App is deployed and functional. Library and Vault pages work with full CRUD. GroupKanban is the primary view with modal as the single editing surface. Side panel preview works for text/markdown files via server proxy. All views (kanban, grid, list) show displayTitle, tags, pins. **Slack bot is NOT receiving events** — needs app reinstall (see Known Issues).

## What Changed This Session (March 29, 2026)

### Bugs Fixed (from the build that existed when this session started)
1. **Stars instead of pins** — pinning feature was using ★/☆ star icons everywhere instead of 📌. Replaced across all views (kanban, grid, list, modals, side panel).
2. **Pinned items didn't sort to top** — pins had no effect on sort order. Now pinned items get priority in all views.
3. **Pin button only visible on already-pinned items** — kanban cards hid the pin icon unless the item was already pinned, so users couldn't pin anything from the card UI. Now always visible (dimmed when unpinned, solid when pinned).
4. **Display name not visually dominant** — kanban cards showed the raw filename as the primary label. Now `displayTitle()` (strips extension, replaces hyphens/underscores with spaces, title-cases) is the dominant element; filename shown as smaller secondary reference underneath.
5. **Tags not visible on kanban cards** — tags existed in the data but weren't rendering on kanban cards at all.
6. **Tags not editable from kanban cards** — had to open a separate edit modal to change tags. No inline editing capability.
7. **No notes/description field** — no persistent notes area anywhere in the app. No way to add context or descriptions to items.
8. **No messages section in view modals** — the iMessage-style message threading component (CollapsibleMessages) existed but wasn't wired into the view modal or accessible from normal item interaction.
9. **"Edit" button was ambiguous** — single "Edit" button conflated content editing with metadata editing. Unclear what it did.

### Improvements (new features added this session)
1. **Modal is now the single editing surface** — clicking a kanban card opens a modal where everything is editable inline: title (click to edit via EditableTitle component), group (dropdown), tags (pill-based with autocomplete), notes, messages. No more separate "edit mode" for metadata. Modeled after B Things.
2. **Side panel preview** — new 👁 button on kanban cards opens a right-side panel (480px) that renders document content (markdown via MarkdownRenderer, plain text via pre) while the kanban stays visible. Built `api/fetch-content.js` Vercel serverless proxy to bypass CORS on Firebase Storage URLs.
3. **AI summary hover tooltip** — hovering over a kanban card shows the AI-generated summary in a dark popover. No click required.
4. **Tags as colored pills on kanban cards** — deterministic hash-based colors via `getTagColor()`. Each tag gets a consistent color across the app. "+ tag" button with accent color styling.
5. **Inline tag editing on kanban cards** — click "+" or "+ tag", get the full TagInput with autocomplete dropdown, hit "Done" to close. No modal needed.
6. **InlineNotes component** — click-to-edit textarea, auto-saves on blur, Esc to cancel. Present in both the modal and side panel.
7. **CollapsibleMessages in modal and side panel** — iMessage-style threading with expand/collapse, message count badge, unread tracking via `_msgMeta` pattern.
8. **EditableTitle component** — click-to-edit h2 in modals. Enter or blur to save, Esc to cancel. Used in both Library and Vault view modals.
9. **Inline group dropdown** — change group/category directly in the modal without separate edit view.
10. **Download link on kanban cards** — ⬇ link so users can grab files without opening anything.
11. **Relative timestamps on kanban cards** — "6m ago", "6h ago", "3d ago" instead of full dates. Falls back to "Mon DD" format after 7 days.
12. **"Edit" button clarified** — now "✏️ Edit Content" (Library) and "📎 Replace File" (Vault), since all metadata editing happens inline in the modal.

### Architecture Notes
- **`displayTitle()` helper** exists in GroupKanban.jsx, Library.jsx, Vault.jsx, ResourceCard.jsx, ListView.jsx — strips file extensions, replaces hyphens/underscores with spaces, title-cases words. Items store `name` (defaults to filename), `fileName`, and optionally `title` fields.
- **GroupKanban has its own `renderItemCard()`** that bypasses the shared ResourceCard component. Any card-level changes must be made in GroupKanban.jsx directly.
- **`_msgMeta` pattern** for unread tracking: `{ lastAt, lastBy, readBy: { [emailKey]: true } }` — stored on the document itself, not in a subcollection.
- **SidePanel content fetching**: `isTextFile()` checks MIME type and file extension. Fetches via POST to `/api/fetch-content` (server proxy), falls back to direct fetch. Non-text files show "Open in new tab" link.
- **EPERM on mounted drive**: Git operations require working from `/tmp/b-resources-fresh/` clone. Git credentials from `/mnt/Developer/B-Suite/.git-token`.

## Known Issues
- **Slack bot not receiving events** — App needs reinstall at https://api.slack.com/apps/A0APJCW2DLZ/install-on-team (Brian must do this as workspace admin). After reinstall, re-test by sending a message in #b-resources and checking Vercel logs + Firestore.
- **Significant architecture issues identified** — to be documented and addressed separately.
- `nmejiawork@gmail.com` does NOT have Firebase Console access — must use `nico@humbleconviction.com`
- The `firestore.rules` file in this repo contains stale/incorrect rules — do NOT deploy from this repo.

## Vercel Environment Variables
### Frontend (VITE_*)
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

### Serverless (Slack bot)
- SLACK_BOT_TOKEN — xoxb-* token from B Resources Slack app
- SLACK_SIGNING_SECRET — signing secret for request verification
- SLACK_CHANNEL_ID — #b-resources channel ID
- FIREBASE_SERVICE_ACCOUNT — JSON string of service account key
- CRON_SECRET — protects the daily reminder endpoint

## Firebase Access
- **Project:** `b-things`
- **Account with access:** `nico@humbleconviction.com` (Editor, granted by Brian)
- **Account WITHOUT access:** `nmejiawork@gmail.com`

## Firebase Rules — WARNING
⚠️ **DO NOT deploy Firestore rules from this repo.** The `firestore.rules` file in this repo was created in error and contains incorrect rules (includes Eddy and B People collections that don't belong in the `b-things` project). The `firestore` section needs to be removed from `firebase.json` (keep only `storage`). The canonical Firestore rules deployer is currently brain-inbox; this will migrate to a dedicated infra repo. See the master handoff in bhub for the full Firestore deploy protocol.

## Design Decisions
- **Modal is THE editing surface** — card click → modal with everything editable inline. Modeled after B Things. No separate "edit mode" for metadata.
- **Side panel is secondary** — preview button (👁) on kanban cards for viewing rendered document content. Rare use case, not the default interaction.
- **displayTitle is visually dominant** — cleaned-up display name is the primary label everywhere. Raw filename shown as secondary reference only.
- **Inline preview over new tab**: Files preview inside the modal and side panel
- **Edit replaces file optionally**: Metadata edits don't require re-upload
- **Image thumbnails on Vault cards**: Asset-focused section shows previews
- **Firestore rules require auth**: All reads/writes require `request.auth != null`
- **CollapsibleComments/Messages**: Uses Firestore sub-collections `{collection}/{docId}/comments`
- **Slack bot auto-classifies**: Messages tagged to vault/library/general automatically
- **CORS proxy pattern**: Server-side fetch via `/api/fetch-content.js` to bypass browser CORS restrictions on Firebase Storage URLs

## PENDING — Next Session
1. **QA all features on live site** — Brian is QAing the deploy from this session. May surface additional issues.
2. **Architecture issues** — significant issues identified during this session, to be documented and addressed separately.
3. **Re-test Slack bot** — After Brian reinstalls the app, verify bot responds and creates Firestore docs.
4. **Test CollapsibleMessages** — Verify iMessage threading works end-to-end on production.
5. **Run seed script** — `node src/seed.js` to populate Library and Vault with starter HC content.
6. **Mobile responsive testing**
