# Slack Bot Setup — B Resources Bot

## 1. Create the Slack App

1. Go to https://api.slack.com/apps → **Create New App** → **From scratch**
2. App Name: `B Resources Bot`
3. Workspace: HC Community
4. Click **Create App**

## 2. Configure Event Subscriptions

1. Go to **Event Subscriptions** in the left sidebar
2. Toggle **Enable Events** to ON
3. Request URL: `https://b-resources.vercel.app/api/slack-events`
   - Slack will send a challenge request — the endpoint handles this automatically
4. Under **Subscribe to bot events**, add:
   - `message.channels`
5. Click **Save Changes**

## 3. Set OAuth Permissions

1. Go to **OAuth & Permissions** in the left sidebar
2. Under **Bot Token Scopes**, add:
   - `channels:history` — read messages in public channels
   - `chat:write` — post replies in threads
   - `channels:read` — list channels
   - `im:write` — send DMs (for inbox reminders)
3. Click **Install to Workspace** at the top
4. Authorize the app
5. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

## 4. Get Signing Secret

1. Go to **Basic Information** in the left sidebar
2. Under **App Credentials**, copy the **Signing Secret**

## 5. Set Environment Variables

In the Vercel dashboard for b-resources (Settings → Environment Variables), add:

| Variable | Value |
|----------|-------|
| `SLACK_BOT_TOKEN` | Bot User OAuth Token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Signing Secret from Basic Information |
| `FIREBASE_SERVICE_ACCOUNT` | JSON stringified service account key for `b-things` |
| `CRON_SECRET` | Random string for cron auth (also set in Vercel cron config) |

## 6. Invite Bot to Channel

In Slack, go to **#b-resources** and run:
```
/invite @B Resources Bot
```

## 7. Test It

Post a message in #b-resources:
- `framework: Brian's 10-element pitch structure` → should auto-classify to Library
- `vault: HC logo files` → should auto-classify to Vault
- `check out this link https://example.com` → should go to Library
- `random thought` → should go to Inbox

The bot will reply in-thread confirming where it was filed.
