import React, { useState, useEffect, useMemo } from 'react';
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
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Search,
  Filter,
  Eye,
  Printer,
  MessageSquare,
  RotateCcw,
  Trash2,
  X,
  CreditCard,
  Banknote,
  Clock,
  CheckCircle,
  ChevronRight,
  AlertCircle,
  RefreshCcw,
  ShieldAlert,
} from 'lucide-react';
import { POSReceipt } from '../../../components/pos/POSReceipt';
import { ReceiptData } from '../../../services/receiptService';
import { SaleReturnItem, createReturnRequest } from '../../../services/returnService';

import { createBIEvent, BIEventType } from '../../../services/biService';

export const VendorPOSSalesHistory = () => {
  const { vendorId, user, appUser } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Detail View
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Receipt state
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Return Modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'credit_note' | 'exchange'>('cash');

  // Improved return states
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState<string | null>(null);

  // Void states
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isSubmittingVoid, setIsSubmittingVoid] = useState(false);
  const [voidSuccess, setVoidSuccess] = useState<string | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) return;

    console.log('[SALES HISTORY LOAD] Querying vendor:', vendorId);
    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'pos_sales'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc'),
      limit(100),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        console.log('[SALES HISTORY SNAPSHOT] Received:', list.length);
        setSales(list);
        setLoading(false);
      },
      (err) => {
        console.error('[SALES HISTORY QUERY ERROR]', err);
        setError(
          'Unable to load sales history. Your account may not have POS sales read permission.',
        );
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [vendorId]);

  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales;
    const q = searchQuery.toLowerCase();
    return sales.filter(
      (s) =>
        s.receiptNumber?.toLowerCase().includes(q) ||
        s.saleId?.toLowerCase().includes(q) ||
        s.operatorEmail?.toLowerCase().includes(q) ||
        s.grandTotal?.toString().includes(q) ||
        s.paymentMethod?.toLowerCase().includes(q),
    );
  }, [sales, searchQuery]);

  const handleViewDetail = async (sale: any) => {
    console.log('[SALE DETAIL LOAD]', sale.id);
    setSelectedSale(sale);
    setLoadingItems(true);
    setSaleItems([]);

    try {
      const q = query(
        collection(db, 'pos_sale_items'),
        where('vendorId', '==', vendorId),
        where('saleId', '==', sale.id),
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        // Fallback for legacy items without vendorId
        const qLegacy = query(collection(db, 'pos_sale_items'), where('saleId', '==', sale.id));
        const legacySnap = await getDocs(qLegacy);
        setSaleItems(legacySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } else {
        setSaleItems(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    } catch (err) {
      console.error('[SALE ITEMS LOAD ERROR]', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleReprintReceipt = () => {
    if (!selectedSale || saleItems.length === 0) return;

    const data: ReceiptData = {
      vendorName: 'iTred Vendor',
      terminalName: selectedSale.terminalId || 'Terminal',
      operatorEmail: selectedSale.operatorEmail || 'Staff',
      receiptNumber: selectedSale.receiptNumber || selectedSale.id,
      saleId: selectedSale.id,
      date: selectedSale.completedAt?.toDate?.() || new Date(),
      items: saleItems.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      subtotal: selectedSale.subtotal || selectedSale.grandTotal,
      total: selectedSale.grandTotal,
      paymentMethod: selectedSale.paymentMethod || 'cash',
    };

    setReceiptData(data);
    setShowReceipt(true);
  };

  const handleWhatsApp = () => {
    // Mock WhatsApp logic (can use receiptService)
    alert('WhatsApp link generated for receipt. (Simulation)');
  };

  const handleInitReturn = () => {
    setReturnQuantities({});
    setReturnReason('');
    setReturnSuccess(null);
    setShowReturnModal(true);
  };

  const handleVoidRequest = async () => {
    if (!vendorId || !user || !selectedSale || !voidReason.trim()) return;

    setIsSubmittingVoid(true);
    setVoidError(null);

    try {
      await addDoc(collection(db, 'approval_requests'), {
        vendorId,
        requestType: 'POS_VOID_SALE',
        sourceCollection: 'pos_sales',
        sourceId: selectedSale.id,
        terminalId: selectedSale.terminalId || '_unknown',
        shiftId: selectedSale.shiftId || '_unknown',
        requestedByUid: user.uid,
        requestedByEmail: user.email,
        status: 'pending',
        reason: voidReason,
        amount: selectedSale.grandTotal,
        metadata: {
          receiptNumber: selectedSale.receiptNumber,
          saleId: selectedSale.id,
          total: selectedSale.grandTotal,
          itemCount: saleItems.length,
          paymentMethod: selectedSale.paymentMethod,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await createBIEvent({
        vendorId,
        userId: user.uid,
        userEmail: user.email!,
        userRole: appUser?.role || 'cashier',
        eventType: 'VOID_REQUESTED' as BIEventType,
        severity: 'warning',
        message: `Void sale requested for ${selectedSale.receiptNumber} by ${user.email}`,
        metadata: { saleId: selectedSale.id, reason: voidReason },
      });

      setVoidSuccess('Void reversal request submitted for approval.');
      setTimeout(() => {
        setShowVoidModal(false);
        setVoidSuccess(null);
        setVoidReason('');
        setSelectedSale(null);
      }, 2000);
    } catch (err: any) {
      console.error('[VOID REQUEST ERROR]', err);
      setVoidError('Failed to submit void request: ' + err.message);
    } finally {
      setIsSubmittingVoid(false);
    }
  };

  const handleQtyChange = (itemId: string, qty: number, max: number) => {
    const val = Math.max(0, Math.min(qty, max));
    setReturnQuantities((prev) => ({ ...prev, [itemId]: val }));
  };

  const submitReturn = async () => {
    if (!vendorId || !user || !selectedSale) {
      console.warn('[RETURN VALIDATION FAILED] Missing core context', {
        vendorId,
        user: !!user,
        selectedSale: !!selectedSale,
      });
      setReturnError('System context missing. Please re-login.');
      return;
    }

    setReturnError(null);
    setReturnSuccess(null);

    const items: SaleReturnItem[] = saleItems
      .filter((item) => (returnQuantities[item.id] || 0) > 0)
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        originalQty: item.quantity,
        returnQty: returnQuantities[item.id],
        unitPrice: item.unitPrice,
        lineTotal: returnQuantities[item.id] * item.unitPrice,
        costPrice: item.costPrice,
      }));

    console.log('[RETURN BUTTON CLICKED]', {
      selectedSaleId: selectedSale.saleId || selectedSale.id,
      vendorId,
      refundMethod,
      itemsCount: items.length,
      reason: returnReason,
    });

    if (items.length === 0) {
      setReturnError('Please select at least one item to return.');
      return;
    }
    if (!returnReason.trim()) {
      setReturnError('Return reason is required for audit trail.');
      return;
    }

    setIsSubmittingReturn(true);
    try {
      console.log('[RETURN REQUEST CREATE START]');
      await createReturnRequest({
        vendorId,
        originalSale: selectedSale,
        user: { uid: user.uid, email: user.email },
        appUser,
        returnItems: items,
        reason: returnReason,
        refundMethod,
      });

      console.log('[RETURN REQUEST SUCCESS]');
      setReturnSuccess('Return request submitted for approval.');

      // Auto close after brief success message
      setTimeout(() => {
        setShowReturnModal(false);
        setSelectedSale(null);
        setReturnSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('[RETURN REQUEST ERROR]', err);
      setReturnError(err.message || 'Failed to create return request. Permission denied.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      {showReceipt && receiptData && (
        <POSReceipt data={receiptData} onClose={() => setShowReceipt(false)} />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">
            Sales History
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">
            Audit Ledger // Receipt Retrieval // Activity Log
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="bg-white p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCcw size={18} className="text-slate-400" />
          </button>
          <div className="relative">
            <input
              type="text"
              placeholder="SEARCH RECEIPTS..."
              className="bg-white border border-slate-200 rounded-xl px-10 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-slate-900 w-64 shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex items-center gap-4 animate-in zoom-in-95">
          <ShieldAlert size={24} className="text-red-500" />
          <div>
            <p className="text-xs font-black text-red-900 uppercase">Permission Block</p>
            <p className="text-[10px] font-bold text-red-700 uppercase mt-1">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-20 bg-white rounded-xl border border-slate-100 animate-pulse"
            ></div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl industrial-border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">Receipt</th>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Operator</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="text-[10px] font-bold group hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => handleViewDetail(sale)}
                  >
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-slate-900 font-black">
                          {sale.receiptNumber || 'LEGACY-SALE'}
                        </span>
                        <span className="text-[8px] font-mono text-slate-400">{sale.saleId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-slate-300" />
                        <span className="text-slate-600">
                          {sale.completedAt?.toDate?.().toLocaleString() || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                          sale.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : sale.status === 'refund_completed'
                              ? 'bg-orange-50 text-orange-600 border-orange-100'
                              : 'bg-slate-50 text-slate-600 border-slate-100'
                        }`}
                      >
                        {sale.status}
                      </span>
                      {sale.hasReturn && (
                        <span className="ml-2 text-[8px] font-black text-orange-itred uppercase animate-pulse">
                          RETURNED
                        </span>
                      )}
                      {sale.voidApprovalStatus === 'approved' && (
                        <div className="mt-1 text-[7px] font-black text-orange-itred uppercase tracking-tighter">
                          Void approved — execution pending.
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-slate-500 font-normal truncate max-w-[120px] block">
                        {sale.operatorEmail || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-5 uppercase">{sale.paymentMethod}</td>
                    <td className="px-6 py-5 text-right font-black text-slate-900">
                      ${Number(sale.grandTotal).toFixed(2)}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button className="p-2 bg-slate-900 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg shadow-slate-900/20">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedSale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 industrial-border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                  {selectedSale.receiptNumber}
                </h2>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Detail Node: {selectedSale.saleId}
                </p>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Terminal
                  </p>
                  <p className="text-xs font-black">{selectedSale.terminalId || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Operator
                  </p>
                  <p className="text-xs font-black truncate">
                    {selectedSale.operatorEmail || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Method
                  </p>
                  <p className="text-xs font-black uppercase">
                    {selectedSale.paymentMethod || 'cash'}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Total Value
                  </p>
                  <p className="text-xs font-black text-emerald-600">
                    ${Number(selectedSale.grandTotal).toFixed(2)}
                  </p>
                </div>
              </div>

              {selectedSale.voidApprovalStatus === 'approved' && (
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3">
                  <ShieldAlert size={20} className="text-orange-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-orange-900 uppercase">
                      Void Approved — Execution Pending
                    </p>
                    <p className="text-[8px] font-bold text-orange-700 uppercase mt-0.5">
                      This transaction has been cleared for voiding by a supervisor. Final reversal
                      will be processed in Phase 2M-I.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">
                  Purchased Items
                </h3>
                {loadingItems ? (
                  <div className="space-y-2">
                    <div className="h-10 bg-slate-50 rounded animate-pulse"></div>
                    <div className="h-10 bg-slate-50 rounded animate-pulse"></div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {saleItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs font-bold bg-slate-50 p-4 rounded-xl"
                      >
                        <div>
                          <p className="uppercase">{item.productName}</p>
                          <p className="text-[8px] text-slate-400 mt-0.5">
                            QTY: {item.quantity} @ ${item.unitPrice.toFixed(2)}
                          </p>
                        </div>
                        <p className="font-black">${item.lineTotal.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4 pt-4">
                <button
                  onClick={handleReprintReceipt}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-900 transition-all group"
                >
                  <Printer size={20} className="text-slate-400 group-hover:text-slate-900" />
                  <span className="text-[8px] font-black uppercase tracking-widest">Reprint</span>
                </button>
                <button
                  onClick={handleWhatsApp}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 transition-all group"
                >
                  <MessageSquare
                    size={20}
                    className="text-slate-400 group-hover:text-emerald-500"
                  />
                  <span className="text-[8px] font-black uppercase tracking-widest">WhatsApp</span>
                </button>
                <button
                  onClick={handleInitReturn}
                  disabled={
                    selectedSale.saleType === 'refund' ||
                    (selectedSale.returnedAmount || 0) >= selectedSale.grandTotal
                  }
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-slate-200 hover:border-orange-itred transition-all group disabled:opacity-30 disabled:hover:border-slate-200"
                >
                  <RotateCcw size={20} className="text-slate-400 group-hover:text-orange-itred" />
                  <span className="text-[8px] font-black uppercase tracking-widest">Return</span>
                </button>
                <button
                  onClick={() => {
                    setVoidError(null);
                    setVoidSuccess(null);
                    setShowVoidModal(true);
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-slate-200 hover:border-red-500 transition-all group"
                >
                  <Trash2 size={20} className="text-slate-400 group-hover:text-red-500" />
                  <span className="text-[8px] font-black uppercase tracking-widest">Void</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RETURN MODAL */}
      {showReturnModal && selectedSale && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-sm font-black tracking-widest text-slate-900 uppercase">
                Process Return: {selectedSale.receiptNumber}
              </h2>
              <button
                onClick={() => setShowReturnModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {returnSuccess ? (
              <div className="p-12 text-center space-y-4">
                <CheckCircle size={48} className="mx-auto text-emerald-500 animate-bounce" />
                <h3 className="text-lg font-black uppercase text-emerald-900">{returnSuccess}</h3>
              </div>
            ) : (
              <div className="p-8 space-y-6">
                {returnError && (
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-3 animate-in shake duration-500">
                    <AlertCircle className="text-red-500" size={16} />
                    <p className="text-[10px] font-black text-red-700 uppercase">{returnError}</p>
                  </div>
                )}

                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                  {saleItems.map((item) => (
                    <div key={item.id} className="p-4 rounded-xl border border-slate-100 space-y-3">
                      <div className="flex justify-between items-start">
                        <p className="text-[10px] font-black truncate">{item.productName}</p>
                        <p className="text-[10px] font-black">${item.unitPrice.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-lg">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          Return Qty:
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              handleQtyChange(
                                item.id,
                                (returnQuantities[item.id] || 0) - 1,
                                item.quantity,
                              )
                            }
                            className="w-6 h-6 border rounded bg-white"
                          >
                            -
                          </button>
                          <span className="text-xs font-black">
                            {returnQuantities[item.id] || 0}
                          </span>
                          <button
                            onClick={() =>
                              handleQtyChange(
                                item.id,
                                (returnQuantities[item.id] || 0) + 1,
                                item.quantity,
                              )
                            }
                            className="w-6 h-6 border rounded bg-white"
                          >
                            +
                          </button>
                        </div>
                        <span className="ml-auto text-[8px] font-bold text-slate-400 uppercase">
                          of {item.quantity} Sold
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        Refund Method
                      </label>
                      <select
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 p-2 text-[10px] font-black uppercase rounded-lg outline-none"
                      >
                        <option value="cash">Direct Cash</option>
                        <option value="credit_note">Credit Note</option>
                        <option value="exchange">Exchange</option>
                      </select>
                    </div>
                    <div className="text-right">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        Total Refund
                      </label>
                      <p className="text-xl font-black text-slate-900">
                        $
                        {saleItems
                          .reduce(
                            (sum, item) => sum + (returnQuantities[item.id] || 0) * item.unitPrice,
                            0,
                          )
                          .toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Reason for Return
                    </label>
                    <textarea
                      placeholder="Enter audit trail reason..."
                      className="w-full bg-slate-50 border border-slate-200 p-3 text-[10px] font-medium rounded-xl outline-none focus:border-slate-900 min-h-[80px]"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={submitReturn}
                  disabled={isSubmittingReturn}
                  className="w-full h-14 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {isSubmittingReturn ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      SUBMITTING RETURN REQUEST...
                    </>
                  ) : (
                    'PROCESS RETURN REQUEST'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VOID MODAL */}
      {showVoidModal && selectedSale && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-red-50/50">
              <h2 className="text-sm font-black tracking-widest text-red-900 uppercase">
                VOID PROTOCOL: {selectedSale.receiptNumber}
              </h2>
              <button
                onClick={() => setShowVoidModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {voidSuccess ? (
              <div className="p-12 text-center space-y-4">
                <CheckCircle size={48} className="mx-auto text-emerald-500 animate-bounce" />
                <h3 className="text-lg font-black uppercase text-emerald-900">{voidSuccess}</h3>
              </div>
            ) : (
              <div className="p-8 space-y-6">
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-center gap-3">
                  <ShieldAlert size={20} className="text-orange-500 shrink-0" />
                  <p className="text-[9px] font-black text-orange-900 uppercase tracking-widest">
                    Voiding a sale requires supervisor clearance. This will request a full reversal
                    of the transaction value.
                  </p>
                </div>

                {voidError && (
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-3 animate-in shake duration-500 text-red-700 text-[10px] font-black uppercase">
                    {voidError}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">
                    Reason for Void Reversal
                  </label>
                  <textarea
                    required
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs font-bold outline-none focus:border-red-500 h-32 resize-none uppercase"
                    placeholder="E.G. DUPLICATE TRANSACTION, INCORRECT PAYMENT METHOD, SYSTEM ERROR..."
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleVoidRequest}
                  disabled={isSubmittingVoid || !voidReason.trim()}
                  className="w-full h-14 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-red-700 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {isSubmittingVoid ? 'Submitting Signal...' : 'Request Void Clearance'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
