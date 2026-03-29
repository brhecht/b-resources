import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: "AIzaSyDUdUq_JxA-MeU8tZIex0PVFExtWIz50kE",
  authDomain: "b-things.firebaseapp.com",
  projectId: "b-things",
  storageBucket: "b-things.firebasestorage.app",
  messagingSenderId: "995860081028",
  appId: "1:995860081028:web:25ebdd0a1b56b402d715d1",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app, "gs://b-things.firebasestorage.app")

// ── Message thread helpers ──────────────────────────────────────
import {
  collection as fbCollection,
  query as fbQuery,
  orderBy as fbOrderBy,
  onSnapshot as fbOnSnapshot,
  addDoc as fbAddDoc,
  doc as fbDoc,
  setDoc as fbSetDoc,
} from "firebase/firestore"

/** Subscribe to messages on a resource. Returns unsubscribe fn. */
export function subscribeMessages(collectionName, docId, callback) {
  const q = fbQuery(
    fbCollection(db, collectionName, docId, "messages"),
    fbOrderBy("timestamp", "asc")
  )
  return fbOnSnapshot(q, (snap) => {
    const msgs = []
    snap.forEach((d) => msgs.push({ id: d.id, ...d.data() }))
    callback(msgs)
  })
}

/** Add a message to a resource's message thread. */
export function addMessage(collectionName, docId, msg) {
  return fbAddDoc(fbCollection(db, collectionName, docId, "messages"), msg)
}

/** Update card-level message metadata (for unread indicators). */
export function updateMsgMeta(collectionName, docId, authorEmail) {
  return fbSetDoc(fbDoc(db, collectionName, docId), {
    _msgMeta: {
      lastAt: Date.now(),
      lastBy: authorEmail,
      readBy: { [authorEmail.replace(/\./g, "_")]: true },
    },
  }, { merge: true })
}

/** Mark messages as read for a given user email. */
export function markMsgMetaRead(collectionName, docId, email) {
  return fbSetDoc(fbDoc(db, collectionName, docId), {
    _msgMeta: {
      readBy: { [email.replace(/\./g, "_")]: true },
    },
  }, { merge: true })
}

const provider = new GoogleAuthProvider()
export const signInWithGoogle = () => signInWithPopup(auth, provider)
export const logOut = () => firebaseSignOut(auth)
export { onAuthStateChanged }
