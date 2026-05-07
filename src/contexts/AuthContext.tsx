import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AppUser, UserRole, Subscription } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  appUser: AppUser | null;
  subscription: Subscription | null;
  loading: boolean;
  appUserLoading: boolean;
  isSuperAdmin: boolean;
  isConsoleAdmin: boolean;
  isConsoleStaff: boolean;
  isVendorOwner: boolean;
  isVendorStaff: boolean;
  isVendorUser: boolean;
  isPOSEnabled: boolean;
  vendorId: string | null;
  role: UserRole | null;
  consolePermissions: string[];
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  refreshAppUser: (uidParam?: string) => Promise<AppUser | null>;
  refreshSubscription: (vendorId?: string) => Promise<Subscription | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function normalizeRole(role?: string): string {
  if (role === 'owner' || role === 'vendor') return 'vendor_owner';
  if (role === 'staff') return 'vendor_staff';
  return role || '';
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [appUserLoading, setAppUserLoading] = useState(false);

  const refreshSubscription = async (vid?: string): Promise<Subscription | null> => {
    const vendorId =
      vid || appUser?.vendorId || (role === UserRole.VENDOR_OWNER ? user?.uid : null);
    if (!vendorId) {
      setSubscription(null);
      return null;
    }

    try {
      const subDoc = await getDoc(doc(db, 'subscriptions', vendorId));
      if (subDoc.exists()) {
        const subData = subDoc.data() as Subscription;
        setSubscription(subData);
        return subData;
      }
      setSubscription(null);
      return null;
    } catch (error) {
      console.error('[AUTH REFRESH SUBSCRIPTION FAILED]', error);
      setSubscription(null);
      return null;
    }
  };

  const refreshAppUser = async (uidParam?: string): Promise<AppUser | null> => {
    const uid = uidParam || auth.currentUser?.uid;
    if (!uid) {
      setAppUser(null);
      return null;
    }

    setAppUserLoading(true);
    console.log('[AUTH REFRESH APP USER]', {
      uid,
      appUserPath: `app_users/${uid}`,
      vendorUserFallbackChecked: true,
    });

    try {
      const userDoc = await getDoc(doc(db, 'app_users', uid));

      if (userDoc.exists()) {
        const data = userDoc.data() as AppUser;
        setAppUser(data);
        return data;
      }

      // Fallback check vendorUsers if app_users profile is missing role
      const vendorUserDoc = await getDoc(doc(db, 'vendorUsers', uid));
      if (vendorUserDoc.exists()) {
        const vuData = vendorUserDoc.data();
        const repairedUser = {
          uid,
          email: auth.currentUser?.email || '',
          displayName: vuData.displayName || auth.currentUser?.displayName || '',
          role: normalizeRole(vuData.role) as UserRole,
          vendorId: vuData.vendorId || uid,
          profileStatus: vuData.status === 'suspended' ? 'suspended' : 'active',
          rpnStatus: vuData.rpnStatus || '',
          createdAt: vuData.createdAt || new Date(),
          updatedAt: vuData.updatedAt || new Date(),
        } as any;

        setAppUser(repairedUser);
        return repairedUser;
      }

      setAppUser(null);
      return null;
    } catch (error) {
      console.error('[AUTH REFRESH APP USER FAILED]', error);
      setAppUser(null);
      return null;
    } finally {
      setAppUserLoading(false);
    }
  };

  useEffect(() => {
    // Initial connection test
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration.');
        }
      }
    };
    testConnection();

    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const profile = await refreshAppUser(firebaseUser.uid);
        if (profile?.vendorId) {
          await refreshSubscription(profile.vendorId);
        }
      } else {
        setAppUser(null);
        setSubscription(null);
        setAppUserLoading(false);
      }
      setLoading(false);
    });
  }, []);

  const logout = async () => {
    setLoading(true);
    await auth.signOut();
  };

  const rawRole = appUser?.role as string;
  const normalizedRoleStr = normalizeRole(rawRole);
  const role = normalizedRoleStr as UserRole;
  const consolePermissions = appUser?.consolePermissions || [];

  const isSuperAdmin = role === UserRole.SUPER_ADMIN;
  const isConsoleStaff =
    isSuperAdmin ||
    [
      UserRole.CONSOLE_ADMIN,
      UserRole.ACTIVATION_OFFICER,
      UserRole.FINANCE_OFFER,
      UserRole.SUPPORT_OFFICER,
      UserRole.RPN_MANAGER,
      UserRole.AUDITOR,
    ].includes(role);

  const hasPermission = (permission: string) => {
    if (isSuperAdmin) return true;
    if (isVendorOwner) return true;
    const permissions = appUser?.permissions || [];
    const consolePerms = appUser?.consolePermissions || [];
    return permissions.includes(permission) || consolePerms.includes(permission);
  };

  const isVendorOwner = role === UserRole.VENDOR_OWNER;
  const isVendorStaff = role === UserRole.VENDOR_STAFF;
  const isVendorUser =
    (isVendorOwner || isVendorStaff) &&
    !!appUser?.vendorId &&
    appUser?.profileStatus !== 'suspended';

  const isPOSEnabled =
    isVendorUser &&
    (subscription?.status === 'active' || subscription?.status === 'trial') &&
    !!subscription?.entitlements?.pos;

  const value = {
    user,
    appUser,
    subscription,
    loading,
    appUserLoading,
    isSuperAdmin,
    isConsoleAdmin: isConsoleStaff,
    isConsoleStaff,
    isVendorOwner,
    isVendorStaff,
    isVendorUser,
    isPOSEnabled,
    vendorId: appUser?.vendorId || null,
    role: role || null,
    consolePermissions,
    logout,
    hasPermission,
    refreshAppUser,
    refreshSubscription,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
