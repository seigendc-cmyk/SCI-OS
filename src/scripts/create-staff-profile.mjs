import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.admin" });

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json";
const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";

const resolvedServiceAccountPath = path.resolve(
  process.cwd(),
  serviceAccountPath
);

if (!fs.existsSync(resolvedServiceAccountPath)) {
  throw new Error(
    `Service account file not found at: ${resolvedServiceAccountPath}`
  );
}

const serviceAccount = JSON.parse(
  fs.readFileSync(resolvedServiceAccountPath, "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db =
  firestoreDatabaseId === "(default)"
    ? getFirestore()
    : getFirestore(admin.app(), firestoreDatabaseId);

console.log("[STAFF PROFILE] Firestore database:", firestoreDatabaseId);

// --------------------------------------------------
// EDIT THESE VALUES FOR EACH STAFF MEMBER
// --------------------------------------------------

const staffId = "STAFF-AMADA-001";

const vendorId = "Qcz1jOKwlKXbvMFXauQMS8yz1Tc2";
const vendorName = "IYO Motor Spares";

const fullName = "Amanda Mlambo";
const phone = "+263779621432";
const whatsapp = "+263779621432";
const email = "amanda@example.com";

const role = "cashier";

const permissions = [
  "pos.terminal.use",
  "pos.sales.create",
  "pos.sales.view",
  "pos.receipts.print",
];

const createdBy = vendorId;
const createdByEmail = "vendorowner@gmail.com";

const inviteUrl = `https://gen-lang-client-0459000055--staging-gprjh686.web.app/staff-invite/${staffId}`;

// --------------------------------------------------
// DO NOT EDIT BELOW UNLESS CHANGING THE DATA MODEL
// --------------------------------------------------

const now = admin.firestore.FieldValue.serverTimestamp();

const staffPayload = {
  staffId,
  vendorId,
  vendorName,

  fullName,
  phone,
  whatsapp,
  email,

  role,
  permissions,

  status: "profile_created",
  loginStatus: "not_connected",
  authUid: "",
  vendorUserId: "",

  inviteCode: staffId,
  inviteUrl,

  createdBy,
  createdByEmail,

  createdAt: now,
  updatedAt: now,
};

await db.collection("staff").doc(staffId).set(staffPayload, {
  merge: true,
});

console.log("");
console.log("✅ STAFF PROFILE CREATED / UPDATED");
console.log("Collection: staff");
console.log("Document ID:", staffId);
console.log("Vendor:", vendorName);
console.log("Staff:", fullName);
console.log("Role:", role);
console.log("Status:", staffPayload.status);
console.log("Login Status:", staffPayload.loginStatus);
console.log("Invite URL:", inviteUrl);