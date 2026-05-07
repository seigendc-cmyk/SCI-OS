import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getCountFromServer,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createAuditLog } from '../services/orderService';

export interface PlanLimits {
  products: number;
  branches: number;
  catalogues: number;
  staff: number;
  notices: number;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  limits: PlanLimits;
}

export interface Subscription {
  id: string;
  vendorId: string;
  planId: string;
  planCode: string;
  status: 'active' | 'trial' | 'expired' | 'suspended' | 'pending_activation';
  startsAt: any;
  expiresAt: any;
  activationSource?: string;
  lastActivationRequestId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const PLAN_TEMPLATES: Record<string, Plan> = {
  starter: {
    id: 'starter',
    code: 'starter',
    name: 'Starter Protocol',
    limits: {
      products: 50,
      branches: 1,
      catalogues: 2,
      staff: 1,
      notices: 0,
    },
  },
  growth: {
    id: 'growth',
    code: 'growth',
    name: 'Growth Engine',
    limits: {
      products: 300,
      branches: 3,
      catalogues: 10,
      staff: 5,
      notices: 5,
    },
  },
  pro: {
    id: 'pro',
    code: 'pro',
    name: 'Professional Tier',
    limits: {
      products: 1000,
      branches: 10,
      catalogues: 30,
      staff: 20,
      notices: 20,
    },
  },
};

export const useSubscription = () => {
  const { vendorId, isVendorOwner } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUsageError, setHasUsageError] = useState(false);
  const [hasSyncError, setHasSyncError] = useState(false);
  const [usage, setUsage] = useState<PlanLimits>({
    products: 0,
    branches: 0,
    catalogues: 0,
    staff: 0,
    notices: 0,
  });

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }

    console.log(`[SUBSCRIPTION] Initiating load protocol for vendorId: ${vendorId}`);

    const loadSubscription = async () => {
      try {
        // 1. Direct fetch (Priority 1) - Path: subscriptions/{vendorId}
        console.log(`[SUBSCRIPTION] Attempting direct fetch for: ${vendorId}`);
        const subDocRef = doc(db, 'subscriptions', vendorId);
        const directSnap = await getDoc(subDocRef);

        let selectedSub: Subscription | null = null;

        if (directSnap.exists()) {
          console.log('[SUBSCRIPTION] Direct subscription document found.');
          selectedSub = {
            id: directSnap.id,
            ...directSnap.data(),
          } as Subscription;
        } else {
          console.log(
            '[SUBSCRIPTION] Direct document missing. Checking for legacy/associated documents...',
          );
          // 2. Query fallback (Priority 2) - Must use vendorId filter
          const q = query(collection(db, 'subscriptions'), where('vendorId', '==', vendorId));
          const querySnap = await getDocs(q);

          if (!querySnap.empty) {
            const candidates = querySnap.docs.map(
              (d) => ({ id: d.id, ...d.data() }) as Subscription,
            );
            console.log(`[SUBSCRIPTION] Found ${candidates.length} candidate documents.`);

            const statusWeights: Record<string, number> = {
              active: 5,
              trial: 4,
              pending_activation: 3,
              expired: 2,
              suspended: 1,
            };

            selectedSub = candidates.sort((a, b) => {
              const weightA = statusWeights[a.status] || 0;
              const weightB = statusWeights[b.status] || 0;
              if (weightA !== weightB) return weightB - weightA;
              const timeA = a.updatedAt?.toMillis() || a.createdAt?.toMillis() || 0;
              const timeB = b.updatedAt?.toMillis() || b.createdAt?.toMillis() || 0;
              return timeB - timeA;
            })[0];
          }
        }

        if (selectedSub) {
          processSubscriptionData(selectedSub);
        } else {
          console.log('[SUBSCRIPTION] No valid subscription records identified.');
        }
      } catch (err: any) {
        console.error('[SUBSCRIPTION] Fetch protocol failed:', err.code, err.message);
        setHasSyncError(true);
      } finally {
        setLoading(false);
      }
    };

    const processSubscriptionData = async (selectedSub: Subscription) => {
      console.log('[SUBSCRIPTION] Processor active:', {
        id: selectedSub.id,
        status: selectedSub.status,
        planCode: selectedSub.planCode,
      });

      setSubscription(selectedSub);

      const planCode = (selectedSub.planCode || 'starter').toLowerCase();
      const planData = PLAN_TEMPLATES[planCode] || PLAN_TEMPLATES.starter;
      setPlan(planData);

      const expiresAtMillis =
        selectedSub.expiresAt?.toMillis?.() ||
        (selectedSub.expiresAt instanceof Date ? selectedSub.expiresAt.getTime() : 0);
      const daysRemaining = expiresAtMillis
        ? Math.max(0, Math.ceil((expiresAtMillis - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;
      console.log(`[SUBSCRIPTION] UI state updated. Days remaining: ${daysRemaining}`);

      await fetchUsageData();
    };

    const fetchUsageData = async () => {
      const results: PlanLimits = {
        products: 0,
        branches: 0,
        catalogues: 0,
        staff: 0,
        notices: 0,
      };
      let hasUsageError = false;

      const getCount = async (collectionName: string, label: string) => {
        try {
          const q = query(collection(db, collectionName), where('vendorId', '==', vendorId));
          const snap = await getCountFromServer(q);
          return snap.data().count;
        } catch (err: any) {
          console.error(`${label} usage query failed:`, err.code, err.message);
          hasUsageError = true;
          return 0;
        }
      };

      results.products = await getCount('products', 'products');
      results.branches = await getCount('branches', 'branches');
      results.catalogues = await getCount('catalogues', 'catalogues');
      results.staff = await getCount('staff', 'staff');
      results.notices = await getCount('notices', 'notices');
      console.log('[SUBSCRIPTION] Usage counts loaded:', results);

      try {
        const qOrders = query(collection(db, 'orders'), where('vendorId', '==', vendorId));
        await getCountFromServer(qOrders);
      } catch (e: any) {
        console.error('orders usage query failed (diagnostic check):', e?.code, e?.message);
      }

      if (hasUsageError) {
        setHasUsageError(true);
      }
      setUsage(results);
    };

    loadSubscription();
  }, [vendorId, isVendorOwner]);

  const createTrialSubscription = async () => {
    if (!vendorId) return;
    try {
      console.log(`[SUBSCRIPTION] Initiating verification for vendor: ${vendorId}`);
      const subRef = doc(db, 'subscriptions', vendorId);
      const subSnap = await getDoc(subRef);

      if (subSnap.exists()) {
        console.log('[SUBSCRIPTION] Existing node confirmed. Initialization aborted.');
        return;
      }

      console.log('[SUBSCRIPTION] Constructing 7-day trial payload...');
      const trialPayload = {
        subscriptionId: vendorId, // Must match document key for security rules
        vendorId: vendorId, // Associated vendor identity
        planId: 'starter',
        planCode: 'starter',
        status: 'trial',
        startsAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        activationSource: 'trial',
        lastActivationRequestId: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('[SUBSCRIPTION] Trial payload ready:', JSON.stringify(trialPayload));
      await setDoc(subRef, trialPayload);
      console.log('[SUBSCRIPTION] Trial initialization success.');

      await createAuditLog({
        action: 'TRIAL_SUBSCRIPTION_CREATED',
        targetType: 'subscription',
        targetId: vendorId,
        vendorId: vendorId,
        metadata: { planCode: 'starter', activationSource: 'trial' },
      });
    } catch (err: any) {
      console.error('[SUBSCRIPTION] trial initialization error:', err.code, err.message);
    }
  };

  useEffect(() => {
    if (isVendorOwner && vendorId && loading === false && !subscription) {
      createTrialSubscription();
    }
  }, [isVendorOwner, vendorId, loading, subscription]);

  const checkQuota = (type: keyof PlanLimits) => {
    if (!isActive) {
      return {
        allowed: false,
        message:
          subscription?.status === 'pending_activation'
            ? 'Your subscription activation is pending review. Actions are restricted.'
            : subscription?.status === 'suspended'
              ? 'Your account has been suspended. Please contact support.'
              : subscription?.status === 'expired'
                ? 'Your subscription has expired. Please renew to continue.'
                : 'An active subscription is required to perform this action.',
      };
    }

    if (!plan) return { allowed: true };
    const currentUsage = usage[type];
    const limitValue = plan.limits[type];

    if (currentUsage >= limitValue) {
      createAuditLog({
        action: 'QUOTA_LIMIT_BLOCKED',
        targetType: 'quota',
        targetId: type,
        vendorId: vendorId || 'unknown',
        metadata: {
          feature: type,
          usage: currentUsage,
          limit: limitValue,
          planCode: plan.code,
        },
      });
      return {
        allowed: false,
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} limit reached for your current plan.`,
      };
    }
    return { allowed: true };
  };

  const isExpired = subscription?.expiresAt
    ? subscription.expiresAt.toMillis() < Date.now()
    : false;
  const isActive =
    subscription?.status === 'active' || (subscription?.status === 'trial' && !isExpired);
  const daysRemaining = subscription?.expiresAt
    ? Math.max(
        0,
        Math.ceil((subscription.expiresAt.toMillis() - Date.now()) / (1000 * 60 * 60 * 24)),
      )
    : 0;

  return {
    subscription,
    plan,
    usage,
    loading,
    hasUsageError,
    hasSyncError,
    checkQuota,
    isActive,
    isTrial: subscription?.status === 'trial',
    isExpired,
    daysRemaining,
  };
};
