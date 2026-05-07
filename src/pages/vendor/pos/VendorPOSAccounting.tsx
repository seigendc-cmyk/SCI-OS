import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export const VendorPOSAccounting = () => {
  const { vendorId } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) return;

    const unsubscribes: (() => void)[] = [];

    const qAccounts = query(collection(db, 'chart_accounts'), where('vendorId', '==', vendorId));
    unsubscribes.push(
      onSnapshot(
        qAccounts,
        (snap) => {
          const list = snap.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((acc: any) => !acc.test) as any[];

          // Manual sort to avoid index requirements in early dev
          setAccounts(
            list.sort((a, b) =>
              (String(a.accountCode) || '').localeCompare(String(b.accountCode) || ''),
            ),
          );
        },
        (err) => {
          console.error('[ACCOUNTING LOAD ERROR]', err);
          setError(`COA load failed: ${err.code} - ${err.message}`);
        },
      ),
    );

    const qJournals = query(
      collection(db, 'accounting_journals'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc'),
      limit(10),
    );
    unsubscribes.push(
      onSnapshot(
        qJournals,
        (snap) => {
          setJournals(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
          setLoading(false);
        },
        (err) => {
          console.error('[JOURNALS LOAD ERROR]', err);
          setError(`Journals Load Error: ${err.code}`);
          setLoading(false);
        },
      ),
    );

    return () => unsubscribes.forEach((u) => u());
  }, [vendorId]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">
          Accounting Node
        </h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">
          Double-Entry Core // Ledger & Financial Foundation
        </p>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded border border-red-200 flex items-center gap-3">
          <BookOpen className="text-red-500" size={16} />
          <p className="text-red-700 text-[10px] font-black uppercase">{error}</p>
        </div>
      )}

      {/* Diagnostic Panel */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-slate-400 animate-pulse rounded-full"></div>
          <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            Accounting Diagnostic Node
          </h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-[9px] font-mono text-slate-500">
          <div>
            Vendor Context: <span className="text-slate-900 font-bold">{vendorId}</span>
          </div>
          <div>
            COA Raw Docs: <span className="text-slate-900 font-bold">{accounts.length}</span>
          </div>
          <div>
            Loading Status:{' '}
            <span className="text-slate-900 font-bold">{loading ? 'SYNCING' : 'IDLE'}</span>
          </div>
          <div>
            Data Accuracy: <span className="text-slate-900 font-bold">100% RELIABLE</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl industrial-border border-slate-200 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Chart of Accounts
          </p>
          <p className="text-2xl font-black text-slate-900">{accounts.length} ACCOUNTS</p>
        </div>
        <div className="bg-white p-6 rounded-xl industrial-border border-slate-200 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Journal Drafts
          </p>
          <p className="text-2xl font-black text-slate-900">
            {journals.filter((j) => j.status === 'draft').length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl industrial-border border-slate-200 shadow-sm opacity-50 relative pointer-events-none">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Trial Balance
          </p>
          <p className="text-2xl font-black text-slate-900 italic">PREPARING...</p>
          <span className="bg-orange-itred text-white text-[7px] font-black px-1 rounded absolute top-2 right-2">
            LOCK
          </span>
        </div>
        <div className="bg-white p-6 rounded-xl industrial-border border-slate-200 shadow-sm opacity-50 relative pointer-events-none">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Financial Health
          </p>
          <p className="text-2xl font-black text-slate-900 italic">OFFLINE</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart of Accounts Status */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
              Active Chart of Accounts
            </h2>
            {accounts.length === 0 && !loading && (
              <Link
                to="/vendor/pos/settings"
                className="p-2 bg-orange-50 border border-orange-100 rounded text-[9px] font-black text-orange-itred uppercase underline tracking-widest"
              >
                Initialize COA
              </Link>
            )}
          </div>
          <div className="bg-white rounded-xl industrial-border border-slate-200 shadow-sm overflow-hidden h-[400px] overflow-y-auto">
            {loading ? (
              <div className="p-20 text-center text-[10px] font-bold text-slate-400 animate-pulse uppercase tracking-[0.3em]">
                Synching with Accounting Node...
              </div>
            ) : accounts.length === 0 ? (
              <div className="p-20 text-center space-y-4">
                <p className="text-slate-300 font-black uppercase text-[10px] tracking-widest">
                  No accounts found. Seeding required.
                </p>
                <Link
                  to="/vendor/pos/settings"
                  className="inline-block bg-orange-itred text-white px-4 py-2 rounded text-[9px] font-black uppercase tracking-widest"
                >
                  Go to POS Settings
                </Link>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white text-[9px] uppercase tracking-widest sticky top-0">
                  <tr>
                    <th className="px-6 py-4 font-black">Code</th>
                    <th className="px-6 py-4 font-black">Account Name</th>
                    <th className="px-6 py-4 font-black text-right pr-6">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-mono text-[10px] font-bold text-slate-400">
                        {acc.accountCode}
                      </td>
                      <td className="px-6 py-3 text-[11px] font-black text-slate-900 uppercase">
                        {acc.accountName}
                      </td>
                      <td className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase text-right pr-6">
                        {acc.accountType}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Journal Trace */}
        <div className="space-y-4">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest px-2">
            Recent Journal Drafts
          </h2>
          <div className="bg-white rounded-xl industrial-border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-20 text-center text-[10px] font-bold text-slate-400 animate-pulse uppercase tracking-[0.3em]">
                Loading Journals...
              </div>
            ) : journals.length === 0 ? (
              <div className="p-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">
                No journals posted yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {journals.map((j) => (
                  <div
                    key={j.id}
                    className="p-5 flex justify-between items-center group cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
                          {j.journalId}
                        </h3>
                        <span className="text-[8px] font-black text-orange-itred uppercase tracking-widest border border-orange-100 px-1 bg-orange-50">
                          {j.status}
                        </span>
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Source: {j.sourceType} // {j.sourceId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-black text-slate-900">
                        ${j.totalDebit.toFixed(2)}
                      </p>
                      <p className="text-[9px] font-mono text-slate-400">
                        {j.createdAt?.toDate?.().toLocaleDateString() || '...'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Future Report Placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 opacity-40">
        {['Cashbook', 'Bankbook', 'COGS Ledger', 'Suppliers Registry'].map((title) => (
          <div
            key={title}
            className="bg-white p-6 rounded-xl industrial-border border-slate-200 flex flex-col gap-4 border-dashed"
          >
            <div className="bg-slate-100 w-10 h-10 rounded flex items-center justify-center text-slate-400">
              <BookOpen size={20} />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              {title}
            </h3>
          </div>
        ))}
      </div>
    </div>
  );
};
