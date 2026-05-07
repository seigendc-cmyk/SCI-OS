import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';

export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return <>{children}</>;
};

export const VendorRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    isVendorUser,
    isConsoleAdmin,
    loading: authLoading,
    appUserLoading,
    vendorId,
    appUser,
    role,
    refreshAppUser,
  } = useAuth();
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [profileExists, setProfileExists] = React.useState(false);

  React.useEffect(() => {
    async function checkProfile() {
      if (!user || isConsoleAdmin) {
        setProfileLoading(false);
        return;
      }
      try {
        const { ensureVendorProfileForCurrentUser } = await import('../../services/db');
        const { status } = await ensureVendorProfileForCurrentUser(user);
        setProfileExists(status === 'complete');
        if (status === 'complete') {
          await refreshAppUser(user.uid);
        }
      } catch (e) {
        console.error('Profile check failed:', e);
      } finally {
        setProfileLoading(false);
      }
    }
    checkProfile();
  }, [user, isConsoleAdmin]);

  // Unified loading check
  if (authLoading || appUserLoading || profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-orange-itred/20 border-t-orange-itred rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 animate-pulse">
          Loading vendor identity...
        </p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (isConsoleAdmin) {
    return <Navigate to="/console" replace />;
  }

  if (!isConsoleAdmin) {
    if (!profileExists) return <Navigate to="/complete-profile" replace />;

    const allowedRoles = ['vendor_owner', 'vendor_staff'];
    const normalizedRole = role as string; // Already normalized in AuthContext
    const allowVendorAccess = isVendorUser && allowedRoles.includes(normalizedRole);

    let denyReason = '';
    if (!allowVendorAccess) {
      if (!appUser) denyReason = 'Missing app_user protocol';
      else if (!allowedRoles.includes(normalizedRole))
        denyReason = `Role not allowed: ${normalizedRole || 'none'}`;
      else if (!vendorId) denyReason = 'Missing vendorId association';
      else if (appUser?.profileStatus === 'suspended') denyReason = 'Profile suspended';
      else denyReason = 'Identity verification failure';
    }

    console.log('[VENDOR ACCESS CHECK]', {
      authUid: user?.uid,
      authEmail: user?.email,
      authLoading,
      appUserLoading,
      appUserExists: !!appUser,
      rawRole: appUser?.role,
      normalizedRole,
      vendorId: vendorId || appUser?.vendorId,
      profileStatus: appUser?.profileStatus,
      rpnStatus: appUser?.rpnStatus,
      allowedRoles,
      allowVendorAccess,
      denyReason,
    });

    if (!allowVendorAccess) {
      return (
        <div className="flex flex-col items-center justify-center p-20 bg-white industrial-border rounded-lg m-8 text-center shadow-xl shadow-slate-100 animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 border border-red-100">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m0 0v2m0-2h2m-2 0H10m11 3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter mb-2 uppercase">
            Access Denied
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-6 max-w-xs">
            Unauthorized Access Node Detected. Secure protocol violation.
          </p>
          <div className="text-[9px] text-slate-600 uppercase font-black px-6 py-3 bg-red-50/50 rounded border border-red-100/50 inline-block">
            REASON: <span className="text-red-600">{denyReason}</span>
          </div>
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => (window.location.href = '/')}
              className="px-6 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-slate-800 transition-colors"
            >
              Back to Home
            </button>
            <button
              onClick={() => user && refreshAppUser(user.uid)}
              className="px-6 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-slate-50 transition-colors"
            >
              Retry Check
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export const POSProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isVendorUser, isPOSEnabled, loading, appUserLoading } = useAuth();

  if (loading || appUserLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-orange-itred/20 border-t-orange-itred rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 animate-pulse">
          Verifying POS Access...
        </p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isVendorUser) return <Navigate to="/vendor" replace />;

  if (!isPOSEnabled) {
    return <Navigate to="/vendor/pos/activate" replace />;
  }

  return <>{children}</>;
};

export const ConsoleRoute: React.FC<{
  children: React.ReactNode;
  requiredPermission?: string;
}> = ({ children, requiredPermission }) => {
  const { user, isConsoleAdmin, isVendorUser, hasPermission, loading } = useAuth();

  if (loading)
    return (
      <div className="p-10 text-center font-mono text-xs animate-pulse uppercase tracking-widest">
        Verifying System Node...
      </div>
    );
  if (!user) return <Navigate to="/console-login" replace />;

  if (!isConsoleAdmin) {
    if (isVendorUser) {
      return <Navigate to="/vendor" replace />;
    }
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white industrial-border rounded-lg m-8 text-center shadow-xl shadow-slate-100 animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 border border-red-100">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m0 0v2m0-2h2m-2 0H10m11 3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tighter mb-2 uppercase">
          Access Denied
        </h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-6 max-w-xs">
          Internal console access denied. This route is restricted to authorized operators.
        </p>
        <button
          onClick={() => (window.location.href = '/')}
          className="px-6 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-slate-800 transition-colors"
        >
          Return to Hub
        </button>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white industrial-border rounded-lg m-8 text-center">
        <h1 className="text-2xl font-bold text-orange-600 tracking-tighter mb-2 uppercase">
          Access Denied
        </h1>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">
          Your desk does not include this permission
        </p>
        <p className="text-slate-400 text-[10px] uppercase font-bold px-4 py-2 bg-slate-50 rounded border border-slate-100">
          Required: {requiredPermission}
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperAdmin, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
};
