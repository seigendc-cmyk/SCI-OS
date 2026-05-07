import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  MoreVertical,
  ArrowRight,
  AlertTriangle,
  User,
  Monitor,
  History,
  DollarSign,
  Tag,
  Trash2,
  Printer,
  Eye,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
  Timestamp,
  getDoc,
  runTransaction,
} from 'firebase/firestore';
import { POSReceipt } from '../../../components/pos/POSReceipt';
import { ReceiptData } from '../../../services/receiptService';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { createBIEvent, BIEventType } from '../../../services/biService';

export const VendorPOSApprovals: React.FC = () => {
  const { user, vendorId, role } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>(
    'pending',
  );
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [viewingContext, setViewingContext] = useState<any>(null);
  const [contextReceipt, setContextReceipt] = useState<ReceiptData | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    if (!vendorId) return;

    const q = query(
      collection(db, 'approval_requests'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [vendorId]);

  const handleApprove = async (request: any) => {
    if (!vendorId) return;
    setIsApproving(true);

    try {
      await runTransaction(db, async (transaction) => {
        const requestDoc = doc(db, 'approval_requests', request.id);

        // Update approval request
        transaction.update(requestDoc, {
          status: 'approved',
          approvedAt: serverTimestamp(),
          approvedByUid: user?.uid,
          approvedByEmail: user?.email,
          updatedAt: serverTimestamp(),
        });

        // Handle Side Effects for VOID
        if (request.requestType === 'POS_VOID_SALE' && request.sourceId) {
          const saleDocRef = doc(db, 'pos_sales', request.sourceId);
          const saleSnap = await transaction.get(saleDocRef);

          if (saleSnap.exists()) {
            // Task A & B: Do NOT update status to "voided" yet.
            // Only mark as void approved but pending execution for Phase 2M-I.
            transaction.update(saleDocRef, {
              voidApprovalStatus: 'approved',
              voidApprovalId: request.id,
              voidApprovedAt: serverTimestamp(),
              voidApprovedByUid: user?.uid,
              voidExecutionStatus: 'pending_execution',
              updatedAt: serverTimestamp(),
            });

            // Note: Real inventory and accounting reversal happens in Phase 2M-I
          }
        }
      });

      // Task E: Create VOID_APPROVED Event
      await createBIEvent({
        vendorId,
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userRole: role || 'admin',
        eventType: (request.requestType === 'POS_VOID_SALE'
          ? 'VOID_APPROVED'
          : `${request.requestType}_APPROVED`) as BIEventType,
        severity: request.requestType === 'POS_VOID_SALE' ? 'warning' : 'info',
        message: `Approval request ${request.id} approved by ${user?.email}`,
        metadata: {
          approvalId: request.id,
          type: request.requestType,
          sourceId: request.sourceId,
          executionStatus:
            request.requestType === 'POS_VOID_SALE' ? 'pending_execution' : undefined,
        },
      });

      setSelectedRequest(null);
      setViewingContext(null);
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Failed to complete approval logic process.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !selectedRequest || !rejectionReason.trim()) return;

    try {
      await updateDoc(doc(db, 'approval_requests', selectedRequest.id), {
        status: 'rejected',
        rejectionReason,
        rejectedAt: serverTimestamp(),
        rejectedByUid: user?.uid,
        rejectedByEmail: user?.email,
        updatedAt: serverTimestamp(),
      });

      await createBIEvent({
        vendorId,
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userRole: role || 'admin',
        eventType: `${selectedRequest.requestType}_REJECTED` as BIEventType,
        severity: 'warning',
        message: `Approval request ${selectedRequest.id} rejected by ${user?.email}`,
        metadata: {
          approvalId: selectedRequest.id,
          type: selectedRequest.requestType,
          reason: rejectionReason,
        },
      });

      setShowRejectionModal(false);
      setRejectionReason('');
      setSelectedRequest(null);
    } catch (err) {
      console.error('Error rejecting request:', err);
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchesTab = activeTab === 'all' ? true : r.status === activeTab;
    const matchesSearch =
      r.requestedByEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requestType?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'POS_PRICE_OVERRIDE':
        return <Tag className="text-orange-500" size={18} />;
      case 'POS_DISCOUNT':
        return <DollarSign className="text-blue-500" size={18} />;
      case 'POS_VOID_SALE':
        return <Trash2 className="text-red-500" size={18} />;
      default:
        return <AlertTriangle className="text-slate-500" size={18} />;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
            Approval Desk
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
              Risk Control Center
            </span>
            <span className="text-[10px] font-black text-orange-itred uppercase tracking-widest bg-orange-50 px-2 py-1 rounded border border-orange-100 italic">
              Supervisor Authority Required
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="SEARCH REQUESTS..."
              className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-orange-itred/20 w-64 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {tab} Requests
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredRequests.map((request) => (
          <div
            key={request.id}
            className="bg-white industrial-border border-slate-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="flex items-start justify-between mb-8">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  {request.requestType}
                </p>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                  REF: {request.id.substring(0, 8)}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                  <Clock size={12} /> {request.createdAt?.toDate?.().toLocaleString() || 'N/A'}
                </p>
              </div>
              <div
                className={`p-3 rounded-xl ${request.status === 'pending' ? 'bg-orange-50 text-orange-600' : request.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}
              >
                {getIcon(request.requestType)}
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-50 flex items-center justify-center rounded-lg border border-slate-100 text-slate-400">
                  <User size={14} />
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    Requested By
                  </p>
                  <p className="text-[10px] font-black text-slate-900 uppercase">
                    {request.requestedByEmail}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 italic text-[10px] text-slate-600">
                "{request.reason || 'No reason provided'}"
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Impact Value
                  </p>
                  <p className="text-sm font-black text-slate-900">
                    ${Number(request.amount || 0).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Status
                  </p>
                  <div className="flex flex-col items-end">
                    <p
                      className={`text-[10px] font-black uppercase tracking-widest ${request.status === 'approved' ? 'text-emerald-500' : request.status === 'rejected' ? 'text-red-500' : 'text-orange-500'}`}
                    >
                      {request.status}
                    </p>
                    {request.status === 'approved' && request.requestType === 'POS_VOID_SALE' && (
                      <p className="text-[7px] font-black text-orange-itred uppercase animate-pulse mt-1">
                        Pending Phase 2M-I Execution
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {request.status === 'pending' && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleApprove(request)}
                  disabled={isApproving}
                  className="bg-emerald-500 text-white p-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
                <button
                  onClick={() => {
                    setSelectedRequest(request);
                    setShowRejectionModal(true);
                  }}
                  disabled={isApproving}
                  className="bg-red-50 text-red-600 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-100 font-black disabled:opacity-50"
                >
                  <XCircle size={14} /> Reject
                </button>
              </div>
            )}

            {request.status === 'pending' && (
              <button
                onClick={async () => {
                  setViewingContext(request);
                  // Try to hydrate contextual receipt if it's a sale-related request
                  const saleId = request.sourceId || (request.metadata && request.metadata.saleId);
                  if (saleId) {
                    try {
                      const saleSnap = await getDoc(doc(db, 'pos_sales', saleId));
                      if (saleSnap.exists()) {
                        const saleData = saleSnap.data();
                        const receipt: ReceiptData = {
                          saleId: saleData.id,
                          vendorName: 'iTred POS',
                          terminalName: saleData.terminalId || 'Terminal',
                          operatorEmail: saleData.operatorEmail || 'Staff',
                          receiptNumber: saleData.receiptNumber || saleData.id,
                          date: saleData.createdAt?.toDate() || new Date(),
                          items: saleData.items || request.metadata?.items || [],
                          total: saleData.grandTotal,
                          subtotal: saleData.subtotal,
                          paymentMethod: saleData.paymentMethod,
                        };
                        setContextReceipt(receipt);
                      }
                    } catch (e) {
                      console.error('Hydration error:', e);
                    }
                  }
                }}
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-slate-900 border border-slate-800 rounded-xl text-[9px] font-black text-white uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                <Eye size={14} /> View Source Context
              </button>
            )}

            <div className="absolute bottom-0 left-0 w-0 h-1 bg-orange-itred group-hover:w-full transition-all duration-500"></div>
          </div>
        ))}

        {filteredRequests.length === 0 && (
          <div className="col-span-full py-32 text-center bg-white rounded-3xl industrial-border border-dashed border-slate-200">
            <ShieldCheck size={64} className="mx-auto text-slate-100 mb-6" />
            <h2 className="text-xl font-black text-slate-300 uppercase tracking-tighter">
              No clearance requests pending in the vault
            </h2>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectionModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white industrial-border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-red-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                  Rejection Protocol
                </h2>
                <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em] mt-1 italic">
                  Security Denial Required
                </p>
              </div>
              <button
                onClick={() => setShowRejectionModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleReject} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                    Rejection Reason (Strictly Required)
                  </label>
                  <textarea
                    required
                    autoFocus
                    className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-bold focus:ring-2 focus:ring-red-500/20 outline-none h-32 resize-none"
                    placeholder="e.g. Risk too high, incorrect documentation, missing customer proof..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
                <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl flex gap-3">
                  <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                  <p className="text-[9px] font-black text-red-800 uppercase tracking-tight">
                    REJECTING THIS ACTION WILL LOG A SECURITY FAILURE EVENT AND NOTIFY THE
                    REQUESTING CASHIER IMMEDIATELY.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
              >
                Confirm Permanent Denial
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Context Viewer Modal */}
      {viewingContext && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-500">
            {/* Summary Side */}
            <div className="w-full md:w-1/2 p-10 border-r border-slate-100 overflow-y-auto">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                    Request Context
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 italic">
                    Audit Chain Intelligence
                  </p>
                </div>
                <button
                  onClick={() => setViewingContext(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-slate-900 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center text-white">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                      Proposed Action
                    </span>
                    <span className="text-xs font-black text-white uppercase">
                      {viewingContext.requestType}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-white">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                      Financial Impact
                    </span>
                    <span className="text-lg font-black text-white">
                      ${Number(viewingContext.amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-slate-800">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Stated Reason
                    </p>
                    <p className="text-xs italic text-slate-300 font-bold">
                      "{viewingContext.reason || 'No reason provided'}"
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Terminal
                    </p>
                    <p className="text-[10px] font-black text-slate-900 font-mono">
                      {viewingContext.terminalId}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Requesting Staff
                    </p>
                    <p className="text-[10px] font-black text-slate-900 uppercase truncate">
                      {viewingContext.requestedByEmail}
                    </p>
                  </div>
                </div>

                {viewingContext.status === 'pending' && (
                  <div className="flex gap-3 pt-6 border-t border-slate-100">
                    <button
                      onClick={() => handleApprove(viewingContext)}
                      disabled={isApproving}
                      className="flex-1 bg-emerald-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={16} /> Authorize Action
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRequest(viewingContext);
                        setShowRejectionModal(true);
                      }}
                      disabled={isApproving}
                      className="flex-1 bg-red-50 text-red-600 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-100 transition-all flex items-center justify-center gap-2 border border-red-100"
                    >
                      <XCircle size={16} /> Deny Request
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Receipt Side */}
            <div className="w-full md:w-1/2 bg-slate-50 p-10 flex flex-col items-center justify-center overflow-y-auto">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">
                Original Transaction Receipt
              </p>
              {contextReceipt ? (
                <div className="scale-90 origin-top shadow-2xl">
                  <POSReceipt data={contextReceipt} />
                </div>
              ) : (
                <div className="text-center">
                  <AlertTriangle size={32} className="text-slate-200 mx-auto mb-4" />
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    Transaction details unavailable
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
