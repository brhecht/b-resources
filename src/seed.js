import { initializeApp } from "firebase/app"
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyDUdUq_JxA-MeU8tZIex0PVFExtWIz50kE",
  authDomain: "b-things.firebaseapp.com",
  projectId: "b-things",
  storageBucket: "b-things.firebasestorage.app",
  messagingSenderId: "995860081028",
  appId: "1:995860081028:web:25ebdd0a1b56b402d715d1",
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const libraryDocs = [
  {
    title: "30-Second Pitch Framework",
    category: "Framework",
    description: "Brian's core 10-element pitch structure for delivering a compelling 30-second investor pitch.",
    content:
      "Element 1: Hook — open with a surprising stat or bold claim.\n" +
      "Element 2: Problem — describe the pain in one sentence.\n" +
      "Element 3: Insight — what most people miss.\n" +
      "Element 4: Solution — your product in plain English.\n" +
      "Element 5: Traction — proof it works (numbers).\n" +
      "Element 6: Market — size and why now.\n" +
      "Element 7: Model — how you make money.\n" +
      "Element 8: Team — why you specifically.\n" +
      "Element 9: Ask — what you need.\n" +
      "Element 10: Close — memorable last line.",
    tags: ["pitch", "framework", "30-second", "pillar-1"],
    status: "Active",
    priority: 3,
    createdAt: serverTimestamp(),
    uid: "seed",
  },
  {
    title: "Investor Q&A Playbook",
    category: "Playbook",
    description: "How to handle the four types of investor questions: confusion, clarification, challenge, and curiosity.",
    content:
      "Confusion → Simplify. Restate your point in fewer words.\n" +
      "Clarification → Go one level deeper with a specific example.\n" +
      "Challenge → Acknowledge, then reframe with data.\n" +
      "Curiosity → This is buying signal. Expand and invite follow-up.\n\n" +
      "Golden rule: never get defensive. Every question is an opportunity to demonstrate self-awareness.",
    tags: ["Q&A", "investor-meetings", "pillar-3", "closing"],
    status: "Active",
    priority: 2,
    createdAt: serverTimestamp(),
    uid: "seed",
  },
  {
    title: "Humble Conviction Delivery SOP",
    category: "SOP",
    description: "Step-by-step process for coaching founders on delivery — Pillar 2: How to Say It.",
    content:
      "1. Record a 60-second selfie pitch (no script).\n" +
      "2. Review: identify filler words, pacing issues, eye contact breaks.\n" +
      "3. Rewrite the opening sentence for clarity.\n" +
      "4. Practice 3x with timer — aim for 30s.\n" +
      "5. Record again. Compare side by side.\n" +
      "6. Repeat until the founder can deliver without looking at notes.",
    tags: ["delivery", "coaching", "pillar-2", "SOP"],
    status: "Active",
    priority: 2,
    createdAt: serverTimestamp(),
    uid: "seed",
  },
  {
    title: "Dunning-Kruger Pitch Assessment Reference",
    category: "Reference",
    description: "Reference doc mapping the Dunning-Kruger curve to founder pitch readiness for the HC quiz funnel.",
    content:
      "Peak of Mt. Stupid → Founder thinks their pitch is great, hasn't tested it with real investors.\n" +
      "Valley of Despair → Founder got rejected, doesn't know why, considers giving up.\n" +
      "Slope of Enlightenment → Founder is coachable, aware of gaps, ready for structured help.\n\n" +
      "Quiz tiers:\n" +
      "- Lost in the Noise → Mt. Stupid or early Valley\n" +
      "- The Pieces Are There → Mid Valley, some self-awareness\n" +
      "- So Close It Hurts → Slope of Enlightenment, needs refinement",
    tags: ["quiz-funnel", "assessment", "dunning-kruger", "ICP"],
    status: "Active",
    priority: 1,
    createdAt: serverTimestamp(),
    uid: "seed",
  },
  {
    title: "Contrarian Positioning Framework",
    category: "Framework",
    description: "Brian's four contrarian positions that differentiate HC from generic pitch coaching.",
    content:
      "Position 1: Whole Package, Not Template — every founder is different, no fill-in-the-blank decks.\n" +
      "Position 2: Investors Are Humans — stop treating them like ATMs, build a real conversation.\n" +
      "Position 3: Nobody Tells Founders the Truth — advisors sugarcoat, Brian doesn't.\n" +
      "Position 4: Conversation, Not Pitch — the best pitches feel like a dialogue, not a monologue.",
    tags: ["positioning", "brand", "contrarian", "messaging"],
    status: "Inbox",
    priority: 1,
    createdAt: serverTimestamp(),
    uid: "seed",
  },
]

const vaultAssets = [
  {
    name: "HC Brand Guidelines v2",
    category: "Brand",
    description: "Current brand guidelines including logo usage, color palette, typography, and tone of voice for Humble Conviction.",
    tags: ["brand", "guidelines", "design", "tone-of-voice"],
    status: "Active",
    priority: 3,
    fileUrl: "",
    fileName: "hc-brand-guidelines-v2.pdf",
    fileSize: 0,
    fileType: "application/pdf",
    storagePath: "",
    createdAt: serverTimestamp(),
    uid: "seed",
  },
  {
    name: "Founder Intake Form Template",
    category: "Template",
    description: "Google Form template used to onboard new coaching clients — collects company stage, pitch history, and goals.",
    tags: ["onboarding", "intake", "template", "coaching"],
    status: "Active",
    priority: 2,
    fileUrl: "",
    fileName: "founder-intake-form.docx",
    fileSize: 0,
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storagePath: "",
    createdAt: serverTimestamp(),
    uid: "seed",
  },
  {
    name: "Beehiiv API Credentials",
    category: "Credentials",
    description: "API key and publication ID for the HC newsletter on Beehiiv. Do not share externally.",
    tags: ["beehiiv", "newsletter", "API", "credentials"],
    status: "Active",
    priority: 3,
    fileUrl: "",
    fileName: "beehiiv-credentials.txt",
    fileSize: 0,
    fileType: "text/plain",
    storagePath: "",
    createdAt: serverTimestamp(),
    uid: "seed",
  },
  {
    name: "Pitch Scorecard PDF",
    category: "Document",
    description: "Printable scorecard Brian uses during live pitch reviews — rates clarity, conviction, structure, and Q&A readiness.",
    tags: ["scorecard", "pitch-review", "coaching", "printable"],
    status: "Active",
    priority: 2,
    fileUrl: "",
    fileName: "pitch-scorecard.pdf",
    fileSize: 0,
    fileType: "application/pdf",
    storagePath: "",
    createdAt: serverTimestamp(),
    uid: "seed",
  },
  {
    name: "Quiz Funnel Email Drip Templates",
    category: "Template",
    description: "5-email drip sequence templates for the HC quiz funnel — from result delivery through coaching CTA.",
    tags: ["email", "drip", "quiz-funnel", "marketing"],
    status: "Inbox",
    priority: 1,
    fileUrl: "",
    fileName: "quiz-drip-templates.html",
    fileSize: 0,
    fileType: "text/html",
    storagePath: "",
    createdAt: serverTimestamp(),
    uid: "seed",
  },
]

async function seed() {
  console.log("Seeding Firestore...")

  console.log("\n--- Library ---")
  for (const doc of libraryDocs) {
    const ref = await addDoc(collection(db, "library"), doc)
    console.log(`  Added: ${doc.title} → ${ref.id}`)
  }

  console.log("\n--- Vault ---")
  for (const asset of vaultAssets) {
    const ref = await addDoc(collection(db, "vault"), asset)
    console.log(`  Added: ${asset.name} → ${ref.id}`)
  }

  console.log("\nDone. 5 library docs + 5 vault assets seeded.")
  process.exit(0)
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
