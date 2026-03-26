import { db } from "./firebase-admin.js";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const NICO_SLACK_USER_ID = "U09GRAMET4H";

async function sendSlackDM(userId, text) {
  // Open a DM channel with the user
  const openRes = await fetch("https://slack.com/api/conversations.open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ users: userId }),
  });
  const openData = await openRes.json();

  if (!openData.ok) {
    console.error("Failed to open DM:", openData.error);
    return;
  }

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: openData.channel.id,
      text,
    }),
  });
}

export default async function handler(req, res) {
  // Verify this is a cron request (Vercel sets this header)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Query for inbox items older than 24 hours
    const snapshot = await db
      .collection("library")
      .where("groupId", "==", "inbox")
      .where("createdAt", "<", twentyFourHoursAgo)
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ message: "No stale inbox items" });
    }

    const titles = snapshot.docs.map((doc) => doc.data().title);
    const count = titles.length;
    const titleList = titles.map((t) => `• ${t}`).join("\n");

    const message = `📥 You have ${count} item${count > 1 ? "s" : ""} in B Resources Inbox waiting to be organized:\n${titleList}\n\nOrganize at: b-resources.vercel.app`;

    await sendSlackDM(NICO_SLACK_USER_ID, message);

    return res.status(200).json({ message: `Notified about ${count} items` });
  } catch (err) {
    console.error("Inbox reminder error:", err);
    return res.status(500).json({ error: "Failed to check inbox" });
  }
}
