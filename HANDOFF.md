# HANDOFF — B Resources
*Last updated: May 5, 2026*
*Deploy: https://b-resources.vercel.app*

## What This App Does
B Resources is the knowledge and asset hub for Humble Conviction. Three main sections: **Library** (documents, frameworks, playbooks, SOPs), **Vault** (brand assets, templates, credentials, files), and **References** (external articles, videos, research, guides, tools). Used by Brian and the HC team to store and manage internal resources. Slack bot auto-classifies incoming content.

## Tech Stack
- **Frontend:** React 19 + Vite 6 + Tailwind CSS 4 + React Router 7
- **Database:** Firebase Firestore (project `b-things` — shared with Things, Content Calendar, B Nico)
- **Auth:** Firebase Auth (Google OAuth)
- **Storage:** Firebase Storage (gs://b-things.firebasestorage.app)
- **Hosting:** Vercel (frontend) + Firebase (rules/storage)
- **Serverless:** Vercel serverless functions (`/api/` directory) for Slack bot + content proxy
- **Repo:** https://github.com/brhecht/b-resources (private)

## Folder Structure
- `src/App.jsx` — Router: / → Home, /inbox → Inbox (legacy), /library → Library, /vault → Vault, /references → References
- `src/pages/Library.jsx` — Full CRUD, modal as single editing surface, side panel preview, CollapsibleMessages
- `src/pages/Vault.jsx` — Same pattern as Library, asset-focused
- `src/pages/References.jsx` — NEW. Same pattern as Library. Teal accent (#5B9E8F). Collection: `references`. Default groups: Articles, Videos, Research, Guides, Tools.
- `src/pages/Inbox.jsx` — Legacy inbox page (removed from Home nav, still accessible at /inbox for old items)
- `src/pages/Home.jsx` — Dashboard with Library, Vault, References cards (Inbox removed)
- `src/components/` — GroupKanban, SidePanel, ResourceCard, ListView, MessageThread, TagInput, InlineNotes, TagFilter, ViewSwitcher, GroupManager, MarkdownRenderer, tagColors
- `api/slack-events.js` — Slack bot: classifies messages → Library/Vault/References, uploads files to Firebase Storage
- `api/firebase-admin.js` — Firebase Admin SDK init (Firestore + Storage)
- `api/fetch-content.js` — CORS proxy for Firebase Storage content
- `api/generate-summary.js` — AI summary generation
- `firestore.rules` — Full rules for b-things project (deployed from here Apr 2)
- `vercel.json` — SPA rewrites + serverless function config

## Current Status
Library, Vault, References pages work. **Slack bot signature verification fixed (May 5)** — verified end-to-end via Vercel logs and direct API tests. The Apr 2 belief that "text bot works" was incorrect: 40-day Vercel log audit showed **8 total events from Slack, all 401**. The bot has never successfully processed a real Slack message in production. Slack likely auto-disabled the event subscription after repeated 401s — Brian needs to re-verify the Request URL to reactivate.

## What Changed This Session (May 5, 2026)
1. **Bug fix — raw body parsing:** `api/slack-events.js` added `export const config = { api: { bodyParser: false } }` and switched to manual Buffer stream reading for Slack signature verification. The previous code did `JSON.stringify(req.body)` against Vercel's pre-parsed body, which produces a different byte sequence than the original (key order, whitespace) → HMAC always failed → all events returned 401.
2. **Bug fix — firebase-admin crash guard:** `api/firebase-admin.js` now wraps `JSON.parse(FIREBASE_SERVICE_ACCOUNT)` in try/catch to prevent cold-start crash if env var is missing or malformed.
3. **End-to-end verification (Vercel CLI):**
   - URL verification challenge → 200 ✅
   - Valid HMAC signature → 200 ✅
   - Invalid HMAC signature → 401 ✅
   - All 6 env vars confirmed present in Vercel: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, FIREBASE_SERVICE_ACCOUNT, CRON_SECRET, ANTHROPIC_API_KEY, CAPTURE_TOKEN
4. **Vercel logs audit (40d):** Confirmed no real Slack events processed. All historical traffic on Apr 2 deploy returned 401.
5. **HANDOFF.md updated** — Status corrected to reflect actual production behavior.

## What Changed This Session (April 2, 2026)

### New Features
1. **References page** — Full CRUD page for external content (articles, videos, research, guides, tools). Same architecture as Library/Vault with teal accent (#5B9E8F), kanban/grid/list views, side panel, modals, file upload, AI summaries, message threading. Firestore collection: `references`.
2. **Smart Slack bot classification** — Bot now supports:
   - Prefix routing: `library:` / `lib:`, `vault:`, `ref:` / `reference:` / `references:`
   - Keyword auto-classification (framework→Library, article→References, template→Vault, etc.)
   - URL domain detection (YouTube→References>Videos, GitHub→References>Tools, Medium→References>Articles)
   - Content type detection stored in Firestore
   - Section-specific emoji in replies (📚/🔒/🌐)
3. **File upload from Slack** — Bot downloads files from Slack and uploads to Firebase Storage. IMPLEMENTED but not working (see Known Issues).
4. **Inbox removed from navigation** — Bot routes everything directly to sections. No more triage step.
5. **References card on Home** — Globe icon, teal gradient.
6. **References move button on Inbox** — For legacy inbox items.

### Bug Fixes
1. **MessageThread notification URL** — Was hardcoded to vault for non-library collections. Now uses collectionName directly.
2. **Slack bot file_share subtype** — Was filtered out. Now accepts all subtypes except edits/deletes.
3. **Slack 3-second timeout** — Handler now responds 200 immediately, processes async.

### Firestore Rules Deployed (Apr 2)
- Added `references` collection rule (auth required)
- Added `inbox` collection rule (auth required)
- Deployed from this repo via `firebase deploy --only firestore:rules --project b-things`

⚠️ **Rules conflict:** Global CLAUDE.md says canonical rules live in `brain-inbox/firestore.rules`. But b-resources also deployed rules on Apr 2 and has the more complete ruleset (includes `references` + `inbox` which brain-inbox may not have). Until this is resolved, deploy rules from b-resources to avoid losing the Apr 2 additions. Long-term: consolidate into brain-inbox.

## Known Issues

### RESOLVED: Slack signature verification (caused both "text works" illusion and "files don't work")
**Symptom (historical):** Bot appeared to work for text in dev testing but never processed events in prod.
**Root cause:** `JSON.stringify(req.body)` produced different bytes than Slack's original payload → HMAC always failed → 401 on every real event.
**Fix:** `bodyParser: false` + manual raw Buffer reading. Verified May 5 with valid+invalid signature tests.
**Note:** What looked like "files don't work, text does" was probably misinterpretation of Slack URL verification (which bypasses signature check) being mistaken for full bot functioning. With signature now fixed, both text AND files should work — needs end-to-end test in #b-resources to confirm.

### POSSIBLE: Slack event subscription auto-disabled
After 30+ days of 401 responses, Slack may have disabled the event subscription.
**Action required:** Brian (or someone with Slack admin) goes to https://api.slack.com/apps/A0APJCW2DLZ → Event Subscriptions → click "Retry" or re-save the Request URL. Slack will send a fresh URL verification challenge that should now succeed.

### Pre-existing: Groups composite index
`Load groups error: The query requires an index` — affects Library, Vault, and References equally. The `groups` collection needs a composite index on `collection` + `order`. Fallback works (loads without order). Link to create: in console error.

### Pre-existing: Slack app channel
#b-resources is a **private channel**. Required `message.groups` event subscription + `groups:history` scope (both configured).

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
- FIREBASE_SERVICE_ACCOUNT — JSON string of service account key (needs Storage access)

## Firebase Access
- **Project:** `b-things`
- **Account with access:** `nico@humbleconviction.com` (Editor)
- **Account WITHOUT access:** `nmejiawork@gmail.com`
- **Firestore rules deployed from this repo** on Apr 2 (references + inbox rules added)

## Design Decisions
- **Modal is THE editing surface** — card click → modal with everything editable inline
- **References = external content** — Articles, videos, research, guides, tools from outside HC
- **Library = internal content** — Frameworks, playbooks, SOPs, templates created by HC
- **Vault = assets** — Brand files, credentials, legal docs, media
- **No more Inbox flow** — Bot classifies everything directly to a section (ungrouped if unsure)
- **Slack bot prefixes** — `lib:`, `vault:`, `ref:` as shorthands for quick classification
- **Teal accent for References** — #5B9E8F distinguishes from Library blue (#7B8FA8) and Vault brown (#A89078)
- **File upload path convention** — UI uploads: `{collection}/{userId}/...`, Slack bot: `{collection}/slack-bot/...`

## Slack Bot Classification Logic
| Input | Destination | Group |
|---|---|---|
| `library:` / `lib:` prefix | Library | Ungrouped |
| `vault:` prefix | Vault | Ungrouped |
| `ref:` / `reference:` / `references:` prefix | References | Ungrouped |
| Keywords: framework, playbook, sop, process, checklist | Library | Auto |
| Keywords: template, brand, logo, asset | Vault | Auto |
| Keywords: article, blog, video, tutorial, research, guide, tool, podcast | References | Auto |
| YouTube, Medium, GitHub, Spotify URLs | References | Auto by type |
| Other URLs (no prefix, no keywords) | References | Ungrouped |
| Files (no prefix) | Vault | Ungrouped |
| Plain text (no URLs, no files) | Library | Ungrouped |

## PENDING — Next Session
1. **Reactivate Slack event subscription** — Go to https://api.slack.com/apps/A0APJCW2DLZ → Event Subscriptions → re-save the Request URL (`https://b-resources.vercel.app/api/slack-events`). Slack should send a challenge → 200 → green check.
2. **End-to-end test in #b-resources:**
   - `library: test resource` → bot replies in thread, doc in `library` collection
   - `ref: https://youtube.com/watch?v=xyz` → bot classifies as Reference > Video
   - Drop a file (image/PDF) → bot classifies, uploads to Storage, doc has `fileUrl`
3. **Create composite index for groups** — Follow the link in the console error to create `collection` + `order` composite index.
4. **Mobile responsive testing** for References page.
5. **Seed References with starter content** if desired.
