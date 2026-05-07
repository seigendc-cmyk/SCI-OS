import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  CreditCard,
  MessageSquare,
  MapPin,
  Phone,
  Mail,
  MoreVertical,
  UserPlus,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  Briefcase,
  Activity,
  DollarSign,
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
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { createBIEvent, BIEventType } from '../../../services/biService';

export const VendorPOSCustomers: React.FC = () => {
  const { user, vendorId, role } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: '',
    customerType: 'walk_in',
    creditLimit: 0,
    status: 'active',
  });

  useEffect(() => {
    if (!vendorId) return;

    const q = query(
      collection(db, 'customers'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [vendorId]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) return;

    try {
      const customerRef = await addDoc(collection(db, 'customers'), {
        ...formData,
        vendorId,
        currentBalance: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await createBIEvent({
        vendorId,
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userRole: role || 'admin',
        eventType: 'CUSTOMER_CREATED' as BIEventType,
        severity: 'info',
        message: `New customer created: ${formData.fullName}`,
        metadata: { customerId: customerRef.id },
      });

      setShowAddModal(false);
      setFormData({
        fullName: '',
        phone: '',
        whatsapp: '',
        email: '',
        address: '',
        city: '',
        customerType: 'walk_in',
        creditLimit: 0,
        status: 'active',
      });
    } catch (err) {
      console.error('Error adding customer:', err);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    try {
      await updateDoc(doc(db, 'customers', editingCustomer.id), {
        ...formData,
        updatedAt: serverTimestamp(),
      });
      setEditingCustomer(null);
      setShowAddModal(false);
    } catch (err) {
      console.error('Error updating customer:', err);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm) ||
      c.whatsapp?.includes(searchTerm),
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
            Customer Registry
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
              Identity Management
            </span>
            <span className="text-[10px] font-black text-orange-itred uppercase tracking-widest bg-orange-50 px-2 py-1 rounded border border-orange-100 italic">
              Centralized Profiles
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="SEARCH CUSTOMERS..."
              className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-orange-itred/20 w-64 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              setEditingCustomer(null);
              setFormData({
                fullName: '',
                phone: '',
                whatsapp: '',
                email: '',
                address: '',
                city: '',
                customerType: 'walk_in',
                creditLimit: 0,
                status: 'active',
              });
              setShowAddModal(true);
            }}
            className="bg-charcoal text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            <UserPlus size={16} /> Add Customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCustomers.map((customer) => (
          <div
            key={customer.id}
            className="bg-white industrial-border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-slate-50 flex items-center justify-center rounded-xl border border-slate-100 font-black text-slate-400 text-lg">
                  {customer.fullName?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    {customer.fullName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${customer.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}
                    >
                      {customer.status}
                    </span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 rounded">
                      {customer.customerType}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingCustomer(customer);
                  setFormData({ ...customer });
                  setShowAddModal(true);
                }}
                className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 invisible group-hover:visible transition-all"
              >
                <Edit size={16} />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <Phone size={14} className="text-slate-300" /> {customer.phone || 'NO PHONE'}
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <MessageSquare size={14} className="text-emerald-500" />{' '}
                {customer.whatsapp || 'NO WHATSAPP'}
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <MapPin size={14} className="text-slate-300" /> {customer.city || 'NO LOCATION'}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-50 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                  Current Balance
                </p>
                <p
                  className={`text-xs font-black ${customer.currentBalance > 0 ? 'text-red-500' : 'text-emerald-500'}`}
                >
                  ${Number(customer.currentBalance || 0).toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                  Credit Limit
                </p>
                <p className="text-xs font-black text-slate-900">
                  ${Number(customer.creditLimit || 0).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="flex-1 bg-slate-50 text-slate-600 p-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors">
                View Account
              </button>
              <button className="flex-1 bg-orange-50 text-orange-600 p-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-orange-100 transition-colors">
                Create Layby
              </button>
            </div>

            <div className="absolute bottom-0 left-0 w-0 h-1 bg-orange-itred group-hover:w-full transition-all duration-500"></div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white industrial-border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                  {editingCustomer ? 'Modify Profile' : 'New Identity Registration'}
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 italic">
                  Customer Registry Protocol
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <Trash2 size={24} />
              </button>
            </div>

            <form
              onSubmit={editingCustomer ? handleUpdateCustomer : handleAddCustomer}
              className="p-8 space-y-6 max-h-[70vh] overflow-y-auto"
            >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-itred/20 outline-none"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Phone
                    </label>
                    <input
                      type="tel"
                      className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-itred/20 outline-none"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      WhatsApp
                    </label>
                    <input
                      type="tel"
                      className="w-full bg-emerald-50/30 border border-emerald-100/50 p-4 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-itred/20 outline-none"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      City
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-itred/20 outline-none"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Customer Type
                    </label>
                    <select
                      className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-itred/20 outline-none appearance-none"
                      value={formData.customerType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customerType: e.target.value,
                        })
                      }
                    >
                      <option value="walk_in">Walk-in</option>
                      <option value="account">Account Customer</option>
                      <option value="layby">Layby Only</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Credit Limit ($)
                    </label>
                    <input
                      type="number"
                      className="w-full bg-slate-900 text-white p-4 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-itred/20 outline-none"
                      value={formData.creditLimit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          creditLimit: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Status
                    </label>
                    <select
                      className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-itred/20 outline-none appearance-none"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 mt-4"
              >
                {editingCustomer ? 'Update Identity' : 'Register Customer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
