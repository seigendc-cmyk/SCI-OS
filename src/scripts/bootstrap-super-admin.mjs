console.log('[BOOTSTRAP FILE LOADED]');

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.admin' });

const {
  FIREBASE_SERVICE_ACCOUNT_PATH,
  FIRESTORE_DATABASE_ID,
  SUPER_ADMIN_UID,
  OLD_SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  SUPER_ADMIN_DISPLAY_NAME = 'seiGEN Super Admin',
} = process.env;

function required(name, value) {
  if (!value || String(value).trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return String(value).trim();
}

const serviceAccountPath = required(
  'FIREBASE_SERVICE_ACCOUNT_PATH',
  FIREBASE_SERVICE_ACCOUNT_PATH,
);

const targetEmail = required('SUPER_ADMIN_EMAIL', SUPER_ADMIN_EMAIL);
const targetPassword = required('SUPER_ADMIN_PASSWORD', SUPER_ADMIN_PASSWORD);
const targetDisplayName = String(SUPER_ADMIN_DISPLAY_NAME || 'seiGEN Super Admin').trim();
const firestoreDatabaseId = String(FIRESTORE_DATABASE_ID || '(default)').trim();

if (targetPassword.length < 6) {
  throw new Error('SUPER_ADMIN_PASSWORD must be at least 6 characters.');
}

const resolvedServiceAccountPath = path.resolve(process.cwd(), serviceAccountPath);

console.log('[BOOTSTRAP] Working directory:', process.cwd());
console.log('[BOOTSTRAP] Service account path:', resolvedServiceAccountPath);
console.log('[BOOTSTRAP] Firestore database ID:', firestoreDatabaseId);

if (!fs.existsSync(resolvedServiceAccountPath)) {
  throw new Error(`Service account file not found at: ${resolvedServiceAccountPath}`);
}

const serviceAccount = JSON.parse(fs.readFileSync(resolvedServiceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();

const db =
  firestoreDatabaseId === '(default)'
    ? getFirestore()
    : getFirestore(admin.app(), firestoreDatabaseId);

async function findExistingUser() {
  if (SUPER_ADMIN_UID && SUPER_ADMIN_UID.trim()) {
    try {
      console.log('[BOOTSTRAP] Looking for existing user by SUPER_ADMIN_UID...');
      return await auth.getUser(SUPER_ADMIN_UID.trim());
    } catch (error) {
      console.warn('[BOOTSTRAP] SUPER_ADMIN_UID not found. Will continue.');
    }
  }

  if (OLD_SUPER_ADMIN_EMAIL && OLD_SUPER_ADMIN_EMAIL.trim()) {
    try {
      console.log('[BOOTSTRAP] Looking for existing user by OLD_SUPER_ADMIN_EMAIL...');
      return await auth.getUserByEmail(OLD_SUPER_ADMIN_EMAIL.trim());
    } catch (error) {
      console.warn('[BOOTSTRAP] OLD_SUPER_ADMIN_EMAIL not found. Will continue.');
    }
  }

  try {
    console.log('[BOOTSTRAP] Looking for existing user by SUPER_ADMIN_EMAIL...');
    return await auth.getUserByEmail(targetEmail);
  } catch (error) {
    return null;
  }
}

async function bootstrapSuperAdmin() {
  console.log('[BOOTSTRAP] Starting super admin bootstrap...');
  console.log('[BOOTSTRAP] Target email:', targetEmail);

  const existingUser = await findExistingUser();

  let userRecord;

  if (existingUser) {
    console.log('[BOOTSTRAP] Existing admin user found:', existingUser.uid);

    userRecord = await auth.updateUser(existingUser.uid, {
      email: targetEmail,
      password: targetPassword,
      displayName: targetDisplayName,
      emailVerified: true,
      disabled: false,
    });

    console.log('[BOOTSTRAP] Firebase Auth user updated:', userRecord.uid);
  } else {
    userRecord = await auth.createUser({
      email: targetEmail,
      password: targetPassword,
      displayName: targetDisplayName,
      emailVerified: true,
      disabled: false,
    });

    console.log('[BOOTSTRAP] Firebase Auth user created:', userRecord.uid);
  }

  const uid = userRecord.uid;
  const now = admin.firestore.FieldValue.serverTimestamp();

  const permissions = [
    'console.full_access',
    'console.staff.manage',
    'console.vendors.manage',
    'console.subscriptions.manage',
    'console.pos.activate',
    'console.finance.view',
    'console.audit.view',
    'console.rules.manage',
  ];

  const appUserPayload = {
    uid,
    email: targetEmail,
    displayName: targetDisplayName,
    fullName: targetDisplayName,
    role: 'super_admin',
    profileStatus: 'active',
    userType: 'console',
    consoleAccess: true,
    status: 'active',
    permissions,
    updatedAt: now,
    createdAt: now,
  };

  const consoleStaffPayload = {
    uid,
    email: targetEmail,
    displayName: targetDisplayName,
    fullName: targetDisplayName,
    role: 'super_admin',
    status: 'active',
    consoleAccess: true,
    permissions,
    acceptedAt: now,
    updatedAt: now,
    createdAt: now,
  };

  await db.collection('app_users').doc(uid).set(appUserPayload, { merge: true });
  console.log('[BOOTSTRAP] app_users record created/updated:', uid);

  await db.collection('console_staff').doc(uid).set(consoleStaffPayload, {
    merge: true,
  });
  console.log('[BOOTSTRAP] console_staff record created/updated:', uid);

  console.log('');
  console.log('✅ SUPER ADMIN READY');
  console.log('UID:', uid);
  console.log('Email:', targetEmail);
  console.log('Display Name:', targetDisplayName);
  console.log('Firestore Database:', firestoreDatabaseId);
  console.log('');
  console.log('Login route: /console-login');
}

bootstrapSuperAdmin().catch((error) => {
  console.error('');
  console.error('❌ SUPER ADMIN BOOTSTRAP FAILED');
  console.error(error);
  process.exit(1);
});