import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  getDocs,
  setDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { Plus, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPOSEvent } from '../../../services/orderService';
import { createBIEvent, BIEventType } from '../../../services/biService';

export const VendorPOSShifts = () => {
  const { vendorId, user } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [terminals, setTerminals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [actualCash, setActualCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [expectedCashCalc, setExpectedCashCalc] = useState(0);

  // Form
  const [terminalId, setTerminalId] = useState('');
  const [openingCash, setOpeningCash] = useState('0');

  useEffect(() => {
    if (!vendorId) return;

    const unsubscribes: (() => void)[] = [];

    const qShifts = query(
      collection(db, 'pos_shifts'),
      where('vendorId', '==', vendorId),
      orderBy('openedAt', 'desc'),
      limit(20),
    );
    unsubscribes.push(
      onSnapshot(
        qShifts,
        (snap) => {
          setShifts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
          setLoading(false);
        },
        (err) => {
          console.error('[POS SHIFTS]', err);
          setError(`Shifts Load Error: ${err.code} - ${err.message}`);
          setLoading(false);
        },
      ),
    );

    const qTerminals = query(collection(db, 'pos_terminals'), where('vendorId', '==', vendorId));
    unsubscribes.push(
      onSnapshot(
        qTerminals,
        (snap) => {
          setTerminals(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        },
        (err) => {
          console.error('[POS SHIFTS]', err);
          setError(`Terminals Load Error: ${err.code}`);
        },
      ),
    );

    return () => unsubscribes.forEach((u) => u());
  }, [vendorId]);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!vendorId || !user || !terminalId) return;

    console.log('[SHIFT OPEN START]', {
      vendorId,
      terminalId,
      openingCash,
      actorUid: user.uid,
      actorEmail: user.email,
    });

    let currentStep = 'starting';
    try {
      currentStep = 'checking_active_shifts';
      console.log('[SHIFT OPEN STEP]', currentStep);
      // Check if terminal already has open shift
      const qOpen = query(
        collection(db, 'pos_shifts'),
        where('vendorId', '==', vendorId),
        where('terminalId', '==', terminalId),
        where('status', '==', 'open'),
      );
      const openSnap = await getDocs(qOpen);
      if (!openSnap.empty) {
        console.warn('[SHIFT OPEN BLOCKED]', 'Terminal already has open shift.');
        setError(
          'ALREADY_OPEN: This terminal has an active shift. Close it before opening a new one.',
        );
        return;
      }

      const terminal = terminals.find((t) => t.id === terminalId);
      if (!terminal?.branchId) {
        console.error('[SHIFT OPEN FAILED]', {
          step: 'branch_validation',
          message: 'Terminal has no branchId',
        });
        setError('Cannot open shift: Selected terminal has no branchId. Re-configure terminal.');
        return;
      }

      const shiftId = `SFT-${Date.now()}`;
      const now = serverTimestamp();
      const data = {
        shiftId,
        vendorId,
        branchId: terminal.branchId,
        terminalId,
        terminalName: terminal.terminalName,
        openedByUid: user.uid,
        openedByEmail: user.email,
        openingCash: Number(openingCash),
        status: 'open',
        openedAt: now,
        closedAt: null,
        closingCash: null,
        expectedCash: Number(openingCash),
        cashVariance: 0,
        createdAt: now,
        updatedAt: now,
      };

      currentStep = 'pos_shifts_write';
      console.log('[SHIFT OPEN STEP]', currentStep, data);
      await setDoc(doc(db, 'pos_shifts', shiftId), data);

      currentStep = 'pos_events_write';
      console.log('[SHIFT OPEN STEP]', currentStep);
      try {
        await createPOSEvent({
          vendorId,
          branchId: terminal.branchId,
          terminalId,
          shiftId,
          eventType: 'POS_SHIFT_OPENED',
          actorUid: user.uid,
          actorEmail: user.email!,
          metadata: { openingCash },
        });
      } catch (err: any) {
        console.error('[SHIFT OPEN WARNING]', {
          step: 'pos_events',
          code: err.code,
          message: err.message,
        });
      }

      currentStep = 'biEvents_write';
      console.log('[SHIFT OPEN STEP]', currentStep);
      try {
        await createBIEvent({
          vendorId,
          userId: user.uid,
          userEmail: user.email!,
          userRole: 'vendor_owner',
          eventType: BIEventType.SHIFT_OPENED,
          severity: 'info',
          message: `Shift ${shiftId} opened on terminal ${terminal?.terminalName} with $${openingCash}.`,
          terminalId,
          shiftId,
        });
      } catch (err: any) {
        console.error('[SHIFT OPEN WARNING]', {
          step: 'biEvents',
          code: err.code,
          message: err.message,
        });
      }

      setSuccessMsg(`Shift ${shiftId} opened successfully.`);
      setIsOpening(false);
      setTerminalId('');
      setOpeningCash('0');
      console.log('[SHIFT OPEN SUCCESS]', { shiftId });
    } catch (err: any) {
      console.error('[SHIFT OPEN CRITICAL FAILED]', err);
      setError(`Shift failed at ${currentStep}: ${err.code || 'ERROR'} - ${err.message}`);
    }
  };

  const initiateCloseShift = async (shift: any) => {
    setSelectedShift(shift);
    setIsClosing(true);
    setError(null);
    setActualCash('');
    setCloseNotes('');

    console.log('[SHIFT CLOSE INIT]', shift.id);

    try {
      // Calculate expected cash = opening + cash sales
      const qSales = query(
        collection(db, 'pos_sales'),
        where('vendorId', '==', vendorId),
        where('shiftId', '==', shift.id),
        where('status', '==', 'completed'),
        where('paymentMethod', '==', 'cash'),
      );
      const salesSnap = await getDocs(qSales);
      const cashSalesTotal = salesSnap.docs.reduce(
        (sum, doc) => sum + Number(doc.data().grandTotal || 0),
        0,
      );

      console.log('[SHIFT CLOSE SALES TOTAL]', cashSalesTotal);
      const expected = Number(shift.openingCash || 0) + cashSalesTotal;
      setExpectedCashCalc(expected);
      console.log('[SHIFT CLOSE CALC]', {
        opening: shift.openingCash,
        sales: cashSalesTotal,
        expected,
      });
    } catch (err: any) {
      console.error('[SHIFT CLOSE PRE-CALC ERROR]', err);
      setError(`Failed to calculate shift totals: ${err.message}`);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !user || !selectedShift) return;

    const actual = Number(actualCash);
    if (actual < 0 || actualCash === '') {
      setError('Invalid actual cash amount.');
      return;
    }

    const variance = actual - expectedCashCalc;
    const cashSalesTotal = expectedCashCalc - Number(selectedShift.openingCash || 0);
    const now = serverTimestamp();
    const batch = writeBatch(db);

    console.log('[SHIFT CLOSE COMMIT START]', {
      shiftId: selectedShift.id,
      expected: expectedCashCalc,
      actual,
      variance,
    });

    try {
      // 1. Update Shift
      const shiftRef = doc(db, 'pos_shifts', selectedShift.id);
      batch.update(shiftRef, {
        status: 'closed',
        closedAt: now,
        closedByUid: user.uid,
        closedByEmail: user.email,
        expectedCash: expectedCashCalc,
        actualCash: actual,
        cashVariance: variance,
        cashSalesTotal: cashSalesTotal,
        closeNotes: closeNotes,
        updatedAt: now,
      });

      // 2. Events & BI
      const eventId = `EVT-CLOSE-${selectedShift.id}`;
      batch.set(doc(db, 'pos_events', eventId), {
        eventId,
        vendorId,
        branchId: selectedShift.branchId,
        terminalId: selectedShift.terminalId,
        shiftId: selectedShift.id,
        eventType: 'SHIFT_CLOSED',
        severity: 'info',
        actorUid: user.uid,
        actorEmail: user.email!,
        expectedCash: expectedCashCalc,
        actualCash: actual,
        cashVariance: variance,
        metadata: {
          expectedCash: expectedCashCalc,
          actualCash: actual,
          cashVariance: variance,
          closeNotes,
        },
        createdAt: now,
      });

      // General BI Close
      const biCloseId = `BI-CLOSE-${selectedShift.id}`;
      batch.set(doc(db, 'biEvents', biCloseId), {
        vendorId,
        userId: user.uid,
        userEmail: user.email!,
        userRole: 'vendor_owner',
        eventType: BIEventType.SHIFT_CLOSED,
        severity: 'info',
        message: `Shift ${selectedShift.id} closed on terminal ${selectedShift.terminalName}. Final cash: $${actual}.`,
        metadata: {
          shiftId: selectedShift.id,
          terminalId: selectedShift.terminalId,
          expectedCash: expectedCashCalc,
          actualCash: actual,
          cashVariance: variance,
        },
        createdAt: now,
      });

      if (variance !== 0) {
        const varEventId = `EVT-VAR-${selectedShift.id}`;
        const severity = Math.abs(variance) > 5 ? 'critical' : 'warning';
        batch.set(doc(db, 'pos_events', varEventId), {
          eventId: varEventId,
          vendorId,
          branchId: selectedShift.branchId,
          terminalId: selectedShift.terminalId,
          shiftId: selectedShift.id,
          eventType: 'CASH_VARIANCE_FOUND',
          severity,
          actorUid: user.uid,
          actorEmail: user.email!,
          expectedCash: expectedCashCalc,
          actualCash: actual,
          cashVariance: variance,
          metadata: {
            expectedCash: expectedCashCalc,
            actualCash: actual,
            cashVariance: variance,
            closeNotes,
          },
          createdAt: now,
        });

        // Also BI
        const biVarId = `BI-VAR-${selectedShift.id}`;
        batch.set(doc(db, 'biEvents', biVarId), {
          vendorId,
          userId: user.uid,
          userEmail: user.email!,
          userRole: 'vendor_owner',
          eventType: BIEventType.CASH_VARIANCE_FOUND,
          severity,
          message: `CASH VARIANCE: $${variance.toFixed(2)} found in shift ${selectedShift.id} on ${selectedShift.terminalName}`,
          metadata: {
            expectedCash: expectedCashCalc,
            actualCash: actual,
            cashVariance: variance,
            shiftId: selectedShift.id,
            terminalId: selectedShift.terminalId,
          },
          createdAt: now,
        });
      }

      await batch.commit();
      console.log('[SHIFT CLOSE COMMIT SUCCESS]');
      setSuccessMsg(`Shift ${selectedShift.id} closed successfully.`);
      setIsClosing(false);
      setSelectedShift(null);
    } catch (err: any) {
      console.error('[SHIFT CLOSE ERROR]', err);
      setError(`Shift reduction failed: ${err.code} - ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-900 uppercase">
            Shift Management
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            Cash Control & Operational Handover
          </p>
        </div>
        <button
          disabled={terminals.length === 0}
          onClick={() => setIsOpening(true)}
          className="bg-[#25D366] text-white h-11 px-6 rounded font-black uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-lg shadow-emerald-50 hover:bg-[#1fb355] transition-all disabled:opacity-50"
        >
          <Plus size={14} /> Open Station Shift
        </button>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded border border-red-200 flex items-center gap-3">
          <AlertCircle className="text-red-500" size={16} />
          <p className="text-red-700 text-[10px] font-black uppercase">{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 p-4 rounded border border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="text-emerald-500" size={16} />
          <p className="text-emerald-700 text-[10px] font-black uppercase">{successMsg}</p>
        </div>
      )}

      {terminals.length === 0 && !loading && (
        <div className="bg-orange-50 p-6 rounded-xl industrial-border border-orange-100 text-center">
          <p className="text-orange-900 text-xs font-black uppercase tracking-widest">
            No POS terminal found. Create a terminal in POS Settings before opening a shift.
          </p>
          <Link
            to="/vendor/pos/settings"
            className="mt-4 inline-block text-[10px] font-black text-orange-itred uppercase underline tracking-widest"
          >
            Go to POS Settings
          </Link>
        </div>
      )}

      <div className="bg-white rounded-xl industrial-border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/50">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Shift Chronicle // Last 20 Sessions
          </h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-[10px] font-bold text-slate-400 animate-pulse">
            Syncing with Shift Node...
          </div>
        ) : shifts.length === 0 ? (
          <div className="p-20 text-center italic text-slate-400 text-xs font-bold uppercase tracking-widest">
            No shift history found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900 text-white text-[9px] uppercase tracking-widest sticky top-0">
                <tr>
                  <th className="px-6 py-4 font-black">Terminal</th>
                  <th className="px-6 py-4 font-black">Status</th>
                  <th className="px-6 py-4 font-black">Operator</th>
                  <th className="px-6 py-4 font-black">Open Cash</th>
                  <th className="px-6 py-4 font-black">Close Cash</th>
                  <th className="px-6 py-4 font-black">Date</th>
                  <th className="px-6 py-4 font-black">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {shifts.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-[11px] font-black text-slate-900 uppercase">
                        {terminals.find((t) => t.id === s.terminalId)?.terminalName || s.terminalId}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                          s.status === 'open'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter truncate w-32">
                        {s.openedByEmail}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] font-black text-slate-900">
                        ${s.openingCash?.toFixed(2)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] font-black text-slate-900">
                        {s.closingCash ? `$${s.closingCash.toFixed(2)}` : '---'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-[9px] font-mono text-slate-400">
                      {s.openedAt?.toDate ? s.openedAt.toDate().toLocaleString() : '...'}
                    </td>
                    <td className="px-6 py-4">
                      {s.status === 'open' && (
                        <button
                          onClick={() => initiateCloseShift(s)}
                          className="bg-red-500 text-white px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest hover:bg-red-600 transition-colors"
                        >
                          Close Shift
                        </button>
                      )}
                      {s.status === 'closed' && (
                        <div className="flex flex-col gap-1">
                          <span
                            className={`text-[8px] font-black uppercase px-1 rounded w-fit ${s.cashVariance !== 0 ? (Math.abs(s.cashVariance || 0) > 5 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600') : 'bg-emerald-100 text-emerald-600'}`}
                          >
                            VAR: ${Number(s.cashVariance || 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isClosing && selectedShift && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <form
            onSubmit={handleCloseShift}
            className="bg-white industrial-border border-slate-200 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center font-black">
              <span className="text-[10px] uppercase tracking-[0.3em] text-slate-900">
                Shift Finalization & Reconciliation
              </span>
              <button type="button" onClick={() => setIsClosing(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-slate-50 p-4 rounded-lg space-y-2 border border-slate-100">
                <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Opening Float</span>
                  <span className="text-slate-900">${selectedShift.openingCash?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Total Cash Sales</span>
                  <span className="text-emerald-600">
                    ${(expectedCashCalc - selectedShift.openingCash).toFixed(2)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-[10px] font-black text-slate-900 uppercase tracking-widest">
                  <span>Expected Cash in Drawer</span>
                  <span className="text-orange-itred">${expectedCashCalc.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Actual Cash Counted
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full industrial-border border-slate-200 p-3 text-xs font-bold uppercase outline-none focus:border-emerald-500"
                  placeholder="Enter physical cash amount"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Shift Notes / Variance Reasons
                </label>
                <textarea
                  className="w-full industrial-border border-slate-200 p-3 text-[10px] font-medium outline-none focus:border-slate-400 min-h-[60px]"
                  placeholder="Any discrepancies or incidents?"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                />
              </div>

              {actualCash !== '' && (
                <div
                  className={`p-3 rounded flex justify-between items-center animate-in slide-in-from-top-1 ${
                    Number(actualCash) - expectedCashCalc === 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    Handover Variance:
                  </span>
                  <span className="font-mono text-xs font-black uppercase">
                    ${(Number(actualCash) - expectedCashCalc).toFixed(2)}
                  </span>
                </div>
              )}

              {error && (
                <p className="text-[9px] font-black text-red-600 uppercase bg-red-50 p-3 rounded leading-relaxed">
                  {error}
                </p>
              )}
              <button className="w-full bg-slate-900 text-white p-4 rounded font-black text-[10px] uppercase tracking-[0.3em] shadow-lg shadow-slate-900/10 mt-2 hover:bg-slate-800 transition-all">
                Close Shift & Record Cash Count
              </button>
            </div>
          </form>
        </div>
      )}

      {isOpening && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <form
            onSubmit={handleOpenShift}
            className="bg-white industrial-border border-slate-200 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center font-black">
              <span className="text-[10px] uppercase tracking-[0.3em] text-slate-900">
                Shift Initialization
              </span>
              <button type="button" onClick={() => setIsOpening(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Select Station / Terminal
                </label>
                <select
                  required
                  className="w-full industrial-border border-slate-200 p-3 text-xs font-bold uppercase outline-none focus:border-orange-itred"
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                >
                  <option value="">Select Terminal</option>
                  {terminals.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.terminalName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Opening Float (Cash)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full industrial-border border-slate-200 p-3 text-xs font-bold uppercase outline-none focus:border-orange-itred"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-[9px] font-black text-red-600 uppercase bg-red-50 p-3 rounded leading-relaxed">
                  {error}
                </p>
              )}
              <button className="w-full bg-[#25D366] text-white p-4 rounded font-black text-[10px] uppercase tracking-[0.3em] shadow-lg shadow-emerald-50 mt-6">
                Authorize Shift Opening
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
