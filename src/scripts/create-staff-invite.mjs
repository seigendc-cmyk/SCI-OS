import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.admin" });

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json";
const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";

const resolvedServiceAccountPath = path.resolve(process.cwd(), serviceAccountPath);

if (!fs.existsSync(resolvedServiceAccountPath)) {
  throw new Error(`Service account file not found at: ${resolvedServiceAccountPath}`);
}

const serviceAccount = JSON.parse(fs.readFileSync(resolvedServiceAccountPath, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db =
  firestoreDatabaseId === "(default)"
    ? getFirestore()
    : getFirestore(admin.app(), firestoreDatabaseId);

console.log("[STAFF INVITE] Firestore database:", firestoreDatabaseId);

const inviteId = "STAFF-AMADA-001";
const vendorId = "Qcz1jOKwlKXbvMFXauQMS8yz1Tc2";

const invitePayload = {
  inviteId,
  vendorId,
  vendorName: "IYO Motor Spares",
  staffName: "Amanda Mlambo",
  phone: "+263779621432",
  whatsapp: "+263779621432",
  email: "amanda@example.com",
  role: "cashier",
  permissions: [
    "pos.terminal.use",
    "pos.sales.create",
    "pos.sales.view",
    "pos.receipts.print"
  ],
  status: "pending",
  inviteCode: inviteId,
  inviteUrl: `http://localhost:3000/staff-invite/${inviteId}`,
  invitedBy: vendorId,
  invitedByEmail: "vendorowner@gmail.com",
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  expiresAt: admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  )
};

await db.collection("staff_invites").doc(inviteId).set(invitePayload, {
  merge: true,
});

console.log("");
console.log("✅ STAFF INVITE CREATED / UPDATED");
console.log("Collection: staff_invites");
console.log("Document ID:", inviteId);
console.log("Staff:", invitePayload.staffName);
console.log("Role:", invitePayload.role);
console.log("Invite URL:", invitePayload.inviteUrl);
