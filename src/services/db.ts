import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
  serverTimestamp,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getFirestore,
} from 'firebase/firestore';

import { UserRole, AuditLogEntry } from '../types';
import { OperationType, handleFirestoreError } from '../contexts/AuthContext';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firestoreDatabaseId =
  import.meta.env.VITE_FIRESTORE_DATABASE_ID ||
  'ai-studio-7684b326-c3ce-4ebf-acb9-911e2f925d5a';

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firestoreDatabaseId);

/**
 * Log a system event to audit_logs
 */
export async function logAuditEvent(entry: Omit<AuditLogEntry, 'createdAt'>) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      ...entry,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'audit_logs');
  }
}

/**
 * Helper to remove undefined fields from an object
 */
export function removeUndefinedFields(obj: any) {
  const result: any = {};

  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined && obj[key] !== null) {
      result[key] = obj[key];
    } else if (obj[key] === null) {
      result[key] = null;
    }
  });

  return result;
}

export function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as T;
}

async function findRPNAgent(referralInput: string): Promise<{
  rpnId: string;
  rpnName: string;
  rpnCode: string;
  rpnRole: string;
}> {
  if (!referralInput) {
    return {
      rpnId: '',
      rpnName: 'Direct',
      rpnCode: '',
      rpnRole: '',
    };
  }

  console.log('[REGISTRATION RPN]', {
    rawCode: referralInput,
    mode: 'metadata_only',
    willWriteRpnAgents: false,
  });

  try {
    const rpnCollection = collection(db, 'rpn_agents');

    const qCode = query(rpnCollection, where('rpnCode', '==', referralInput));
    const snapCode = await getDocs(qCode);

    if (!snapCode.empty) {
      const data = snapCode.docs[0].data();

      return {
        rpnId: snapCode.docs[0].id,
        rpnName: data.fullName || data.name,
        rpnCode: data.rpnCode,
        rpnRole: data.role || '',
      };
    }

    const rpnDoc = await getDoc(doc(db, 'rpn_agents', referralInput));

    if (rpnDoc.exists()) {
      const data = rpnDoc.data();

      return {
        rpnId: rpnDoc.id,
        rpnName: data.fullName || data.name,
        rpnCode: data.rpnCode || '',
        rpnRole: data.role || '',
      };
    }

    const qPhone = query(rpnCollection, where('phone', '==', referralInput));
    const snapPhone = await getDocs(qPhone);

    if (!snapPhone.empty) {
      const data = snapPhone.docs[0].data();

      return {
        rpnId: snapPhone.docs[0].id,
        rpnName: data.fullName || data.name,
        rpnCode: data.rpnCode || '',
        rpnRole: data.role || '',
      };
    }
  } catch (err) {
    console.warn('[REGISTRATION RPN] Lookup failed or permission denied:', err);
  }

  return {
    rpnId: '',
    rpnName: 'Pending Verification',
    rpnCode: '',
    rpnRole: '',
  };
}

function mapBusinessTypeToSector(type: string) {
  switch (type) {
    case 'AGRICULTURE':
      return 'agriculture';
    case 'PROPERTY_AGENT':
      return 'property';
    case 'VEHICLE_DEALER':
      return 'vehicles';
    case 'PROFESSIONAL_SERVICES':
      return 'professional_services';
    case 'JOBBING_SERVICES':
      return 'jobbing_services';
    case 'HOTELS':
      return 'hotels';
    case 'MOTOR_SPARES':
      return 'motor_spares';
    case 'GROCERY':
      return 'grocery';
    case 'RETAILER':
      return 'retailer';
    default:
      return 'general';
  }
}

function getPlanPriceForType(type: string): number {
  const prices: Record<string, number> = {
    GENERAL_VENDOR: 4,
    GENERAL_DEALER: 4,
    RETAILER: 7,
    AGRICULTURE: 5,
    PROFESSIONAL_SERVICES: 3,
    PROFESSIONALS: 3,
    JOBBING_SERVICES: 4,
    PROPERTY_AGENT: 15,
    VEHICLE_DEALER: 10,
    MOTOR_SPARES: 8,
    GROCERY: 6,
    HOTELS: 12,
    TRANSPORT_LOGISTICS: 10,
    CLOTHING: 5,
    HARDWARE: 8,
  };

  return prices[type] || 4;
}

/**
 * Universal friendly error generator
 */
export function getFriendlyErrorMessage(error: any): string {
  if (!error) return 'An unknown error occurred.';

  const code = error?.code || '';
  const message = error?.message || String(error);

  if (code.includes('auth/email-already-in-use') || message.includes('auth/email-already-in-use')) {
    return 'This email is already registered. Please login instead.';
  }

  if (
    code.includes('auth/invalid-credential') ||
    code.includes('auth/user-not-found') ||
    code.includes('auth/wrong-password') ||
    message.includes('auth/invalid-credential') ||
    message.includes('auth/user-not-found') ||
    message.includes('auth/wrong-password')
  ) {
    return 'Invalid login credentials. Please try again.';
  }

  if (code.includes('auth/network-request-failed') || message.includes('auth/network-request-failed')) {
    return 'Network connection lost. Please check your connectivity.';
  }

  if (message.includes('Unsupported field value: undefined')) {
    return 'Some required form data is missing. Please complete the form and try again.';
  }

  if (message.includes('permission') || message.includes('insufficient')) {
    return 'Your store profile could not be verified. Please complete setup.';
  }

  return message;
}

/**
 * Initialize a new vendor profile foundation
 */
export async function registerVendorFoundation(
  uid: string,
  email: string,
  displayName: string,
  businessName: string,
  phone: string,
  whatsapp: string,
  city: string,
  sector: string,
  rpnId: string = '',
) {
  const vendorId = uid;
  const userRef = doc(db, 'app_users', uid);
  const vendorRef = doc(db, 'vendors', vendorId);
  const vendorUserRef = doc(db, 'vendorUsers', uid);
  const branchRef = doc(db, 'branches', `${vendorId}_main`);
  const subRef = doc(db, 'subscriptions', vendorId);

  console.log('[REGISTRATION] Protocol initiated via writeBatch.', {
    uid,
    vendorId,
    businessName,
  });

  const batch = writeBatch(db);

  try {
    const attribution = await findRPNAgent(rpnId);
    const rpnStatus = attribution.rpnId ? 'verified' : rpnId ? 'pending_verification' : 'direct';
    const rpnReferralCode = rpnId || '';

    const planPrice = getPlanPriceForType(sector);
    const normalizedSector = mapBusinessTypeToSector(sector);
    const now = serverTimestamp();

    const userPayload = removeUndefinedFields({
      uid,
      vendorId,
      email,
      displayName,
      phone,
      role: 'vendor_owner',
      businessType: sector,
      planPrice,
      profileStatus: 'active',
      rpnId: attribution.rpnId,
      rpnCode: attribution.rpnCode,
      rpnName: attribution.rpnName,
      rpnReferralCode,
      rpnStatus,
      createdAt: now,
      updatedAt: now,
    });

    batch.set(userRef, userPayload);

    const vendorPayload = removeUndefinedFields({
      vendorId,
      id: vendorId,
      ownerUid: uid,
      ownerId: vendorId,
      uid,
      name: businessName,
      businessName,
      displayName: businessName,
      email,
      phone,
      whatsapp,
      city,
      businessType: sector,
      sector: normalizedSector,
      status: 'published',
      visibility: 'public',
      verified: false,
      rating: 0,
      rank: 0,
      scoreGrade: 'New',
      rpnId: attribution.rpnId,
      rpnCode: attribution.rpnCode,
      rpnName: attribution.rpnName,
      rpnRole: attribution.rpnRole,
      rpnReferralCode,
      rpnStatus,
      createdAt: now,
      updatedAt: now,
    });

    batch.set(vendorRef, vendorPayload);

    const vendorUserPayload = removeUndefinedFields({
      uid,
      vendorId,
      email,
      displayName,
      role: 'vendor_owner',
      permissions: [
        'vendor.manage',
        'products.create',
        'products.edit',
        'inventory.manage',
        'orders.manage',
      ],
      active: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    batch.set(vendorUserRef, vendorUserPayload);

    batch.set(
      branchRef,
      removeUndefinedFields({
        branchId: `${vendorId}_main`,
        vendorId,
        branchName: 'Main Shop',
        name: 'Main Shop',
        type: 'shop',
        isMain: true,
        isMainBranch: true,
        status: 'active',
        city: city || '',
        geo: null,
        deliverySettings: {
          deliveryAvailable: false,
        },
        createdAt: now,
        updatedAt: now,
      }),
    );

    batch.set(
      subRef,
      removeUndefinedFields({
        subscriptionId: vendorId,
        vendorId,
        planId: sector,
        planCode: 'starter',
        status: 'active',
        currentLimit: 20,
        currentPrice: planPrice,
        currency: 'USD',
        entitlements: {
          pos: false,
          maxBranches: 0,
          maxTerminals: 0,
          maxStaff: 5,
          maxProducts: 50,
          cataloguesPerMonth: 1,
        },
        startsAt: now,
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await batch.commit();

    console.log('[REGISTRATION] SUCCESS: All 5 foundation records atomicized.');

    return { success: true };
  } catch (error: any) {
    console.error('[REGISTRATION] ATOMIC FAILED:', error);
    throw error;
  }
}

/**
 * Check if a vendor profile exists for the current user and return status.
 */
export async function ensureVendorProfileForCurrentUser(user: any) {
  if (!user) return { status: 'not_found' };

  const uid = user.uid;

  try {
    if (typeof window !== 'undefined') {
      const pendingData = sessionStorage.getItem('pendingVendorSignup');

      if (pendingData) {
        console.log(
          '[AUTH GATE] Found pendingVendorSignup in session. Attempting atomic resolution.',
        );

        try {
          const data = JSON.parse(pendingData);

          await completeGoogleVendorSignup(user, data);
          sessionStorage.removeItem('pendingVendorSignup');

          return { status: 'complete', vendor: null, created: true };
        } catch (e) {
          console.error('[AUTH GATE] Pending resolution failed:', e);
        }
      }
    }

    const userDocPromise = getDoc(doc(db, 'app_users', uid));
    const vendorDocPromise = getDoc(doc(db, 'vendors', uid));
    const vendorUserDocPromise = getDoc(doc(db, 'vendorUsers', uid));

    const [userSnap, vendorSnap, vendorUserSnap] = await Promise.all([
      userDocPromise,
      vendorDocPromise,
      vendorUserDocPromise,
    ]);

    if (userSnap.exists() && vendorSnap.exists() && vendorUserSnap.exists()) {
      return { status: 'complete', vendor: vendorSnap.data() };
    }

    if (userSnap.exists() && (!vendorSnap.exists() || !vendorUserSnap.exists())) {
      return { status: 'profile_incomplete' };
    }

    return { status: 'not_found' };
  } catch (error) {
    console.error('Error ensuring vendor profile:', error);
    return { status: 'error', error };
  }
}

/**
 * Complete Google Vendor Signup using atomic writeBatch
 */
export async function completeGoogleVendorSignup(user: any, data: any) {
  const { uid, email, displayName } = user;
  const { businessName, city, sector, phone, whatsapp, rpnId } = data;
  const vendorId = uid;

  const userRef = doc(db, 'app_users', uid);
  const vendorRef = doc(db, 'vendors', vendorId);
  const vendorUserRef = doc(db, 'vendorUsers', uid);
  const branchRef = doc(db, 'branches', `${vendorId}_main`);
  const subRef = doc(db, 'subscriptions', vendorId);

  console.log('[GOOGLE_ONBOARDING] Atomic Protocol initiated.', {
    uid,
    vendorId,
    businessName,
  });

  const batch = writeBatch(db);

  try {
    const attribution = await findRPNAgent(rpnId);
    const rpnStatus = attribution.rpnId ? 'verified' : rpnId ? 'pending_verification' : 'direct';
    const rpnReferralCode = rpnId || '';

    const planPrice = getPlanPriceForType(sector);
    const normalizedSector = mapBusinessTypeToSector(sector);
    const now = serverTimestamp();

    batch.set(
      userRef,
      removeUndefinedFields({
        uid,
        vendorId,
        email: email || '',
        displayName: displayName || businessName,
        phone: phone || '',
        role: 'vendor_owner',
        businessType: sector,
        planPrice,
        profileStatus: 'active',
        rpnId: attribution.rpnId,
        rpnName: attribution.rpnName,
        rpnCode: attribution.rpnCode,
        rpnReferralCode,
        rpnStatus,
        createdAt: now,
        updatedAt: now,
      }),
      { merge: true },
    );

    batch.set(
      vendorRef,
      removeUndefinedFields({
        vendorId,
        id: vendorId,
        ownerUid: uid,
        ownerId: vendorId,
        uid,
        name: businessName,
        businessName,
        displayName: businessName,
        email: email || '',
        phone: phone || '',
        whatsapp: whatsapp || '',
        city: city || '',
        businessType: sector,
        sector: normalizedSector,
        status: 'published',
        visibility: 'public',
        verified: false,
        rating: 0,
        rank: 0,
        scoreGrade: 'New',
        rpnId: attribution.rpnId,
        rpnCode: attribution.rpnCode,
        rpnName: attribution.rpnName,
        rpnRole: attribution.rpnRole,
        rpnReferralCode,
        rpnStatus,
        createdAt: now,
        updatedAt: now,
      }),
      { merge: true },
    );

    batch.set(
      vendorUserRef,
      removeUndefinedFields({
        uid,
        vendorId,
        email: email || '',
        displayName: displayName || businessName,
        role: 'vendor_owner',
        permissions: [
          'vendor.manage',
          'products.create',
          'products.edit',
          'inventory.manage',
          'orders.manage',
        ],
        active: true,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }),
      { merge: true },
    );

    batch.set(
      branchRef,
      removeUndefinedFields({
        branchId: `${vendorId}_main`,
        vendorId,
        branchName: 'Main Shop',
        name: 'Main Shop',
        type: 'shop',
        isMain: true,
        isMainBranch: true,
        status: 'active',
        city: city || '',
        geo: null,
        deliverySettings: {
          deliveryAvailable: false,
        },
        createdAt: now,
        updatedAt: now,
      }),
      { merge: true },
    );

    batch.set(
      subRef,
      removeUndefinedFields({
        subscriptionId: vendorId,
        vendorId,
        planId: sector,
        planCode: 'starter',
        status: 'active',
        currentLimit: 20,
        currentPrice: planPrice,
        currency: 'USD',
        entitlements: {
          pos: false,
          maxBranches: 0,
          maxTerminals: 0,
          maxStaff: 5,
          maxProducts: 50,
          cataloguesPerMonth: 1,
        },
        startsAt: now,
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
      }),
      { merge: true },
    );

    await batch.commit();

    console.log('[GOOGLE_ONBOARDING] SUCCESS: All records established atomically.');

    return { status: 'created_vendor' };
  } catch (error: any) {
    console.error('[GOOGLE_ONBOARDING] ATOMIC FAILED:', error);
    throw error;
  }
}

/**
 * Get vendor subscription
 */
export async function getVendorSubscription(vendorId: string): Promise<any | null> {
  if (!vendorId) return null;

  try {
    const subDoc = await getDoc(doc(db, 'subscriptions', vendorId));
    return subDoc.exists() ? subDoc.data() : null;
  } catch (error) {
    console.error('Error getting vendor subscription:', error);
    return null;
  }
}

/**
 * Check if vendor has POS entitlement
 */
export async function hasPOSEntitlement(vendorId: string): Promise<boolean> {
  const sub = await getVendorSubscription(vendorId);

  if (!sub) return false;

  return ['active', 'trial'].includes(String(sub.status || '')) && sub.entitlements?.pos === true;
}

/**
 * Ensure default shop for vendor exists
 */
export async function ensureDefaultShopForVendor(vendorId: string, vendorData?: any) {
  const branchId = `${vendorId}_main`;
  const branchRef = doc(db, 'branches', branchId);
  const now = serverTimestamp();

  try {
    const branchSnap = await getDoc(branchRef);

    if (!branchSnap.exists()) {
      const payload = removeUndefinedFields({
        branchId,
        vendorId,
        branchName: 'Main Shop',
        name: 'Main Shop',
        type: 'shop',
        isMain: true,
        isMainBranch: true,
        status: 'active',
        city: vendorData?.city || '',
        address: vendorData?.address || '',
        district: vendorData?.district || '',
        suburb: vendorData?.suburb || '',
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(branchRef, payload);

      console.log('[SHOP PROVISION] Default shop created:', branchId);
    }
  } catch (error) {
    console.error('Error ensuring default shop:', error);
  }
}

/**
 * Activate POS for vendor
 */
export async function activatePOSForVendor(vendorId: string, planCode: 'pos' | 'growth' | 'pro') {
  const subRef = doc(db, 'subscriptions', vendorId);
  const now = serverTimestamp();

  const entitlements: Record<string, any> = {
    pos: {
      pos: true,
      maxBranches: 1,
      maxTerminals: 1,
      maxStaff: 10,
      maxProducts: 300,
      cataloguesPerMonth: 2,
    },
    growth: {
      pos: true,
      maxBranches: 3,
      maxTerminals: 5,
      maxStaff: 30,
      maxProducts: 1000,
      cataloguesPerMonth: 5,
    },
    pro: {
      pos: true,
      maxBranches: 10,
      maxTerminals: 20,
      maxStaff: 100,
      maxProducts: 5000,
      cataloguesPerMonth: 20,
    },
  };

  try {
    const vendorSnap = await getDoc(doc(db, 'vendors', vendorId));
    const vendorData = vendorSnap.exists() ? vendorSnap.data() : null;

    const subPayload = removeUndefinedFields({
      planCode,
      status: 'active',
      entitlements: entitlements[planCode],
      updatedAt: now,
    });

    await setDoc(subRef, subPayload, { merge: true });

    await ensureDefaultShopForVendor(vendorId, vendorData);

    console.log(`[POS ACTIVATION] Vendor ${vendorId} activated on ${planCode} plan.`);

    return { success: true };
  } catch (error) {
    console.error('Error activating POS:', error);
    throw error;
  }
}