import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { auth, db } from '../../lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { UserRole } from '../../types';

export const ConsoleLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshAppUser, user: currentUser, isVendorUser, isConsoleAdmin } = useAuth();
  const navigate = useNavigate();

  // Task: Improved UX for authenticated vendors visiting console-login
  useEffect(() => {
    if (currentUser && isVendorUser) {
      setError('Console access is restricted to internal operators.');
      const timer = setTimeout(() => {
        navigate('/vendor');
      }, 1500);
      return () => clearTimeout(timer);
    }
    if (currentUser && isConsoleAdmin) {
      navigate('/console');
    }
  }, [currentUser, isVendorUser, isConsoleAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const appUser = await refreshAppUser(userCredential.user.uid);

      if (!appUser) {
        await signOut(auth);
        setError('Protocol Rejected: No console credentials found.');
        setLoading(false);
        return;
      }

      const internalRoles = [
        UserRole.SUPER_ADMIN,
        UserRole.CONSOLE_ADMIN,
        UserRole.ACTIVATION_OFFICER,
        UserRole.FINANCE_OFFER,
        UserRole.SUPPORT_OFFICER,
        UserRole.RPN_MANAGER,
        UserRole.AUDITOR,
      ];

      if (!internalRoles.includes(appUser.role)) {
        await signOut(auth);
        setError('This access route is restricted to approved seiGEN Commerce console operators.');
        setLoading(false);
        return;
      }

      // Success - Route based on role
      if (appUser.role === UserRole.ACTIVATION_OFFICER) {
        navigate('/console/activation-requests');
      } else if (appUser.role === UserRole.FINANCE_OFFER) {
        navigate('/console/finance');
      } else {
        navigate('/console');
      }
    } catch (err: any) {
      console.error('Console login error:', err);
      setError('Authentication failed. Please verify system credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-itred opacity-10 rounded-full blur-[120px] -mr-48 -mt-48 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-800 opacity-20 rounded-full blur-[100px] -ml-32 -mb-32"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-itred rounded-xl flex items-center justify-center text-white font-black text-xl shadow-2xl shadow-orange-950/20">
              iT
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">
              seiGEN <span className="text-orange-itred">Console</span>
            </h1>
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic">
            INTERNAL OPERATIONS HUB // ACCESS LEVEL 3
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-8 p-3 bg-slate-900/50 rounded-lg border border-slate-700/30">
            <ShieldCheck size={18} className="text-orange-itred" />
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
              Identity Verification <br />{' '}
              <span className="text-slate-600">Secure TLSv1.3 Protocol</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                System Email
              </label>
              <input
                type="email"
                required
                className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl text-white text-sm focus:ring-1 focus:ring-orange-itred outline-none transition-all placeholder:text-slate-700"
                placeholder="operator@seigencommerce.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                Access Key
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700"
                  size={16}
                />
                <input
                  type="password"
                  required
                  className="w-full bg-slate-900 border border-slate-700 p-4 pl-12 rounded-xl text-white text-sm focus:ring-1 focus:ring-orange-itred outline-none transition-all placeholder:text-slate-700"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-tight flex items-start gap-3 animate-in shake duration-500">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-itred text-white p-4 rounded-xl font-black uppercase tracking-[0.2em] text-xs hover:bg-orange-600 transition-all shadow-xl shadow-orange-950/20 flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Verify Identity{' '}
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-12 text-center">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] italic">
            System Monitoring and Audit Logging is enabled for all session active nodes.
          </p>
          <div className="mt-8 flex justify-center gap-8">
            <Link
              to="/"
              className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
            >
              Public Storefront
            </Link>
            <Link
              to="/login"
              className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
            >
              Vendor Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
