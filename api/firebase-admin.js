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

const app =
  getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount),
        storageBucket: "b-things.firebasestorage.app",
      })
    : getApps()[0];

export const db = getFirestore(app);
export const bucket = getStorage(app).bucket();
