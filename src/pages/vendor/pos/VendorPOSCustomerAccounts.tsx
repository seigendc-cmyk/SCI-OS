import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  CreditCard,
  History,
  ArrowUpCircle,
  ArrowDownCircle,
  Printer,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  MoreVertical,
  FileText,
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

export const VendorPOSCustomerAccounts: React.FC = () => {
  const { user, vendorId, role } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    if (!vendorId) return;

    const q = query(
      collection(db, 'customers'),
      where('vendorId', '==', vendorId),
      where('customerType', '==', 'account'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAccounts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [vendorId]);

  useEffect(() => {
    if (!selectedAccount) {
      setLedger([]);
      return;
    }

    const q = query(
      collection(db, 'customer_account_ledger'),
      where('customerId', '==', selectedAccount.id),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLedger(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [selectedAccount]);

  const handleReceivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !selectedAccount || paymentAmount <= 0) return;

    try {
      const batch = writeBatch(db);
      const ledgerRef = doc(collection(db, 'customer_account_ledger'));
      const customerRef = doc(db, 'customers', selectedAccount.id);

      const newBalance = Number(selectedAccount.currentBalance || 0) - paymentAmount;

      batch.set(ledgerRef, {
        vendorId,
        customerId: selectedAccount.id,
        movementType: 'payment',
        debit: 0,
        credit: paymentAmount,
        balanceAfter: newBalance,
        referenceType: 'manual_payment',
        notes: paymentNotes,
        createdByUid: user?.uid,
        createdByEmail: user?.email,
        createdAt: serverTimestamp(),
      });

      batch.update(customerRef, {
        currentBalance: newBalance,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      await createBIEvent({
        vendorId,
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userRole: role || 'admin',
        eventType: 'CUSTOMER_PAYMENT_RECEIVED' as BIEventType,
        severity: 'info',
        message: `Payment of $${paymentAmount} received from ${selectedAccount.fullName}`,
        metadata: { customerId: selectedAccount.id, amount: paymentAmount },
      });

      setShowPaymentModal(false);
      setPaymentAmount(0);
      setPaymentNotes('');
    } catch (err) {
      console.error('Error receiving payment:', err);
    }
  };

  const filteredAccounts = accounts.filter((a) =>
    a.fullName?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
            Debtors Ledger
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
              Accounts Receivable Management
            </span>
            <span className="text-[10px] font-black text-orange-itred uppercase tracking-widest bg-orange-50 px-2 py-1 rounded border border-orange-100 italic">
              Financial Controls
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="SEARCH DEBTORS..."
              className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-orange-itred/20 w-64 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Account List */}
        <div className="xl:col-span-4 space-y-4">
          {filteredAccounts.map((account) => (
            <button
              key={account.id}
              onClick={() => setSelectedAccount(account)}
              className={`w-full text-left p-6 rounded-2xl industrial-border border transition-all relative overflow-hidden group ${selectedAccount?.id === account.id ? 'bg-slate-900 border-slate-900 shadow-xl' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3
                    className={`text-sm font-black uppercase tracking-tight ${selectedAccount?.id === account.id ? 'text-white' : 'text-slate-900'}`}
                  >
                    {account.fullName}
                  </h3>
                  <p
                    className={`text-[8px] font-black uppercase tracking-[0.2em] mt-1 ${selectedAccount?.id === account.id ? 'text-slate-400' : 'text-slate-400'}`}
                  >
                    LIMIT: ${account.creditLimit}
                  </p>
                </div>
                <div
                  className={`text-right ${selectedAccount?.id === account.id ? 'text-white' : 'text-slate-900'}`}
                >
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-50 mb-1">
                    Balance
                  </p>
                  <p
                    className={`text-sm font-black ${account.currentBalance > 0 ? (selectedAccount?.id === account.id ? 'text-orange-itred' : 'text-red-500') : 'text-emerald-500'}`}
                  >
                    ${Number(account.currentBalance || 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 w-0 h-1 bg-orange-itred group-hover:w-full transition-all duration-500"></div>
            </button>
          ))}
          {filteredAccounts.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl industrial-border border-slate-200 border-dashed">
              <Users className="mx-auto text-slate-200 mb-4" size={48} />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                No account customers found.
              </p>
            </div>
          )}
        </div>

        {/* Account Detail / Ledger */}
        <div className="xl:col-span-8">
          {selectedAccount ? (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-2xl industrial-border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                      {selectedAccount.fullName}
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 italic">
                      Master Account View
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="bg-emerald-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100"
                    >
                      <DollarSign size={16} /> Mark Payment
                    </button>
                    <button className="p-3 bg-slate-50 text-slate-600 rounded-xl border border-slate-100 hover:bg-slate-100 transition-all">
                      <Printer size={18} />
                    </button>
                    <button className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-all">
                      <MessageSquare size={18} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Total Limit
                    </p>
                    <p className="text-lg font-black text-slate-900">
                      ${selectedAccount.creditLimit}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Available Credit
                    </p>
                    <p className="text-lg font-black text-emerald-600">
                      ${selectedAccount.creditLimit - selectedAccount.currentBalance}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Days Outstanding
                    </p>
                    <p className="text-lg font-black text-orange-itred tracking-tight">12 DAYS</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      A/C Status
                    </p>
                    <p className="text-lg font-black text-slate-900 uppercase tracking-tighter">
                      {selectedAccount.status}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-2 mb-3">
                    Transaction History
                  </h3>
                  <div className="space-y-3">
                    {ledger.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.movementType === 'payment' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}
                          >
                            {item.movementType === 'payment' ? (
                              <ArrowDownCircle size={16} />
                            ) : (
                              <ArrowUpCircle size={16} />
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">
                              {item.movementType === 'payment'
                                ? 'PAYMENT RECEIVED'
                                : 'CREDIT PURCHASE'}
                            </p>
                            <p className="text-[8px] font-medium text-slate-400 uppercase tracking-widest">
                              {item.createdAt?.toDate?.().toLocaleString() || 'PROCESSING...'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-black ${item.movementType === 'payment' ? 'text-emerald-500' : 'text-red-500'}`}
                          >
                            {item.debit > 0
                              ? `+ $${item.debit.toFixed(2)}`
                              : `- $${item.credit.toFixed(2)}`}
                          </p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            BAL: ${item.balanceAfter.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {ledger.length === 0 && (
                      <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <History className="mx-auto text-slate-200 mb-3" size={32} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          No transaction records found.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white h-full p-20 flex flex-col items-center justify-center rounded-2xl industrial-border border-slate-200 shadow-sm animate-pulse">
              <Users size={64} className="text-slate-100 mb-6" />
              <h2 className="text-xl font-black text-slate-300 uppercase tracking-tighter">
                Select an Account to Audit
              </h2>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white industrial-border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                  Receive Account Payment
                </h2>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] mt-1 italic">
                  Balance Adjustment Protocol
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
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Payment Amount ($)
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    autoFocus
                    className="w-full bg-slate-900 text-white p-6 rounded-2xl text-2xl font-black focus:ring-4 focus:ring-emerald-500/20 outline-none tracking-tighter"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Notes / Reference
                  </label>
                  <textarea
                    className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-itred/20 outline-none h-24 resize-none"
                    placeholder="e.g. Bank Transfer Ref: BT123456"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>

                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                  <div className="flex gap-3 text-[10px] font-black text-orange-800 uppercase tracking-tight">
                    <AlertTriangle size={16} className="text-orange-500 flex-shrink-0" />
                    <span>
                      Confirming this payment will immediately reduce the customer's balance and
                      update the audit journal.
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 text-white p-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100"
              >
                Process Payment Receipt
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
