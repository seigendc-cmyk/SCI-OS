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
  getDoc,
  doc,
} from 'firebase/firestore';
import {
  Search,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  ChevronRight,
  Banknote,
  RefreshCw,
  Filter,
  ShieldCheck,
  ShieldAlert,
  History,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { POSReceipt } from '../../../components/pos/POSReceipt';
import { ReceiptData } from '../../../services/receiptService';
import {
  SaleReturnItem,
  createReturnRequest,
  approveReturnRequest,
  rejectReturnRequest,
  completeReturnRefund,
} from '../../../services/returnService';

export const VendorPOSReturns = () => {
  const { user, vendorId, appUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [originalSale, setOriginalSale] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'credit_note' | 'exchange'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [returnDraftStarted, setReturnDraftStarted] = useState(false);
  const [completingReturnId, setCompletingReturnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Support for viewing requests
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [completedRequests, setCompletedRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'search' | 'pending' | 'completed'>('pending');

  // Receipt for refund
  const [lastRefundReceipt, setLastRefundReceipt] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const canApprove =
    appUser?.role === 'vendor_owner' || appUser?.permissions?.includes('pos.refund.approve');
  const canComplete =
    appUser?.role === 'vendor_owner' || appUser?.permissions?.includes('pos.refund.complete');

  useEffect(() => {
    if (!vendorId) return;

    console.log('[RETURNS INIT] Loading data for vendor:', vendorId);

    const qPending = query(
      collection(db, 'pos_return_requests'),
      where('vendorId', '==', vendorId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
    );
    const unsubPending = onSnapshot(
      qPending,
      (snap) => {
        setPendingRequests(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.error('[RETURNS PENDING ERROR]', err);
        setError('Unable to load pending return requests.');
      },
    );

    const qCompleted = query(
      collection(db, 'pos_return_requests'),
      where('vendorId', '==', vendorId),
      where('status', 'in', ['approved', 'completed', 'rejected']),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const unsubCompleted = onSnapshot(
      qCompleted,
      (snap) => {
        setCompletedRequests(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.error('[RETURNS COMPLETED ERROR]', err);
      },
    );

    return () => {
      unsubPending();
      unsubCompleted();
    };
  }, [vendorId]);

  const handleResetSearch = () => {
    setSearchQuery('');
    setSearching(false);
    setOriginalSale(null);
    setSaleItems([]);
    setReturnQuantities({});
    setReturnDraftStarted(false);
    setError(null);
    setSuccess(null);
  };

  const handleSearchSale = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || !vendorId) return;

    setSearching(true);
    setError(null);
    setSuccess(null);
    setOriginalSale(null);
    setSaleItems([]);
    setReturnQuantities({});

    try {
      console.log('[RETURN LOOKUP] Searching for:', searchQuery);

      const qById = query(
        collection(db, 'pos_sales'),
        where('vendorId', '==', vendorId),
        where('saleId', '==', searchQuery.trim()),
      );

      const qByRcpt = query(
        collection(db, 'pos_sales'),
        where('vendorId', '==', vendorId),
        where('receiptNumber', '==', searchQuery.trim()),
      );

      const [snapId, snapRcpt] = await Promise.all([getDocs(qById), getDocs(qByRcpt)]);
      let saleSnapDoc = snapId.empty ? (snapRcpt.empty ? null : snapRcpt.docs[0]) : snapId.docs[0];

      if (!saleSnapDoc) {
        setError('No completed sale found for this reference.');
        return;
      }

      const saleData = { id: saleSnapDoc.id, ...saleSnapDoc.data() } as any;

      if (
        saleData.status === 'refund_completed' ||
        saleData.saleType === 'refund' ||
        saleData.status === 'voided' ||
        saleData.status === 'draft'
      ) {
        setError('This sale cannot be returned because its status/type is not eligible.');
        return;
      }

      setOriginalSale(saleData);
      setReturnDraftStarted(false);

      // Fetch Items
      const itemsSnap = await getDocs(
        query(
          collection(db, 'pos_sale_items'),
          where('vendorId', '==', vendorId),
          where('saleId', '==', saleSnapDoc.id),
        ),
      );

      if (itemsSnap.empty) {
        // Legacy support
        const legacySnap = await getDocs(
          query(collection(db, 'pos_sale_items'), where('saleId', '==', saleSnapDoc.id)),
        );
        setSaleItems(legacySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } else {
        setSaleItems(itemsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    } catch (err: any) {
      console.error('[RETURN SEARCH ERROR]', err);
      setError(`Unable to search sales. ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const handleQtyChange = (itemId: string, qty: number, max: number) => {
    const val = Math.max(0, Math.min(qty, max));
    setReturnQuantities((prev) => ({ ...prev, [itemId]: val }));
  };

  const handleSubmitReturnRequest = async () => {
    if (!originalSale || !vendorId || !user) return;

    const returnItems: SaleReturnItem[] = saleItems
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

    if (returnItems.length === 0) {
      setError('Please select at least one item to return.');
      return;
    }

    if (!returnReason.trim()) {
      setError('Return reason is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await createReturnRequest({
        vendorId,
        originalSale,
        user: { uid: user.uid, email: user.email },
        appUser,
        returnItems,
        reason: returnReason,
        refundMethod,
      });

      setSuccess('Return request submitted for approval.');
      setOriginalSale(null);
      setSearchQuery('');
      setReturnReason('');
      setActiveTab('pending');
    } catch (err: any) {
      console.error('[RETURN REQUEST ERROR]', err);
      setError(`Failed to create return request: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovalAction = async (
    request: any,
    action: 'approved' | 'rejected',
    rejectReason?: string,
  ) => {
    if (!vendorId || !user || !canApprove) {
      console.warn('[RETURN APPROVAL BLOCKED] Pre-checks failed');
      return;
    }

    console.log('[RETURN APPROVE CLICKED]', {
      returnId: request.id || request.returnId,
      vendorId: request.vendorId,
    });

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    let approveStep = 'init';

    try {
      if (action === 'approved') {
        approveStep = 'approveReturnRequest';
        await approveReturnRequest(
          vendorId,
          request.id,
          { uid: user.uid, email: user.email },
          appUser,
        );
      } else {
        approveStep = 'rejectReturnRequest';
        await rejectReturnRequest(
          vendorId,
          request.id,
          { uid: user.uid, email: user.email },
          appUser,
          rejectReason || 'No reason provided',
        );
      }
      setSuccess(`Request ${action} successfully.`);
      setError(null);
    } catch (err: any) {
      console.error('[RETURN APPROVE ERROR]', err);
      setError(
        err.message.includes('at ')
          ? err.message
          : `Approval failed at ${approveStep}: ${err.message}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteRefundAction = async (request: any) => {
    if (!vendorId || !user) return;

    if (!canComplete) {
      setError('You do not have permission to complete refunds. Supervisor required.');
      return;
    }

    setCompletingReturnId(request.id);
    setError(null);
    setSuccess(null);

    console.log('[COMPLETE REFUND CLICKED]', {
      returnId: request.id,
      vendorId,
      status: request.status,
    });

    try {
      const result = await completeReturnRefund({
        vendorId,
        returnRequest: request,
        user: { uid: user.uid, email: user.email },
        appUser,
      });

      if (result.alreadyCompleted) {
        setSuccess('This refund was already completed.');
      } else {
        setSuccess('Refund completed. Stock and ledger updated.');
      }

      // Generate Data for receipt modal
      const receiptData: ReceiptData = {
        vendorName: 'iTred Vendor',
        terminalName: request.terminalId || 'POS',
        operatorEmail: user.email!,
        receiptNumber: result.refundReceiptNumber,
        saleId: result.refundSaleId,
        date: new Date(),
        items: request.items.map((i: any) => ({
          name: i.productName,
          quantity: -i.returnQty,
          unitPrice: i.unitPrice,
          lineTotal: -i.lineTotal,
        })),
        subtotal: -request.totalRefund,
        total: -request.totalRefund,
        paymentMethod: request.refundMethod,
      };
      setLastRefundReceipt(receiptData);
      setShowReceipt(true);

      console.log('[COMPLETE REFUND SUCCESS]', { returnId: request.id });
    } catch (err: any) {
      console.error('[COMPLETE REFUND ERROR]', err);
      setError(err.message);
    } finally {
      setCompletingReturnId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      {showReceipt && lastRefundReceipt && (
        <POSReceipt data={lastRefundReceipt} onClose={() => setShowReceipt(false)} />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">
            Returns & Refunds
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">
            Controlled Reversals // Inventory Reconciliation
          </p>
        </div>
        <div className="flex bg-white rounded-lg p-1 shadow-sm industrial-border border-slate-200">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all ${activeTab === 'search' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900'}`}
          >
            Search Sale
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded relative transition-all ${activeTab === 'pending' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900'}`}
          >
            Pending Requests
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-itred text-white text-[8px] flex items-center justify-center rounded-full animate-pulse">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all ${activeTab === 'completed' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900'}`}
          >
            History
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
          <p className="text-[10px] font-black text-red-700 uppercase leading-relaxed">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={16} />
          <p className="text-[10px] font-black text-emerald-700 uppercase leading-relaxed">
            {success}
          </p>
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}

      {activeTab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <section className="bg-white p-8 rounded-2xl industrial-border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Search size={16} className="text-slate-400" />
                    Locate Sale / Receipt
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                    Search by Sale ID, Receipt Number, or Reference
                  </p>
                </div>
                <Link
                  to="/vendor/pos/sales-history"
                  className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <History size={14} /> History
                </Link>
              </div>

              <div className="relative">
                <input
                  type="text"
                  className="w-full h-14 bg-slate-50 border border-slate-200 rounded-xl px-12 pr-24 text-sm font-black uppercase tracking-wider outline-none focus:border-slate-900 transition-all placeholder:text-slate-300"
                  placeholder="Enter Sale ID, Receipt No. or Scan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchSale();
                    }
                  }}
                  disabled={searching}
                />
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />

                {searchQuery && !searching && (
                  <button
                    onClick={handleResetSearch}
                    className="absolute right-[100px] top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900"
                  >
                    <X size={16} />
                  </button>
                )}

                <button
                  onClick={() => handleSearchSale()}
                  disabled={searching || !searchQuery.trim()}
                  className="absolute right-2 top-2 bottom-2 bg-slate-900 text-white px-6 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 min-w-[80px]"
                >
                  {searching ? <RefreshCw size={14} className="animate-spin" /> : 'SEARCH'}
                </button>
              </div>

              <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">
                Use this tool only for completed POS sales. Drafts and voided sales cannot be
                returned.
              </p>
            </section>

            {originalSale && (
              <section className="bg-slate-900 text-white p-8 rounded-2xl space-y-6 animate-in slide-in-from-left duration-300 shadow-xl border border-slate-800">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-emerald-500 text-white rounded text-[7px] font-black uppercase tracking-widest">
                        SALE_FOUND
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        ID: {originalSale.saleId || originalSale.id}
                      </span>
                    </div>
                    <h3 className="text-xl font-black tracking-tight">
                      {originalSale.receiptNumber || 'NO_RECEIPT'}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-emerald-400">
                      ${Number(originalSale.grandTotal || 0).toFixed(2)}
                    </p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                      {originalSale.completedAt?.toDate?.().toLocaleString() || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-800">
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Terminal
                    </p>
                    <p className="text-[10px] font-black uppercase">
                      {originalSale.terminalId || 'UNKNOWN'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Payment
                    </p>
                    <p className="text-[10px] font-black uppercase">
                      {originalSale.paymentMethod || 'UNKNOWN'}
                    </p>
                  </div>
                </div>

                {originalSale.hasReturn && (
                  <div className="flex items-center gap-2 text-orange-400">
                    <AlertCircle size={14} />
                    <p className="text-[9px] font-black uppercase">
                      Note: A partial or full return already exists for this sale.
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="space-y-6">
            {originalSale ? (
              <>
                {!returnDraftStarted ? (
                  <section className="bg-white industrial-border border-slate-200 rounded-2xl p-8 lg:p-12 text-center shadow-lg min-h-[400px] flex flex-col justify-center animate-in slide-in-from-right">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="text-emerald-500" size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      Sale Found
                    </h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-2 max-w-[300px] mx-auto leading-relaxed">
                      Reference {originalSale.receiptNumber} is valid and eligible for return.
                    </p>

                    <div className="mt-8 space-y-4 max-w-[320px] mx-auto w-full text-left">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            Total Amount
                          </p>
                          <p className="text-sm font-black text-slate-900">
                            ${Number(originalSale.grandTotal || 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            Payment
                          </p>
                          <p className="text-xs font-black text-slate-900 uppercase">
                            {originalSale.paymentMethod}
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            Date
                          </p>
                          <p className="text-[10px] font-black text-slate-900">
                            {originalSale.createdAt?.toDate?.().toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            Terminal
                          </p>
                          <p className="text-[10px] font-black text-slate-900 uppercase">
                            {originalSale.terminalId || 'POS'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setReturnDraftStarted(true)}
                        className="w-full h-14 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-3"
                      >
                        <RotateCcw size={16} />
                        Start Return Request
                      </button>

                      <button
                        onClick={handleResetSearch}
                        className="w-full text-center text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                      >
                        Cancel and Search Again
                      </button>
                    </div>
                  </section>
                ) : (
                  <section className="bg-white industrial-border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col h-full animate-in slide-in-from-right duration-300">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                        Return Itemization
                      </h3>
                      <button
                        onClick={() => setReturnDraftStarted(false)}
                        className="text-[9px] font-black text-slate-400 uppercase hover:text-slate-900"
                      >
                        Back
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[400px]">
                      {saleItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all space-y-3"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black text-slate-900 uppercase truncate mb-1">
                                {item.productName}
                              </p>
                              <p className="text-[9px] font-bold text-slate-400 font-mono">
                                ${item.unitPrice.toFixed(2)} x {item.quantity}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black text-slate-900">
                                ${item.lineTotal.toFixed(2)}
                              </p>
                            </div>
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
                                className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded-md hover:bg-slate-100"
                              >
                                -
                              </button>
                              <span className="text-xs font-black w-4 text-center">
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
                                className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded-md hover:bg-slate-100"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-6 border-t border-slate-100 bg-slate-50/30 space-y-6">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Refund Method
                            </label>
                            <select
                              value={refundMethod}
                              onChange={(e) => setRefundMethod(e.target.value as any)}
                              className="w-full industrial-border border-slate-200 p-2 text-[10px] font-black uppercase outline-none focus:border-slate-400"
                            >
                              <option value="cash">Direct Cash</option>
                              <option value="credit_note">Credit Note</option>
                              <option value="exchange">Exchange</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right block">
                              Refund Total
                            </label>
                            <p className="text-lg font-black text-slate-900 text-right">
                              $
                              {saleItems
                                .reduce(
                                  (sum, item) =>
                                    sum + (returnQuantities[item.id] || 0) * item.unitPrice,
                                  0,
                                )
                                .toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <textarea
                          className="w-full industrial-border border-slate-200 p-3 text-[10px] font-medium outline-none focus:border-slate-400 min-h-[60px]"
                          placeholder="Enter reason for return..."
                          value={returnReason}
                          onChange={(e) => setReturnReason(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={handleSubmitReturnRequest}
                        disabled={isSubmitting}
                        className="w-full h-14 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-3 transition-all"
                      >
                        <RotateCcw size={16} />
                        {isSubmitting ? 'PROCESSING...' : 'REQUEST RETURN'}
                      </button>
                    </div>
                  </section>
                )}
              </>
            ) : (
              <section className="bg-white h-auto industrial-border border-slate-200 rounded-2xl p-8 lg:p-12 text-center shadow-lg min-h-[400px] flex flex-col justify-center">
                <RotateCcw className="text-slate-100 mx-auto mb-6" size={48} />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">
                  Ready for Return Processing
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase mt-2 max-w-[300px] mx-auto leading-relaxed">
                  Search for a completed sale to inspect items, validate return quantities, and
                  begin a controlled refund request.
                </p>

                <div className="mt-8 space-y-3 max-w-[280px] mx-auto w-full">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                      Completed Sale Required
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <RefreshCw size={14} className="text-blue-500" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                      Stock Reconciled after Approval
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <ShieldCheck size={14} className="text-purple-500" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                      Supervisor Authorization Needed
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-2xl industrial-border border-slate-200 shadow-sm flex flex-col overflow-hidden animate-in zoom-in-95"
            >
              <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <RotateCcw size={14} className="text-orange-itred" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                    {req.id}
                  </span>
                </div>
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-[7px] font-black uppercase">
                  PENDING
                </span>
              </div>
              <div className="p-5 flex-1 space-y-4">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    Original Sale:
                  </span>
                  <p className="text-xs font-black">{req.originalSaleId}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    Total Refund:
                  </span>
                  <p className="text-sm font-black text-slate-900">
                    ${req.totalRefund?.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-1 gap-2">
                {canApprove && (
                  <>
                    <button
                      onClick={() => handleApprovalAction(req, 'approved')}
                      disabled={isSubmitting}
                      className="bg-slate-900 text-white p-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50"
                    >
                      Approve Refund
                    </button>
                    <button
                      onClick={() => {
                        const r = prompt('Reason?');
                        if (r) handleApprovalAction(req, 'rejected', r);
                      }}
                      disabled={isSubmitting}
                      className="bg-white border border-slate-200 text-slate-600 p-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
                {!canApprove && req.status === 'approved' && (
                  <button
                    onClick={() => handleCompleteRefundAction(req)}
                    disabled={isSubmitting}
                    className="bg-emerald-600 text-white p-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Finalize Refund
                  </button>
                )}
              </div>
            </div>
          ))}
          {pendingRequests.length === 0 && (
            <div className="col-span-full py-20 text-center opacity-30">
              <Clock className="mx-auto mb-4" size={32} />
              <p className="text-[10px] font-black uppercase tracking-widest">
                No pending requests
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'completed' && (
        <div className="bg-white rounded-2xl industrial-border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Request ID</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {completedRequests.map((req) => (
                <tr key={req.id} className="text-[10px] font-bold">
                  <td className="px-6 py-4 font-black">{req.id}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                        req.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-600'
                          : req.status === 'rejected'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-black">${req.totalRefund?.toFixed(2)}</td>
                  <td className="px-6 py-4 uppercase">{req.refundMethod}</td>
                  <td className="px-6 py-4 text-slate-400">
                    {req.createdAt?.toDate?.().toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {req.status === 'approved' && (
                      <button
                        onClick={() => handleCompleteRefundAction(req)}
                        disabled={completingReturnId === req.id}
                        className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {completingReturnId === req.id ? 'COMPLETING...' : 'COMPLETE REFUND'}
                      </button>
                    )}
                    {req.status === 'completed' && (
                      <button
                        onClick={() => {
                          const receiptData: ReceiptData = {
                            vendorName: 'iTred Vendor',
                            terminalName: req.terminalId || 'POS',
                            operatorEmail: req.completedByEmail || 'system',
                            receiptNumber: req.refundReceiptNumber || 'N/A',
                            saleId: req.refundSaleId || 'N/A',
                            date: req.completedAt?.toDate?.() || new Date(),
                            items: req.items.map((i: any) => ({
                              name: i.productName,
                              quantity: -i.returnQty,
                              unitPrice: i.unitPrice,
                              lineTotal: -i.lineTotal,
                            })),
                            subtotal: -req.totalRefund,
                            total: -req.totalRefund,
                            paymentMethod: req.refundMethod,
                          };
                          setLastRefundReceipt(receiptData);
                          setShowReceipt(true);
                        }}
                        className="text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-50"
                      >
                        VIEW RECEIPT
                      </button>
                    )}
                    {req.status === 'rejected' && (
                      <span className="text-[8px] font-black text-red-500 uppercase">REJECTED</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
