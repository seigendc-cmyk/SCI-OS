import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import {
  Plus,
  AlertCircle,
  Laptop,
  Database,
  Trash2,
  X,
  Activity,
  FlaskConical,
} from 'lucide-react';
import { seedChartOfAccounts } from '../../../services/accountingService';
import { createPOSEvent } from '../../../services/orderService';

export const VendorPOSSettings = () => {
  const { vendorId, user } = useAuth();
  const [terminals, setTerminals] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedingStatus, setSeedingStatus] = useState<string | null>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);

  // Debug State
  const [debug, setDebug] = useState({
    seedClickCount: 0,
    seedStatus: 'idle',
    seedStep: 'none',
    seedError: '',
    lastWrittenAccountId: '',
    directWriteStatus: 'pending',
    directReadStatus: 'pending',
    verifiedStandardAccountCount: 0,
  });

  useEffect(() => {
    if (!vendorId) return;

    const runDiagnostics = async () => {
      try {
        if (!vendorId) {
          setDiagnosticInfo({ error: 'No vendorId in AuthContext' });
          return;
        }
        const qT = query(collection(db, 'pos_terminals'), where('vendorId', '==', vendorId));
        const qC = query(collection(db, 'chart_accounts'), where('vendorId', '==', vendorId));
        const [tSnap, cSnap] = await Promise.all([
          getDocs(qT).catch((e) => {
            console.error('T-Diag Fail', e);
            return { size: 'ERR' } as any;
          }),
          getDocs(qC).catch((e) => {
            console.error('C-Diag Fail', e);
            return { size: 'ERR' } as any;
          }),
        ]);

        setDiagnosticInfo({
          authUid: user?.uid,
          vendorId,
          terminalCount: tSnap.size,
          chartAccountCount: cSnap.docs.filter((d: any) => !d.data().test).length,
          lastChecked: new Date().toLocaleTimeString(),
        });
      } catch (err: any) {
        console.error('[DIAGNOSTICS_ERROR]', err);
        setDiagnosticInfo({ error: err.message });
      }
    };

    runDiagnostics();
  }, [vendorId, user]);

  // Form
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');

  useEffect(() => {
    if (!vendorId) return;

    const unsubscribes: (() => void)[] = [];

    const qTerminals = query(
      collection(db, 'pos_terminals'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc'),
    );
    unsubscribes.push(
      onSnapshot(
        qTerminals,
        (snap) => {
          setTerminals(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
          setLoading(false);
        },
        (err) => {
          console.error('[POS SETTINGS]', err);
          setError(`Terminals Load Error: ${err.code} - ${err.message}`);
          setLoading(false);
        },
      ),
    );

    const qBranches = query(collection(db, 'branches'), where('vendorId', '==', vendorId));
    unsubscribes.push(
      onSnapshot(
        qBranches,
        (snap) => {
          setBranches(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        },
        (err) => {
          console.error('[POS SETTINGS]', err);
          setError(`Branches Load Error: ${err.code}`);
        },
      ),
    );

    return () => unsubscribes.forEach((u) => u());
  }, [vendorId]);

  const handleSeedAccounts = async () => {
    console.log('[COA SEED BUTTON CLICKED]');
    setDebug((prev) => ({
      ...prev,
      seedClickCount: prev.seedClickCount + 1,
      seedStatus: 'clicked',
      seedStep: 'start',
      seedError: '',
    }));

    if (!vendorId) {
      const err = 'Cannot seed accounts: vendorId missing.';
      setError(err);
      setDebug((prev) => ({ ...prev, seedStatus: 'error', seedError: err }));
      return;
    }

    setSeedingStatus('Seeding...');
    console.log('[COA SEED START]', { vendorId });

    try {
      // TASK C: Direct write test
      setDebug((prev) => ({ ...prev, seedStep: 'direct_write_test' }));
      const testAccountId = `${vendorId}-1000`;
      const testPayload = {
        accountId: testAccountId,
        vendorId,
        accountCode: '1000',
        accountName: 'Cash on Hand',
        accountType: 'Asset',
        normalBalance: 'debit',
        systemAccount: true,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'chart_accounts', testAccountId), testPayload);
        setDebug((prev) => ({
          ...prev,
          directWriteStatus: 'success',
          lastWrittenAccountId: testAccountId,
        }));

        // Immediate getDoc proof
        const testDoc = await getDoc(doc(db, 'chart_accounts', testAccountId));
        setDebug((prev) => ({
          ...prev,
          directReadStatus: testDoc.exists() ? 'success' : 'failed_not_found',
        }));
      } catch (writeErr: any) {
        console.error('[DIRECT_WRITE_FAIL]', writeErr);
        setDebug((prev) => ({
          ...prev,
          directWriteStatus: `failed: ${writeErr.code}`,
        }));
      }

      // TASK D: Call professional service
      setDebug((prev) => ({ ...prev, seedStep: 'calling_service' }));
      const result = await seedChartOfAccounts(vendorId);

      // TASK E: Final Verification
      setDebug((prev) => ({ ...prev, seedStep: 'verifying' }));
      const q = query(collection(db, 'chart_accounts'), where('vendorId', '==', vendorId));
      const snap = await getDocs(q);

      const standardAccounts = snap.docs.filter((d) => !d.data().test);
      const count = standardAccounts.length;

      let msg = '';
      if (count >= 18) {
        msg = `COA seed verified: ${count} accounts found.`;
        console.log('[COA SEED VERIFIED]', { vendorId, count });
      } else {
        msg = `COA seed incomplete: expected 18, found ${count}.`;
        console.warn('[COA SEED INCOMPLETE]', { vendorId, count });
      }

      setSeedingStatus(msg);
      setDebug((prev) => ({
        ...prev,
        seedStatus: 'completed',
        seedStep: 'done',
        verifiedStandardAccountCount: count,
      }));
      setDiagnosticInfo((prev) => ({ ...prev, chartAccountCount: count }));
      setTimeout(() => setSeedingStatus(null), 8000);
    } catch (err: any) {
      console.error('[COA SEED FAILED]', err);
      const errMsg = `${err.code || 'UNKNOWN'} - ${err.message}`;
      setError(`COA seed failed: ${errMsg}`);
      setDebug((prev) => ({ ...prev, seedStatus: 'error', seedError: errMsg }));
      setSeedingStatus(null);
    }
  };

  const handleTestWrite = async (collectionName: string) => {
    if (!vendorId) return;
    setError(null);
    const testId = `TEST-${Date.now()}`;
    console.log(`[TEST WRITE] ${collectionName}`, { testId, vendorId });

    try {
      await setDoc(doc(db, collectionName, testId), {
        id: testId,
        vendorId,
        test: true,
        createdAt: serverTimestamp(),
      });
      setSeedingStatus(`Test write to ${collectionName} SUCCEEDED.`);

      // If it's chart_accounts, update diagnostic count but only for non-test
      if (collectionName === 'chart_accounts') {
        const q = query(collection(db, 'chart_accounts'), where('vendorId', '==', vendorId));
        const snap = await getDocs(q);
        const count = snap.docs.filter((d) => !d.data().test).length;
        setDiagnosticInfo((prev) => ({ ...prev, chartAccountCount: count }));
      }
    } catch (err: any) {
      console.error(`[TEST WRITE FAILED] ${collectionName}`, err);
      setError(`Test write to ${collectionName} FAILED: ${err.code} - ${err.message}`);
    }
  };

  const handleCreateTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !user) return;

    setError(null);
    const terminalId = `TRM-${Date.now()}`;
    const terminalCode = `POS-${Math.floor(1000 + Math.random() * 9000)}`;

    const data = {
      terminalId,
      vendorId,
      branchId,
      terminalName: name,
      terminalCode,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'pos_terminals', terminalId), data);

      await createPOSEvent({
        vendorId,
        branchId,
        terminalId,
        eventType: 'POS_TERMINAL_CREATED',
        actorUid: user.uid,
        actorEmail: user.email!,
        metadata: { terminalName: name, terminalCode },
      });

      setIsModalOpen(false);
      setName('');
      setBranchId('');
    } catch (err: any) {
      setError(`Terminal Creation Failed: ${err.code} - ${err.message}`);
    }
  };

  const handleDeleteTerminal = async (id: string) => {
    if (!window.confirm('TERMINATE THIS TERMINAL IDENTITY? Current sessions will be invalidated.'))
      return;
    try {
      await deleteDoc(doc(db, 'pos_terminals', id));
    } catch (err: any) {
      console.error(err);
      setError(`Terminal Delete Failed: ${err.code}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-900 uppercase">
            POS Configuration
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            Terminal Identity Management
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-charcoal text-white h-11 px-6 rounded font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-slate-800 transition-all"
        >
          <Plus size={14} /> Provision Terminal
        </button>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded border border-red-200 flex items-center gap-3">
          <AlertCircle className="text-red-500" size={16} />
          <div className="flex-1">
            <p className="text-red-700 text-[10px] font-black uppercase leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Diagnostics Box */}
      <div className="bg-slate-900 text-white p-6 rounded-xl industrial-border border-slate-800 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="text-emerald-400" size={16} />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Node Diagnostics</h3>
          </div>
          <span className="text-[8px] font-mono text-slate-500">REF: {vendorId}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-[8px] font-black text-slate-500 uppercase">Auth UID</p>
            <p className="text-[10px] font-mono text-slate-300 truncate">{user?.uid || 'NONE'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[8px] font-black text-slate-500 uppercase">Vendor ID</p>
            <p className="text-[10px] font-mono text-slate-300 truncate">{vendorId || 'NONE'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[8px] font-black text-slate-500 uppercase">Terminals</p>
            <p className="text-[10px] font-black text-emerald-400">
              {diagnosticInfo?.terminalCount ?? '...'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[8px] font-black text-slate-500 uppercase">COA Accounts</p>
            <p className="text-[10px] font-black text-emerald-400">
              {diagnosticInfo?.chartAccountCount ?? '...'}
            </p>
          </div>
        </div>

        {diagnosticInfo?.error && (
          <p className="text-[8px] text-red-400 font-mono mt-2">
            DIAG_ERROR: {diagnosticInfo.error}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={() => handleTestWrite('chart_accounts')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded text-[8px] font-black uppercase hover:bg-slate-700"
          >
            <FlaskConical size={10} /> Test COA Write
          </button>
          <button
            onClick={() => handleTestWrite('pos_shifts')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded text-[8px] font-black uppercase hover:bg-slate-700"
          >
            <FlaskConical size={10} /> Test Shift Write
          </button>
          <button
            onClick={() => handleTestWrite('biEvents')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded text-[8px] font-black uppercase hover:bg-slate-700"
          >
            <FlaskConical size={10} /> Test BI Write
          </button>
        </div>
      </div>

      <div className="bg-orange-50 industrial-border border-orange-100 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-orange-itred text-white p-3 rounded-lg">
            <Database size={20} />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
              Accounting Foundation
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mt-1">
              Initialize default double-entry chart of accounts for POS journals.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            disabled={!!seedingStatus && seedingStatus.startsWith('Seeding')}
            onClick={handleSeedAccounts}
            className="bg-white text-orange-itred h-10 px-4 rounded border border-orange-200 font-black uppercase tracking-widest text-[9px] hover:bg-orange-100 transition-all disabled:opacity-50"
          >
            {seedingStatus || 'Seed POS Accounts'}
          </button>
          {seedingStatus && (
            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest animate-pulse">
              {seedingStatus}
            </p>
          )}
        </div>
      </div>

      {/* TASK B: Debug Panel */}
      <div className="bg-white border-2 border-dashed border-slate-200 p-6 rounded-xl space-y-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Seeding Debug Stream
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[9px] font-mono text-slate-600 uppercase">
          <div>
            Clicks: <span className="font-bold text-slate-900">{debug.seedClickCount}</span>
          </div>
          <div>
            Status: <span className="font-bold text-slate-900">{debug.seedStatus}</span>
          </div>
          <div>
            Step: <span className="font-bold text-slate-900">{debug.seedStep}</span>
          </div>
          <div>
            DocID:{' '}
            <span className="font-bold text-slate-900 truncate block">
              {debug.lastWrittenAccountId || '...'}
            </span>
          </div>
          <div>
            Direct Write:{' '}
            <span
              className={`font-bold ${debug.directWriteStatus === 'success' ? 'text-emerald-600' : 'text-orange-600'}`}
            >
              {debug.directWriteStatus}
            </span>
          </div>
          <div>
            Direct Read:{' '}
            <span
              className={`font-bold ${debug.directReadStatus === 'success' ? 'text-emerald-600' : 'text-orange-600'}`}
            >
              {debug.directReadStatus}
            </span>
          </div>
          <div>
            COA Count:{' '}
            <span className="font-bold text-slate-900">{debug.verifiedStandardAccountCount}</span>
          </div>
          <div>
            Vendor: <span className="font-bold text-slate-900 truncate block">{vendorId}</span>
          </div>
        </div>
        {debug.seedError && (
          <div className="mt-2 p-2 bg-red-50 text-red-600 text-[8px] font-bold border border-red-100 rounded">
            ERROR_STREAM: {debug.seedError}
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-20 text-center text-[10px] font-bold text-slate-400 animate-pulse">
          Syncing Terminals...
        </div>
      ) : terminals.length === 0 ? (
        <div className="bg-white industrial-border border-slate-200 rounded-xl p-20 text-center shadow-sm">
          <Laptop size={48} className="mx-auto text-slate-100 mb-4" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            No registered terminals found in this node.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {terminals.map((t) => (
            <div
              key={t.id}
              className="bg-white industrial-border border-slate-200 rounded-xl p-6 shadow-sm flex justify-between items-start"
            >
              <div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">
                  {t.terminalName}
                </h3>
                <p className="text-[10px] font-black text-orange-itred tracking-widest uppercase mt-1">
                  CODE: {t.terminalCode}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Branch: {branches.find((b) => b.id === t.branchId)?.name || 'UNKNOWN BRANCH'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDeleteTerminal(t.id)}
                className="text-slate-300 hover:text-red-500 p-2 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <form
            onSubmit={handleCreateTerminal}
            className="bg-white industrial-border border-slate-200 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center font-black">
              <span className="text-[10px] uppercase tracking-[0.3em] text-slate-900">
                Provision Terminal
              </span>
              <button type="button" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Terminal Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full industrial-border border-slate-200 p-3 text-xs font-bold uppercase outline-none focus:border-orange-itred transition-colors"
                  placeholder="Retail Counter 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Assign Branch
                </label>
                <select
                  required
                  className="w-full industrial-border border-slate-200 p-3 text-xs font-bold uppercase outline-none focus:border-orange-itred"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                >
                  <option value="">Select Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <button className="w-full bg-orange-itred text-white p-4 rounded font-black text-[10px] uppercase tracking-[0.3em] shadow-lg shadow-orange-100 mt-6">
                Initialize Terminal Identity
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
