import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Search,
  Store,
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  User,
  Shield,
  AlertTriangle,
  ShieldCheck,
  GitBranch,
  Truck,
  Package,
  BookOpen,
  ShoppingBag,
  CreditCard,
  Users,
  Laptop,
  Activity,
  History,
  Bell,
  Info,
  Clock,
  DollarSign,
  Monitor,
  RotateCcw,
  BarChart3,
  Wallet,
} from 'lucide-react';
import { query, collection, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSubscription } from '../hooks/useSubscription';

const NavLink = ({
  to,
  children,
  icon: Icon,
  show = true,
}: {
  to: string;
  children: React.ReactNode;
  icon?: any;
  show?: boolean;
}) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  if (!show) return null;

  return (
    <Link
      to={to}
      className={`text-xs py-2 px-3 rounded flex items-center gap-2 transition-colors ${
        isActive
          ? 'bg-slate-800 border-l-2 border-orange-itred text-white'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {Icon && <Icon size={14} />}
      {children}
    </Link>
  );
};

export const PublicLayout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <header className="h-20 bg-white border-b border-slate-100 sticky top-0 z-[60] flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-12">
          <Link
            to="/"
            className="text-2xl font-black tracking-tighter flex items-center gap-2 group"
          >
            <span className="w-10 h-10 bg-orange-itred rounded-lg flex items-center justify-center text-sm text-white shadow-lg shadow-orange-100 group-hover:scale-110 transition-transform">
              iT
            </span>
            <span className="text-slate-900">iTred</span>
          </Link>
          <nav className="hidden lg:flex gap-8">
            <Link
              to="/itred"
              className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${location.pathname === '/itred' ? 'text-orange-itred' : 'text-slate-400 hover:text-slate-900'}`}
            >
              Marketplace
            </Link>
            <Link
              to="/vendors"
              className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${location.pathname === '/vendors' ? 'text-orange-itred' : 'text-slate-400 hover:text-slate-900'}`}
            >
              Registry
            </Link>
            <Link
              to="/catalogues"
              className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${location.pathname === '/catalogues' ? 'text-orange-itred' : 'text-slate-400 hover:text-slate-900'}`}
            >
              Catalogues
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (location.pathname !== '/itred') navigate('/itred');
              setTimeout(() => {
                const input = document.querySelector(
                  'input[placeholder*="SEARCH"]',
                ) as HTMLInputElement;
                input?.focus();
              }, 100);
            }}
            className="p-3 text-slate-400 hover:text-orange-itred transition-colors"
            title="Search Marketplace"
          >
            <Search size={22} />
          </button>

          <Link
            to="/login"
            className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white bg-charcoal h-11 px-6 rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-100"
          >
            <User size={14} /> Vendor Login
          </Link>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-3 text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Mobile/Global Navigation Drawer */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setIsMenuOpen(false)}
          ></div>
          <div className="absolute top-0 right-0 w-80 h-full bg-white shadow-2xl animate-in slide-in-from-right duration-500 ease-out flex flex-col">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">
                Trade Menu
              </span>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-100 text-slate-900 shadow-sm"
              >
                <LogOut size={16} />
              </button>
            </div>

            <nav className="flex-1 p-8 flex flex-col gap-2">
              <Link
                to="/itred"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 group transition-all"
              >
                <span className="text-sm font-black uppercase tracking-widest text-slate-900 group-hover:text-orange-itred">
                  Marketplace
                </span>
                <ShoppingBag size={18} className="text-slate-200 group-hover:text-orange-itred" />
              </Link>
              <Link
                to="/vendors"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 group transition-all"
              >
                <span className="text-sm font-black uppercase tracking-widest text-slate-900 group-hover:text-orange-itred">
                  Merchant Registry
                </span>
                <Store size={18} className="text-slate-200 group-hover:text-orange-itred" />
              </Link>
              <Link
                to="/catalogues"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 group transition-all"
              >
                <span className="text-sm font-black uppercase tracking-widest text-slate-900 group-hover:text-orange-itred">
                  Global Catalogues
                </span>
                <BookOpen size={18} className="text-slate-200 group-hover:text-orange-itred" />
              </Link>

              <div className="mt-8 pt-8 border-t border-slate-50 space-y-4">
                <Link
                  to="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center justify-center gap-3 w-full bg-charcoal text-white p-5 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200"
                >
                  <User size={18} /> Vendor Portal
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center justify-center gap-3 w-full bg-white border-2 border-slate-100 text-slate-900 p-5 rounded-xl text-[11px] font-black uppercase tracking-[0.2em]"
                >
                  <Store size={18} /> Merchant Signup
                </Link>
              </div>
            </nav>

            <div className="p-8 border-t border-slate-50 text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] text-center">
              powered by seiGEN Commerce
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-12 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Outlet />
      </main>

      <footer className="bg-charcoal text-white py-20 px-6 md:px-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
          <div className="lg:col-span-1">
            <Link
              to="/"
              className="text-2xl font-black tracking-tighter flex items-center gap-3 mb-6"
            >
              <span className="w-10 h-10 bg-orange-itred rounded-lg flex items-center justify-center text-sm text-white">
                iT
              </span>
              <span>iTred</span>
            </Link>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] leading-relaxed mb-6">
              Africa-first commerce infrastructure for vendors, catalogues, discovery, and offline
              trade.
            </p>
            <div className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">
              powered by <span className="text-slate-400">seiGEN Commerce</span>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-orange-itred mb-8">
              Infrastructure
            </h4>
            <ul className="space-y-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              <li>
                <Link to="/itred" className="hover:text-white transition-colors">
                  iTred Marketplace
                </Link>
              </li>
              <li>
                <Link to="/vendors" className="hover:text-white transition-colors">
                  Merchant Registry
                </Link>
              </li>
              <li>
                <Link to="/catalogues" className="hover:text-white transition-colors">
                  Global Catalogues
                </Link>
              </li>
              <li>
                <Link to="/itred" className="hover:text-white transition-colors">
                  Public Node Search
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-orange-itred mb-8">
              Ecosystem
            </h4>
            <ul className="space-y-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Vendor Dashboard
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-white transition-colors">
                  Merchant Onboarding
                </Link>
              </li>
              <li>
                <Link to="/rpn" className="hover:text-white transition-colors">
                  Partner Network (RPN)
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-orange-itred mb-8">
              Protocol
            </h4>
            <ul className="space-y-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              <li>
                <Link to="/business-terms" className="hover:text-white transition-colors">
                  Business Terms
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/support" className="hover:text-white transition-colors">
                  Merchant Support
                </Link>
              </li>
              <li>
                <Link to="/support" className="hover:text-white transition-colors">
                  System Status
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-20 pt-10 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-center md:text-left">
              © {new Date().getFullYear()} iTred Nexus. Part of the seiGEN Commerce ecosystem.
            </p>
            <p className="text-[9px] font-medium text-slate-600 uppercase tracking-widest text-center md:text-left">
              Built for resilient offline and digital trade across Africa.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-slate-900/50 px-6 py-3 rounded-full border border-slate-800">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
              Node Status:
            </span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em]">
                Operational // SA_NORTH
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const safeString = (value: any, fallback = '') => (typeof value === 'string' ? value : fallback);

export const VendorLayout: React.FC = () => {
  const { user, appUser, logout } = useAuth();
  const {
    subscription,
    plan,
    loading: subLoading,
    daysRemaining,
    isActive,
    isExpired,
    isTrial,
  } = useSubscription();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getWarningBanner = () => {
    if (subLoading || !subscription) return null;

    if (subscription.status === 'pending_activation') {
      return (
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center gap-3 animate-in slide-in-from-top duration-500">
          <Info className="text-blue-500" size={16} />
          <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
            Activation request submitted. Some features may be limited until approved.
          </p>
        </div>
      );
    }

    if (subscription.status === 'suspended') {
      return (
        <div className="bg-red-50 border-b border-red-100 px-6 py-3 flex items-center gap-3 animate-in slide-in-from-top duration-500">
          <AlertTriangle className="text-red-500" size={16} />
          <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">
            Your subscription is suspended. Contact seiGEN Commerce support.
          </p>
        </div>
      );
    }

    if (isExpired) {
      return (
        <div className="bg-red-50 border-b border-red-100 px-6 py-3 flex items-center gap-3 animate-in slide-in-from-top duration-500">
          <AlertTriangle className="text-red-500" size={16} />
          <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">
            Your subscription has expired. Renew to continue creating new records.
          </p>
          <Link
            to="/vendor/subscription"
            className="ml-auto text-[10px] font-black text-red-700 underline uppercase tracking-widest"
          >
            Renew Now
          </Link>
        </div>
      );
    }

    if (isTrial) {
      return (
        <div className="bg-orange-50 border-b border-orange-100 px-6 py-3 flex items-center gap-3 animate-in slide-in-from-top duration-500">
          <Clock className="text-orange-itred" size={16} />
          <p className="text-[10px] font-black text-orange-itred uppercase tracking-widest">
            Free trial active. {daysRemaining} days remaining.
          </p>
          <Link
            to="/vendor/subscription"
            className="ml-auto text-[10px] font-black text-orange-itred underline uppercase tracking-widest"
          >
            Upgrade Plan
          </Link>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex min-h-screen bg-[#F4F4F4] font-sans">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`
        w-72 bg-charcoal text-white flex flex-col border-r border-slate-800 fixed lg:sticky top-0 h-screen z-[80] transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      >
        <div className="p-8 mb-4 flex justify-between items-center">
          <div>
            <Link
              to="/vendor"
              className="text-2xl font-black tracking-tighter flex items-center gap-2"
            >
              <span className="w-9 h-9 bg-orange-itred rounded-lg flex items-center justify-center text-sm shadow-lg shadow-orange-950/20 text-white">
                iT
              </span>
              iTred
            </Link>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.3em] mt-2">
              Vendor Portal
            </p>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-slate-500 hover:text-white"
          >
            <LogOut size={20} className="rotate-180" />
          </button>
        </div>

        <nav className="flex-1 px-6 space-y-8 overflow-y-auto pb-10 no-scrollbar">
          <section>
            <h3 className="text-[10px] uppercase text-slate-600 font-black mb-4 tracking-[0.3em]">
              Store Management
            </h3>
            <div className="space-y-1.5" onClick={() => setIsSidebarOpen(false)}>
              <NavLink to="/vendor" icon={LayoutDashboard}>
                Dashboard
              </NavLink>
              <NavLink to="/vendor/profile" icon={User}>
                Identity
              </NavLink>
              <NavLink to="/vendor/branches" icon={GitBranch}>
                Branches
              </NavLink>
              <NavLink to="/vendor/delivery" icon={Truck}>
                Delivery
              </NavLink>
              <NavLink to="/vendor/delivery-fulfilment" icon={ShieldCheck}>
                Fulfilment
              </NavLink>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] uppercase text-slate-600 font-black mb-4 tracking-[0.3em]">
              Procurement & Sales
            </h3>
            <div className="space-y-1.5" onClick={() => setIsSidebarOpen(false)}>
              <NavLink to="/vendor/products" icon={Package}>
                Inventory
              </NavLink>
              <NavLink to="/vendor/notices" icon={Bell}>
                Broadcasts
              </NavLink>
              <NavLink to="/vendor/catalogues" icon={BookOpen}>
                Catalogues
              </NavLink>
              <NavLink to="/vendor/orders" icon={ShoppingBag}>
                Orders
              </NavLink>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] uppercase text-slate-600 font-black mb-4 tracking-[0.3em]">
              POS Operations
            </h3>
            <div className="space-y-1.5" onClick={() => setIsSidebarOpen(false)}>
              <NavLink to="/vendor/pos" icon={Monitor}>
                POS Hub
              </NavLink>
              <NavLink to="/vendor/pos/terminal" icon={Laptop}>
                Terminal
              </NavLink>
              <NavLink to="/vendor/pos/sales-history" icon={History}>
                Sales History
              </NavLink>
              <NavLink to="/vendor/pos/customers" icon={Users}>
                Customers
              </NavLink>
              <NavLink to="/vendor/pos/customer-accounts" icon={Wallet}>
                Customer Accounts
              </NavLink>
              <NavLink to="/vendor/pos/layby" icon={ShoppingBag}>
                Layby
              </NavLink>
              <NavLink to="/vendor/pos/approvals" icon={ShieldCheck}>
                Approval Desk
              </NavLink>
              <NavLink to="/vendor/pos/reports" icon={BarChart3}>
                Reports
              </NavLink>
              <NavLink to="/vendor/pos/shifts" icon={History}>
                Shifts
              </NavLink>
              <NavLink to="/vendor/pos/returns" icon={RotateCcw}>
                Returns
              </NavLink>
              <NavLink to="/vendor/pos/bi" icon={Activity}>
                Intelligence
              </NavLink>
              <NavLink to="/vendor/pos/accounting" icon={DollarSign}>
                Accounting
              </NavLink>
              <NavLink to="/vendor/pos/settings" icon={Settings}>
                POS Settings
              </NavLink>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] uppercase text-slate-600 font-black mb-4 tracking-[0.3em]">
              Governance
            </h3>
            <div className="space-y-1.5" onClick={() => setIsSidebarOpen(false)}>
              <NavLink to="/vendor/staff" icon={Users}>
                Staff Registry
              </NavLink>
              <NavLink to="/vendor/subscription" icon={CreditCard}>
                Subscription
              </NavLink>
            </div>
          </section>
        </nav>

        <div className="p-8 bg-[#0D0D0D] border-t border-slate-800 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-itred/10 border border-orange-itred/20 flex items-center justify-center text-xs font-black text-orange-itred shadow-inner">
              {user?.email?.substring(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-[11px] font-black text-white truncate uppercase tracking-widest">
                {user?.email?.split('@')[0]}
              </p>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                {safeString(appUser?.role).replace('vendor_', '')}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full h-11 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-900 border border-slate-800 rounded-lg hover:text-white hover:border-slate-600 transition-all"
          >
            <LogOut size={16} />
            Termination
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-12 sticky top-0 z-[60]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-900 hover:bg-slate-50 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
              Node / <span className="text-slate-900">Dashboard</span>
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              Merchant_Live
            </div>
            <Link
              to="/itred"
              className="p-2 text-slate-400 hover:text-orange-itred transition-colors"
            >
              <Store size={20} />
            </Link>
          </div>
        </header>
        {getWarningBanner()}
        <div className="p-6 lg:p-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export const ConsoleLayout: React.FC = () => {
  const { user, appUser, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = React.useState(0);

  React.useEffect(() => {
    const q = query(collection(db, 'activation_requests'), where('status', '==', 'submitted'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPendingCount(snapshot.size);
      },
      (err) => {
        console.error('Layout sync error:', err);
      },
    );
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/console-login');
  };

  return (
    <div className="flex min-h-screen bg-[#F4F4F4]">
      <aside className="w-64 bg-charcoal text-white flex flex-col border-r border-slate-800 sticky top-0 h-screen">
        <div className="p-6 mb-4">
          <Link to="/console" className="flex flex-col gap-1 group">
            <div className="text-xl font-black tracking-tighter flex items-center gap-2">
              <span className="w-8 h-8 bg-orange-itred rounded flex items-center justify-center text-sm text-white">
                iT
              </span>
              seiGEN <span className="text-orange-itred">Console</span>
            </div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic">
              Internal Operations
            </p>
          </Link>
          <div className="mt-4 px-2 py-1 bg-slate-900 rounded border border-slate-800 flex items-center gap-2">
            <Activity size={10} className="text-emerald-500" />
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
              Access Level: Secure
            </span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-6 overflow-y-auto pb-8">
          <section>
            <h3 className="text-[10px] uppercase text-slate-500 font-bold mb-3 tracking-widest">
              System Monitor
            </h3>
            <div className="space-y-1">
              <NavLink to="/console" icon={LayoutDashboard} show={hasPermission('dashboard.view')}>
                Overview
              </NavLink>
              <NavLink to="/console/health" icon={Laptop} show={hasPermission('health.view')}>
                System Health
              </NavLink>
              <NavLink
                to="/console/audit-logs"
                icon={History}
                show={hasPermission('audit_logs.view')}
              >
                Audit Logs
              </NavLink>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] uppercase text-slate-500 font-bold mb-3 tracking-widest">
              Governance
            </h3>
            <div className="space-y-1">
              <NavLink to="/console/vendors" icon={Store} show={hasPermission('vendors.view')}>
                Merchants
              </NavLink>
              <NavLink
                to="/console/activation-requests"
                icon={Activity}
                show={hasPermission('activation_requests.view')}
              >
                <div className="flex items-center justify-between w-full">
                  <span>Queue</span>
                  {pendingCount > 0 && (
                    <span className="bg-orange-itred text-white text-[9px] px-1.5 py-0.5 rounded font-black animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                </div>
              </NavLink>
              <NavLink to="/console/rpn" icon={Users} show={hasPermission('rpn.view')}>
                RPN Network
              </NavLink>
              <NavLink to="/console/products" icon={Package} show={hasPermission('products.view')}>
                Global products
              </NavLink>
              <NavLink to="/console/staff" icon={Shield} show={hasPermission('console_staff.view')}>
                Console Staff
              </NavLink>
            </div>
          </section>

          {(hasPermission('plans.view') ||
            hasPermission('subscriptions.view') ||
            hasPermission('finance.view')) && (
            <section>
              <h3 className="text-[10px] uppercase text-slate-500 font-bold mb-3 tracking-widest">
                Revenue
              </h3>
              <div className="space-y-1">
                <NavLink
                  to="/console/finance"
                  icon={DollarSign}
                  show={hasPermission('finance.view')}
                >
                  Financial Analytics
                </NavLink>
                <NavLink to="/console/plans" icon={CreditCard} show={hasPermission('plans.view')}>
                  Pricing Plans
                </NavLink>
                <NavLink
                  to="/console/subscriptions"
                  icon={Shield}
                  show={hasPermission('subscriptions.view')}
                >
                  Leases
                </NavLink>
              </div>
            </section>
          )}
        </nav>

        <div className="p-6 bg-[#111111] border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] uppercase">
              {user?.email?.substring(0, 2)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate">{user?.email}</p>
              <p className="text-[10px] text-orange-itred uppercase font-bold tracking-tighter">
                {safeString(appUser?.role).replace(/_/g, ' ')} Node
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full h-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
            Console / <span className="text-slate-900 font-bold">System Monitor</span>
          </h2>
          <div className="flex items-center gap-4">
            <div className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded tracking-widest uppercase">
              Phase 1 Foundation
            </div>
          </div>
        </header>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
