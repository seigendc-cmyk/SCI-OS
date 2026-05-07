import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { AlertCircle, ShieldAlert, AlertTriangle, Info, BarChart2 } from 'lucide-react';
import { BISeverity } from '../../../services/biService';

export const VendorPOSBI = () => {
  const { vendorId } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    critical: 0,
    warnings: 0,
    info: 0,
  });

  useEffect(() => {
    if (!vendorId) return;

    const q = query(
      collection(db, 'biEvents'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setEvents(list);

        const counts = list.reduce(
          (acc, curr: any) => {
            if (curr.severity === 'critical') acc.critical++;
            else if (curr.severity === 'warning') acc.warnings++;
            else acc.info++;
            return acc;
          },
          { critical: 0, warnings: 0, info: 0 },
        );

        setSummary(counts);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[POS BI LOAD ERROR]', err);
        if (err.code === 'failed-precondition') {
          setError('INDEX_REQUIRED: A Firestore composite index is required for the BI stream.');
        } else {
          setError(`Data Load Error: ${err.code} - ${err.message}`);
        }
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [vendorId]);

  const getSeverityColor = (sev: BISeverity) => {
    switch (sev) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-100';
      case 'warning':
        return 'text-orange-600 bg-orange-50 border-orange-100';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-100';
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">
          Operational Intelligence
        </h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">
          BI Engine // Event Stream & Pattern Analysis
        </p>
      </div>

      {error && (
        <div className="bg-red-50 p-6 rounded-xl industrial-border border-red-200">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="text-red-500" size={18} />
            <h3 className="text-xs font-black text-red-900 uppercase">Intelligence Feed Offline</h3>
          </div>
          <p className="text-[10px] font-bold text-red-700 leading-relaxed uppercase">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl industrial-border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert className="text-red-500" size={16} />
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Critical Alerts
            </p>
          </div>
          <p className="text-3xl font-black text-slate-900">{summary.critical}</p>
        </div>
        <div className="bg-white p-6 rounded-xl industrial-border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="text-orange-500" size={16} />
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Operational Warnings
            </p>
          </div>
          <p className="text-3xl font-black text-slate-900">{summary.warnings}</p>
        </div>
        <div className="bg-white p-6 rounded-xl industrial-border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Info className="text-blue-500" size={16} />
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              System Info
            </p>
          </div>
          <p className="text-3xl font-black text-slate-900">{summary.info}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest px-2">
            Live Intel Stream
          </h2>
          <div className="bg-white rounded-xl industrial-border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-[10px] font-bold text-slate-400 animate-pulse uppercase tracking-[0.3em]">
                Synching with Intelligence Node...
              </div>
            ) : events.length === 0 ? (
              <div className="p-24 text-center">
                <BarChart2 size={48} className="mx-auto text-slate-100 mb-4" />
                <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em]">
                  No operational events recorded.
                </p>
                {!error && (
                  <p className="mt-2 text-[9px] font-bold text-slate-400 uppercase">
                    Start POS actions to generate BI activity logs.
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {events.map((event) => (
                  <div key={event.id} className="p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${getSeverityColor(event.severity)}`}
                        >
                          {event.severity}
                        </span>
                        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
                          {event.eventType?.replace(/_/g, ' ')}
                        </h3>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400">
                        {event.createdAt?.toDate?.().toLocaleString() || '...'}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                      {event.message}
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Terminal: {event.terminalId || 'N/A'}</span>
                      <span>Actor: {event.userEmail}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest px-2">
            BI Categories
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Sales Alerts', count: 0 },
              { label: 'Cash Variances', count: 0 },
              { label: 'Stock Alerts', count: 0 },
              { label: 'Account Anomalies', count: summary.critical },
              { label: 'Staff Behaviour', count: 0 },
              { label: 'Market Signals', count: 0 },
            ].map((cat, i) => (
              <div
                key={i}
                className="bg-white p-4 rounded-lg industrial-border border-slate-200 flex justify-between items-center"
              >
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                  {cat.label}
                </span>
                <span className="bg-slate-100 text-slate-400 text-[9px] font-black px-2 py-0.5 rounded">
                  {cat.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
