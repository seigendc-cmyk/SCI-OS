import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import {
  Activity,
  ShieldAlert,
  Laptop,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  X,
  History,
  Database,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const VendorPOSDashboard = () => {
  const { vendorId, user, appUser } = useAuth();
  const [stats, setStats] = useState({
    activeShifts: 0,
    todaySales: 0,
    terminalCount: 0,
    cashInDrawer: 0,
    biEventCount: 0,
    accountCount: 0,
    posEventCount: 0,
  });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }

    const unsubscribes: (() => void)[] = [];

    try {
      // Terminals
      unsubscribes.push(
        onSnapshot(
          query(collection(db, 'pos_terminals'), where('vendorId', '==', vendorId)),
          (snap) => setStats((prev) => ({ ...prev, terminalCount: snap.size })),
          (err) => {
            console.error('[POS DIAGNOSTIC]', err);
            setError(`Terminals: ${err.code}`);
          },
        ),
      );

      // Shifts
      unsubscribes.push(
        onSnapshot(
          query(
            collection(db, 'pos_shifts'),
            where('vendorId', '==', vendorId),
            where('status', '==', 'open'),
          ),
          (snap) => {
            const openShifts = snap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setStats((prev) => ({ ...prev, activeShifts: snap.size }));

            // Calculate base cash in drawer from opening floats
            const openingTotal = openShifts.reduce(
              (sum: number, s: any) => sum + Number(s.openingCash || 0),
              0,
            );

            // Now we need cash sales for these shifts to complete "Cash in Drawer"
            // Strategy: Fetch all completed cash sales for today for this vendor
            // This is a close enough proxy for "Cash in drawer" if we filter by shiftId in a real implementation
            // But for the stats card, let's just use the current day's cash sales
          },
          (err) => {
            console.error('[POS DIAGNOSTIC]', err);
            setError(`Shifts: ${err.code}`);
          },
        ),
      );

      // Today's Sales & Cash in Drawer (Current day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const qTodaySales = query(
        collection(db, 'pos_sales'),
        where('vendorId', '==', vendorId),
        where('status', '==', 'completed'),
        where('completedAt', '>=', today),
      );
      unsubscribes.push(
        onSnapshot(qTodaySales, async (snap) => {
          const sales = snap.docs.map((doc) => doc.data());
          const total = sales.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);
          const cashTotal = sales
            .filter((s) => s.paymentMethod === 'cash')
            .reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);

          setStats((prev) => ({ ...prev, todaySales: total }));

          // Get opening floats sum to add to cashTotal for drawer
          const shiftsSnap = await getDocs(
            query(
              collection(db, 'pos_shifts'),
              where('vendorId', '==', vendorId),
              where('status', '==', 'open'),
            ),
          );
          const openingSum = shiftsSnap.docs.reduce(
            (sum, d) => sum + Number(d.data().openingCash || 0),
            0,
          );

          setStats((prev) => ({
            ...prev,
            cashInDrawer: openingSum + cashTotal,
          }));
        }),
      );

      // BI Events
      unsubscribes.push(
        onSnapshot(
          query(collection(db, 'biEvents'), where('vendorId', '==', vendorId)),
          (snap) => setStats((prev) => ({ ...prev, biEventCount: snap.size })),
          (err) => {
            console.error('[POS DIAGNOSTIC]', err);
            setError(`BI Events: ${err.code}`);
          },
        ),
      );

      // Accounts
      unsubscribes.push(
        onSnapshot(
          query(collection(db, 'chart_accounts'), where('vendorId', '==', vendorId)),
          (snap) => setStats((prev) => ({ ...prev, accountCount: snap.size })),
          (err) => {
            console.error('[POS DIAGNOSTIC]', err);
            setError(`Accounts: ${err.code}`);
          },
        ),
      );

      // Recent POS Events
      unsubscribes.push(
        onSnapshot(
          query(
            collection(db, 'pos_events'),
            where('vendorId', '==', vendorId),
            orderBy('createdAt', 'desc'),
            limit(50),
          ),
          (snap) => {
            setRecentEvents(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
            setStats((prev) => ({ ...prev, posEventCount: snap.size }));
            setLoading(false);
          },
          (err) => {
            console.error('[POS DIAGNOSTIC]', err);
            setError(`POS Events: ${err.code}`);
            setLoading(false);
          },
        ),
      );
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }

    return () => unsubscribes.forEach((u) => u());
  }, [vendorId]);

  const checklist = [
    { label: 'Terminal Provisioned', status: stats.terminalCount > 0 },
    { label: 'Chart of Accounts Seeded', status: stats.accountCount > 0 },
    { label: 'Active Shift Exists', status: stats.activeShifts > 0 },
    { label: 'POS Logging Active', status: stats.posEventCount > 0 },
    { label: 'BI Intelligence Active', status: stats.biEventCount > 0 },
  ];

  if (!vendorId) {
    return (
      <div className="p-12 text-center bg-red-50 rounded-xl industrial-border border-red-200">
        <ShieldAlert className="mx-auto text-red-500 mb-4" size={48} />
        <h1 className="text-xl font-black text-red-900 uppercase">POS Initialization Failed</h1>
        <p className="text-red-600 text-xs font-bold uppercase mt-2">
          POS cannot load because vendorId is missing from AuthContext.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-slate-900 uppercase">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">
            POS Control Hub
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">
            Retail Point of Sale Operations // Node Master
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/vendor/pos/terminal"
            className="bg-orange-itred text-white h-11 px-6 rounded-lg font-black uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-lg shadow-orange-100 hover:scale-105 transition-all"
          >
            <Laptop size={14} /> Open Terminal
          </Link>
        </div>
      </div>

      {/* ERROR DISPLAY */}
      {error && (
        <div className="bg-red-50 p-4 rounded border border-red-200 flex items-center gap-3">
          <AlertTriangle className="text-red-500" size={16} />
          <p className="text-red-700 text-[10px] font-black uppercase">
            System Error: {error} (Check Indexes/Rules)
          </p>
        </div>
      )}

      {/* Diagnostic Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl industrial-border border-slate-200 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Active Shifts
            </p>
            <p className="text-3xl font-black text-slate-900">{stats.activeShifts}</p>
          </div>
          <div className="bg-white p-6 rounded-xl industrial-border border-slate-200 shadow-sm relative overflow-hidden">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Today Sales
            </p>
            <p className="text-3xl font-black text-slate-900 leading-none">
              ${stats.todaySales.toFixed(2)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl industrial-border border-slate-200 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Terminals
            </p>
            <p className="text-3xl font-black text-slate-900">{stats.terminalCount}</p>
          </div>
          <div className="bg-white p-6 rounded-xl industrial-border border-slate-200 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Cash in Drawer
            </p>
            <p className="text-3xl font-black text-emerald-600">${stats.cashInDrawer.toFixed(2)}</p>
          </div>
        </div>

        {/* Foundation Checklist */}
        <div className="bg-slate-900 p-6 rounded-xl shadow-xl space-y-4">
          <h3 className="text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <ClipboardList size={14} className="text-orange-itred" /> Foundation Checklist
          </h3>
          <div className="space-y-3">
            {checklist.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest"
              >
                <span className={item.status ? 'text-slate-400' : 'text-white'}>{item.label}</span>
                {item.status ? (
                  <CheckCircle2 size={12} className="text-emerald-500" />
                ) : (
                  <X size={12} className="text-red-500" />
                )}
              </div>
            ))}
          </div>
          {!checklist.every((c) => c.status) && (
            <p className="text-[8px] text-orange-itred font-black uppercase animate-pulse">
              Setup Required // System Incomplete
            </p>
          )}
        </div>
      </div>

      {/* Diagnostic Diagnostics */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <p className="text-[8px] font-black text-slate-400 uppercase">Auth UID</p>
          <p className="text-[10px] font-mono text-slate-600 truncate">{user?.uid}</p>
        </div>
        <div>
          <p className="text-[8px] font-black text-slate-400 uppercase">App Role</p>
          <p className="text-[10px] font-mono text-slate-600">{appUser?.role}</p>
        </div>
        <div>
          <p className="text-[8px] font-black text-slate-400 uppercase">Vendor ID</p>
          <p className="text-[10px] font-mono text-slate-600 truncate">{vendorId}</p>
        </div>
        <div>
          <p className="text-[8px] font-black text-slate-400 uppercase">BI Events</p>
          <p className="text-[10px] font-mono text-slate-600">{stats.biEventCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Events */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
              Recent Activity (Log Stream)
            </h2>
            <Link
              to="/vendor/pos/bi"
              className="text-[9px] font-black text-orange-itred uppercase tracking-widest bg-orange-50 px-2 py-1 rounded"
            >
              View BI Stream
            </Link>
          </div>
          <div className="bg-white rounded-xl industrial-border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-[10px] font-bold text-slate-400 animate-pulse uppercase tracking-widest">
                Retrieving Log Stream...
              </div>
            ) : recentEvents.length === 0 ? (
              <div className="p-12 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                No recent POS activity found.
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-l-2 border-transparent hover:border-orange-itred"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                        <Activity size={14} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
                          {event.eventType?.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                          By: {event.actorEmail} // Terminal: {event.terminalId || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 font-mono">
                      {event.createdAt?.toDate
                        ? event.createdAt.toDate().toLocaleTimeString()
                        : '...'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-6">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest px-2">
            Quick Navigation
          </h2>
          <div className="grid grid-cols-1 gap-3">
            <Link
              to="/vendor/pos/terminal"
              className="bg-charcoal p-6 rounded-xl flex items-center gap-4 group hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
            >
              <Laptop
                className="text-orange-itred group-hover:scale-110 transition-transform"
                size={24}
              />
              <div>
                <h3 className="text-white text-xs font-black uppercase tracking-widest">
                  Terminal
                </h3>
                <p className="text-slate-400 text-[9px] mt-0.5">Customer Checkout</p>
              </div>
            </Link>
            <Link
              to="/vendor/pos/shifts"
              className="bg-white p-4 rounded-xl industrial-border border-slate-200 flex items-center gap-4 group hover:border-orange-itred transition-all shadow-sm"
            >
              <History className="text-slate-400 group-hover:text-orange-itred" size={20} />
              <span className="text-slate-900 text-[10px] font-black uppercase tracking-widest">
                Shift Management
              </span>
            </Link>
            <Link
              to="/vendor/pos/bi"
              className="bg-white p-4 rounded-xl industrial-border border-slate-200 flex items-center gap-4 group hover:border-orange-itred transition-all shadow-sm"
            >
              <ShieldAlert className="text-slate-400 group-hover:text-orange-itred" size={20} />
              <span className="text-slate-900 text-[10px] font-black uppercase tracking-widest">
                POS Intelligence
              </span>
            </Link>
            <Link
              to="/vendor/pos/accounting"
              className="bg-white p-4 rounded-xl industrial-border border-slate-200 flex items-center gap-4 group hover:border-orange-itred transition-all shadow-sm"
            >
              <Database className="text-slate-400 group-hover:text-orange-itred" size={20} />
              <span className="text-slate-900 text-[10px] font-black uppercase tracking-widest">
                POS Accounting
              </span>
            </Link>
            <Link
              to="/vendor/pos/settings"
              className="bg-white p-4 rounded-xl industrial-border border-slate-200 flex items-center gap-4 group hover:border-orange-itred transition-all shadow-sm"
            >
              <SettingsIcon className="text-slate-400 group-hover:text-orange-itred" size={20} />
              <span className="text-slate-900 text-[10px] font-black uppercase tracking-widest">
                POS Settings
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
