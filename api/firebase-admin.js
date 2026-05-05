import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
} catch (e) {
  console.error("FIREBASE_SERVICE_ACCOUNT parse error:", e.message);
  throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT env var");
}

const isNewApp = getApps().length === 0;
const app = isNewApp
  ? initializeApp({
      credential: cert(serviceAccount),
      storageBucket: "b-things.firebasestorage.app",
    })
  : getApps()[0];

const _db = getFirestore(app);
// Use REST instead of gRPC for Firestore — gRPC's persistent connection
// doesn't survive Vercel's stateless serverless functions and causes
// DEADLINE_EXCEEDED hangs (name resolution + LB pick stalls).
if (isNewApp) {
  _db.settings({ preferRest: true });
}

export const db = _db;
export const bucket = getStorage(app).bucket();
