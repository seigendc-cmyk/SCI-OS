import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  MoreVertical,
  DollarSign,
  Printer,
  MessageSquare,
  AlertTriangle,
  History,
  ArrowRight,
  User,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { createBIEvent, BIEventType } from '../../../services/biService';

export const VendorPOSLayby: React.FC = () => {
  const { user, vendorId, role } = useAuth();
  const [laybys, setLaybys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'open' | 'completed' | 'cancelled'>('open');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedLayby, setSelectedLayby] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);

  useEffect(() => {
    if (!vendorId) return;

    const q = query(
      collection(db, 'layby_orders'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLaybys(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [vendorId]);

  const handleReceivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !selectedLayby || paymentAmount <= 0) return;

    try {
      const batch = writeBatch(db);
      const paymentRef = doc(collection(db, 'layby_payments'));
      const laybyRef = doc(db, 'layby_orders', selectedLayby.id);

      const newDeposit = Number(selectedLayby.depositPaid || 0) + paymentAmount;
      const newBalance = Number(selectedLayby.totalAmount || 0) - newDeposit;
      const isCompleted = newBalance <= 0;

      batch.set(paymentRef, {
        vendorId,
        laybyId: selectedLayby.id,
        customerId: selectedLayby.customerId,
        amount: paymentAmount,
        paymentMethod: 'cash', // Default for now
        receiptNumber: `LAY-${Date.now()}`,
        receivedByUid: user?.uid,
        receivedByEmail: user?.email,
        createdAt: serverTimestamp(),
      });

      batch.update(laybyRef, {
        depositPaid: newDeposit,
        balanceDue: Math.max(0, newBalance),
        status: isCompleted ? 'completed' : 'open',
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      await createBIEvent({
        vendorId,
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userRole: role || 'admin',
        eventType: isCompleted
          ? ('LAYBY_COMPLETED' as BIEventType)
          : ('LAYBY_PAYMENT_RECEIVED' as BIEventType),
        severity: 'info',
        message: isCompleted
          ? `Layby completed for ${selectedLayby.customerName}`
          : `Layby payment of $${paymentAmount} from ${selectedLayby.customerName}`,
        metadata: { laybyId: selectedLayby.id, amount: paymentAmount },
      });

      setShowPaymentModal(false);
      setSelectedLayby(null);
      setPaymentAmount(0);
    } catch (err) {
      console.error('Error processing layby payment:', err);
    }
  };

  const filteredLaybys = laybys.filter(
    (l) =>
      l.status === activeTab &&
      (l.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.id.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
            Layby Portal
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
              Instalment Plan Management
            </span>
            <span className="text-[10px] font-black text-orange-itred uppercase tracking-widest bg-orange-50 px-2 py-1 rounded border border-orange-100 italic">
              Financial Recovery
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="SEARCH LAYBYS..."
              className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-orange-itred/20 w-64 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        {(['open', 'completed', 'cancelled'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {tab} Orders
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredLaybys.map((order) => (
          <div
            key={order.id}
            className="bg-white industrial-border border-slate-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="flex items-start justify-between mb-8">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  REFERENCE: {order.id.substring(0, 8)}
                </p>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                  {order.customerName}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                  <Clock size={12} /> EXP:{' '}
                  {order.expiryDate?.toDate?.().toLocaleDateString() || 'N/A'}
                </p>
              </div>
              <div
                className={`p-3 rounded-xl ${order.status === 'open' ? 'bg-orange-50 text-orange-600' : order.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}
              >
                {order.status === 'open' ? (
                  <Clock size={20} />
                ) : order.status === 'completed' ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <XCircle size={20} />
                )}
              </div>
            </div>

            <div className="space-y-6 mb-8">
              <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-orange-itred transition-all duration-1000"
                  style={{
                    width: `${(order.depositPaid / order.totalAmount) * 100}%`,
                  }}
                ></div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Total Amount
                  </p>
                  <p className="text-lg font-black text-slate-900 tracking-tighter">
                    ${Number(order.totalAmount).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-orange-itred uppercase tracking-widest mb-1">
                    Balance Due
                  </p>
                  <p className="text-lg font-black text-orange-itred tracking-tighter">
                    ${Number(order.balanceDue).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {order.status === 'open' && (
                <button
                  onClick={() => {
                    setSelectedLayby(order);
                    setShowPaymentModal(true);
                  }}
                  className="bg-slate-900 text-white p-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  <DollarSign size={14} /> Receive Pay
                </button>
              )}
              <button className="bg-slate-50 text-slate-600 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 border border-slate-100">
                <Printer size={14} /> Receipt
              </button>
              {order.status !== 'open' && (
                <button className="col-span-2 bg-slate-50 text-slate-400 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed">
                  Order Finalized
                </button>
              )}
            </div>

            <div className="absolute bottom-0 left-0 w-0 h-1 bg-orange-itred group-hover:w-full transition-all duration-500"></div>
          </div>
        ))}

        {filteredLaybys.length === 0 && (
          <div className="col-span-full py-32 text-center bg-white rounded-3xl industrial-border border-dashed border-slate-200">
            <ShoppingBag size={64} className="mx-auto text-slate-100 mb-6" />
            <h2 className="text-xl font-black text-slate-300 uppercase tracking-tighter">
              No layby records found in this vault
            </h2>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white industrial-border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-orange-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                  Layby Installment
                </h2>
                <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em] mt-1 italic">
                  Partial Recovery Protocol
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <Plus className="rotate-45" size={24} />
              </button>
            </div>

            <form onSubmit={handleReceivePayment} className="p-8 space-y-6">
              <div className="space-y-6">
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      REMAINING BALANCE
                    </p>
                    <p className="text-2xl font-black text-orange-itred tracking-tighter">
                      ${selectedLayby?.balanceDue.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      TOTAL ORDER
                    </p>
                    <p className="text-sm font-black text-slate-900">
                      ${selectedLayby?.totalAmount.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                    Installment Amount ($)
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    autoFocus
                    className="w-full bg-slate-900 text-white p-6 rounded-2xl text-2xl font-black focus:ring-4 focus:ring-orange-itred/20 outline-none tracking-tighter"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  />
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-3">
                  <AlertTriangle size={16} className="text-emerald-500 flex-shrink-0" />
                  <p className="text-[10px] font-black text-emerald-800 uppercase tracking-tight">
                    Receiving this payment will update the deposit history. If the balance reaches
                    zero, the order will be marked as completed.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
              >
                Finalize Instalment Payment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
