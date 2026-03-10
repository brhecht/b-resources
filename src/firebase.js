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
export const storage = getStorage(app)

const provider = new GoogleAuthProvider()
export const signInWithGoogle = () => signInWithPopup(auth, provider)
export const logOut = () => firebaseSignOut(auth)
export { onAuthStateChanged }
