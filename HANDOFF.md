# HANDOFF — B Resources
*Last updated: March 26, 2026 (evening session)*
*Deploy: https://b-resources.vercel.app*

## What This App Does
B Resources is the knowledge and asset hub for Humble Conviction. It has three main sections: **Library** (documents, frameworks, playbooks, SOPs), **Vault** (brand assets, templates, credentials, files), and **Groups** (kanban-style boards for organizing resources). Used by Brian and the HC team to store and manage internal resources.

## Tech Stack
- **Frontend:** React 19 + Vite 6 + Tailwind CSS 4 + React Router 7
- **Database:** Firebase Firestore (project `b-things` — shared with Things, Content Calendar, B Nico, Eddy, B People)
- **Auth:** Firebase Auth (Google OAuth)
- **Storage:** Firebase Storage (gs://b-things.firebasestorage.app)
- **Hosting:** Vercel (frontend) + Firebase (rules/storage)
- **Serverless:** Vercel serverless functions (`/api/` directory) for Slack bot
- **Repo:** https://github.com/brhecht/b-resources (private)

## Folder Structure
- `src/App.jsx` — Router: / → Home, /library → Library, /vault → Vault
- `src/pages/Library.jsx` — Full CRUD with CollapsibleComments
- `src/pages/Vault.jsx` — Full CRUD with CollapsibleComments
- `src/pages/Home.jsx` — Dashboard/landing page
- `src/components/GroupKanban.jsx` — Vertical kanban layout for groups
- `src/components/CommentSection.jsx` — CollapsibleComments + CommentSection with @mention and Slack notifications
- `src/firebase.js` — Firebase init, exports db, auth, storage
- `api/slack-events.js` — Slack Events API handler (auto-classifies messages → Firestore)
- `api/slack-inbox-reminder.js` — Daily cron (9 AM) for stale inbox items
- `api/firebase-admin.js` — Firebase Admin SDK init from env
- `firestore.rules` — **MASTER rules for ALL b-things apps** (see Firebase Rules section)
- `storage.rules` — Firebase Storage security rules
- `vercel.json` — SPA rewrites + serverless function config

## Current Status
App is deployed and functional. Library and Vault pages work with full CRUD. GroupKanban renders vertically. CollapsibleComments integrated. **Slack bot is NOT receiving events** — needs app reinstall (see Known Issues).

## What Changed This Session (March 26, 2026 — evening)
1. **Slack bot debugging** — Sent test message in #b-resources, bot did not respond. Verified: Vercel logs show zero requests to `/api/slack-events`. Slack API dashboard confirmed Event Subscriptions ON, Request URL verified (`https://b-resources.vercel.app/api/slack-events`), `message.channels` subscribed, app installed to HC Community. **Root cause: Slack app needs reinstall to activate event subscription scopes.**
2. **Brian notified** — Sent Slack DM to Brian via Brain Inbox API with full update and reinstall instructions (link: https://api.slack.com/apps/A0APJCW2DLZ/install-on-team).

## Previous Session Changes (March 26, 2026 — earlier)
1. **GroupKanban vertical layout** — Committed and pushed to main
2. **CollapsibleComments** — Integrated into Library.jsx and Vault.jsx with Firestore sub-collections
3. **Slack bot pipeline** — Full setup: app creation, OAuth scopes, installation, env vars in Vercel, Event Subscriptions with verified URL, message.channels subscription, bot invited to #b-resources
4. **Firebase rules CRITICAL FIX** — Previous deploy had overwritten ALL b-things rules with only vault/library/groups. Built comprehensive merged ruleset covering ALL 6 apps and redeployed successfully.

## Firebase Rules (CRITICAL)
The `firestore.rules` file in this repo is now the **MASTER ruleset** for the entire `b-things` Firebase project. It covers:
- **B Things** — appConfig, users/tasks (+messages), users/projects, viewers
- **Brain Inbox** — nicoTasks, nicoProjects, inboxMessages, nicoNotes
- **B Resources** — vault, library, groups (all with `{document=**}` for comments sub-collections)
- **Content Calendar** — contentCards (+messages), contentPlatforms
- **Eddy** — restricted to Brian (`brhnyc1970@gmail.com`) and Nico (`nico@humbleconviction.com`)
- **B People** — contacts (+notes), feed_items, user_settings, mail
- **Catch-all deny** — blocks everything not explicitly allowed

⚠️ **NEVER deploy firestore rules from any other app folder** — always deploy from b-resources to avoid overwriting the master ruleset. Command:
```bash
firebase deploy --only firestore:rules --project b-things
```

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

## Known Issues
- **Slack bot not receiving events** — App needs reinstall at https://api.slack.com/apps/A0APJCW2DLZ/install-on-team (Brian must do this as workspace admin). After reinstall, re-test by sending a message in #b-resources and checking Vercel logs + Firestore.
- `nmejiawork@gmail.com` does NOT have Firebase Console access — must use `nico@humbleconviction.com`
- Git remote auth: HTTPS push works without token to `brhecht/b-resources`, SSH not configured

## PENDING — Next Session
1. **Re-test Slack bot** — After Brian reinstalls the app, send a message in #b-resources, verify bot responds in thread and creates Firestore doc. If still broken, check: (a) bot is still in the channel, (b) Vercel function logs for errors, (c) SLACK_BOT_TOKEN hasn't changed post-reinstall.
2. **Test CollapsibleComments** — Open an item in Library/Vault on production, post a comment, verify @Brian mention triggers Slack notification via Brain Inbox API
3. **Run seed script** — `node src/seed.js` to populate Library and Vault with starter HC content
4. **Mobile responsive testing**
5. **File type icons for Library cards**

## Design Decisions
- **Inline preview over new tab**: Files preview inside the modal
- **Edit replaces file optionally**: Metadata edits don't require re-upload
- **Image thumbnails on Vault cards**: Asset-focused section shows previews
- **Firestore rules require auth**: All reads/writes require `request.auth != null`
- **Master rules in b-resources**: Single source of truth for all b-things Firestore rules
- **CollapsibleComments**: Collapsed by default to keep UI clean, uses Firestore sub-collections `{collection}/{docId}/comments`
- **Slack bot auto-classifies**: Messages tagged to vault/library/general automatically
