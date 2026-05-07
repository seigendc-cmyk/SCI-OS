import React, { useState, useEffect } from 'react';
import { useAuth, handleFirestoreError, OperationType } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { ImageUpload } from '../components/ImageUpload';
import {
  ShieldCheck,
  Activity,
  Database,
  Key,
  Server,
  Laptop,
  Loader2,
  LogOut,
  LayoutDashboard,
  Store,
  Package,
  GitBranch,
  Users,
  Truck,
  BookOpen,
  ShoppingBag,
  CreditCard,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldAlert,
  Search,
  Filter,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  MapPin,
  Briefcase,
  Info,
  Bell,
  ArrowLeft,
  Globe,
  Download,
  Quote,
  Clock,
  ClipboardList,
  Check,
  CornerDownRight,
  ArrowRight,
  Shield,
  FileText,
  History,
  PieChart,
  DollarSign,
  Copy,
  AlertCircle,
  BarChart2,
  Settings as SettingsIcon,
  Lock as LockIcon,
} from 'lucide-react';
import { SECTORS, getSector } from '../config/sectors';
import { SearchableProductPicker } from '../components/SearchableProductPicker';
import { CONSOLE_ROLES, PERMISSION_LABELS, ConsoleRole, PermissionKey } from '../config/console';
import { logActivity } from '../services/auditService';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useNavigate, Link, useParams } from 'react-router-dom';
import {
  registerVendorFoundation,
  ensureVendorProfileForCurrentUser,
  completeGoogleVendorSignup,
  getFriendlyErrorMessage,
  activatePOSForVendor,
} from '../services/db';
import { generateOfflineCatalogueHtml } from '../services/exportService';
import {
  createOrder,
  OrderData,
  OrderItem,
  createAuditLog,
  generateStatusUpdateWhatsAppMessage,
  generateFulfilmentCode,
} from '../services/orderService';
// Accounting services refactored to POS folder
// import { seedChartOfAccounts, createAccountingJournalDraft, validateJournalBalanced } from '../services/accountingService';
// BI services refactored to POS folder
// import { BISeverity, BIEventType, createBIEvent } from '../services/biService';
import { UserRole, RPNAgent } from '../types';
export { VendorPOSDashboard } from './vendor/pos/VendorPOSDashboard';
export { VendorPOSSettings } from './vendor/pos/VendorPOSSettings';
export { VendorPOSShifts } from './vendor/pos/VendorPOSShifts';
export { VendorPOSTerminalScreen } from './vendor/pos/VendorPOSTerminalScreen';
export { VendorPOSBI } from './vendor/pos/VendorPOSBI';
export { VendorPOSAccounting } from './vendor/pos/VendorPOSAccounting';
export { VendorPOSReturns } from './vendor/pos/VendorPOSReturns';
export { VendorPOSReports } from './vendor/pos/VendorPOSReports';
export { VendorPOSCustomers } from './vendor/pos/VendorPOSCustomers';
export { VendorPOSCustomerAccounts } from './vendor/pos/VendorPOSCustomerAccounts';
export { VendorPOSLayby } from './vendor/pos/VendorPOSLayby';
export { VendorPOSApprovals } from './vendor/pos/VendorPOSApprovals';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  setDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  orderBy,
  Timestamp,
  addDoc,
  limit,
  getDocs,
  getCountFromServer,
  writeBatch,
} from 'firebase/firestore';

// HELPERS
export function safeString(value: any, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function safeSlug(value: any, fallback = 'vendor') {
  return safeString(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// Common Placeholder Factory
const PlaceholderPage = ({
  title,
  description,
  role,
}: {
  title: string;
  description: string;
  role: string;
}) => (
  <div className="bg-white p-10 rounded-lg industrial-border shadow-sm border border-slate-200">
    <div className="mb-6">
      <h1 className="text-3xl font-bold text-slate-900 tracking-tighter mb-2">{title}</h1>
      <p className="text-slate-500 max-w-2xl">{description}</p>
    </div>
    <div className="flex items-center gap-2 text-[10px] font-bold text-orange-itred uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded w-fit border border-orange-100">
      <ShieldCheck size={12} />
      <span>Security Clearance: {role}</span>
    </div>
  </div>
);

// PUBLIC PAGES
const getWhatsAppLink = (
  phone: string,
  productName: string,
  sku: string,
  price: number,
  businessName: string,
) => {
  const cleanPhone = safeString(phone).replace(/\+/g, '').replace(/\s+/g, '');
  const message = `Hello, I saw this product on iTred:\nProduct: ${productName}\nSKU: ${sku || 'N/A'}\nPrice: $${price.toFixed(2)}\nVendor: ${businessName}\nI would like to enquire/order.`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};

// SHARED COMPONENTS
// SHARED COMPONENTS

const OrderEnquiryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  orderData: Partial<OrderData>;
  vendor: any;
}> = ({ isOpen, onClose, orderData, vendor }) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [preferredFulfillment, setPreferredFulfillment] = useState<
    'pickup' | 'delivery' | 'not_specified'
  >('not_specified');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatsappMessage, setWhatsappMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const finalOrderData: OrderData = {
      vendorId: orderData.vendorId!,
      vendorName: vendor.businessName,
      source: orderData.source === 'itred_product' ? 'storefront' : (orderData.source as any),
      sourceId: orderData.sourceId!,
      items: orderData.items!.map((item) => ({
        ...item,
        lineTotal: (item as any).subtotal || (item as any).lineTotal || item.price * item.qty,
      })),
      totalAmount: orderData.totalAmount || (orderData as any).estimatedTotal || 0,
      currency: vendor.currency || 'USD',
      customerName,
      customerPhone,
      customerWhatsApp: customerPhone,
      customerLocation,
      customerNotes,
      preferredFulfillment,
      branchId: orderData.branchId,
      deliveryServiceId: orderData.deliveryServiceId,
    };

    const result = await createOrder(finalOrderData);

    if (result.success) {
      setSuccess(true);
      setWhatsappMessage(result.whatsappMessage!);
    } else {
      setError(
        'Online order record could not be created, but you can still send the enquiry through WhatsApp.',
      );
      setWhatsappMessage(result.whatsappMessage!);
    }
    setLoading(false);
  };

  const handleWhatsAppRedirect = () => {
    if (!whatsappMessage) return;
    const phone = vendor?.whatsapp || vendor?.phone || '';
    const cleanPhone = safeString(phone).replace(/\+/g, '').replace(/\s+/g, '');
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`,
      '_blank',
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white industrial-border border-slate-200 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tighter">
              Submit Enquiry
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Direct Merchant Request // {vendor.businessName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {success ? (
            <div className="text-center space-y-6 py-8">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                Enquiry Sent Successfully
              </h3>
              <p className="text-sm text-slate-500 max-w-xs mx-auto">
                Your enquiry has been recorded. Please continue on WhatsApp to finalize your order
                with the vendor.
              </p>

              <button
                onClick={handleWhatsAppRedirect}
                className="w-full bg-[#25D366] text-white p-4 rounded font-bold uppercase tracking-widest hover:scale-105 transition-all flex justify-center items-center gap-3 shadow-lg shadow-emerald-100"
              >
                <MessageSquare size={20} /> Continue on WhatsApp
              </button>
            </div>
          ) : error ? (
            <div className="space-y-6">
              <div className="p-4 bg-orange-50 border border-orange-100 rounded text-orange-800 text-xs font-bold uppercase flex gap-3">
                <AlertTriangle className="flex-shrink-0" size={18} />
                <span>{error}</span>
              </div>
              <button
                onClick={handleWhatsAppRedirect}
                className="w-full bg-[#25D366] text-white p-4 rounded font-bold uppercase tracking-widest hover:scale-105 transition-all flex justify-center items-center gap-3 shadow-lg shadow-emerald-100"
              >
                <MessageSquare size={20} /> Send via WhatsApp Anyway
              </button>
              <button
                onClick={onClose}
                className="w-full text-[10px] font-bold text-slate-400 uppercase tracking-widest"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full industrial-border border-slate-200 p-3 text-sm focus:ring-1 focus:ring-orange-itred outline-none rounded"
                    placeholder="John Doe"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    className="w-full industrial-border border-slate-200 p-3 text-sm focus:ring-1 focus:ring-orange-itred outline-none rounded"
                    placeholder="+1234567890"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Your Location
                </label>
                <input
                  type="text"
                  required
                  className="w-full industrial-border border-slate-200 p-3 text-sm focus:ring-1 focus:ring-orange-itred outline-none rounded"
                  placeholder="City, Area"
                  value={customerLocation}
                  onChange={(e) => setCustomerLocation(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Fulfillment Preference
                </label>
                <select
                  className="w-full industrial-border border-slate-200 p-3 text-sm focus:ring-1 focus:ring-orange-itred outline-none rounded appearance-none bg-white"
                  value={preferredFulfillment}
                  onChange={(e) => setPreferredFulfillment(e.target.value as any)}
                >
                  <option value="not_specified">Select Preference...</option>
                  <option value="pickup">Self-Pickup</option>
                  <option value="delivery">Delivery Service</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Additional Notes
                </label>
                <textarea
                  className="w-full industrial-border border-slate-200 p-3 text-sm focus:ring-1 focus:ring-orange-itred outline-none rounded h-24 resize-none"
                  placeholder="Tell the vendor more about your request..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-itred text-white p-4 rounded font-bold uppercase tracking-widest hover:bg-[#d96a1a] transition-all flex justify-center items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      Submit Global Enquiry <ChevronRight size={18} />
                    </>
                  )}
                </button>
                <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-4 italic">
                  Encrypted request protocol via iTred Nexus
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const ProductCard: React.FC<{ product: any; vendor?: any }> = ({ product, vendor }) => {
  return (
    <div className="bg-white industrial-border border-slate-200 overflow-hidden rounded-lg shadow-sm hover:border-orange-itred/50 hover:shadow-md transition-all group animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Link
        to={`/products/${product.id}`}
        className="block aspect-[4/3] bg-slate-50 relative overflow-hidden"
      >
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-200">
            <Package size={48} />
          </div>
        )}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          <span className="bg-slate-900/80 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase backdrop-blur-sm">
            {product.categoryLabel || product.category}
          </span>
        </div>
      </Link>
      <div className="p-5">
        <div className="mb-4 flex items-center gap-2">
          {vendor?.logoUrl ? (
            <img
              src={vendor.logoUrl}
              alt={vendor.businessName}
              className="w-5 h-5 rounded-full object-cover border border-slate-100"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center text-[8px] font-black border border-slate-100">
              {vendor?.businessName?.substring(0, 1) || 'M'}
            </div>
          )}
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate flex-grow">
            {vendor?.businessName || 'Merchant Node'}
          </p>
        </div>
        <Link
          to={`/products/${product.id}`}
          className="text-sm font-bold text-slate-900 uppercase tracking-tight line-clamp-1 hover:text-orange-itred transition-colors"
        >
          {product.name}
        </Link>

        <div className="flex justify-between items-end mt-4">
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Standard Price
            </p>
            <p className="text-lg font-bold text-slate-900 tracking-tighter">
              ${Number(product.price).toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <span className="bg-emerald-50 text-emerald-600 text-[8px] font-bold px-2 py-1 rounded uppercase block mb-1">
              {product.stockQty} In Stock
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            to={`/products/${product.id}`}
            className="bg-slate-100 text-slate-700 p-2.5 rounded text-[9px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
          >
            <Info size={12} /> Details
          </Link>
          {vendor?.whatsapp ? (
            <a
              href={getWhatsAppLink(
                vendor.whatsapp,
                product.name,
                product.sku,
                product.price,
                vendor.businessName,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-500 text-white p-2.5 rounded text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1.5"
            >
              <MessageSquare size={12} /> Order
            </a>
          ) : (
            <div className="bg-slate-50 text-slate-300 p-2.5 rounded text-[9px] font-bold uppercase tracking-widest text-center cursor-not-allowed">
              Locked
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const VendorCard: React.FC<{ vendor: any }> = ({ vendor }) => {
  return (
    <div className="bg-white industrial-border border-slate-200 p-6 rounded-lg shadow-sm hover:border-orange-itred/50 hover:shadow-md transition-all group">
      <div className="flex gap-4 items-start mb-4">
        <div className="w-14 h-14 bg-slate-50 industrial-border border-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-400 text-lg uppercase flex-shrink-0 overflow-hidden">
          {vendor.logoUrl ? (
            <img
              src={vendor.logoUrl}
              alt={vendor.businessName}
              className="w-full h-full object-cover"
            />
          ) : (
            vendor.businessName?.substring(0, 2)
          )}
        </div>
        <div className="flex-grow">
          <div className="flex items-center gap-2 mb-1">
            <Link
              to={`/vendors/${vendor.id}`}
              className="text-lg font-bold text-slate-900 uppercase tracking-tighter group-hover:text-orange-itred transition-colors line-clamp-1"
            >
              {vendor.businessName}
            </Link>
            <ShieldCheck size={14} className="text-emerald-500" />
          </div>
          <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            <Briefcase size={12} /> {getSector(vendor.sectorCode)?.label || vendor.sector}
          </div>
        </div>
      </div>

      <div className="py-4 border-y border-slate-50 mb-6 flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
        <MapPin size={14} className="text-orange-itred" /> {vendor.city}, {vendor.country}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to={`/vendors/${vendor.id}`}
          className="bg-charcoal text-white p-3 rounded text-[9px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
        >
          <Store size={14} /> Open Store
        </Link>
        {vendor.whatsapp && (
          <a
            href={`https://wa.me/${safeString(vendor.whatsapp).replace(/\+/g, '').replace(/\s+/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-50 text-emerald-600 border border-emerald-100 p-3 rounded text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
          >
            <MessageSquare size={14} /> Contact
          </a>
        )}
      </div>
    </div>
  );
};

// WELCOME & LEGAL PAGES
export const WelcomePage = () => {
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-6 text-center bg-white">
      <div className="mb-14 animate-in fade-in zoom-in duration-1000">
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl md:text-7xl font-black tracking-tighter text-slate-900 uppercase">
            seiGEN <span className="text-orange-itred tracking-widest">Commerce</span>
          </div>
          <div className="h-1.5 w-24 bg-charcoal"></div>
        </div>
      </div>

      <h1 className="text-lg md:text-xl font-bold text-slate-500 uppercase tracking-widest max-w-2xl mb-12 leading-relaxed">
        Africa-first commerce infrastructure for vendors, catalogues, discovery, and offline trade.
      </h1>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-lg">
        <Link
          to="/itred"
          className="flex-1 bg-charcoal text-white p-6 rounded-lg font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-800 transition-all hover:scale-105 flex items-center justify-center gap-3 shadow-xl shadow-slate-200"
        >
          <ShoppingBag size={20} /> Open iTred Marketplace
        </Link>
        <Link
          to="/login"
          className="flex-1 bg-white border-2 border-slate-200 text-charcoal p-6 rounded-lg font-black uppercase tracking-[0.2em] text-xs hover:border-orange-itred hover:text-orange-itred transition-all hover:scale-105 flex items-center justify-center gap-3"
        >
          <LayoutDashboard size={20} /> Vendor Login
        </Link>
      </div>

      <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-12 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
        <div className="flex flex-col items-center gap-3">
          <Package size={40} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Inventory</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Truck size={40} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Logistics</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <GitBranch size={40} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Systems</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Users size={40} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Network</span>
        </div>
      </div>
    </div>
  );
};

export const BusinessTermsPage = () => (
  <div className="max-w-4xl mx-auto py-16 px-6">
    <h1 className="text-4xl font-black tracking-tighter uppercase mb-4 text-slate-900 border-b-4 border-orange-itred inline-block">
      Business Terms
    </h1>
    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-10">
      Trade Protocol // Operational Framework
    </p>

    <div className="prose prose-slate max-w-none space-y-8">
      <section>
        <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900">
          1. Infrastructure Access
        </h2>
        <p className="text-slate-600 leading-relaxed font-medium">
          Verified merchants are granted access to the seiGEN Commerce ecosystem subject to
          subscription tier compliance and verification protocols. We provide the infrastructure;
          vendors own their trade relationships.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900">
          2. Transaction Integrity
        </h2>
        <p className="text-slate-600 leading-relaxed font-medium">
          All price listings, stock quantities, and branch locations must be maintained with high
          fidelity. Failure to maintain accurate digital-to-physical inventory parity may result in
          node suspension.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900">
          3. Liability Framework
        </h2>
        <p className="text-slate-600 leading-relaxed font-medium">
          seiGEN Commerce acts as a technical intermediary. We do not process payments directly
          unless specified via integrated gateway modules. All physical trade fulfillment is the
          responsibility of the vendor.
        </p>
      </section>
    </div>
  </div>
);

export const PrivacyPage = () => (
  <div className="max-w-4xl mx-auto py-16 px-6">
    <h1 className="text-4xl font-black tracking-tighter uppercase mb-4 text-slate-900 border-b-4 border-orange-itred inline-block">
      Privacy Protocol
    </h1>
    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-10">
      Data Encryption // Identity Protection
    </p>

    <div className="prose prose-slate max-w-none space-y-8">
      <section>
        <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900">
          Data Sovereignty
        </h2>
        <p className="text-slate-600 leading-relaxed font-medium">
          Your business data belongs to you. Catalogues, customer enquiries, and branch locations
          are encrypted at rest and serve only the purpose of trade facilitation.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900">
          Metadata Analysis
        </h2>
        <p className="text-slate-600 leading-relaxed font-medium">
          We process anonymized trade metadata to improve the discovery algorithms of the iTred
          Marketplace. Individual vendor strategy remains confidential.
        </p>
      </section>
    </div>
  </div>
);

export const SupportPage = () => (
  <div className="max-w-4xl mx-auto py-16 px-6">
    <h1 className="text-4xl font-black tracking-tighter uppercase mb-4 text-slate-900 border-b-4 border-orange-itred inline-block">
      System Support
    </h1>
    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-10">
      Merchant Assistance // Help Center
    </p>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
      <div className="bg-white industrial-border p-8 rounded-lg shadow-sm">
        <h2 className="text-lg font-bold uppercase text-slate-900 mb-4">Documentation</h2>
        <p className="text-xs text-slate-500 font-medium mb-6">
          Learn how to configure your catalogues, manage staff access, and optimize your listings
          for discovery.
        </p>
        <button className="bg-charcoal text-white px-4 py-3 rounded text-[10px] font-bold uppercase tracking-widest">
          Open Docs
        </button>
      </div>
      <div className="bg-white industrial-border p-8 rounded-lg shadow-sm border-l-4 border-orange-itred">
        <h2 className="text-lg font-bold uppercase text-slate-900 mb-4">Direct Contact</h2>
        <p className="text-xs text-slate-500 font-medium mb-6">
          Need technical assistance with your dashboard or account? Our systems team is available
          for verified merchants.
        </p>
        <button className="bg-orange-itred text-white px-4 py-3 rounded text-[10px] font-bold uppercase tracking-widest">
          Submit Ticket
        </button>
      </div>
    </div>
  </div>
);

export const RPNPage = () => (
  <div className="max-w-4xl mx-auto py-16 px-6">
    <h1 className="text-4xl font-black tracking-tighter uppercase mb-4 text-slate-900 border-b-4 border-orange-itred inline-block">
      Partner Network
    </h1>
    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-10">
      Revenue Partner Network (RPN)
    </p>

    <div className="bg-slate-900 text-white p-12 rounded-lg industrial-border border-slate-700 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-itred opacity-20 rounded-full blur-3xl -mr-32 -mt-32"></div>
      <div className="relative z-10">
        <h2 className="text-2xl font-bold uppercase tracking-tight mb-6">
          Scaling African Commerce Together
        </h2>
        <p className="text-slate-400 mb-8 leading-relaxed">
          Join the network of distribution partners, logistics providers, and regional agents
          helping merchants reach more customers across the continent.
        </p>
        <div className="flex flex-wrap gap-4">
          <button className="bg-white text-slate-900 px-6 py-4 rounded font-bold uppercase text-xs tracking-widest">
            Apply as Agent
          </button>
          <button className="bg-orange-itred text-white px-6 py-4 rounded font-bold uppercase text-xs tracking-widest">
            Become Distributor
          </button>
        </div>
      </div>
    </div>
  </div>
);

const vendorCache: Record<string, any> = {};

function normalizeSearchText(value: any) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function freeOrderMatch(query: string, target: string) {
  const q = normalizeSearchText(query);
  const t = normalizeSearchText(target);
  if (!q) return true;
  const tokens = q.split(' ').filter(Boolean);
  return tokens.every((token) => t.includes(token));
}

export const ITredListingPage = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [vendors, setVendors] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'products'),
      where('status', '==', 'published'),
      where('visibility', '==', 'public'),
      where('stockQty', '>', 0),
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const productsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(productsList);

        // Fetch missing vendors
        const missingVendorIds = [
          ...new Set(productsList.map((p: any) => p.vendorId).filter((id) => !vendorCache[id])),
        ];

        for (const vid of missingVendorIds) {
          try {
            const vDoc = await getDoc(doc(db, 'vendors', vid as string));
            if (vDoc.exists()) {
              vendorCache[vid as string] = vDoc.data();
            }
          } catch (vErr) {
            // Silently fail if vendor is private/non-existent
            console.warn(`Could not resolve vendor node ${vid}:`, vErr);
          }
        }

        setVendors({ ...vendorCache });
        setLoading(false);
      },
      (err: any) => {
        console.error('Discovery sync error:', err);
        setLoading(false);
      },
    );

    // Fetch Global Active Notices
    const noticesQ = query(
      collection(db, 'notices'),
      where('status', '==', 'published'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(10),
    );
    const unsubscribeNotices = onSnapshot(noticesQ, (snapshot) => {
      setGlobalNotices(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeNotices();
    };
  }, []);

  const [globalNotices, setGlobalNotices] = useState<any[]>([]);

  const filteredProducts = products.filter((p) => {
    const vendor = vendors[p.vendorId];
    const searchableText = [
      p.name,
      p.description,
      p.sku,
      p.brand,
      p.category,
      p.categoryCode,
      p.sector,
      p.sectorCode,
      vendor?.businessName,
      ...Object.values(p.attributes || {}),
    ].join(' ');

    const matchesSearch = freeOrderMatch(searchTerm, searchableText);

    const matchesSector =
      sectorFilter === 'all' || p.sectorCode === sectorFilter || p.sector === sectorFilter;
    const matchesCategory =
      categoryFilter === 'all' ||
      p.categoryCode === categoryFilter ||
      p.category === categoryFilter;

    return matchesSearch && matchesSector && matchesCategory;
  });

  useEffect(() => {
    console.log('[ITRED SEARCH] Protocol scan complete', {
      searchTerm,
      sectorFilter,
      categoryFilter,
      nodesFound: products.length,
      matches: filteredProducts.length,
    });
  }, [searchTerm, sectorFilter, categoryFilter, products.length, filteredProducts.length]);

  const focusSearch = () => {
    searchInputRef.current?.focus();
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-charcoal text-white p-12 md:p-20 rounded-lg industrial-border border-slate-800 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-itred opacity-10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase mb-4 leading-none animate-in slide-in-from-bottom duration-700">
            iTred <span className="text-orange-itred tracking-wider">Marketplace</span>
          </h1>
          <p className="text-slate-400 text-xs font-black uppercase tracking-[0.4em] mb-12">
            powered by <span className="text-white">seiGEN Commerce</span> // GLOBAL TRADE PROTOCOL
          </p>

          <div className="flex flex-col items-center gap-2 max-w-2xl mx-auto">
            <div className="relative w-full">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                size={20}
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="SEARCH GLOBAL INVENTORY..."
                className="w-full bg-white text-slate-900 p-6 pl-14 rounded-lg outline-none text-xs uppercase font-black tracking-[0.2em] transition-all focus:ring-4 focus:ring-orange-itred/20 shadow-2xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-orange-50 border border-orange-200 text-orange-800 rounded text-xs font-bold uppercase tracking-tight flex items-center gap-3">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Global Notice Strip */}
      {globalNotices.length > 0 && (
        <div className="bg-orange-50 border-y border-orange-100 overflow-hidden py-3">
          <div className="animate-marquee whitespace-nowrap px-4">
            <div className="flex gap-8">
              {[...globalNotices, ...globalNotices].map((notice, idx) => (
                <div
                  key={`${notice.id}-${idx}`}
                  className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-orange-800"
                >
                  <span className="bg-orange-itred text-white text-[8px] px-1.5 py-0.5 rounded-sm">
                    {notice.type}
                  </span>
                  <span>{vendors[notice.vendorId]?.businessName || 'Merchant'}:</span>
                  <span className="font-black italic underline">{notice.title}</span>
                  <span className="text-orange-300 mx-2">|</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded industrial-border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 border-r pr-4">
          <Filter size={14} /> <span>Filters:</span>
        </div>

        <select
          className="bg-slate-50 border border-slate-200 p-2 rounded text-[9px] font-bold uppercase outline-none focus:ring-1 focus:ring-orange-itred"
          value={sectorFilter}
          onChange={(e) => {
            setSectorFilter(e.target.value);
            setCategoryFilter('all');
          }}
        >
          <option value="all">All Sectors</option>
          {SECTORS.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          className="bg-slate-50 border border-slate-200 p-2 rounded text-[9px] font-bold uppercase outline-none focus:ring-1 focus:ring-orange-itred"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {sectorFilter !== 'all' &&
            getSector(sectorFilter)?.defaultCategories.map((cat) => (
              <option key={cat} value={cat.toLowerCase()}>
                {cat}
              </option>
            ))}
          {sectorFilter === 'all' && (
            <>
              <option value="electronics">Electronics</option>
              <option value="clothing">Clothing</option>
              <option value="grocery">Grocery</option>
              <option value="industrial">Industrial</option>
            </>
          )}
        </select>

        <button
          onClick={() => {
            setSearchTerm('');
            setSectorFilter('all');
            setCategoryFilter('all');
          }}
          className="text-[9px] font-bold uppercase text-slate-400 hover:text-orange-itred ml-auto px-2"
        >
          Reset All
        </button>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-64 bg-slate-50 industrial-border animate-pulse rounded-lg"
            ></div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg p-20 text-center">
          <ShoppingBag size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
            No matching products found. Try another search or reset filters.
          </p>
          <p className="text-slate-300 text-[10px] uppercase font-bold mt-2">
            New products are registered hourly by verified merchants.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} vendor={vendors[product.vendorId]} />
          ))}
        </div>
      )}
    </div>
  );
};

export const VendorsPage = () => {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectorFilter, setSectorFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'vendors'),
      where('status', '==', 'published'),
      where('visibility', '==', 'public'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setVendors(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err: any) => {
        console.error('Vendor list sync error:', err);
        setError('Failed to establish connection to merchant registry.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const filteredVendors = vendors.filter((v) => {
    const matchesSearch =
      v.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector =
      sectorFilter === 'all' || v.sectorCode === sectorFilter || v.sector === sectorFilter;
    return matchesSearch && matchesSector;
  });

  return (
    <div className="space-y-8">
      <div className="bg-white p-10 rounded-lg industrial-border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter uppercase mb-2">
              Merchant Registry
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
              Verified Corporate Entities on iTred
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-grow">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 p-2 pl-10 rounded text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-orange-itred tracking-widest"
                placeholder="Search Merchants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="bg-slate-50 border border-slate-200 p-2 rounded text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-orange-itred"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
            >
              <option value="all">Everywhere</option>
              {SECTORS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-orange-50 border border-orange-200 text-orange-800 rounded text-xs font-bold uppercase tracking-tight">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 bg-slate-50 industrial-border animate-pulse rounded-lg"
            ></div>
          ))}
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg p-20 text-center">
          <Store size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
            No merchants match your filter parameters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVendors.map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} />
          ))}
        </div>
      )}
    </div>
  );
};

export const VendorDetailPage = () => {
  const { vendorId } = useParams();
  const [vendor, setVendor] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) return;

    const loadStorefront = async () => {
      try {
        // Fetch Vendor
        const vDoc = await getDoc(doc(db, 'vendors', vendorId));
        if (!vDoc.exists()) return setError('Registry node not found.');

        const vData = vDoc.data();
        if (vData.status !== 'published' || vData.visibility !== 'public') {
          return setError('This storefront is currently restricted.');
        }
        setVendor(vData);

        // Fetch Public Notices
        const noticesQ = query(
          collection(db, 'notices'),
          where('vendorId', '==', vendorId),
          where('status', '==', 'published'),
          where('visibility', '==', 'public'),
          orderBy('createdAt', 'desc'),
          limit(5),
        );

        onSnapshot(noticesQ, (snapshot) => {
          setNotices(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        });

        // Fetch Products
        const q = query(
          collection(db, 'products'),
          where('vendorId', '==', vendorId),
          where('status', '==', 'published'),
          where('visibility', '==', 'public'),
          where('stockQty', '>', 0),
        );

        onSnapshot(q, (snapshot) => {
          setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        });

        setLoading(false);
      } catch (err) {
        console.error('Storefront error:', err);
        setError('Failed to establish connection to storefront.');
        setLoading(false);
      }
    };

    loadStorefront();
  }, [vendorId]);

  if (loading)
    return (
      <div className="p-20 text-center animate-pulse uppercase font-mono text-[10px]">
        Connecting to Storefront Node...
      </div>
    );
  if (error)
    return (
      <div className="max-w-md mx-auto p-10 bg-white border border-red-100 industrial-border rounded-lg text-center mt-20">
        <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold uppercase tracking-tighter text-slate-900 mb-2">
          Access Denied
        </h2>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{error}</p>
        <Link
          to="/vendors"
          className="inline-block mt-8 bg-charcoal text-white px-6 py-3 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800"
        >
          Return to Registry
        </Link>
      </div>
    );

  return (
    <div className="space-y-8">
      {/* Storefront Header */}
      <div className="bg-white industrial-border border-slate-200 overflow-hidden rounded-lg shadow-sm">
        <div className="h-40 bg-slate-900 relative">
          {vendor.bannerUrl ? (
            <img src={vendor.bannerUrl} alt="Store Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-orange-itred/40 to-transparent"></div>
          )}
          <div className="absolute bottom-4 left-8 text-white/40 text-[8px] font-black uppercase tracking-[0.3em]">
            Corporate Node // Restricted Access
          </div>
        </div>
        <div className="px-8 pb-8 -mt-16 relative flex flex-col items-center text-center">
          <div className="w-36 h-36 bg-white industrial-border border-slate-300 rounded-xl flex items-center justify-center shadow-2xl text-charcoal font-black text-5xl uppercase mb-8 overflow-hidden">
            {vendor.logoUrl ? (
              <img
                src={vendor.logoUrl}
                alt={vendor.businessName}
                className="w-full h-full object-cover"
              />
            ) : (
              vendor.businessName?.substring(0, 2)
            )}
          </div>

          <div className="mb-10">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-slate-900 uppercase mb-4 leading-[0.9]">
              {vendor.businessName}
            </h1>
            <div className="flex flex-col items-center gap-3">
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-black px-4 py-1.5 rounded uppercase tracking-[0.3em] flex items-center gap-2">
                <ShieldCheck size={14} /> Verified Merchant Node
              </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-8 border-y border-slate-100 py-4 w-full">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-orange-itred" /> {vendor.city}, {vendor.country}
            </span>
            <span className="flex items-center gap-1.5">
              <Briefcase size={14} className="text-orange-itred" />{' '}
              {getSector(vendor.sectorCode)?.label || vendor.sector}
            </span>
            {vendor.phone && (
              <span className="flex items-center gap-1.5">
                <History size={14} className="text-orange-itred" /> Est.{' '}
                {vendor.createdAt?.toDate().getFullYear()}
              </span>
            )}
          </div>

          <p className="text-slate-600 text-sm max-w-2xl leading-relaxed mb-8">
            {vendor.description ||
              'Professional vendor operational within the iTred commerce ecosystem, providing synchronized inventory and direct trade fulfillment.'}
          </p>

          {vendor.whatsapp && (
            <a
              href={`https://wa.me/${safeString(vendor.whatsapp).replace(/\+/g, '').replace(/\s+/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full max-w-sm bg-[#25D366] text-white px-8 py-5 rounded font-black uppercase tracking-widest flex items-center justify-center gap-3 text-xs hover:scale-105 transition-all shadow-lg shadow-emerald-100"
            >
              <MessageSquare size={18} /> Open Direct WhatsApp Channel
            </a>
          )}
        </div>
      </div>

      {/* Merchant Notices */}
      {notices.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b pb-2 flex items-center gap-2">
            <Bell size={14} className="text-orange-itred" /> Merchant Broadcasts
          </h2>
          <div className="flex flex-col gap-4">
            {notices.map((notice) => (
              <div
                key={notice.id}
                className="bg-orange-50/50 border border-orange-100 p-6 rounded-lg relative overflow-hidden group"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-itred"></div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    {notice.title}
                  </h3>
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-600 bg-orange-100/50 px-2 py-0.5 rounded">
                    {notice.type} // {notice.createdAt?.toDate().toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                  {notice.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Stream */}
      <div className="space-y-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b pb-2">
          Active Inventory Stream
        </h2>
        {products.length === 0 ? (
          <div className="p-20 text-center bg-slate-50 border border-dashed rounded-lg">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              Storefront inventory currently in offline synchronization mode.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} vendor={vendor} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const ProductDetailPage = () => {
  const { productId } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  useEffect(() => {
    if (!productId) return;

    const loadProduct = async () => {
      try {
        const pDoc = await getDoc(doc(db, 'products', productId));
        if (!pDoc.exists()) return setError('Product entity not found in global index.');

        const pData = pDoc.data();
        if (pData.status !== 'published' || pData.visibility !== 'public' || pData.stockQty <= 0) {
          return setError('This product node is currently offline or out of stock.');
        }
        setProduct(pData);

        // Fetch Vendor
        const vDoc = await getDoc(doc(db, 'vendors', pData.vendorId));
        if (vDoc.exists()) {
          setVendor(vDoc.data());
        }

        setLoading(false);
      } catch (err) {
        console.error('Product detail error:', err);
        setError('Failed to establish connection to product node.');
        setLoading(false);
      }
    };

    loadProduct();
  }, [productId]);

  if (loading)
    return (
      <div className="p-20 text-center animate-pulse uppercase font-mono text-[10px]">
        Retrieving Product Metadata...
      </div>
    );
  if (error)
    return (
      <div className="max-w-md mx-auto p-10 bg-white border border-red-100 industrial-border rounded-lg text-center mt-20">
        <Info className="mx-auto text-slate-400 mb-4" size={48} />
        <h2 className="text-xl font-bold uppercase tracking-tighter text-slate-900 mb-2">
          Access Alert
        </h2>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{error}</p>
        <Link
          to="/itred"
          className="inline-block mt-8 bg-charcoal text-white px-6 py-3 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800"
        >
          System Discovery
        </Link>
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <Link
        to="/itred"
        className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-orange-itred transition-colors"
      >
        <ArrowLeft size={12} /> Back to Discovery
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Images */}
        <div className="md:col-span-12 lg:col-span-5 space-y-4">
          <div className="aspect-square bg-slate-50 industrial-border border-slate-200 rounded-lg flex items-center justify-center shadow-inner overflow-hidden">
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[activeImageIdx]}
                alt={product.name}
                className="w-full h-full object-cover animate-in fade-in duration-300"
              />
            ) : (
              <Package size={80} className="text-slate-200" />
            )}
          </div>
          {product.images && product.images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {product.images.map((img: string, idx: number) => (
                <div
                  key={idx}
                  onClick={() => setActiveImageIdx(idx)}
                  className={`aspect-square bg-slate-50 border cursor-pointer rounded overflow-hidden transition-all ${
                    idx === activeImageIdx
                      ? 'border-orange-itred ring-1 ring-orange-itred'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <img
                    src={img}
                    alt={`${product.name} ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="md:col-span-12 lg:col-span-7 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="bg-slate-900 text-white text-[9px] font-mono px-2 py-0.5 rounded tracking-widest uppercase">
                  ID: {product.productId?.substring(0, 8)}
                </span>
                <span className="bg-orange-50 text-orange-itred border border-orange-100 text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                  {product.category}
                </span>
              </div>
              <h1 className="text-4xl font-bold tracking-tighter text-slate-900 uppercase mb-2">
                {product.name}
              </h1>
              <p className="text-slate-500 text-xs leading-relaxed max-w-xl">
                {product.description ||
                  'Industrial grade specification listing published on iTred.'}
              </p>
            </div>

            <div className="flex items-center gap-8 py-6 border-y border-slate-100">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Standard Price
                </p>
                <p className="text-3xl font-bold text-slate-900 tracking-tighter">
                  ${Number(product.price).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Availability
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <p className="text-lg font-bold text-emerald-600 uppercase tracking-tight">
                    {product.stockQty} In Stock
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase tracking-widest pt-2">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded">
                <span className="text-slate-400 block mb-1">SKU identifier</span>
                <span className="text-slate-900 font-mono">{product.sku || 'N/A'}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded">
                <span className="text-slate-400 block mb-1">Unit Type</span>
                <span className="text-slate-900">{product.unit || 'each'}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded">
                <span className="text-slate-400 block mb-1">Assigned Sector</span>
                <span className="text-slate-900">
                  {getSector(product.sectorCode)?.label || product.sector}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded">
                <span className="text-slate-400 block mb-1">Manufacturer/Brand</span>
                <span className="text-slate-900">{product.brand || 'N/A'}</span>
              </div>
            </div>

            {product.attributes && Object.keys(product.attributes).length > 0 && (
              <div className="bg-slate-50 p-6 rounded-lg industrial-border border-slate-100">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Activity size={12} /> Sector Specific intelligence
                </h3>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  {Object.entries(product.attributes).map(([key, value]) => {
                    const sectorConfig = getSector(product.sectorCode);
                    const attrConfig = sectorConfig?.attributes.find((a) => a.id === key);
                    const label = attrConfig?.label || key;
                    if (value === undefined || value === null || value === '') return null;
                    return (
                      <div key={key}>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">
                          {label}
                        </p>
                        <p className="text-xs font-bold text-slate-900 uppercase">
                          {String(value)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-10 space-y-3">
            {vendor ? (
              <button
                onClick={() => setIsEnquiryModalOpen(true)}
                className="w-full bg-orange-itred text-white p-5 rounded font-bold uppercase tracking-widest hover:bg-[#d96a1a] transition-all flex justify-center items-center gap-3 text-sm shadow-lg shadow-orange-100"
              >
                <MessageSquare size={20} /> Send Enquiry
              </button>
            ) : (
              <div className="p-5 bg-slate-100 text-slate-400 text-center rounded font-bold uppercase tracking-widest text-[10px]">
                Vendor contact offline
              </div>
            )}
            <p className="text-center text-slate-400 text-[9px] uppercase font-bold tracking-tight">
              Direct commerce channel encrypted via iTred protocol
            </p>
          </div>
        </div>
      </div>

      {vendor && (
        <OrderEnquiryModal
          isOpen={isEnquiryModalOpen}
          onClose={() => setIsEnquiryModalOpen(false)}
          vendor={vendor}
          orderData={{
            vendorId: product.vendorId,
            vendorName: vendor.businessName,
            source: 'storefront',
            sourceId: productId,
            items: [
              {
                productId: productId!,
                name: product.name,
                sku: product.sku || 'N/A',
                qty: 1,
                price: product.price,
                lineTotal: product.price,
                imageUrl: product.images?.[0],
              },
            ],
            totalAmount: product.price,
            currency: vendor.currency || 'USD',
          }}
        />
      )}

      {/* Vendor Profile Card */}
      {vendor && (
        <div className="mt-12 bg-white industrial-border border-slate-200 p-8 rounded-lg flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-50 industrial-border border-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-400">
              {vendor.businessName?.substring(0, 2)}
            </div>
            <div>
              <p className="text-[9px] font-bold text-orange-itred uppercase tracking-widest mb-1">
                Published By
              </p>
              <h3 className="text-xl font-bold uppercase text-slate-900 tracking-tighter">
                {vendor.businessName}
              </h3>
              <div className="flex gap-3 text-[9px] font-bold text-slate-500 uppercase mt-1">
                <span className="flex items-center gap-1">
                  <MapPin size={10} /> {vendor.city}
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck size={10} className="text-emerald-500" /> Verified Merchant
                </span>
              </div>
            </div>
          </div>
          <Link
            to={`/vendors/${product.vendorId}`}
            className="w-full md:w-auto px-6 py-3 bg-charcoal text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors text-center border border-slate-700"
          >
            Enter Merchant Storefront
          </Link>
        </div>
      )}
    </div>
  );
};

// SHARED COMPONENTS
const CataloguesPagePlaceholder = () => (
  <PlaceholderPage
    title="Interactive Catalogues"
    description="Virtual storefronts and seasonal product collections optimized for mobile browsing."
    role="Public Guest"
  />
);

// Firebase Diagnostics Panel
const FirebaseDiagnostics = () => {
  const [isOpen, setIsOpen] = useState(false);
  const projectId = 'gen-lang-client-0459000055';
  const authDomain = 'gen-lang-client-0459000055.firebaseapp.com';

  return (
    <div className="fixed bottom-4 right-4 z-[9999] text-[10px] font-mono">
      <button
        type="button"
        id="diag-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-charcoal text-white px-2 py-1 rounded shadow-lg border border-slate-700 hover:bg-slate-800"
      >
        {isOpen ? 'CLOSE DIAGNOSTICS' : 'FIREBASE DIAGNOSTICS'}
      </button>
      {isOpen && (
        <div className="mt-2 p-4 bg-white industrial-border rounded shadow-xl border border-slate-300 w-80 space-y-2 text-slate-700">
          <p className="font-bold border-b pb-1 mb-2">FIREBASE STATE</p>
          <div className="flex justify-between">
            <span>Project ID:</span>{' '}
            <span className="text-blue-600 truncate ml-2">{projectId}</span>
          </div>
          <div className="flex justify-between">
            <span>Auth Domain:</span>{' '}
            <span className="text-blue-600 truncate ml-2">{authDomain}</span>
          </div>
          <div className="flex justify-between">
            <span>Auth Init:</span>{' '}
            <span className={auth ? 'text-emerald-600' : 'text-red-600'}>
              {auth ? 'TRUE' : 'FALSE'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Firestore Init:</span>{' '}
            <span className={db ? 'text-emerald-600' : 'text-red-600'}>
              {db ? 'TRUE' : 'FALSE'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Hostname:</span>{' '}
            <span className="text-slate-500 ml-2">{window.location.hostname}</span>
          </div>
          <div className="flex justify-between">
            <span>User UID:</span>{' '}
            <span className="text-slate-500 ml-2 truncate">{auth.currentUser?.uid || 'NONE'}</span>
          </div>
          <div className="mt-2 pt-2 border-t text-[8px] text-slate-400">
            * Ensure Email/Password provider is ENABLED in Firebase Console. * Ensure current domain
            is in Authorized Domains list.
          </div>
        </div>
      )}
    </div>
  );
};

import { ConsoleLoginPage } from './console/ConsoleLoginPage';
import { POSPlanGate } from './vendor/pos/POSPlanGate';
export { ConsoleLoginPage, POSPlanGate };

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!auth) return setError('Firebase Auth not initialized');
    if (!db) return setError('Firestore not initialized');

    setLoading(true);
    console.log('[LOGIN] Starting login attempt:', email);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      console.log('[LOGIN] Auth success, UID:', uid);

      const userDoc = await getDoc(doc(db, 'app_users', uid));
      const appUser = userDoc.exists() ? userDoc.data() : null;
      const role = appUser?.role;

      const internalRoles = [
        UserRole.SUPER_ADMIN,
        UserRole.CONSOLE_ADMIN,
        UserRole.ACTIVATION_OFFICER,
        UserRole.FINANCE_OFFER,
        UserRole.SUPPORT_OFFICER,
        UserRole.RPN_MANAGER,
        UserRole.AUDITOR,
      ];

      if (internalRoles.includes(role)) {
        setError('Internal profile detected. Please use the Console Access route.');
        setTimeout(() => {
          navigate('/console-login');
        }, 1000);
        return;
      }

      const { status } = await ensureVendorProfileForCurrentUser(userCredential.user);

      if (status === 'complete') {
        navigate('/vendor');
      } else if (status === 'profile_incomplete') {
        navigate('/complete-profile');
      } else {
        navigate('/itred');
      }
    } catch (err: any) {
      console.error('[LOGIN] Error:', err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // ensureVendorProfileForCurrentUser handles pendingVendorSignup resolution automatically
      const { status } = await ensureVendorProfileForCurrentUser(user);

      if (status === 'complete') {
        navigate('/vendor');
      } else {
        navigate('/complete-profile');
      }
    } catch (err: any) {
      console.error('Google login failed:', err);
      setError('Your Google login was successful. Please complete your business profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white industrial-border rounded-xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-500">
      <FirebaseDiagnostics />
      <div className="flex flex-col items-center mb-10">
        <div className="w-12 h-12 bg-orange-itred rounded-lg flex items-center justify-center text-sm text-white font-black mb-4 shadow-lg shadow-orange-100">
          iT
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">
          Vendor Portal
        </h1>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">
          Merchant Hub // Secure Login
        </p>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded border border-red-100">
          {error}
        </div>
      )}
      <form
        onSubmit={handleLogin}
        className="space-y-4 text-xs font-bold uppercase tracking-tighter"
      >
        <div>
          <label className="block text-slate-500 mb-1">Email Address</label>
          <input
            type="email"
            required
            id="login-email"
            className="w-full p-3 industrial-border rounded focus:ring-1 focus:ring-orange-itred outline-none font-mono lowercase tracking-normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-slate-500 mb-1">Password</label>
          <input
            type="password"
            required
            id="login-password"
            className="w-full p-3 industrial-border rounded focus:ring-1 focus:ring-orange-itred outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          disabled={loading}
          type="submit"
          id="login-button"
          className="w-full bg-charcoal text-white p-3 rounded font-bold uppercase tracking-widest hover:bg-slate-800 flex justify-center items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : 'Authorize Access'}
        </button>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white border border-slate-200 text-slate-700 p-3 rounded font-bold uppercase tracking-widest hover:bg-slate-50 flex justify-center items-center gap-2"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <>
              <Globe size={16} className="text-orange-itred" /> Continue with Google
            </>
          )}
        </button>
      </form>

      <div className="mt-8 space-y-6">
        <div className="relative flex items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400">OR</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        <div className="space-y-3">
          <Link
            to="/register"
            id="register-redirect-button"
            className="w-full bg-orange-itred text-white p-3 rounded font-bold uppercase tracking-widest hover:bg-[#d96a1a] flex justify-center items-center gap-2 text-center"
          >
            Create Your Vendor Store
          </Link>
          <p className="text-center text-slate-500 text-[9px] leading-relaxed font-bold uppercase tracking-tight px-4">
            Register your business and start publishing products on iTred.
          </p>
        </div>

        <div className="pt-6 text-center border-t border-slate-50">
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">
            powered by seiGEN Commerce
          </p>
        </div>
      </div>
    </div>
  );
};

export const RegisterPage = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    whatsapp: '',
    businessName: '',
    city: '',
    sector: 'GENERAL_DEALER',
    password: '',
    confirmPassword: '',
    rpnCode: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshAppUser } = useAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Defensive checks
    if (!auth) return setError('Firebase Auth not initialized');
    if (!db) return setError('Firestore not initialized');

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }
    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    setLoading(true);
    console.log('[REGISTER] Starting registration for:', formData.email);

    try {
      console.log('[REGISTER] Creating Auth user...');
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password,
      );
      const uid = userCredential.user.uid;
      console.log('[REGISTER] Auth user created successfully, UID:', uid);

      console.log('[REGISTER] Initializing Firestore foundation records...');
      await registerVendorFoundation(
        uid,
        formData.email,
        formData.fullName,
        formData.businessName,
        formData.phone,
        formData.whatsapp,
        formData.city,
        formData.sector,
        formData.rpnCode,
      );

      console.log('[REGISTER] Firestore foundation successfully established.');
      if (formData.rpnCode) {
        localStorage.setItem('rpn_notification', 'true');
      }

      console.log('[REGISTER] Triggering mandatory Auth refresh...');
      const refreshed = await refreshAppUser(uid);

      console.log('[POST REGISTRATION AUTH REFRESH]', {
        uid,
        refreshed: !!refreshed,
        role: refreshed?.role,
        vendorId: refreshed?.vendorId,
        profileStatus: refreshed?.profileStatus,
      });

      if (!refreshed) {
        setError(
          'Registration created your business profile, but login identity has not refreshed yet. Please click Retry Check or login again.',
        );
        return;
      }

      console.log('[REGISTER] Redirecting to merchant node dashboard...');
      navigate('/vendor');
    } catch (err: any) {
      console.error('[REGISTER] SYSTEM PROTOCOL ERROR:', err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      console.log('[REGISTER] Registration attempt sequence concluded.');
      setLoading(false);
    }
  };

  const handleGoogleRegister = (e: React.MouseEvent) => {
    e.preventDefault();
    // Validate form first
    if (!formData.businessName || !formData.city || !formData.phone || !formData.whatsapp) {
      return setError('Please fill all required business details before continuing with Google.');
    }

    // Store in session
    sessionStorage.setItem(
      'pendingVendorSignup',
      JSON.stringify({
        businessName: formData.businessName,
        city: formData.city,
        sector: formData.sector,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        rpnId: formData.rpnCode,
      }),
    );

    // Redirect to login with Google hint
    navigate('/login?signup=google');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-10 bg-white industrial-border rounded-xl shadow-2xl border border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <FirebaseDiagnostics />
      <div className="flex flex-col items-center mb-10">
        <div className="w-12 h-12 bg-orange-itred rounded-lg flex items-center justify-center text-sm text-white font-black mb-4 shadow-lg shadow-orange-100">
          iT
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
          Merchant Onboarding
        </h1>
        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">
          Initialize Storefront Node
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 text-[10px] font-black rounded border border-red-100 uppercase tracking-tight">
          {error}
        </div>
      )}
      <form
        onSubmit={handleRegister}
        className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold uppercase tracking-tighter"
      >
        <div className="col-span-full">
          <label className="block text-slate-500 mb-1">Full Name</label>
          <input
            name="fullName"
            id="reg-fullName"
            required
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred"
            value={formData.fullName}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-slate-500 mb-1">Email Address</label>
          <input
            type="email"
            name="email"
            id="reg-email"
            required
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred font-mono lowercase tracking-normal"
            value={formData.email}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-slate-500 mb-1">Phone Number</label>
          <input
            name="phone"
            id="reg-phone"
            required
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred"
            value={formData.phone}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-slate-500 mb-1">WhatsApp Number</label>
          <input
            name="whatsapp"
            id="reg-whatsapp"
            required
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred"
            value={formData.whatsapp}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-slate-500 mb-1">Business Name</label>
          <input
            name="businessName"
            id="reg-businessName"
            required
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred"
            value={formData.businessName}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-slate-500 mb-1">City</label>
          <input
            name="city"
            id="reg-city"
            required
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred"
            value={formData.city}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-slate-500 mb-1">Industry Sector</label>
          <select
            name="sector"
            id="reg-sector"
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white"
            value={formData.sector}
            onChange={handleChange}
          >
            {SECTORS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-slate-500 mb-1">Password</label>
          <input
            type="password"
            name="password"
            id="reg-password"
            required
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred"
            value={formData.password}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-slate-500 mb-1">Confirm Password</label>
          <input
            type="password"
            name="confirmPassword"
            id="reg-confirmPassword"
            required
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred"
            value={formData.confirmPassword}
            onChange={handleChange}
          />
        </div>
        <div className="col-span-full">
          <label className="block text-slate-500 mb-1">RPN Referral Code (Optional)</label>
          <input
            name="rpnCode"
            id="reg-rpnCode"
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred font-mono"
            value={formData.rpnCode}
            onChange={handleChange}
            placeholder="Enter Agent ID"
          />
        </div>
        <button
          disabled={loading}
          type="submit"
          id="reg-button"
          className="col-span-full bg-orange-itred text-white p-4 rounded font-bold uppercase tracking-widest hover:bg-[#d96a1a] flex justify-center items-center gap-2 mt-4"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : 'Complete Registration'}
        </button>

        <button
          type="button"
          onClick={handleGoogleRegister}
          className="col-span-full border border-slate-200 bg-white text-slate-700 p-4 rounded font-bold uppercase tracking-widest hover:bg-slate-50 flex justify-center items-center gap-2"
        >
          <Globe size={16} className="text-orange-itred" />
          Register with Google Account
        </button>
      </form>
      <div className="mt-10 pt-8 border-t border-slate-50 text-center space-y-4">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
          powered by seiGEN Commerce
        </p>
        <p className="text-center text-slate-500 text-[10px] uppercase font-bold tracking-widest">
          Already registered?{' '}
          <Link to="/login" className="text-orange-itred hover:underline">
            Authorize Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export const CompleteProfilePage = () => {
  const { user, isConsoleAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    businessName: '',
    phone: '',
    whatsapp: '',
    city: '',
    sector: 'GENERAL_DEALER',
    rpnId: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (isConsoleAdmin) {
      navigate('/console');
    }
  }, [user, isConsoleAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await completeGoogleVendorSignup(user, formData);
      if (formData.rpnId) {
        localStorage.setItem('rpn_notification', 'true');
      }
      navigate('/vendor');
    } catch (err: any) {
      console.error('Profile completion failed:', err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-10 bg-white industrial-border rounded-xl shadow-2xl border border-slate-100">
      <div className="flex flex-col items-center mb-10">
        <div className="w-12 h-12 bg-orange-itred rounded-lg flex items-center justify-center text-sm text-white font-black mb-4">
          iT
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
          Initialize Storefront
        </h1>
        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2 text-center">
          Your Google login was successful.
          <br />
          Complete your business profile to create your store.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 text-[10px] font-black rounded border border-red-100 uppercase tracking-tight">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold uppercase tracking-tighter"
      >
        <div className="col-span-full">
          <label className="block text-slate-500 mb-1">Business Name</label>
          <input
            name="businessName"
            value={formData.businessName}
            onChange={handleChange}
            required
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred"
          />
        </div>
        <div>
          <label className="block text-slate-500 mb-1">Phone Number</label>
          <input
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred"
          />
        </div>
        <div>
          <label className="block text-slate-500 mb-1">WhatsApp Number</label>
          <input
            name="whatsapp"
            value={formData.whatsapp}
            onChange={handleChange}
            required
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred"
          />
        </div>
        <div>
          <label className="block text-slate-500 mb-1">City</label>
          <input
            name="city"
            value={formData.city}
            onChange={handleChange}
            required
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred"
          />
        </div>
        <div>
          <label className="block text-slate-500 mb-1">Industry Sector</label>
          <select
            name="sector"
            value={formData.sector}
            onChange={handleChange}
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white font-bold uppercase"
          >
            {SECTORS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-slate-500 mb-1">RPN Referral Code (Optional)</label>
          <input
            name="rpnId"
            value={formData.rpnId}
            onChange={handleChange}
            placeholder="Enter Agent ID"
            className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred font-mono"
          />
        </div>
        <button
          disabled={loading}
          type="submit"
          className="col-span-full bg-slate-900 text-white p-4 rounded font-bold uppercase tracking-widest hover:bg-black transition-all flex justify-center items-center gap-2 mt-4"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : 'Establish Storefront Node'}
        </button>
      </form>
    </div>
  );
};

// VENDOR PAGES
export const VendorDashboard = () => {
  const { user, appUser, vendorId, isPOSEnabled } = useAuth();
  const [rpnMessage, setRpnMessage] = useState(false);
  const {
    plan,
    usage,
    subscription,
    hasUsageError,
    hasSyncError,
    daysRemaining,
    isTrial,
    isExpired,
  } = useSubscription();

  useEffect(() => {
    if (localStorage.getItem('rpn_notification') === 'true') {
      setRpnMessage(true);
      localStorage.removeItem('rpn_notification');
    }
  }, []);

  useEffect(() => {
    if (vendorId) {
      console.log('[VENDOR DASHBOARD DATA]', {
        vendorId,
        businessName: safeString(appUser?.businessName),
        displayName: safeString(appUser?.displayName),
        sector: safeString(appUser?.sector),
        sectorCode: safeString(appUser?.sectorCode),
        rpnReferralCode: safeString(appUser?.rpnReferralCode),
        rpnCode: safeString(appUser?.rpnCode),
        rpnStatus: safeString(appUser?.rpnStatus),
      });
      console.log('[DASHBOARD] Rendering for vendorId:', vendorId);
      console.log('[DASHBOARD] Subscription loaded:', !!subscription);
      if (subscription) {
        console.log('[DASHBOARD] Status:', subscription.status);
        console.log('[DASHBOARD] PlanCode:', subscription.planCode);
        console.log(
          '[DASHBOARD] ExpiresAt:',
          subscription.expiresAt?.toDate?.() || subscription.expiresAt,
        );
        console.log('[DASHBOARD] Days Remaining:', daysRemaining);
      }
    }
  }, [vendorId, subscription, daysRemaining, appUser]);

  const isRpnPending = safeString(appUser?.rpnStatus) === 'pending_verification';

  return (
    <div className="space-y-6">
      {(rpnMessage || isRpnPending) && (
        <div className="bg-orange-itred text-white py-3 px-6 rounded-lg flex justify-between items-center z-[100] shadow-lg shadow-orange-100 animate-in fade-in slide-in-from-top duration-500">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 animate-pulse text-white/80" />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">
              RPN Referral Captured // Verification Pending by seiGEN Commerce
            </span>
          </div>
          <button
            onClick={() => setRpnMessage(false)}
            className="p-1 hover:bg-black/10 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {(hasUsageError || hasSyncError) && (
        <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg flex items-center gap-3 animate-pulse">
          <AlertTriangle className="text-orange-500" size={18} />
          <div>
            <p className="text-xs font-black text-orange-900 uppercase tracking-tight">
              Diagnostic Advisory
            </p>
            <p className="text-[10px] text-orange-700 font-bold uppercase tracking-tight">
              Some usage counts could not be loaded. Cloud connection may be restricted.
            </p>
          </div>
        </div>
      )}

      {isTrial && !isExpired && (
        <div className="bg-indigo-600 border border-indigo-500 p-6 rounded-lg text-white shadow-lg overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-700">
            <Activity size={120} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                <Activity className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tighter italic">
                  Free Trial Active
                </h2>
                <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest leading-none">
                  Protocol Starter Tier Initialized
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <p className="text-3xl font-black tracking-tighter leading-none">{daysRemaining}</p>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">
                Days Remaining
              </p>
            </div>
          </div>
        </div>
      )}

      {isTrial && isExpired && (
        <div className="bg-red-600 border border-red-500 p-6 rounded-lg text-white shadow-lg">
          <div className="flex items-center gap-4">
            <AlertTriangle className="text-white" size={24} />
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter italic">
                Trial Expired
              </h2>
              <p className="text-red-100 text-xs font-bold uppercase tracking-widest leading-none">
                Upgrade required to resume operations
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-lg industrial-border shadow-sm border border-slate-200">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
              Vendor Dashboard
            </h1>
            <p className="text-slate-500 text-xs font-medium">MANAGEMENT INTERFACE ACTIVE</p>
          </div>
          {subscription && (
            <div
              className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                subscription.status === 'active'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : subscription.status === 'trial'
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                    : subscription.status === 'pending_activation'
                      ? 'bg-blue-50 text-blue-600 border-blue-100'
                      : 'bg-orange-50 text-orange-600 border-orange-100'
              }`}
            >
              {safeString(subscription.planCode)} //{' '}
              {safeString(subscription.status).replace('_', ' ')}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-50 border rounded">
            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Operator Identity</p>
            <p className="text-xs font-bold text-slate-700 truncate">{user?.email}</p>
          </div>
          <div className="p-4 bg-slate-50 border rounded">
            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Assigned Role</p>
            <p className="text-xs font-bold text-orange-itred uppercase">
              {safeString(appUser?.role).replace('_', ' ')}
            </p>
          </div>
          <div className="p-4 bg-slate-50 border rounded">
            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Merchant ID</p>
            <p className="text-xs font-bold text-slate-700 truncate font-mono">
              {vendorId || 'N/A'}
            </p>
          </div>
        </div>

        {plan && (
          <div className="mt-8 pt-8 border-t border-slate-100">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <Activity size={14} className="text-orange-itred" /> Protocol Quota Utilization
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <QuotaIndicator
                label="Inventory"
                used={usage.products}
                limit={plan.limits.products}
              />
              <QuotaIndicator label="Branches" used={usage.branches} limit={plan.limits.branches} />
              <QuotaIndicator
                label="Catalogues"
                used={usage.catalogues}
                limit={plan.limits.catalogues}
              />
              <QuotaIndicator label="Staff" used={usage.staff} limit={plan.limits.staff} />
              <QuotaIndicator label="Notices" used={usage.notices} limit={plan.limits.notices} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashLink to="/vendor/profile" icon={<Store size={18} />} label="Business Profile" />
        <DashLink to="/vendor/products" icon={<Package size={18} />} label="Product Catalog" />
        <DashLink to="/vendor/branches" icon={<GitBranch size={18} />} label="Branch Network" />
        <DashLink to="/vendor/staff" icon={<Users size={18} />} label="Staff Access" />
        <DashLink to="/vendor/delivery" icon={<Truck size={18} />} label="Delivery Config" />
        <DashLink to="/vendor/catalogues" icon={<BookOpen size={18} />} label="Catalogue Engine" />
        <DashLink to="/vendor/orders" icon={<ShoppingBag size={18} />} label="Order Stream" />
        <DashLink to="/vendor/subscription" icon={<CreditCard size={18} />} label="Plan Status" />
      </div>

      <div className="mt-12">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6 flex items-center gap-3">
          <Laptop size={14} className="text-orange-itred" /> POS Operations Hub
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashLink
            to="/vendor/pos"
            icon={<LayoutDashboard size={18} />}
            label="POS Dashboard"
            locked={!isPOSEnabled}
            lockedMessage="Activate POS Module"
          />
          <DashLink
            to="/vendor/pos/terminal"
            icon={<Laptop size={18} />}
            label="Sales Terminal"
            locked={!isPOSEnabled}
          />
          <DashLink
            to="/vendor/pos/shifts"
            icon={<Clock size={18} />}
            label="Shift Management"
            locked={!isPOSEnabled}
          />
          <DashLink
            to="/vendor/pos/accounting"
            icon={<Database size={18} />}
            label="POS Accounting"
            locked={!isPOSEnabled}
          />
        </div>
      </div>
    </div>
  );
};

const DashLink = ({
  to,
  icon,
  label,
  locked,
  lockedMessage,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  locked?: boolean;
  lockedMessage?: string;
}) => {
  if (locked) {
    return (
      <Link
        to="/vendor/pos/activate"
        className="bg-slate-50 p-6 rounded border border-slate-200 opacity-60 flex flex-col items-center gap-3 group text-center grayscale hover:grayscale-0 transition-all"
      >
        <div className="p-3 bg-white rounded text-slate-300 relative">
          {icon}
          <div className="absolute -top-1 -right-1">
            <LockIcon size={12} className="text-orange-itred" />
          </div>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <span className="text-[8px] font-black text-orange-itred uppercase tracking-widest">
          {lockedMessage || 'Paid Module'}
        </span>
      </Link>
    );
  }

  return (
    <Link
      to={to}
      className="bg-white p-6 rounded industrial-border hover:border-orange-itred transition-all flex flex-col items-center gap-3 group text-center"
    >
      <div className="p-3 bg-slate-50 rounded text-slate-400 group-hover:text-orange-itred transition-colors">
        {icon}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-900">
        {label}
      </p>
    </Link>
  );
};

const QuotaIndicator = ({ label, used, limit }: { label: string; used: number; limit: number }) => {
  const percentage = Math.min(Math.round((used / limit) * 100), 100);
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          {label}
        </span>
        <span
          className={`text-[10px] font-mono font-bold ${isCritical ? 'text-red-500' : isWarning ? 'text-orange-500' : 'text-slate-400'}`}
        >
          {used}/{limit}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${isCritical ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-emerald-500'}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export const VendorProfile = () => {
  const { vendorId, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    businessName: '',
    name: '',
    slug: '',
    description: '',
    sector: 'General Dealer',
    sectorCode: 'GENERAL_DEALER',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: '',
    country: 'Zimbabwe',
    visibility: 'private' as 'private' | 'public',
    status: 'draft' as 'draft' | 'published',
    ownerUid: '',
    logoUrl: '',
    bannerUrl: '',
  });

  useEffect(() => {
    const fetchVendor = async () => {
      if (!vendorId) return;
      try {
        const docRef = doc(db, 'vendors', vendorId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            businessName: data.businessName || '',
            name: data.name || '',
            slug: data.slug || '',
            description: data.description || '',
            sector: data.sector || 'General Dealer',
            sectorCode: data.sectorCode || 'GENERAL_DEALER',
            phone: data.phone || '',
            whatsapp: data.whatsapp || '',
            email: data.email || '',
            address: data.address || '',
            city: data.city || '',
            country: data.country || 'Zimbabwe',
            visibility: data.visibility || 'private',
            status: data.status || 'draft',
            ownerUid: data.ownerUid || '',
            logoUrl: data.logoUrl || '',
            bannerUrl: data.bannerUrl || '',
          });
        }
      } catch (err) {
        console.error('Error fetching vendor:', err);
        setMessage({ type: 'error', text: 'Failed to load vendor profile.' });
      } finally {
        setLoading(false);
      }
    };

    fetchVendor();
  }, [vendorId]);

  const generateSlug = (name: string) => {
    return safeSlug(name, 'record');
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };

      // If sectorCode changes, also update sector label for backward compatibility
      if (name === 'sectorCode') {
        const selectedSector = getSector(value);
        if (selectedSector) {
          newData.sector = selectedSector.label;
        }
      }

      // Auto-generate slug if businessName changes and slug is empty or was previously synced
      if (
        name === 'businessName' &&
        (!prev.slug || prev.slug === generateSlug(prev.businessName))
      ) {
        newData.slug = generateSlug(value);
      }
      return newData;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) return;

    setSaving(true);
    setMessage(null);

    try {
      const vendorRef = doc(db, 'vendors', vendorId);
      const updateData = {
        ...formData,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(vendorRef, updateData);

      // Audit Log
      const logRef = doc(collection(db, 'audit_logs'));
      await setDoc(logRef, {
        action: 'VENDOR_PROFILE_UPDATED',
        targetType: 'vendor',
        targetId: vendorId,
        vendorId: vendorId,
        performedBy: user?.uid,
        timestamp: serverTimestamp(),
        metadata: {
          businessName: formData.businessName,
          status: formData.status,
          visibility: formData.visibility,
        },
      });

      setMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err: any) {
      console.error('Error updating vendor:', err);
      setMessage({
        type: 'error',
        text: err.message || 'Permission denied or update failed.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center animate-pulse font-mono text-[10px] uppercase">
        Retrieving Merchant Data...
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-lg industrial-border shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-8 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
              Business Profile
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
              CORE IDENTITY SYSTEM
            </p>
          </div>
          <div className="flex gap-2">
            <span
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${formData.status === 'published' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
            >
              {formData.status}
            </span>
            <span
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${formData.visibility === 'public' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
            >
              {formData.visibility}
            </span>
          </div>
        </div>

        <div className="mb-6 p-4 bg-orange-50 border border-orange-100 rounded text-orange-800 text-[10px] font-bold uppercase tracking-tight">
          Warning: Only vendors with status <span className="underline">published</span> and
          visibility <span className="underline">public</span> will appear on public iTred
          discovery.
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded text-xs font-bold border uppercase tracking-tighter ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}
          >
            {message.text}
          </div>
        )}

        <form
          onSubmit={handleSave}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[10px] font-bold uppercase tracking-widest"
        >
          {/* Read Only Info */}
          <div className="p-4 bg-slate-50 border rounded col-span-1">
            <p className="text-slate-400 mb-1">Merchant ID</p>
            <p className="font-mono text-slate-700 break-all">{vendorId}</p>
          </div>
          <div className="p-4 bg-slate-50 border rounded col-span-1">
            <p className="text-slate-400 mb-1">Owner Identity (UID)</p>
            <p className="font-mono text-slate-700 break-all">{formData.ownerUid}</p>
          </div>

          <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <ImageUpload
              label="Business Logo"
              path="logo/logo.webp"
              value={formData.logoUrl}
              onUpload={async (url) => {
                setFormData((p) => ({ ...p, logoUrl: url }));
                if (url) {
                  await createAuditLog({
                    action: 'VENDOR_IMAGE_UPDATED',
                    targetType: 'vendor',
                    targetId: vendorId!,
                    vendorId: vendorId!,
                    metadata: { type: 'logo' },
                  });
                }
              }}
              aspectRatio="square"
            />
            <ImageUpload
              label="Store Banner"
              path="banner/banner.webp"
              value={formData.bannerUrl}
              onUpload={async (url) => {
                setFormData((p) => ({ ...p, bannerUrl: url }));
                if (url) {
                  await createAuditLog({
                    action: 'VENDOR_IMAGE_UPDATED',
                    targetType: 'vendor',
                    targetId: vendorId!,
                    vendorId: vendorId!,
                    metadata: { type: 'banner' },
                  });
                }
              }}
              aspectRatio="banner"
            />
          </div>

          <div className="col-span-full border-t pt-6 mt-2">
            <h3 className="text-slate-400 mb-4">Primary Information</h3>
          </div>

          <div>
            <label className="block text-slate-500 mb-2">Display Name (Public Name)</label>
            <input
              name="name"
              required
              className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
              value={formData.name}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-2">Registered Business Name</label>
            <input
              name="businessName"
              required
              className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
              value={formData.businessName}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-2">URL Slug (Lowercase ID)</label>
            <input
              name="slug"
              required
              className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred font-mono lowercase tracking-normal"
              value={formData.slug}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-2">Industry Sector</label>
            <select
              name="sectorCode"
              className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white"
              value={formData.sectorCode}
              onChange={handleInputChange}
            >
              {SECTORS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-full">
            <label className="block text-slate-500 mb-2">Business Description</label>
            <textarea
              name="description"
              rows={4}
              className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief company mission and offerings..."
            />
          </div>

          <div className="col-span-full border-t pt-6 mt-2">
            <h3 className="text-slate-400 mb-4">Contact & Location</h3>
          </div>

          <div>
            <label className="block text-slate-500 mb-2">Business Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred font-mono lowercase tracking-normal"
              value={formData.email}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-2">Direct Phone</label>
            <input
              name="phone"
              required
              className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal"
              value={formData.phone}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-2">WhatsApp Line</label>
            <input
              name="whatsapp"
              required
              className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal"
              value={formData.whatsapp}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-2">City</label>
            <input
              name="city"
              required
              className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal"
              value={formData.city}
              onChange={handleInputChange}
            />
          </div>

          <div className="col-span-full">
            <label className="block text-slate-500 mb-2">Physical Address</label>
            <input
              name="address"
              required
              className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
              value={formData.address}
              onChange={handleInputChange}
            />
          </div>

          <div className="col-span-full border-t pt-6 mt-2">
            <h3 className="text-slate-400 mb-4">Discovery Settings</h3>
          </div>

          <div>
            <label className="block text-slate-500 mb-2">Visibility Status</label>
            <select
              name="visibility"
              className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white"
              value={formData.visibility}
              onChange={handleInputChange}
            >
              <option value="private">Private (Internal Only)</option>
              <option value="public">Public (Discovery Active)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-2">Operational Status</label>
            <select
              name="status"
              className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white"
              value={formData.status}
              onChange={handleInputChange}
            >
              <option value="draft">Draft Mode</option>
              <option value="published">Published / Operational</option>
            </select>
          </div>

          <div className="col-span-full pt-8">
            <button
              disabled={saving}
              type="submit"
              className="w-full md:w-auto bg-orange-itred text-white px-8 py-4 rounded font-bold uppercase tracking-widest hover:bg-[#d96a1a] transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : 'Synchronize Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export const VendorProducts = () => {
  const { vendorId, user } = useAuth();
  const { checkQuota } = useSubscription();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialFormData = {
    productId: '',
    name: '',
    description: '',
    sku: '',
    sector: 'General Dealer',
    sectorCode: 'GENERAL_DEALER',
    category: 'Electronics',
    categoryCode: 'electronics',
    brand: '',
    unit: 'each',
    price: 0,
    costPrice: 0,
    stockQty: 0,
    reorderLevel: 0,
    status: 'draft' as 'draft' | 'published',
    visibility: 'private' as 'private' | 'public',
    images: [] as string[],
    attributes: {} as Record<string, any>,
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (!vendorId) return;

    const q = query(
      collection(db, 'products'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const productsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.id && doc.data()),
        }));
        setProducts(productsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching products:', err);
        setError('Failed to load inventory nodes.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [vendorId]);

  const handleOpenModal = (product?: any) => {
    if (!product) {
      const quota = checkQuota('products');
      if (!quota.allowed) {
        setError(quota.message!);
        return;
      }
    }
    if (product) {
      setEditingProduct(product);
      setFormData({
        productId: product.id || product.productId,
        name: product.name || '',
        description: product.description || '',
        sku: product.sku || '',
        sector: product.sector || 'General Dealer',
        sectorCode: product.sectorCode || 'GENERAL_DEALER',
        category: product.category || 'Electronics',
        categoryCode: product.categoryCode || 'electronics',
        brand: product.brand || '',
        unit: product.unit || 'each',
        price: product.price || 0,
        costPrice: product.costPrice || 0,
        stockQty: product.stockQty || 0,
        reorderLevel: product.reorderLevel || 0,
        status: product.status || 'draft',
        visibility: product.visibility || 'private',
        images: product.images || [],
        attributes: product.attributes || {},
      });
    } else {
      setEditingProduct(null);
      setFormData({
        ...initialFormData,
        productId: doc(collection(db, 'products')).id,
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !user) return;

    setSaving(true);
    setError(null);

    try {
      const timestamp = serverTimestamp();

      if (editingProduct) {
        // Update
        const docRef = doc(db, 'products', editingProduct.id);
        const updateData = {
          ...formData,
          updatedAt: timestamp,
        };
        await updateDoc(docRef, updateData);

        // Audit Log
        await setDoc(doc(collection(db, 'audit_logs')), {
          action: 'PRODUCT_UPDATED',
          targetType: 'product',
          targetId: editingProduct.id,
          vendorId: vendorId,
          performedBy: user.uid,
          timestamp: timestamp,
        });
      } else {
        // Create
        const productId = formData.productId;
        const docRef = doc(db, 'products', productId);
        const productData = {
          ...formData,
          productId: productId,
          vendorId: vendorId,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await setDoc(docRef, productData);

        // Audit Log
        await setDoc(doc(collection(db, 'audit_logs')), {
          action: 'PRODUCT_CREATED',
          targetType: 'product',
          targetId: productId,
          vendorId: vendorId,
          performedBy: user.uid,
          timestamp: timestamp,
        });
      }

      setModalOpen(false);
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Operation restricted by security protocol.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !window.confirm(
        `SECURITY NOTICE: Deleting Product Node "${name}". This action is irreversible. Proceed?`,
      )
    )
      return;

    try {
      await deleteDoc(doc(db, 'products', id));

      // Audit Log
      await setDoc(doc(collection(db, 'audit_logs')), {
        action: 'PRODUCT_DELETED',
        targetType: 'product',
        targetId: id,
        vendorId: vendorId,
        performedBy: user?.uid,
        timestamp: serverTimestamp(),
      });
    } catch (err: any) {
      console.error('Delete error:', err);
      setError('Delete permission denied.');
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center animate-pulse font-mono text-[10px] uppercase">
        Retrieving Inventory Matrix...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg industrial-border shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
            Product Inventory
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            Operational Node Management
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-orange-itred text-white p-3 rounded font-bold uppercase tracking-widest hover:bg-[#d96a1a] flex items-center gap-2 text-xs"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="bg-orange-50 border border-orange-100 p-4 rounded text-[10px] font-bold text-orange-800 uppercase tracking-tight">
        Warning: Only products with status <span className="underline">published</span>, visibility{' '}
        <span className="underline">public</span>, and{' '}
        <span className="underline">stockQty greater than 0</span> will appear in public iTred
        discovery.
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded text-xs font-bold uppercase">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.length === 0 ? (
          <div className="col-span-full bg-slate-50 border border-dashed border-slate-300 rounded-lg p-20 text-center">
            <Package className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              No Product Nodes Found in Repository
            </p>
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="bg-white industrial-border rounded-lg shadow-sm overflow-hidden group"
            >
              {product.images && product.images.length > 0 && (
                <div className="h-40 overflow-hidden bg-slate-100 border-b border-slate-100">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
              )}
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 uppercase tracking-tight line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">
                      SKU: {product.sku || 'N/A'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${product.status === 'published' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      {product.status}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${product.visibility === 'public' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      {product.visibility}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="p-3 bg-slate-50 rounded border border-slate-100">
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">
                      Price (USD)
                    </p>
                    <p className="text-lg font-bold text-slate-900 tracking-tight">
                      ${Number(product.price).toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-100">
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">
                      Stock Level
                    </p>
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-lg font-bold tracking-tight ${product.stockQty <= product.reorderLevel ? 'text-red-600' : 'text-slate-900'}`}
                      >
                        {product.stockQty}
                      </p>
                      {product.stockQty <= product.reorderLevel && (
                        <AlertTriangle size={14} className="text-red-500 animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-center">
                  <div className="flex gap-2">
                    {product.stockQty <= product.reorderLevel && (
                      <span className="text-[9px] font-bold uppercase text-red-600 bg-red-50 px-2 py-1 rounded">
                        Low Stock
                      </span>
                    )}
                    {product.status === 'published' &&
                      product.visibility === 'public' &&
                      product.stockQty > 0 && (
                        <span className="text-[9px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded flex items-center gap-1">
                          <CheckCircle2 size={10} /> Public Ready
                        </span>
                      )}
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenModal(product)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id, product.name)}
                      className="p-2 bg-red-50 hover:bg-red-100 rounded text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-lg industrial-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-charcoal text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tighter uppercase">
                  {editingProduct ? 'Update Node' : 'Register New Product'}
                </h2>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                  System Interaction Point
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="p-8 overflow-y-auto space-y-6 text-[10px] font-bold uppercase tracking-widest"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-full">
                  <label className="block text-slate-500 mb-2">Product Name</label>
                  <input
                    required
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-2">Industrial Sector</label>
                  <select
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white font-sans"
                    value={formData.sectorCode}
                    onChange={(e) => {
                      const sCode = e.target.value;
                      const selectedSector = getSector(sCode);
                      setFormData({
                        ...formData,
                        sectorCode: sCode,
                        sector: selectedSector?.label || sCode,
                        category: selectedSector?.defaultCategories[0] || 'General',
                        categoryCode:
                          selectedSector?.defaultCategories[0].toLowerCase() || 'general',
                        attributes: {},
                      });
                    }}
                  >
                    {SECTORS.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-2">Global Category</label>
                  <select
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white font-sans"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value,
                        categoryCode: e.target.value.toLowerCase(),
                      })
                    }
                  >
                    {getSector(formData.sectorCode)?.defaultCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>

                {getSector(formData.sectorCode)?.attributes &&
                  getSector(formData.sectorCode)!.attributes.length > 0 && (
                    <div className="col-span-full bg-slate-50 p-6 rounded-lg border border-slate-200">
                      <h3 className="text-slate-400 mb-4 flex items-center gap-2">
                        <Activity size={14} /> Sector Intelligence:{' '}
                        {getSector(formData.sectorCode)?.label} Attributes
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {getSector(formData.sectorCode)!.attributes.map((tmpl) => (
                          <div key={tmpl.id}>
                            <label className="block text-slate-400 mb-1">{tmpl.label}</label>
                            {tmpl.type === 'select' ? (
                              <select
                                className="w-full p-2 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white font-sans"
                                value={formData.attributes[tmpl.id] || ''}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    attributes: {
                                      ...formData.attributes,
                                      [tmpl.id]: e.target.value,
                                    },
                                  })
                                }
                              >
                                <option value="">Not Specified</option>
                                {tmpl.options?.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={tmpl.type}
                                placeholder={tmpl.placeholder}
                                className="w-full p-2 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                                value={formData.attributes[tmpl.id] || ''}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    attributes: {
                                      ...formData.attributes,
                                      [tmpl.id]:
                                        tmpl.type === 'number'
                                          ? Number(e.target.value)
                                          : e.target.value,
                                    },
                                  })
                                }
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="col-span-full">
                  <label className="block text-slate-500 mb-2">Description</label>
                  <textarea
                    rows={3}
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="col-span-full">
                  <label className="block text-slate-500 mb-4">Product Images (Max 5)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {formData.images.map((url, idx) => (
                      <ImageUpload
                        key={idx}
                        label=""
                        path={`products/${formData.productId}/${Date.now()}-${idx}.webp`}
                        value={url}
                        onUpload={async (newUrl) => {
                          const newImages = [...formData.images];
                          if (newUrl) {
                            newImages[idx] = newUrl;
                            await createAuditLog({
                              action: 'PRODUCT_IMAGES_UPDATED',
                              targetType: 'product',
                              targetId: formData.productId,
                              vendorId: vendorId!,
                            });
                          } else {
                            newImages.splice(idx, 1);
                          }
                          setFormData((p) => ({ ...p, images: newImages }));
                        }}
                        aspectRatio="square"
                      />
                    ))}
                    {formData.images.length < 5 && (
                      <ImageUpload
                        label=""
                        path={`products/${formData.productId}/${Date.now()}.webp`}
                        value=""
                        onUpload={async (newUrl) => {
                          if (newUrl) {
                            setFormData((p) => ({
                              ...p,
                              images: [...p.images, newUrl],
                            }));
                            await createAuditLog({
                              action: 'PRODUCT_IMAGES_UPDATED',
                              targetType: 'product',
                              targetId: formData.productId,
                              vendorId: vendorId!,
                            });
                          }
                        }}
                        aspectRatio="square"
                      />
                    )}
                  </div>
                  <p className="mt-2 text-[8px] text-slate-400">
                    WEBP_PROCESSOR: AUTOMATIC_COMPRESSION_ACTIVE
                  </p>
                </div>

                <div>
                  <label className="block text-slate-500 mb-2">SKU Code</label>
                  <input
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred font-mono tracking-normal"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-2">Category</label>
                  <select
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="electronics">Electronics</option>
                    <option value="clothing">Clothing</option>
                    <option value="grocery">Grocery</option>
                    <option value="home">Home & Living</option>
                    <option value="industrial">Industrial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-2">Sale Price (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-2">Cost Price (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.costPrice}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        costPrice: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-2">Current Stock</label>
                  <input
                    type="number"
                    required
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.stockQty}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stockQty: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-2">Reorder Level</label>
                  <input
                    type="number"
                    required
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.reorderLevel}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        reorderLevel: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-2">Operational Status</label>
                  <select
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as any,
                      })
                    }
                  >
                    <option value="draft">Draft Mode</option>
                    <option value="published">Published</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-2">Visibility</label>
                  <select
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white"
                    value={formData.visibility}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        visibility: e.target.value as any,
                      })
                    }
                  >
                    <option value="private">Private</option>
                    <option value="public">Public Search</option>
                  </select>
                </div>
              </div>

              <button
                disabled={saving}
                type="submit"
                className="w-full bg-charcoal text-white p-4 rounded font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 mt-4"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  'Synchronize Product Node'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export const VendorBranches = () => {
  const { user, vendorId } = useAuth();
  const { checkQuota } = useSubscription();
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [latestError, setLatestError] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const { role } = useAuth();

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);
  const [formData, setFormData] = useState({
    name: '',
    type: 'shop' as 'shop' | 'warehouse' | 'office' | 'pickup_point',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    country: 'Zimbabwe',
    latitude: '' as string | number,
    longitude: '' as string | number,
    isMainBranch: false,
    status: 'active' as 'active' | 'inactive',
  });

  useEffect(() => {
    if (!vendorId) {
      console.log('VendorBranches: Waiting for vendorId...', {
        userUid: user?.uid,
      });
      return;
    }

    console.log('VendorBranches: Initializing branches query...', {
      vendorId,
      userUid: user?.uid,
    });
    // Removed orderBy to prevent index requirement for basic sync
    const q = query(collection(db, 'branches'), where('vendorId', '==', vendorId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(`VendorBranches: Received ${snapshot.size} branches.`);
        const branchesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Manual sort if needed, but keeping it simple as per request
        setBranches(branchesData);
        setLoading(false);
      },
      (err: any) => {
        console.error('VendorBranches sync error:', err.code, err.message);
        setLatestError({ code: err.code, message: err.message });
        if (err.code === 'permission-denied') {
          setError('Permission denied. Check Firestore rules for branches collection.');
        } else if (err.code === 'failed-precondition') {
          setError(
            'Firestore index required. Open browser console and use the Firebase index link.',
          );
        } else if (err.code === 'unavailable') {
          setError('Cloud Firestore is temporarily offline. Retrying...');
        } else {
          setError(`FAILED TO SYNC BRANCH REPOSITORY: ${err.message}`);
        }
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [vendorId, user?.uid]);

  const handleOpenModal = (branch: any = null) => {
    setError(null);
    if (!branch) {
      const quota = checkQuota('branches');
      if (!quota.allowed) {
        setError(quota.message!);
        return;
      }
    }
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        name: branch.name,
        type: branch.type,
        phone: branch.phone || '',
        whatsapp: branch.whatsapp || '',
        address: branch.address || '',
        city: branch.city,
        country: branch.country || 'Zimbabwe',
        latitude: branch.latitude || '',
        longitude: branch.longitude || '',
        isMainBranch: branch.isMainBranch,
        status: branch.status,
      });
    } else {
      setEditingBranch(null);
      setFormData({
        name: '',
        type: 'shop',
        phone: '',
        whatsapp: '',
        address: '',
        city: '',
        country: 'Zimbabwe',
        latitude: '',
        longitude: '',
        isMainBranch: branches.length === 0, // First branch is main by default
        status: 'active',
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      console.error('VendorBranches: Attempted save without vendorId');
      setError('Session error: vendor identity missing.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      console.log(`VendorBranches: Starting ${editingBranch ? 'update' : 'create'} for branch...`);

      let branchId: string;
      let branchRef;

      if (editingBranch) {
        branchId = editingBranch.id;
        branchRef = doc(db, 'branches', branchId);
      } else {
        const newBranchRef = doc(collection(db, 'branches'));
        branchId = newBranchRef.id;
        branchRef = newBranchRef;
      }

      const payload = {
        branchId,
        vendorId: vendorId,
        name: formData.name,
        type: formData.type,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        latitude: formData.latitude !== '' ? Number(formData.latitude) : null,
        longitude: formData.longitude !== '' ? Number(formData.longitude) : null,
        isMainBranch: formData.isMainBranch,
        status: formData.status,
        updatedAt: serverTimestamp(),
        createdAt: editingBranch ? editingBranch.createdAt : serverTimestamp(),
      };

      // Handle main branch exclusivity
      if (formData.isMainBranch) {
        console.log('VendorBranches: Enforcing main branch exclusivity...');
        const otherMainBranches = branches.filter((b) => b.isMainBranch && b.id !== branchId);
        for (const b of otherMainBranches) {
          await updateDoc(doc(db, 'branches', b.id), {
            isMainBranch: false,
            updatedAt: serverTimestamp(),
          });
        }
      }

      if (editingBranch) {
        await updateDoc(branchRef, payload);
        console.log('VendorBranches: Update successful.');
      } else {
        await setDoc(branchRef, payload);
        console.log('VendorBranches: Create successful.');
      }

      setSuccess(`Branch node "${formData.name.toUpperCase()}" synchronized successfully.`);
      // Audit Log - only after success
      try {
        await setDoc(doc(collection(db, 'audit_logs')), {
          action: editingBranch ? 'BRANCH_UPDATED' : 'BRANCH_CREATED',
          targetType: 'branch',
          targetId: branchId,
          vendorId: vendorId,
          performedBy: user?.uid,
          timestamp: serverTimestamp(),
          metadata: { name: formData.name },
        });
        console.log('VendorBranches: Audit log recorded.');
      } catch (auditErr) {
        console.warn('VendorBranches: Audit log failed (non-blocking):', auditErr);
      }

      setModalOpen(false);
    } catch (err: any) {
      console.error('VendorBranches save error:', err.code, err.message);
      if (err.code === 'permission-denied') {
        setError('Permission denied: You do not have authority to write to this branch node.');
      } else {
        setError(`Operation failed: ${err.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !window.confirm(
        `IDENTIFY ACTION: Permanent deletion of branch "${name.toUpperCase()}". Continue?`,
      )
    )
      return;
    try {
      await deleteDoc(doc(db, 'branches', id));
      setSuccess(`Branch node "${name.toUpperCase()}" purged from network.`);
      await setDoc(doc(collection(db, 'audit_logs')), {
        action: 'BRANCH_DELETED',
        targetType: 'branch',
        targetId: id,
        vendorId: vendorId,
        performedBy: user?.uid,
        timestamp: serverTimestamp(),
        metadata: { name },
      });
    } catch (err: any) {
      setError(err.message || 'Deletion failed.');
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center animate-pulse font-mono text-[10px] uppercase">
        Mapping Branch Network...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-lg industrial-border shadow-sm border border-slate-200 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
            Branch Network
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            Fulfillment Node Management
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-orange-itred text-white p-3 rounded font-bold uppercase tracking-widest hover:bg-[#d96a1a] flex items-center gap-2 text-xs"
        >
          <Plus size={16} /> Add Branch
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded text-xs font-bold uppercase">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded text-xs font-bold uppercase flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* Debug Panel */}
      <div className="bg-slate-900 p-4 rounded text-[8px] font-mono text-emerald-400 space-y-1">
        <p className="border-b border-emerald-400/20 pb-1 mb-1 text-emerald-200">
          SYSTEM DEBUG PANEL
        </p>
        <div className="grid grid-cols-2 gap-x-4">
          <p>USER: {user?.email}</p>
          <p>ROLE: {role}</p>
          <p>VENDOR_ID: {vendorId}</p>
          <p>COLLECTION: branches</p>
        </div>
        {latestError && (
          <div className="mt-1 pt-1 border-t border-red-400/20 text-red-400">
            <p>FIREBASE_ERROR_CODE: {latestError.code}</p>
            <p>FIREBASE_ERROR_MSG: {latestError.message}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.length === 0 ? (
          <div className="col-span-full bg-slate-50 border border-dashed border-slate-300 rounded-lg p-20 text-center">
            <GitBranch className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              No branch nodes registered in network.
            </p>
          </div>
        ) : (
          branches.map((branch) => (
            <div
              key={branch.id}
              className="bg-white industrial-border rounded-lg shadow-sm overflow-hidden group"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 uppercase tracking-tight line-clamp-1">
                        {branch.name}
                      </h3>
                      {branch.isMainBranch && (
                        <span className="bg-orange-50 text-orange-itred text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-orange-100 flex items-center gap-1">
                          <ShieldCheck size={10} /> Main
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">
                      {branch.type}
                    </p>
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${branch.status === 'active' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                  >
                    {branch.status}
                  </span>
                </div>

                <div className="space-y-3 mt-4">
                  <div className="flex items-center gap-3 text-slate-500 text-[10px] font-bold uppercase">
                    <MapPin size={14} className="text-orange-itred" /> {branch.city},{' '}
                    {branch.country}
                  </div>
                  {branch.phone && (
                    <div className="flex items-center gap-3 text-slate-500 text-[10px] font-bold uppercase">
                      <Activity size={14} className="text-slate-400" /> {branch.phone}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(branch)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(branch.id, branch.name)}
                      className="p-2 bg-red-50 hover:bg-red-100 rounded text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="text-[9px] font-mono text-slate-300">
                    ID: {branch.branchId?.substring(0, 8)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-lg industrial-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-charcoal text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tighter uppercase">
                  {editingBranch ? 'Update Node' : 'Register Branch'}
                </h2>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                  Network Infrastructure Point
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={handleSave}
              className="p-8 overflow-y-auto space-y-6 text-[10px] font-bold uppercase tracking-widest"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-full">
                  <label className="block text-slate-500 mb-2">Branch Name</label>
                  <input
                    required
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-2">Facility Type</label>
                  <select
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <option value="shop">Retail Shop</option>
                    <option value="warehouse">Warehouse</option>
                    <option value="office">Corporate Office</option>
                    <option value="pickup_point">Pickup Point</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-2">City</label>
                  <input
                    required
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-2">Operational Status</label>
                  <select
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as any,
                      })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-8">
                  <input
                    type="checkbox"
                    id="isMain"
                    className="w-4 h-4 accent-orange-itred"
                    checked={formData.isMainBranch}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isMainBranch: e.target.checked,
                      })
                    }
                  />
                  <label htmlFor="isMain" className="text-slate-700">
                    Mark as primary node
                  </label>
                </div>
                <div>
                  <label className="block text-slate-500 mb-2">Contact Phone</label>
                  <input
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-2">WhatsApp Contact</label>
                  <input
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  />
                </div>
                <div className="col-span-full">
                  <label className="block text-slate-500 mb-2">Physical Address</label>
                  <input
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>
              <button
                disabled={saving}
                type="submit"
                className="w-full bg-charcoal text-white p-4 rounded font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 mt-4"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  'Synchronize Branch Node'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const VendorDelivery = () => {
  const { user, vendorId } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [latestError, setLatestError] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const { role } = useAuth();

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);
  const [formData, setFormData] = useState({
    name: '',
    providerType: 'vendor_owned' as 'vendor_owned' | 'third_party' | 'pickup_only',
    contactPerson: '',
    phone: '',
    whatsapp: '',
    coverageArea: '',
    baseFee: 0,
    notes: '',
    status: 'active' as 'active' | 'inactive',
    visibility: 'private' as 'private' | 'public',
  });

  useEffect(() => {
    if (!vendorId) {
      console.log('VendorDelivery: Waiting for vendorId...', {
        userUid: user?.uid,
      });
      return;
    }

    console.log('VendorDelivery: Initializing delivery services query...', {
      vendorId,
      userUid: user?.uid,
    });
    // Removed orderBy for basic sync
    const q = query(collection(db, 'delivery_services'), where('vendorId', '==', vendorId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(`VendorDelivery: Received ${snapshot.size} services.`);
        setServices(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err: any) => {
        console.error('VendorDelivery sync error:', err.code, err.message);
        setLatestError({ code: err.code, message: err.message });
        if (err.code === 'permission-denied') {
          setError('Permission denied. Check Firestore rules for delivery_services collection.');
        } else if (err.code === 'failed-precondition') {
          setError(
            'Firestore index required. Open browser console and use the Firebase index link.',
          );
        } else {
          setError(`FAILED TO SYNC LOGISTICS REPOSITORY: ${err.message}`);
        }
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [vendorId, user?.uid]);

  const handleOpenModal = (service: any = null) => {
    setError(null);
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        providerType: service.providerType,
        contactPerson: service.contactPerson || '',
        phone: service.phone || '',
        whatsapp: service.whatsapp || '',
        coverageArea: service.coverageArea || '',
        baseFee: service.baseFee || 0,
        notes: service.notes || '',
        status: service.status,
        visibility: service.visibility,
      });
    } else {
      setEditingService(null);
      setFormData({
        name: '',
        providerType: 'vendor_owned',
        contactPerson: '',
        phone: '',
        whatsapp: '',
        coverageArea: '',
        baseFee: 0,
        notes: '',
        status: 'active',
        visibility: 'private',
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      console.error('VendorDelivery: Attempted save without vendorId');
      setError('Session error: vendor identity missing.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      console.log(
        `VendorDelivery: Starting ${editingService ? 'update' : 'create'} for service...`,
      );

      let deliveryId: string;
      let serviceRef;

      if (editingService) {
        deliveryId = editingService.id;
        serviceRef = doc(db, 'delivery_services', deliveryId);
      } else {
        const newServiceRef = doc(collection(db, 'delivery_services'));
        deliveryId = newServiceRef.id;
        serviceRef = newServiceRef;
      }

      const payload = {
        deliveryId,
        vendorId: vendorId,
        ...formData,
        updatedAt: serverTimestamp(),
        createdAt: editingService ? editingService.createdAt : serverTimestamp(),
      };

      if (editingService) {
        await updateDoc(serviceRef, payload);
        console.log('VendorDelivery: Update successful.');
      } else {
        await setDoc(serviceRef, payload);
        console.log('VendorDelivery: Create successful.');
      }

      setSuccess(`Logistics service "${formData.name.toUpperCase()}" synchronized successfully.`);
      // Audit Log - only after success
      try {
        await setDoc(doc(collection(db, 'audit_logs')), {
          action: editingService ? 'DELIVERY_SERVICE_UPDATED' : 'DELIVERY_SERVICE_CREATED',
          targetType: 'delivery_service',
          targetId: deliveryId,
          vendorId: vendorId,
          performedBy: user?.uid,
          timestamp: serverTimestamp(),
          metadata: { name: formData.name },
        });
        console.log('VendorDelivery: Audit log recorded.');
      } catch (auditErr) {
        console.warn('VendorDelivery: Audit log failed (non-blocking):', auditErr);
      }

      setModalOpen(false);
    } catch (err: any) {
      console.error('VendorDelivery save error:', err.code, err.message);
      if (err.code === 'permission-denied') {
        setError('Permission denied: You do not have authority to write to this logistics node.');
      } else {
        setError(`Operation failed: ${err.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !window.confirm(
        `IDENTIFY ACTION: Permanent deletion of delivery service "${name.toUpperCase()}". Continue?`,
      )
    )
      return;
    try {
      await deleteDoc(doc(db, 'delivery_services', id));
      setSuccess(`Logistics service "${name.toUpperCase()}" purged from network.`);
      await setDoc(doc(collection(db, 'audit_logs')), {
        action: 'DELIVERY_SERVICE_DELETED',
        targetType: 'delivery_service',
        targetId: id,
        vendorId: vendorId,
        performedBy: user?.uid,
        timestamp: serverTimestamp(),
        metadata: { name },
      });
    } catch (err: any) {
      setError(err.message || 'Deletion failed.');
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center animate-pulse font-mono text-[10px] uppercase">
        Retrieving Logistics Config...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-lg industrial-border shadow-sm border border-slate-200 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
            Logistics Pipeline
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            Delivery Configuration Node
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-charcoal text-white p-3 rounded font-bold uppercase tracking-widest hover:bg-slate-800 flex items-center gap-2 text-xs"
        >
          <Plus size={16} /> New Service
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded text-xs font-bold uppercase">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded text-xs font-bold uppercase flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* Debug Panel */}
      <div className="bg-slate-900 p-4 rounded text-[8px] font-mono text-emerald-400 space-y-1">
        <p className="border-b border-emerald-400/20 pb-1 mb-1 text-emerald-200">
          SYSTEM DEBUG PANEL
        </p>
        <div className="grid grid-cols-2 gap-x-4">
          <p>USER: {user?.email}</p>
          <p>ROLE: {role}</p>
          <p>VENDOR_ID: {vendorId}</p>
          <p>COLLECTION: delivery_services</p>
        </div>
        {latestError && (
          <div className="mt-1 pt-1 border-t border-red-400/20 text-red-400">
            <p>FIREBASE_ERROR_CODE: {latestError.code}</p>
            <p>FIREBASE_ERROR_MSG: {latestError.message}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.length === 0 ? (
          <div className="col-span-full bg-slate-50 border border-dashed border-slate-300 rounded-lg p-20 text-center">
            <Truck className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              No active delivery nodes configured.
            </p>
          </div>
        ) : (
          services.map((service) => (
            <div
              key={service.id}
              className="bg-white industrial-border rounded-lg shadow-sm overflow-hidden group border border-slate-100"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 uppercase tracking-tight">
                      {service.name}
                    </h3>
                    <p className="text-[10px] text-orange-itred font-bold uppercase mt-1 tracking-widest">
                      {safeString(service.providerType).replace('_', ' ')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${service.status === 'active' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      {service.status}
                    </span>
                    <span
                      className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${service.visibility === 'public' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      {service.visibility}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-100 mb-4">
                  <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">
                    Base Logistics Fee
                  </p>
                  <p className="text-lg font-bold text-slate-900 tracking-tight">
                    ${Number(service.baseFee).toFixed(2)}
                  </p>
                </div>
                <div className="space-y-2 text-[10px] font-bold uppercase text-slate-500">
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-slate-400" />{' '}
                    {service.coverageArea || 'Unspecified Domain'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase size={12} className="text-slate-400" />{' '}
                    {service.contactPerson || 'Unknown Agent'}
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(service)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(service.id, service.name)}
                      className="p-2 bg-red-50 hover:bg-red-100 rounded text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="text-[9px] font-mono text-slate-300">
                    LOG-NODE: {service.deliveryId?.substring(0, 8)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-lg industrial-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-charcoal text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tighter uppercase">
                  {editingService ? 'Modulate Pipeline' : 'Register Service'}
                </h2>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                  Logistics Integration Point
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={handleSave}
              className="p-8 overflow-y-auto space-y-6 text-[10px] font-bold uppercase tracking-widest"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-full">
                  <label className="block text-slate-500 mb-2">Service Name</label>
                  <input
                    required
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-2">Provider Category</label>
                  <select
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white"
                    value={formData.providerType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        providerType: e.target.value as any,
                      })
                    }
                  >
                    <option value="vendor_owned">Vendor Internal</option>
                    <option value="third_party">Third Party Partner</option>
                    <option value="pickup_only">Customer Pickup Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-2">Base Service Fee (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.baseFee}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        baseFee: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-2">Contact Person</label>
                  <input
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contactPerson: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-2">Fulfillment Domain (Area)</label>
                  <input
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.coverageArea}
                    onChange={(e) => setFormData({ ...formData, coverageArea: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-2">Visibility Level</label>
                  <select
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white"
                    value={formData.visibility}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        visibility: e.target.value as any,
                      })
                    }
                  >
                    <option value="private">Private / Internal</option>
                    <option value="public">Public / Checkout Visible</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-2">Operational State</label>
                  <select
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as any,
                      })
                    }
                  >
                    <option value="active">Active Stream</option>
                    <option value="inactive">Suspended</option>
                  </select>
                </div>
                <div className="col-span-full">
                  <label className="block text-slate-500 mb-2">Operational Notes</label>
                  <textarea
                    rows={2}
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <button
                disabled={saving}
                type="submit"
                className="w-full bg-charcoal text-white p-4 rounded font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 mt-4"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  'Synchronize Logistics Node'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export const VendorCatalogues = () => {
  const { user, vendorId, role } = useAuth();
  const { checkQuota } = useSubscription();
  const [catalogues, setCatalogues] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [deliveryServices, setDeliveryServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCatalogue, setEditingCatalogue] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [latestError, setLatestError] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportDiagnostic, setExportDiagnostic] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    theme: 'classic' as 'classic' | 'modern' | 'compact',
    status: 'draft' as 'draft' | 'published',
    visibility: 'private' as 'private' | 'public',
    selectedProductIds: [] as string[],
    branchId: '',
    deliveryServiceIds: [] as string[],
    whatsappNumber: '',
    expiresAt: '',
  });

  useEffect(() => {
    if (!vendorId) return;

    // Sync Catalogues
    const qC = query(collection(db, 'catalogues'), where('vendorId', '==', vendorId));
    const unsubC = onSnapshot(
      qC,
      (snap) => {
        setCatalogues(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err: any) => {
        console.error('Catalogues sync error:', err);
        setLatestError({ code: err.code, message: err.message });
      },
    );

    // Sync Products
    const qP = query(collection(db, 'products'), where('vendorId', '==', vendorId));
    const unsubP = onSnapshot(qP, (snap) => {
      setProducts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    // Sync Branches
    const qB = query(collection(db, 'branches'), where('vendorId', '==', vendorId));
    const unsubB = onSnapshot(qB, (snap) => {
      setBranches(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    // Sync Delivery
    const qD = query(collection(db, 'delivery_services'), where('vendorId', '==', vendorId));
    const unsubD = onSnapshot(qD, (snap) => {
      setDeliveryServices(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    setLoading(false);

    return () => {
      unsubC();
      unsubP();
      unsubB();
      unsubD();
    };
  }, [vendorId]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleOpenModal = (cat: any = null) => {
    setError(null);
    if (!cat) {
      const quota = checkQuota('catalogues');
      if (!quota.allowed) {
        setError(quota.message!);
        return;
      }
    }
    if (cat) {
      setEditingCatalogue(cat);
      setFormData({
        title: cat.title,
        description: cat.description || '',
        theme: cat.theme,
        status: cat.status,
        visibility: cat.visibility,
        selectedProductIds: cat.selectedProductIds || [],
        branchId: cat.branchId || '',
        deliveryServiceIds: cat.deliveryServiceIds || [],
        whatsappNumber: cat.whatsappNumber || '',
        expiresAt: cat.expiresAt
          ? new Date(cat.expiresAt.seconds * 1000).toISOString().split('T')[0]
          : '',
      });
    } else {
      setEditingCatalogue(null);
      setFormData({
        title: '',
        description: '',
        theme: 'classic',
        status: 'draft',
        visibility: 'private',
        selectedProductIds: [],
        branchId: branches.find((b) => b.isMainBranch)?.id || branches[0]?.id || '',
        deliveryServiceIds: [],
        whatsappNumber: '',
        expiresAt: '',
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) return;
    setSaving(true);
    setError(null);

    try {
      const catalogueId = editingCatalogue?.id || doc(collection(db, 'catalogues')).id;
      const catalogueRef = doc(db, 'catalogues', catalogueId);

      const payload = {
        catalogueId,
        vendorId,
        ...formData,
        expiresAt: formData.expiresAt ? Timestamp.fromDate(new Date(formData.expiresAt)) : null,
        updatedAt: serverTimestamp(),
        createdAt: editingCatalogue ? editingCatalogue.createdAt : serverTimestamp(),
      };

      if (editingCatalogue) {
        await updateDoc(catalogueRef, payload);
      } else {
        await setDoc(catalogueRef, payload);
      }

      // Audit
      await setDoc(doc(collection(db, 'audit_logs')), {
        action: editingCatalogue ? 'CATALOGUE_UPDATED' : 'CATALOGUE_CREATED',
        targetType: 'catalogue',
        targetId: catalogueId,
        vendorId: vendorId,
        performedBy: user?.uid,
        timestamp: serverTimestamp(),
        metadata: { title: formData.title },
      });

      setSuccess(`Catalogue "${formData.title.toUpperCase()}" synchronized successfully.`);
      setModalOpen(false);
    } catch (err: any) {
      console.error('Catalogue save error:', err);
      setError(err.message || 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = (productId: string) => {
    const current = [...formData.selectedProductIds];
    const index = current.indexOf(productId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(productId);
    }
    setFormData({ ...formData, selectedProductIds: current });
  };

  const toggleDelivery = (deliveryId: string) => {
    const current = [...formData.deliveryServiceIds];
    const index = current.indexOf(deliveryId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(deliveryId);
    }
    setFormData({ ...formData, deliveryServiceIds: current });
  };

  const handleExportOffline = async (cat: any) => {
    setExportingId(cat.id);
    setError(null);
    setExportDiagnostic({
      selectedIds: (cat.selectedProductIds || []).length,
      loadedDocs: 0,
      publicReady: 0,
      vendorLoaded: false,
      branchLoaded: false,
      deliveryCount: 0,
    });

    console.log('Starting export for catalogue:', cat.id);

    try {
      // Load Vendor
      const vDoc = await getDoc(doc(db, 'vendors', vendorId!));
      if (!vDoc.exists()) throw new Error('Vendor identity missing.');
      const vData = vDoc.data();
      console.log('Vendor loaded:', vData.businessName);
      setExportDiagnostic((prev: any) => ({ ...prev, vendorLoaded: true }));

      // Load Products explicitly from Firestore
      const selectedProductIds = Array.isArray(cat.selectedProductIds)
        ? cat.selectedProductIds
        : [];
      console.log('Catalogue selectedProductIds count:', selectedProductIds.length);

      const productSnapshots = await Promise.all(
        selectedProductIds.map((pid) => getDoc(doc(db, 'products', pid))),
      );

      const loadedProducts = productSnapshots
        .filter((snap) => {
          if (!snap.exists()) {
            console.warn(`Product doc ${snap.id} does not exist.`);
            return false;
          }
          return true;
        })
        .map((snap) => ({ id: snap.id, ...snap.data() }));

      console.log('Loaded product docs from Firestore:', loadedProducts.length);
      setExportDiagnostic((prev: any) => ({
        ...prev,
        loadedDocs: loadedProducts.length,
      }));

      // Filter Public-Ready Products
      const exportProducts = loadedProducts.filter((p: any) => {
        const stockQty = Number(p.stockQty || 0);
        const isPublished = p.status === 'published';
        const isPublic = p.visibility === 'public';
        const hasStock = stockQty > 0;

        const ready = isPublished && isPublic && hasStock;
        if (!ready) {
          console.log(
            `Filtering product out: ${p.name || p.id} (Status: ${p.status}, Visibility: ${p.visibility}, Stock: ${stockQty})`,
          );
        }
        return ready;
      });

      console.log('Public-ready products count:', exportProducts.length);
      setExportDiagnostic((prev: any) => ({
        ...prev,
        publicReady: exportProducts.length,
      }));

      if (exportProducts.length === 0) {
        throw new Error(
          'No public-ready products were found for this catalogue export. Check that the catalogue has selected product IDs and that selected products are published, public, and in stock.',
        );
      }

      // Load Branch
      let branchData = null;
      if (cat.branchId) {
        const bDoc = await getDoc(doc(db, 'branches', cat.branchId));
        if (bDoc.exists()) {
          branchData = bDoc.data();
          console.log('Branch loaded:', branchData.name);
          setExportDiagnostic((prev: any) => ({ ...prev, branchLoaded: true }));
        }
      }

      // Load Delivery
      const exportDelivery = deliveryServices.filter((ds) =>
        (cat.deliveryServiceIds || []).includes(ds.id),
      );
      console.log('Delivery services count:', exportDelivery.length);
      setExportDiagnostic((prev: any) => ({
        ...prev,
        deliveryCount: exportDelivery.length,
      }));

      const html = generateOfflineCatalogueHtml({
        vendor: vData,
        catalogue: cat,
        products: exportProducts,
        branch: branchData,
        deliveryServices: exportDelivery,
      });

      // Trigger Download
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeVendorName = (vData.businessName || 'vendor')
        .replace(/[^a-z0-9]/gi, '-')
        .toLowerCase();
      const safeCatTitle = (cat.title || 'catalogue').replace(/[^a-z0-9]/gi, '-').toLowerCase();
      a.href = url;
      a.download = `itred-${safeVendorName}-${safeCatTitle}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Audit
      await setDoc(doc(collection(db, 'audit_logs')), {
        action: 'CATALOGUE_OFFLINE_HTML_EXPORTED',
        targetType: 'catalogue',
        targetId: cat.id,
        vendorId: vendorId,
        performedBy: user?.uid,
        timestamp: serverTimestamp(),
        metadata: {
          productCount: exportProducts.length,
          fileName: a.download,
        },
      });

      setSuccess(`Offline HTML export for "${cat.title.toUpperCase()}" initialized successfully.`);
      // Clear diagnostic after success
      setTimeout(() => setExportDiagnostic(null), 5000);
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || 'Export failed.');
      setExportDiagnostic(null);
    } finally {
      setExportingId(null);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (
      !window.confirm(
        `IDENTIFY ACTION: Permanent deletion of catalogue "${title.toUpperCase()}". Continue?`,
      )
    )
      return;
    try {
      await deleteDoc(doc(db, 'catalogues', id));
      setSuccess(`Catalogue "${title.toUpperCase()}" purged from network.`);
      await setDoc(doc(collection(db, 'audit_logs')), {
        action: 'CATALOGUE_DELETED',
        targetType: 'catalogue',
        targetId: id,
        vendorId: vendorId,
        performedBy: user?.uid,
        timestamp: serverTimestamp(),
        metadata: { title },
      });
    } catch (err: any) {
      setError(err.message || 'Deletion failed.');
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center animate-pulse font-mono text-[10px] uppercase">
        Retrieving Catalogue Index...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-lg industrial-border shadow-sm border border-slate-200 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
            Catalogue Engine
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            Direct Market Broadcasting
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-orange-itred text-white p-3 rounded font-bold uppercase tracking-widest hover:bg-[#d96a1a] flex items-center gap-2 text-xs"
        >
          <Plus size={16} /> New Catalogue
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded text-xs font-bold uppercase">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded text-xs font-bold uppercase flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {catalogues.length === 0 ? (
          <div className="col-span-full bg-slate-50 border border-dashed border-slate-300 rounded-lg p-20 text-center">
            <BookOpen className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              No active catalogues configured.
            </p>
          </div>
        ) : (
          catalogues.map((cat) => (
            <div
              key={cat.id}
              className="bg-white industrial-border rounded-lg shadow-sm border border-slate-100 overflow-hidden group"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 uppercase tracking-tight line-clamp-1">
                      {cat.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">
                      {cat.theme} aesthetic
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${cat.status === 'published' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      {cat.status}
                    </span>
                    <span
                      className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${cat.visibility === 'public' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      {cat.visibility}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-2 mb-4 h-8">
                  {cat.description || 'No broadcast description provided.'}
                </p>
                <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase tracking-widest py-3 border-t border-slate-50">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Package size={14} /> {cat.selectedProductIds?.length || 0} Products
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Truck size={14} /> {cat.deliveryServiceIds?.length || 0} Services
                  </div>
                </div>
                <div className="mt-6 flex justify-between items-center gap-4">
                  <Link
                    to={`/catalogues/${cat.id}`}
                    target="_blank"
                    className="flex-grow bg-slate-100 p-2.5 rounded text-[9px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-200 text-center flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={14} /> Preview
                  </Link>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(cat)}
                      className="p-2 bg-slate-50 hover:bg-slate-100 rounded text-slate-600 transition-colors border border-slate-100"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.title)}
                      className="p-2 bg-red-50 hover:bg-red-100 rounded text-red-600 transition-colors border border-red-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    disabled={exportingId === cat.id}
                    onClick={() => handleExportOffline(cat)}
                    className={`w-full text-[8px] font-bold uppercase tracking-widest text-center py-2 transition-colors flex items-center justify-center gap-2 border border-dashed rounded ${exportingId === cat.id ? 'bg-slate-50 text-slate-300 border-slate-200' : 'text-slate-400 border-slate-200 hover:text-orange-itred hover:border-orange-itred/30 hover:bg-orange-50'}`}
                  >
                    {exportingId === cat.id ? (
                      <>
                        <Loader2 size={10} className="animate-spin" /> Preparing Export...
                      </>
                    ) : (
                      <>
                        <Download size={10} /> Export Offline HTML
                      </>
                    )}
                  </button>
                  {exportingId === cat.id && exportDiagnostic && (
                    <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-[9px] font-mono leading-tight space-y-1">
                      <div className="text-slate-400 uppercase font-bold border-b border-slate-100 pb-1 mb-1">
                        Export Diagnostic
                      </div>
                      <div className="flex justify-between">
                        <span>Selected IDs:</span>{' '}
                        <span className="text-slate-900">{exportDiagnostic.selectedIds}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Loaded Docs:</span>{' '}
                        <span className="text-slate-900">{exportDiagnostic.loadedDocs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Public Ready:</span>{' '}
                        <span className="text-slate-900 font-bold">
                          {exportDiagnostic.publicReady}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Vendor Loaded:</span>{' '}
                        <span
                          className={
                            exportDiagnostic.vendorLoaded ? 'text-emerald-600' : 'text-red-500'
                          }
                        >
                          {exportDiagnostic.vendorLoaded ? 'YES' : 'NO'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Branch Loaded:</span>{' '}
                        <span className="text-slate-900">
                          {exportDiagnostic.branchLoaded ? 'YES' : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery SVCS:</span>{' '}
                        <span className="text-slate-900">{exportDiagnostic.deliveryCount}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-lg industrial-border shadow-2xl overflow-hidden flex flex-col h-[90vh]">
            <div className="p-6 bg-charcoal text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tighter uppercase">
                  {editingCatalogue ? 'Modulate Catalogue' : 'Register Catalogue'}
                </h2>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                  Broadcast Infrastructure Node
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={handleSave}
              className="p-8 overflow-y-auto space-y-8 text-[10px] font-bold uppercase tracking-widest"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold text-orange-itred tracking-widest border-b pb-2">
                    Configuration
                  </h3>
                  <div>
                    <label className="block text-slate-500 mb-2">Catalogue Title</label>
                    <input
                      required
                      className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-2">Description</label>
                    <textarea
                      rows={2}
                      className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-500 mb-2">Theme</label>
                      <select
                        className="w-full p-3 industrial-border rounded outline-none bg-white"
                        value={formData.theme}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            theme: e.target.value as any,
                          })
                        }
                      >
                        <option value="classic">Classic</option>
                        <option value="modern">Modern</option>
                        <option value="compact">Compact</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-2">Status</label>
                      <select
                        className="w-full p-3 industrial-border rounded outline-none bg-white"
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            status: e.target.value as any,
                          })
                        }
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-2">Visibility</label>
                      <select
                        className="w-full p-3 industrial-border rounded outline-none bg-white"
                        value={formData.visibility}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            visibility: e.target.value as any,
                          })
                        }
                      >
                        <option value="private">Private</option>
                        <option value="public">Public</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 mb-2">Primary Branch</label>
                      <select
                        className="w-full p-3 industrial-border rounded outline-none bg-white"
                        value={formData.branchId}
                        onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                      >
                        <option value="">No branch selected</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.city})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-2">WhatsApp Order Link</label>
                      <input
                        className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred tracking-normal font-sans"
                        placeholder="+263..."
                        value={formData.whatsappNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            whatsappNumber: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-2">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    />
                  </div>

                  {/* Delivery Services */}
                  <div className="space-y-3">
                    <label className="block text-slate-500">Distribution Nodes (Delivery)</label>
                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto pr-2 no-scrollbar">
                      {deliveryServices.map((ds) => (
                        <div
                          key={ds.id}
                          onClick={() => toggleDelivery(ds.id)}
                          className={`p-3 industrial-border rounded cursor-pointer transition-all flex justify-between items-center ${formData.deliveryServiceIds.includes(ds.id) ? 'bg-orange-50 border-orange-itred text-slate-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                        >
                          <span>{ds.name}</span>
                          {formData.deliveryServiceIds.includes(ds.id) ? (
                            <CheckCircle2 size={14} className="text-orange-itred" />
                          ) : (
                            <div className="w-3.5 h-3.5 border border-slate-300 rounded-full"></div>
                          )}
                        </div>
                      ))}
                      {deliveryServices.length === 0 && (
                        <p className="text-[9px] text-slate-300 italic">
                          No delivery services registered.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Product Selector */}
                <div className="space-y-6">
                  <div className="flex justify-between items-end border-b pb-2">
                    <h3 className="text-xs font-bold text-orange-itred tracking-widest">
                      Inventory Selection ({formData.selectedProductIds.length} Linked)
                    </h3>
                  </div>

                  <SearchableProductPicker
                    products={products}
                    selectedIds={formData.selectedProductIds}
                    onToggle={toggleProduct}
                    onSelectAll={() => {
                      const allIds = products.map((p) => p.id);
                      setFormData({ ...formData, selectedProductIds: allIds });
                    }}
                  />
                </div>
              </div>

              <button
                disabled={saving}
                type="submit"
                className="w-full bg-charcoal text-white p-5 rounded font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-3 text-sm shadow-xl mt-8"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Database size={20} />}
                {saving ? 'Synchronizing Infrastructure...' : 'Deploy Broadcast Catalogue'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const CataloguesPage = () => {
  const [catalogues, setCatalogues] = useState<any[]>([]);
  const [vendors, setVendors] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'catalogues'),
      where('status', '==', 'published'),
      where('visibility', '==', 'public'),
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as any);
      setCatalogues(list);

      const vCache: Record<string, any> = {};
      for (const cat of list) {
        if (!vCache[cat.vendorId]) {
          const vDoc = await getDoc(doc(db, 'vendors', cat.vendorId));
          if (vDoc.exists()) vCache[cat.vendorId] = vDoc.data();
        }
      }
      setVendors(vCache);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-8">
      <div className="bg-charcoal text-white p-10 rounded-lg industrial-border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-orange-itred opacity-10 rounded-full blur-3xl"></div>
        <h1 className="text-4xl font-bold tracking-tighter uppercase mb-2">
          Interactive <span className="text-orange-itred">Catalogues</span>
        </h1>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
          Curated Inventory Broadcasts // {catalogues.length} Active Feeds
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 bg-slate-50 industrial-border animate-pulse rounded-lg"
            ></div>
          ))}
        </div>
      ) : catalogues.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg p-20 text-center">
          <BookOpen size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
            No public catalogues are available yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {catalogues.map((cat) => (
            <div
              key={cat.id}
              className="bg-white industrial-border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all group"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-slate-50 industrial-border border-slate-100 rounded flex items-center justify-center font-bold text-slate-300">
                    {vendors[cat.vendorId]?.businessName?.substring(0, 2) || 'VN'}
                  </div>
                  <span className="bg-orange-itred text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-widest shadow-sm">
                    {cat.theme}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tighter mb-2 group-hover:text-orange-itred transition-colors line-clamp-1">
                  {cat.title}
                </h2>
                <p className="text-[10px] text-orange-itred font-black uppercase tracking-widest mb-4">
                  {vendors[cat.vendorId]?.businessName || 'Merchant Node'}
                </p>
                <p className="text-xs text-slate-500 line-clamp-2 h-8 mb-8">
                  {cat.description ||
                    'Professional inventory showcase broadcasted via iTred network.'}
                </p>
                <Link
                  to={`/catalogues/${cat.id}`}
                  className="w-full bg-charcoal text-white p-4 rounded font-bold uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-colors flex items-center justify-center gap-3 border border-slate-700"
                >
                  <ExternalLink size={14} /> Open Catalogue
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const CatalogueDetailPage = () => {
  const { catalogueId } = useParams();
  const [catalogue, setCatalogue] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [branch, setBranch] = useState<any>(null);
  const [delivery, setDelivery] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);

  useEffect(() => {
    if (!catalogueId) return;

    const loadContent = async () => {
      try {
        const cDoc = await getDoc(doc(db, 'catalogues', catalogueId));
        if (!cDoc.exists()) return setError('Catalogue node not found.');

        const cData = cDoc.data();
        if (cData.status !== 'published' || cData.visibility !== 'public') {
          return setError('Catalogue is not publicly available.');
        }
        setCatalogue(cData);

        // Load Vendor
        const vDoc = await getDoc(doc(db, 'vendors', cData.vendorId));
        if (vDoc.exists()) setVendor(vDoc.data());

        // Load Products
        if (cData.selectedProductIds?.length > 0) {
          const pList: any[] = [];
          for (const pid of cData.selectedProductIds) {
            const pDoc = await getDoc(doc(db, 'products', pid));
            if (pDoc.exists()) {
              const pData = pDoc.data();
              if (
                pData.status === 'published' &&
                pData.visibility === 'public' &&
                pData.stockQty > 0
              ) {
                pList.push({ id: pDoc.id, ...pData });
              }
            }
          }
          setProducts(pList);
        }

        // Load Branch
        if (cData.branchId) {
          const bDoc = await getDoc(doc(db, 'branches', cData.branchId));
          if (bDoc.exists()) setBranch(bDoc.data());
        }

        // Load Delivery
        if (cData.deliveryServiceIds?.length > 0) {
          const dList: any[] = [];
          for (const did of cData.deliveryServiceIds) {
            const dDoc = await getDoc(doc(db, 'delivery_services', did));
            if (dDoc.exists()) dList.push(dDoc.data());
          }
          setDelivery(dList);
        }

        setLoading(false);
      } catch (err) {
        console.error('Catalogue error:', err);
        setError('Failed to establish connection to catalogue node.');
        setLoading(false);
      }
    };

    loadContent();
  }, [catalogueId]);

  const getCatWhatsApp = () => {
    const phone = catalogue?.whatsappNumber || vendor?.whatsapp || '';
    const cleanPhone = safeString(phone).replace(/\+/g, '').replace(/\s+/g, '');
    const message = `Hello, I saw your iTred catalogue:\nCatalogue: ${catalogue?.title}\nVendor: ${vendor?.businessName}\nI would like to enquire/order from this catalogue.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const getProductWhatsApp = (p: any) => {
    const phone = catalogue?.whatsappNumber || vendor?.whatsapp || '';
    const cleanPhone = safeString(phone).replace(/\+/g, '').replace(/\s+/g, '');
    const message = `Hello, I saw this product in your iTred catalogue:\nCatalogue: ${catalogue?.title}\nProduct: ${p.name}\nSKU: ${p.sku || 'N/A'}\nPrice: $${Number(p.price).toFixed(2)}\nVendor: ${vendor?.businessName}\nI would like to enquire/order.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  if (loading)
    return (
      <div className="p-20 text-center animate-pulse uppercase font-mono text-[10px]">
        Opening Catalogue Stream...
      </div>
    );
  if (error)
    return (
      <div className="max-w-md mx-auto p-10 bg-white border border-red-100 industrial-border rounded-lg text-center mt-20">
        <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold uppercase tracking-tighter text-slate-900">{error}</h2>
        <Link
          to="/catalogues"
          className="inline-block mt-8 bg-charcoal text-white px-6 py-3 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800"
        >
          Return to Discovery
        </Link>
      </div>
    );

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="bg-white industrial-border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="h-40 bg-slate-900 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal to-transparent opacity-80"></div>
          <div className="absolute bottom-6 left-8">
            <div className="flex items-center gap-4 mb-2">
              <Link to="/catalogues" className="text-white/60 hover:text-white transition-colors">
                <ArrowLeft size={20} />
              </Link>
              <span className="text-orange-itred text-[10px] font-black uppercase tracking-[0.2em]">
                {vendor?.businessName} // CATALOGUE
              </span>
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tighter uppercase">
              {catalogue.title}
            </h1>
          </div>
        </div>
        <div className="p-8 flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="flex-grow space-y-4">
            <p className="text-slate-600 text-sm max-w-2xl leading-relaxed">
              {catalogue.description ||
                'Verified merchant catalogue broadcasted via iTred global network.'}
            </p>
            <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              {branch && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-orange-itred" /> {branch.city} Node Enabled
                </span>
              )}
              {vendor?.city && !branch && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-orange-itred" /> {vendor.city} Operational
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" /> SECURE MERCHANT
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsEnquiryModalOpen(true)}
            className="bg-orange-itred text-white px-8 py-5 rounded font-black uppercase tracking-widest shadow-xl shadow-orange-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 text-xs w-full md:w-auto text-center justify-center"
          >
            <MessageSquare size={20} /> Send Enquiry
          </button>
          {vendor && (
            <OrderEnquiryModal
              isOpen={isEnquiryModalOpen}
              onClose={() => setIsEnquiryModalOpen(false)}
              vendor={vendor}
              orderData={{
                vendorId: catalogue.vendorId,
                vendorName: vendor.businessName,
                source: 'catalogue',
                sourceId: catalogueId,
                items: products.map((p) => ({
                  productId: p.id,
                  name: p.name,
                  sku: p.sku || 'N/A',
                  qty: 1,
                  price: p.price,
                  lineTotal: p.price,
                  imageUrl: p.images?.[0],
                })),
                totalAmount: products.reduce((acc, p) => acc + p.price, 0),
                currency: vendor?.currency || 'USD',
              }}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Config */}
        <div className="lg:col-span-3 space-y-6 order-2 lg:order-1">
          {branch && (
            <div className="bg-white industrial-border border-slate-200 p-6 rounded-lg space-y-4">
              <h3 className="text-[10px] font-black text-orange-itred uppercase tracking-widest border-b border-slate-50 pb-2">
                Pickup Identity
              </h3>
              <div>
                <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                  {branch.name}
                </p>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{branch.type}</p>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                {branch.address}, {branch.city}
              </p>
            </div>
          )}

          {delivery.length > 0 && (
            <div className="bg-white industrial-border border-slate-200 p-6 rounded-lg space-y-4">
              <h3 className="text-[10px] font-black text-orange-itred uppercase tracking-widest border-b border-slate-50 pb-2">
                Delivery Channels
              </h3>
              <div className="space-y-3">
                {delivery.map((d, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <p className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">
                      {d.name}
                    </p>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[8px] text-slate-400 font-bold uppercase">
                        {d.coverageArea}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600">
                        ${Number(d.baseFee).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Product Inventory */}
        <div className="lg:col-span-9 space-y-6 order-1 lg:order-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="SEARCH CATALOGUE INVENTORY..."
              className="w-full bg-white border border-slate-200 p-4 pl-12 rounded industrial-border outline-none focus:ring-1 focus:ring-orange-itred text-[10px] uppercase font-black tracking-widest"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full p-20 text-center bg-slate-50 border border-dashed rounded-lg">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  No matching products in current broadcast feed.
                </p>
              </div>
            ) : (
              filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="bg-white industrial-border border-slate-200 rounded-lg overflow-hidden group shadow-sm hover:border-orange-itred/50 transition-all"
                >
                  <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden">
                    {p.images?.[0] ? (
                      <img
                        src={p.images[0]}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <Package className="w-full h-full p-10 text-slate-200" />
                    )}
                    <div className="absolute top-2 right-2 bg-slate-900/80 text-white text-[8px] font-black px-1.5 py-0.5 rounded backdrop-blur-sm uppercase">
                      {p.category}
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <h4 className="font-bold text-slate-900 uppercase tracking-tight text-sm line-clamp-1">
                        {p.name}
                      </h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest font-mono">
                        SKU ID: {p.sku || 'UNTRACKED'}
                      </p>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">
                          Inventory Price
                        </p>
                        <p className="text-xl font-bold text-slate-900 tracking-tighter">
                          ${Number(p.price).toFixed(2)}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase">
                        {p.stockQty} In Stock
                      </span>
                    </div>
                    <a
                      href={getProductWhatsApp(p)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-emerald-500 text-white p-3 rounded text-[9px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
                    >
                      <MessageSquare size={14} /> Send Inquiry
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export const VendorOrders = () => {
  const { vendorId } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    if (!vendorId) return;

    let q = query(
      collection(db, 'orders'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setOrders(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Orders sync error:', err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [vendorId]);

  const counts = {
    all: orders.length,
    submitted: orders.filter((o) => o.status === 'submitted' || o.status === 'new').length,
    accepted: orders.filter((o) => o.status === 'accepted').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    delivery: orders.filter(
      (o) => o.status === 'delivery_assigned' || o.status === 'out_for_delivery',
    ).length,
    completed: orders.filter((o) => o.status === 'completed' || o.status === 'delivery_completed')
      .length,
    rejected: orders.filter((o) => o.status === 'rejected').length,
  };

  const filteredOrders = orders.filter((o) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'submitted' && (o.status === 'submitted' || o.status === 'new')) ||
      (filter === 'delivery' &&
        (o.status === 'delivery_assigned' || o.status === 'out_for_delivery')) ||
      (filter === 'completed' && (o.status === 'completed' || o.status === 'delivery_completed')) ||
      o.status === filter;

    const matchesSearch =
      searchTerm === '' ||
      o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerPhone?.includes(searchTerm) ||
      o.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.items?.some((i: any) => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  const [deliveryServices, setDeliveryServices] = useState<any[]>([]);

  useEffect(() => {
    if (!vendorId) return;

    const qD = query(
      collection(db, 'delivery_services'),
      where('vendorId', '==', vendorId),
      where('status', '==', 'active'),
    );
    const unsubD = onSnapshot(qD, (snap) => {
      setDeliveryServices(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubD();
  }, [vendorId]);

  const generateFulfilmentCode = () => Math.floor(100000 + Math.random() * 900000).toString();

  const updateOrderStatus = async (
    orderId: string,
    newStatus: string,
    deliveryData: any = null,
    rejectionReason?: string,
  ) => {
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };

      if (rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }

      if (newStatus === 'accepted') {
        updateData.acceptedAt = serverTimestamp();
        updateData.acceptedByUid = auth.currentUser?.uid;
        updateData.acceptedByEmail = auth.currentUser?.email;
      }

      if (newStatus === 'accepted' || newStatus === 'delivery_assigned') {
        const existingOrder = orders.find((o) => o.id === orderId);
        if (!existingOrder?.fulfilmentCode) {
          updateData.fulfilmentCode = generateFulfilmentCode();
          updateData.fulfilmentCodeIssuedAt = serverTimestamp();
          updateData.fulfilmentCodeStatus = 'issued';
          updateData.fulfilmentCodeAttempts = 0;
        }
      }

      if (deliveryData) {
        updateData.deliveryServiceId = deliveryData.id;
        updateData.deliveryServiceName = deliveryData.name;
        updateData.deliveryContactPhone = deliveryData.phone || deliveryData.whatsapp || '';
        updateData.deliveryAssignedAt = serverTimestamp();
        updateData.deliveryStatus = 'assigned';
        updateData.status = 'delivery_assigned';
      }

      await updateDoc(doc(db, 'orders', orderId), updateData);

      const actionMap: Record<string, string> = {
        submitted: 'ORDER_SUBMITTED',
        accepted: 'ORDER_ACCEPTED',
        rejected: 'ORDER_REJECTED',
        preparing: 'ORDER_PREPARING',
        ready_for_pickup: 'ORDER_READY_FOR_PICKUP',
        delivery_assigned: 'ORDER_DELIVERY_ASSIGNED',
        delivery_completed: 'ORDER_DELIVERY_COMPLETED',
        completed: 'ORDER_COMPLETED',
        cancelled: 'ORDER_CANCELLED',
      };

      const action = deliveryData
        ? 'DELIVERY_ASSIGNED'
        : actionMap[newStatus] || 'ORDER_STATUS_UPDATED';

      await createAuditLog({
        action,
        targetType: 'order',
        targetId: orderId,
        vendorId: vendorId!,
        metadata: {
          orderId,
          vendorId: vendorId!,
          statusBefore: orders.find((o) => o.id === orderId)?.status,
          statusAfter: newStatus,
          actorUid: auth.currentUser?.uid,
          actorEmail: auth.currentUser?.email,
          ...(rejectionReason && { rejectionReason }),
          ...(deliveryData && {
            deliveryServiceId: deliveryData.id,
            deliveryServiceName: deliveryData.name,
          }),
        },
      });

      if (updateData.fulfilmentCode) {
        await createAuditLog({
          action: 'FULFILMENT_CODE_ISSUED',
          targetType: 'order',
          targetId: orderId,
          vendorId: vendorId!,
          metadata: {
            orderId,
            vendorId: vendorId!,
            fulfilmentCode: updateData.fulfilmentCode,
            actorUid: auth.currentUser?.uid,
            actorEmail: auth.currentUser?.email,
          },
        });
      }

      setSelectedOrder((prev) => (prev ? { ...prev, ...updateData } : null));
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  const handleResetFulfilmentCode = async (orderId: string) => {
    try {
      const newCode = generateFulfilmentCode();
      const updateData = {
        fulfilmentCode: newCode,
        fulfilmentCodeStatus: 'issued',
        fulfilmentCodeAttempts: 0,
        fulfilmentCodeReissuedAt: serverTimestamp(),
        fulfilmentCodeReissuedBy: auth.currentUser?.uid,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, 'orders', orderId), updateData);
      await createAuditLog({
        action: 'FULFILMENT_CODE_RESET',
        targetType: 'order',
        targetId: orderId,
        vendorId: vendorId!,
        metadata: {
          orderId,
          vendorId: vendorId!,
          newCode: '******', // Hidden in metadata for security, but logged
          actorUid: auth.currentUser?.uid,
          actorEmail: auth.currentUser?.email,
        },
      });
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, ...updateData });
      }
    } catch (err) {
      console.error('Code reset failed:', err);
    }
  };

  const handleSendWhatsAppUpdate = (order: any, type: any) => {
    const message = generateStatusUpdateWhatsAppMessage(order, type, {
      reason: order.rejectionReason,
    });
    const cleanPhone = safeString(order.customerPhone).replace(/\+/g, '').replace(/\s+/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');

    createAuditLog({
      action: 'WHATSAPP_UPDATE_SENT',
      targetType: 'order',
      targetId: order.id,
      vendorId: vendorId!,
      metadata: { type },
    });
  };

  const updatePaymentStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        paymentStatus: newStatus,
        updatedAt: serverTimestamp(),
      });
      await createAuditLog({
        action: 'ORDER_PAYMENT_STATUS_UPDATED',
        targetType: 'order',
        targetId: orderId,
        vendorId: vendorId!,
        metadata: { paymentStatus: newStatus },
      });
    } catch (err) {
      console.error('Payment status update failed:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: any = {
      submitted: 'bg-blue-50 text-blue-600 border-blue-100',
      new: 'bg-blue-50 text-blue-600 border-blue-100',
      accepted: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      preparing: 'bg-violet-50 text-violet-600 border-violet-100',
      delivery_assigned: 'bg-cyan-50 text-cyan-600 border-cyan-100',
      out_for_delivery: 'bg-orange-50 text-orange-600 border-orange-100',
      delivery_completed: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      completed: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      cancelled: 'bg-slate-50 text-slate-400 border-slate-100',
      rejected: 'bg-red-50 text-red-600 border-red-100',
      ready_for_pickup: 'bg-amber-50 text-amber-600 border-amber-100',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-tight ${styles[status] || styles.new}`}
      >
        {safeString(status).replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-lg industrial-border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
              Fulfillment Operations
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
              Terminal: {vendorId?.substring(0, 8)} // Real-time Order Stream
            </p>
          </div>
          <div className="w-full md:w-64 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="SEARCH ORDERS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded font-mono text-[10px] uppercase tracking-widest focus:ring-1 focus:ring-orange-itred outline-none shadow-inner"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-t border-slate-50 pt-6">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'submitted', label: 'Queued' },
            { id: 'accepted', label: 'Active' },
            { id: 'preparing', label: 'Prep' },
            { id: 'delivery', label: 'Transit' },
            { id: 'completed', label: 'History' },
            { id: 'rejected', label: 'Declined' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2.5 rounded text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap flex items-center gap-2 ${filter === tab.id ? 'bg-orange-itred text-white border-orange-itred shadow-lg shadow-orange-100' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
            >
              {tab.label}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[8px] ${filter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400'}`}
              >
                {(counts as any)[tab.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-20 text-center animate-pulse text-slate-400 uppercase font-mono text-[10px]">
          Synchronizing with Order Cluster...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg p-20 text-center">
          <Package size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            No orders matching current filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white industrial-border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    ID: {order.orderId}
                  </p>
                  <h3 className="font-bold text-slate-900 uppercase tracking-tight">
                    {order.customerName}
                  </h3>
                </div>
                {getStatusBadge(order.status)}
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      Total Value
                    </p>
                    <p className="text-lg font-bold text-slate-900">
                      ${(order.totalAmount || order.estimatedTotal)?.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      Items
                    </p>
                    <p className="text-lg font-bold text-slate-900">{order.items?.length || 0}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                  <span>{safeString(order.source).replace('_', ' ')}</span>
                  <span>{new Date(order.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                </div>
                <div className="pt-4 border-t border-slate-50 flex gap-2">
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="flex-1 bg-charcoal text-white py-2.5 rounded text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    View Protocol
                  </button>
                  <a
                    href={`https://wa.me/${safeString(order.customerPhone).replace(/\+/g, '').replace(/\s+/g, '')}?text=${encodeURIComponent(order.whatsappMessage || '')}`}
                    target="_blank"
                    className="p-2.5 bg-[#25D366] text-white rounded hover:scale-105 transition-transform flex items-center justify-center shadow-lg shadow-emerald-50"
                  >
                    <MessageSquare size={16} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white industrial-border border-slate-200 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tighter">
                  Order Protocol Details
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Ref No: {selectedOrder.orderId}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-1">
                      Customer Profile
                    </h4>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-900 uppercase">
                        {selectedOrder.customerName}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {selectedOrder.customerPhone || selectedOrder.customerWhatsApp}
                      </p>
                      <p className="text-xs text-slate-500">{selectedOrder.customerLocation}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-1">
                      Logistics
                    </h4>
                    <p className="text-[10px] font-bold text-orange-itred uppercase">
                      {safeString(selectedOrder.preferredFulfillment).replace('_', ' ')}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      Fulfillment Type
                    </p>
                    <p
                      className={`text-[10px] font-bold uppercase ${selectedOrder.preferredFulfillment === 'delivery' ? 'text-orange-itred' : 'text-slate-600'}`}
                    >
                      {selectedOrder.preferredFulfillment === 'delivery' ? (
                        <Truck size={10} className="inline mr-1" />
                      ) : (
                        <Package size={10} className="inline mr-1" />
                      )}
                      {safeString(selectedOrder.preferredFulfillment).replace('_', ' ')}
                    </p>
                  </div>

                  {selectedOrder.fulfilmentCode && (
                    <div className="bg-slate-900 p-4 rounded border border-slate-700 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                          Secret Fulfilment Code
                        </p>
                        <button
                          onClick={() => handleResetFulfilmentCode(selectedOrder.id)}
                          className="text-[8px] font-bold text-orange-itred uppercase border border-orange-itred/20 px-1 rounded hover:bg-orange-itred/5"
                        >
                          Reset Code
                        </button>
                      </div>
                      <p className="text-2xl font-black text-white font-mono tracking-widest leading-none">
                        {selectedOrder.fulfilmentCode}
                      </p>
                      <div className="flex justify-between items-center pt-2">
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                          Status: {selectedOrder.fulfilmentCodeStatus || 'issued'}
                        </p>
                        <button
                          onClick={() => handleSendWhatsAppUpdate(selectedOrder, 'fulfilment_code')}
                          className="text-[8px] font-black text-[#25D366] uppercase flex items-center gap-1"
                        >
                          <MessageSquare size={10} /> Send Code
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Protocol Execution
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedOrder.status === 'submitted' || selectedOrder.status === 'new' ? (
                        <>
                          <button
                            onClick={async () => {
                              await updateOrderStatus(selectedOrder.id, 'accepted');
                              handleSendWhatsAppUpdate(selectedOrder, 'accepted');
                            }}
                            className="bg-emerald-600 text-white p-3 rounded text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700"
                          >
                            Accept & Notify
                          </button>
                          <button
                            onClick={async () => {
                              const reason = window.prompt('Reason for rejection:');
                              if (reason) {
                                await updateOrderStatus(selectedOrder.id, 'rejected', null, reason);
                                handleSendWhatsAppUpdate(
                                  { ...selectedOrder, rejectionReason: reason },
                                  'rejected',
                                );
                              }
                            }}
                            className="bg-red-50 text-red-600 p-3 rounded text-[9px] font-black uppercase tracking-widest border border-red-100 hover:bg-red-100"
                          >
                            Decline
                          </button>
                        </>
                      ) : selectedOrder.status === 'accepted' ? (
                        <>
                          <button
                            onClick={async () => {
                              await updateOrderStatus(selectedOrder.id, 'preparing');
                              handleSendWhatsAppUpdate(selectedOrder, 'preparing');
                            }}
                            className="bg-violet-600 text-white p-3 rounded text-[9px] font-black uppercase tracking-widest shadow-lg shadow-violet-100"
                          >
                            Mark Preparing
                          </button>
                          <button
                            onClick={() => updateOrderStatus(selectedOrder.id, 'cancelled')}
                            className="bg-slate-100 text-slate-400 p-3 rounded text-[9px] font-black uppercase tracking-widest"
                          >
                            Cancel
                          </button>
                        </>
                      ) : selectedOrder.status === 'preparing' ? (
                        <>
                          {selectedOrder.preferredFulfillment === 'delivery' ? (
                            <div className="col-span-2 space-y-2">
                              <select
                                onChange={(e) => {
                                  const service = deliveryServices.find(
                                    (s) => s.id === e.target.value,
                                  );
                                  if (service) {
                                    updateOrderStatus(
                                      selectedOrder.id,
                                      'delivery_assigned',
                                      service,
                                    );
                                    handleSendWhatsAppUpdate(
                                      { ...selectedOrder, ...service },
                                      'delivery',
                                    );
                                  }
                                }}
                                className="w-full industrial-border border-slate-200 p-3 text-[10px] rounded font-black uppercase tracking-widest bg-orange-itred text-white"
                              >
                                <option value="">DISPATCH (SELECT COURIER)</option>
                                {deliveryServices.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <button
                              onClick={async () => {
                                await updateOrderStatus(selectedOrder.id, 'ready_for_pickup');
                                handleSendWhatsAppUpdate(selectedOrder, 'pickup');
                              }}
                              className="col-span-2 bg-amber-500 text-white p-3 rounded text-[9px] font-black uppercase tracking-widest shadow-lg shadow-amber-100"
                            >
                              Ready for Pickup
                            </button>
                          )}
                        </>
                      ) : selectedOrder.status === 'delivery_assigned' ||
                        selectedOrder.status === 'out_for_delivery' ? (
                        <div className="col-span-2 space-y-2">
                          <button
                            onClick={() => handleSendWhatsAppUpdate(selectedOrder, 'delivery')}
                            className="w-full bg-[#25D366] text-white p-3 rounded text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                          >
                            <MessageSquare size={14} /> Re-send Delivery Code
                          </button>
                          {selectedOrder.fulfilmentCodeStatus === 'locked' && (
                            <button
                              onClick={() => handleResetFulfilmentCode(selectedOrder.id)}
                              className="w-full bg-orange-50 text-orange-600 p-3 rounded text-[9px] font-black uppercase tracking-widest border border-orange-100"
                            >
                              Reset Security Lock
                            </button>
                          )}
                        </div>
                      ) : selectedOrder.status === 'ready_for_pickup' ||
                        selectedOrder.status === 'delivery_completed' ? (
                        <button
                          onClick={async () => {
                            await updateOrderStatus(selectedOrder.id, 'completed');
                            handleSendWhatsAppUpdate(selectedOrder, 'completed');
                          }}
                          className="col-span-2 bg-charcoal text-white p-4 rounded text-[10px] font-black uppercase tracking-widest shadow-xl"
                        >
                          Finalize Order (Complete)
                        </button>
                      ) : (
                        <p className="col-span-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center py-2 bg-slate-50 border border-slate-100 rounded">
                          Protocol Lifecycle Terminated
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-8 border-t border-slate-100">
                <div className="space-y-6">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-50 pb-1">
                    Billed Items
                  </h4>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-100"
                      >
                        <div className="flex gap-3 items-center">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="w-8 h-8 rounded object-cover border border-slate-200"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div>
                            <p className="text-[10px] font-bold text-slate-900 uppercase tracking-tight">
                              {item.name}
                            </p>
                            <p className="text-[9px] text-slate-400 font-mono">
                              SKU: {item.sku} | Qty: {item.qty}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs font-bold text-slate-900">
                          ${(item.price * item.qty).toFixed(2)}
                        </p>
                      </div>
                    ))}
                    <div className="flex justify-between items-center p-4 pt-6 mt-2 border-t border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Total Invoice Amount
                      </p>
                      <p className="text-2xl font-bold text-slate-900 tracking-tighter">
                        ${(selectedOrder.totalAmount || selectedOrder.estimatedTotal)?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Quick Status Shift (Overwrite)
                    </label>
                    <select
                      value={selectedOrder.status}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        updateOrderStatus(selectedOrder.id, newStatus);
                        setSelectedOrder({
                          ...selectedOrder,
                          status: newStatus,
                        });
                      }}
                      className="w-full industrial-border border-slate-200 p-3 text-sm rounded font-bold uppercase tracking-tight bg-white outline-none focus:ring-1 focus:ring-orange-itred"
                    >
                      <option value="submitted">SUBMITTED</option>
                      <option value="accepted">ACCEPTED</option>
                      <option value="rejected">REJECTED</option>
                      <option value="preparing">PREPARING</option>
                      <option value="ready_for_pickup">READY FOR PICKUP</option>
                      <option value="delivery_assigned">DELIVERY ASSIGNED</option>
                      <option value="out_for_delivery">OUT FOR DELIVERY</option>
                      <option value="delivery_completed">DELIVERY COMPLETED</option>
                      <option value="completed">ORDER COMPLETED</option>
                      <option value="cancelled">CANCELLED</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Payment Status
                    </label>
                    <select
                      value={selectedOrder.paymentStatus}
                      onChange={(e) => {
                        updatePaymentStatus(selectedOrder.id, e.target.value);
                        setSelectedOrder({
                          ...selectedOrder,
                          paymentStatus: e.target.value,
                        });
                      }}
                      className="w-full industrial-border border-slate-200 p-3 text-sm rounded font-bold uppercase tracking-tight bg-white outline-none focus:ring-1 focus:ring-orange-itred"
                    >
                      <option value="unpaid">UNPAID / PENDING</option>
                      <option value="partial">PARTIAL PAYMENT</option>
                      <option value="paid">PAID IN FULL</option>
                      <option value="not_required">NOT REQUIRED</option>
                    </select>
                  </div>

                  {selectedOrder.customerNotes && (
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Quote size={12} /> Customer Internal Notes
                      </p>
                      <p className="text-xs text-amber-800 leading-relaxed italic">
                        "{selectedOrder.customerNotes}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export const VendorStaff = () => {
  const { vendorId } = useAuth();
  const { checkQuota } = useSubscription();
  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<any>('viewer');
  const [assignedBranchId, setAssignedBranchId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [status, setStatus] = useState<any>('active');

  const rolePermissionsSuggestions: Record<string, string[]> = {
    manager: [
      'vendor.manage',
      'products.create',
      'products.edit',
      'inventory.manage',
      'orders.manage',
      'catalogues.manage',
      'branches.manage',
      'delivery.manage',
      'staff.view',
    ],
    cashier: ['orders.manage', 'products.view'],
    inventory_clerk: ['products.create', 'products.edit', 'inventory.manage'],
    catalogue_assistant: ['catalogues.manage', 'products.view'],
    order_handler: ['orders.manage', 'products.view'],
    viewer: ['products.view', 'orders.view', 'catalogues.view'],
  };

  const allPermissions = [
    { id: 'vendor.manage', label: 'Vendor Management' },
    { id: 'products.create', label: 'Create Products' },
    { id: 'products.edit', label: 'Edit Products' },
    { id: 'products.view', label: 'View Products' },
    { id: 'inventory.manage', label: 'Inventory Management' },
    { id: 'orders.manage', label: 'Manage Orders' },
    { id: 'orders.view', label: 'View Orders' },
    { id: 'catalogues.manage', label: 'Manage Catalogues' },
    { id: 'catalogues.view', label: 'View Catalogues' },
    { id: 'branches.manage', label: 'Manage Branches' },
    { id: 'delivery.manage', label: 'Manage Delivery' },
    { id: 'staff.view', label: 'View Staff' },
    { id: 'pos.view', label: 'Access POS Dashboard' },
    { id: 'pos.terminal', label: 'Access Terminal Screen' },
    { id: 'pos.shift.open', label: 'Open Station Shifts' },
    { id: 'pos.shift.close', label: 'Close Station Shifts' },
    { id: 'pos.sale.create', label: 'Create POS Sales' },
    { id: 'pos.sale.refund', label: 'Process POS Refunds' },
    { id: 'pos.settings.manage', label: 'Manage POS Settings' },
  ];

  useEffect(() => {
    if (!vendorId) return;

    const qStaff = query(
      collection(db, 'staff'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc'),
    );
    const unsubscribeStaff = onSnapshot(qStaff, (snapshot) => {
      setStaff(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const qBranches = query(collection(db, 'branches'), where('vendorId', '==', vendorId));
    const unsubscribeBranches = onSnapshot(qBranches, (snapshot) => {
      setBranches(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeStaff();
      unsubscribeBranches();
    };
  }, [vendorId]);

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    setPermissions(rolePermissionsSuggestions[newRole] || []);
  };

  const togglePermission = (permId: string) => {
    setPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId],
    );
  };

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setRole('viewer');
    setAssignedBranchId('');
    setPermissions(rolePermissionsSuggestions['viewer']);
    setStatus('active');
    setEditingStaff(null);
    setError(null);
  };

  const openEditModal = (s: any) => {
    setError(null);
    setEditingStaff(s);
    setFullName(s.fullName);
    setEmail(s.email);
    setPhone(s.phone || '');
    setRole(s.role);
    setAssignedBranchId(s.assignedBranchId || '');
    setPermissions(s.permissions || []);
    setStatus(s.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) return;

    if (!editingStaff) {
      const quota = checkQuota('staff');
      if (!quota.allowed) {
        setError(quota.message!);
        return;
      }
    }

    const staffId = editingStaff ? editingStaff.id : `STF-${Date.now()}`;
    const staffData = {
      staffId,
      vendorId,
      fullName,
      email,
      phone,
      role,
      assignedBranchId,
      permissions,
      status,
      inviteStatus: editingStaff ? editingStaff.inviteStatus : 'draft',
      updatedAt: serverTimestamp(),
      ...(editingStaff ? {} : { createdAt: serverTimestamp() }),
    };

    try {
      await setDoc(doc(db, 'staff', staffId), staffData, { merge: true });
      await createAuditLog({
        action: editingStaff ? 'STAFF_UPDATED' : 'STAFF_CREATED',
        targetType: 'staff',
        targetId: staffId,
        vendorId,
      });
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Staff save error:', err);
      handleFirestoreError(err, OperationType.WRITE, 'staff');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('ARE YOU SURE YOU WANT TO TERMINATE THIS STAFF RECORD?')) return;
    try {
      await deleteDoc(doc(db, 'staff', id));
      await createAuditLog({
        action: 'STAFF_DELETED',
        targetType: 'staff',
        targetId: id,
        vendorId: vendorId!,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'staff');
    }
  };

  const handlePrepareInvite = async (s: any) => {
    try {
      await updateDoc(doc(db, 'staff', s.id), {
        inviteStatus: 'invited',
        updatedAt: serverTimestamp(),
      });
      await createAuditLog({
        action: 'STAFF_INVITE_PREPARED',
        targetType: 'staff',
        targetId: s.id,
        vendorId: vendorId!,
      });
      alert('Invite prepared. Email/SMS sending will be added in a later phase.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'staff');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-lg industrial-border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
            Staff Registry
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            Operational Access Management // Secure Node
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-orange-itred text-white px-6 py-3 rounded font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-[#d96a1a] transition-all"
        >
          <Plus size={16} /> Enroll New Staff
        </button>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-100 rounded flex gap-3 items-start animate-in fade-in duration-500">
        <ShieldCheck className="text-blue-500 mt-1 flex-shrink-0" size={18} />
        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-tight leading-relaxed">
          Staff records are created here first. Login access for staff will be connected in a later
          phase using vendorUsers and Firebase Auth.
        </p>
      </div>

      {loading ? (
        <div className="p-20 text-center animate-pulse text-slate-400 uppercase font-mono text-[10px]">
          Synchronizing with Staff Cluster...
        </div>
      ) : staff.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg p-20 text-center">
          <Users size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            No staff records created yet. Add staff who will support your store operations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staff.map((s) => (
            <div
              key={s.id}
              className="bg-white industrial-border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-start">
                <div className="overflow-hidden">
                  <h3 className="font-bold text-slate-900 uppercase tracking-tight truncate">
                    {s.fullName}
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                    {s.email}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-tight ${
                    s.status === 'active'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : s.status === 'inactive'
                        ? 'bg-slate-50 text-slate-400 border-slate-100'
                        : 'bg-red-50 text-red-600 border-red-100'
                  }`}
                >
                  {s.status}
                </span>
              </div>
              <div className="p-5 flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      Role
                    </p>
                    <p className="text-[10px] font-bold text-orange-itred uppercase tracking-tighter">
                      {safeString(s.role).replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      Branch
                    </p>
                    <p className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter">
                      {branches.find((b) => b.id === s.assignedBranchId)?.branchName ||
                        'GLOBAL / ALL'}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    Phone
                  </p>
                  <p className="text-[10px] font-bold text-slate-600">{s.phone || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    Invite Status
                  </p>
                  <span
                    className={`text-[9px] font-bold uppercase ${s.inviteStatus === 'invited' ? 'text-blue-600' : 'text-slate-400'}`}
                  >
                    {s.inviteStatus || 'DRAFT'}
                  </span>
                </div>

                <div className="pt-4 border-t border-slate-50 flex flex-wrap gap-2">
                  <button
                    onClick={() => openEditModal(s)}
                    className="flex-1 bg-slate-100 text-slate-600 py-2 rounded text-[9px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                  >
                    <Edit size={12} /> Configure
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                  {s.inviteStatus !== 'invited' && s.inviteStatus !== 'accepted' && (
                    <button
                      onClick={() => handlePrepareInvite(s)}
                      className="w-full bg-blue-600 text-white py-2 rounded text-[9px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors mt-1"
                    >
                      Prepare Invite
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white industrial-border border-slate-200 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tighter">
                  {editingStaff ? 'Edit Staff Protocol' : 'Enroll New Staff'}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Access Configuration Level 2
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full industrial-border border-slate-200 p-3 text-sm focus:ring-1 focus:ring-orange-itred outline-none rounded"
                    placeholder="Staff Full Name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full industrial-border border-slate-200 p-3 text-sm focus:ring-1 focus:ring-orange-itred outline-none rounded"
                    placeholder="staff@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full industrial-border border-slate-200 p-3 text-sm focus:ring-1 focus:ring-orange-itred outline-none rounded"
                    placeholder="+263..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full industrial-border border-slate-200 p-3 text-sm rounded font-bold uppercase tracking-tight bg-white outline-none focus:ring-1 focus:ring-orange-itred"
                  >
                    <option value="active">ACTIVE</option>
                    <option value="inactive">INACTIVE</option>
                    <option value="suspended">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Functional Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full industrial-border border-slate-200 p-3 text-sm rounded font-bold uppercase tracking-tight bg-white outline-none focus:ring-1 focus:ring-orange-itred"
                  >
                    <option value="manager">MANAGER</option>
                    <option value="cashier">CASHIER</option>
                    <option value="inventory_clerk">INVENTORY CLERK</option>
                    <option value="catalogue_assistant">CATALOGUE ASSISTANT</option>
                    <option value="order_handler">ORDER HANDLER</option>
                    <option value="viewer">VIEWER ONLY</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Assigned Branch
                  </label>
                  {branches.length === 0 ? (
                    <p className="text-[10px] font-bold text-orange-itred uppercase py-3 italic">
                      No branches available. Create a branch first.
                    </p>
                  ) : (
                    <select
                      value={assignedBranchId}
                      onChange={(e) => setAssignedBranchId(e.target.value)}
                      className="w-full industrial-border border-slate-200 p-3 text-sm rounded font-bold uppercase tracking-tight bg-white outline-none focus:ring-1 focus:ring-orange-itred"
                    >
                      <option value="">ALL / GLOBAL ACCESS</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.branchName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Granular Permissions
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 p-4 rounded border border-slate-100 max-h-[200px] overflow-y-auto">
                  {allPermissions.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer transition-colors border border-transparent hover:border-slate-100"
                    >
                      <input
                        type="checkbox"
                        checked={permissions.includes(p.id)}
                        onChange={() => togglePermission(p.id)}
                        className="w-4 h-4 accent-orange-itred"
                      />
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">
                        {p.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="w-full bg-orange-itred text-white p-4 rounded font-bold uppercase tracking-widest hover:bg-[#d96a1a] transition-all flex justify-center items-center gap-2"
                >
                  {editingStaff ? 'Update Protocol' : 'Finalize Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
const generateRPNCode = (form: any) => {
  const roleMap: Record<string, string> = {
    junior_rpn: 'JNR',
    leader_rpn: 'LEAD',
    imm: 'IMM',
  };
  const role = roleMap[form.role] || 'AGT';
  const shortName = safeString(form?.fullName?.split(' ')[0])
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const last4 =
    (form.phone || '').replace(/[^0-9]/g, '').slice(-4) ||
    Math.floor(1000 + Math.random() * 9000).toString();
  return `RPN-${role}-${shortName}-${last4}`;
};

export const ConsoleRPNPage = () => {
  const { user, hasPermission } = useAuth();
  const [rpns, setRpns] = useState<RPNAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRpn, setEditingRpn] = useState<RPNAgent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    whatsapp: '',
    city: '',
    district: '',
    suburb: '',
    role: 'junior_rpn' as any,
    status: 'active' as any,
    leaderRpnId: '',
    serviceArea: '',
  });

  useEffect(() => {
    const q = query(collection(db, 'rpn_agents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRpns(snapshot.docs.map((doc) => ({ rpnId: doc.id, ...doc.data() }) as RPNAgent));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenModal = (rpn: RPNAgent | null = null) => {
    setError(null);
    if (rpn) {
      setEditingRpn(rpn);
      setForm({
        fullName: rpn.fullName || '',
        email: rpn.email || '',
        phone: rpn.phone || '',
        whatsapp: rpn.whatsapp || '',
        city: rpn.city || '',
        district: rpn.district || '',
        suburb: rpn.suburb || '',
        role: rpn.role || 'junior_rpn',
        status: rpn.status || 'active',
        leaderRpnId: rpn.leaderRpnId || '',
        serviceArea: rpn.serviceArea || '',
      });
    } else {
      setEditingRpn(null);
      setForm({
        fullName: '',
        email: '',
        phone: '',
        whatsapp: '',
        city: '',
        district: '',
        suburb: '',
        role: 'junior_rpn',
        status: 'active',
        leaderRpnId: '',
        serviceArea: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data: any = {
        ...form,
        updatedAt: serverTimestamp(),
        createdBy: user?.uid || 'system',
      };

      if (editingRpn) {
        // If rpnCode is missing, don't force it unless regenerating,
        // but usually we keep it if it exists
        await updateDoc(doc(db, 'rpn_agents', editingRpn.rpnId), data);
        await createAuditLog({
          action: 'RPN_UPDATED',
          targetType: 'rpn_agent',
          targetId: editingRpn.rpnId,
          metadata: { fullName: form.fullName },
        });
      } else {
        // Generate code for new enrollment
        data.rpnCode = generateRPNCode(form);
        const docRef = await addDoc(collection(db, 'rpn_agents'), {
          ...data,
          createdAt: serverTimestamp(),
        });
        await createAuditLog({
          action: 'RPN_CREATED',
          targetType: 'rpn_agent',
          targetId: docRef.id,
          metadata: { fullName: form.fullName, rpnCode: data.rpnCode },
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('RPN Save Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (rpn: RPNAgent) => {
    const newStatus = rpn.status === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'rpn_agents', rpn.rpnId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      await createAuditLog({
        action: newStatus === 'suspended' ? 'RPN_SUSPENDED' : 'RPN_REACTIVATED',
        targetType: 'rpn_agent',
        targetId: rpn.rpnId,
        metadata: { fullName: rpn.fullName },
      });
    } catch (err) {
      console.error('RPN Status error:', err);
    }
  };

  const handleBackfillCode = async (rpn: RPNAgent) => {
    const rpnCode = generateRPNCode(rpn);
    try {
      await updateDoc(doc(db, 'rpn_agents', rpn.rpnId), {
        rpnCode,
        updatedAt: serverTimestamp(),
      });
      await createAuditLog({
        action: 'RPN_CODE_GENERATED',
        targetType: 'rpn_agent',
        targetId: rpn.rpnId,
        metadata: { rpnCode },
      });
    } catch (err) {
      console.error('Backfill failed:', err);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`COPIED: ${text}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg industrial-border shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter uppercase text-slate-900">
            RPN Network Manager
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Growth & Attribution Core
          </p>
        </div>
        {hasPermission('rpn.manage') && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-orange-itred text-white h-11 px-6 rounded font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-[#d96a1a] transition-all"
          >
            <Plus size={16} /> Enroll Agent
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rpns.map((rpn) => (
          <div
            key={rpn.rpnId}
            className="bg-white industrial-border border-slate-200 p-6 rounded shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
          >
            <div
              className={`absolute top-0 right-0 w-2 h-full ${rpn.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}
            ></div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-900 tracking-tight">
                  {rpn.fullName}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {safeString(rpn.role).replace('_', ' ')} // {rpn.city}
                </p>
              </div>
              <span
                className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                  rpn.status === 'active'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-red-50 text-red-600 border-red-100'
                }`}
              >
                {rpn.status}
              </span>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <MessageSquare size={12} className="text-slate-400" />
                <span>{rpn.whatsapp || rpn.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Globe size={12} className="text-slate-400" />
                <span>{rpn.serviceArea || 'General Africa'}</span>
              </div>
            </div>

            {rpn.rpnCode ? (
              <div className="bg-slate-50 border border-slate-100 p-2 rounded flex justify-between items-center mb-6">
                <span className="text-[10px] font-mono font-black text-slate-900">
                  {rpn.rpnCode}
                </span>
                <button
                  onClick={() => handleCopy(rpn.rpnCode!)}
                  className="text-slate-400 hover:text-orange-itred transition-colors"
                >
                  <Copy size={12} />
                </button>
              </div>
            ) : (
              <div className="mb-6">
                {hasPermission('rpn.manage') && (
                  <button
                    onClick={() => handleBackfillCode(rpn)}
                    className="w-full py-2 bg-orange-50 text-orange-itred border border-orange-100 rounded text-[9px] font-black uppercase tracking-widest hover:bg-orange-100 transition-all"
                  >
                    Generate System Code
                  </button>
                )}
              </div>
            )}
            <div className="pt-4 border-t border-slate-50 flex gap-2">
              <Link
                to={`/console/rpn/${rpn.rpnId}`}
                className="flex-1 bg-slate-50 text-slate-900 text-center py-2 rounded text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 border border-slate-100"
              >
                Performance
              </Link>
              {hasPermission('rpn.manage') && (
                <>
                  <button
                    onClick={() => handleOpenModal(rpn)}
                    className="p-2 text-slate-400 hover:text-blue-600 border border-slate-50 rounded"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => toggleStatus(rpn)}
                    className={`p-2 border border-slate-50 rounded ${rpn.status === 'active' ? 'text-red-400 hover:text-red-600' : 'text-emerald-400 hover:text-emerald-600'}`}
                  >
                    <Shield size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="text-center py-12">
          <Loader2 className="animate-spin inline-block text-orange-itred" />
        </div>
      )}
      {!loading && rpns.length === 0 && (
        <div className="text-center py-20 bg-white border-2 border-dashed border-slate-100 rounded-lg">
          <Users size={48} className="mx-auto text-slate-100 mb-4" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            No RPN agents identified in system.
          </p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white industrial-border border-slate-200 rounded shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">
                  {editingRpn ? 'Modify Agent Profile' : 'New Agent Enrollment'}
                </h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  Network Protocol v2.1
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-[10px] font-bold uppercase tracking-widest">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    RPN Referral Code (Read Only)
                  </label>
                  <div className="w-full bg-slate-100 border border-slate-200 p-3 rounded text-xs font-mono font-black text-slate-600">
                    {editingRpn?.rpnCode || 'AUTO-GENERATED ON ENROLLMENT'}
                  </div>
                </div>
                {editingRpn && hasPermission('super_admin') && (
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={async () => {
                        const newCode = generateRPNCode(form);
                        await updateDoc(doc(db, 'rpn_agents', editingRpn.rpnId), {
                          rpnCode: newCode,
                          updatedAt: serverTimestamp(),
                        });
                        await createAuditLog({
                          action: 'RPN_CODE_REGENERATED',
                          targetType: 'rpn_agent',
                          targetId: editingRpn.rpnId,
                          metadata: { rpnCode: newCode },
                        });
                        setEditingRpn({ ...editingRpn, rpnCode: newCode });
                      }}
                      className="text-[9px] font-black uppercase text-orange-itred hover:underline"
                    >
                      Force Regenerate
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Full Legal Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-sm focus:border-orange-itred outline-none"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-sm focus:border-orange-itred outline-none"
                    placeholder="j.doe@network.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-sm focus:border-orange-itred outline-none"
                    placeholder="+263..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-sm focus:border-orange-itred outline-none"
                    placeholder="+263..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Role Tier
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-xs font-bold uppercase outline-none"
                  >
                    <option value="junior_rpn">Junior RPN</option>
                    <option value="leader_rpn">Leader RPN</option>
                    <option value="imm">IMM Agent</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-xs font-bold uppercase outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Service Area
                  </label>
                  <input
                    type="text"
                    value={form.serviceArea}
                    onChange={(e) => setForm({ ...form, serviceArea: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-sm outline-none"
                    placeholder="Harare CBD"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-sm"
                  placeholder="City"
                />
                <input
                  type="text"
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-sm"
                  placeholder="District"
                />
                <input
                  type="text"
                  value={form.suburb}
                  onChange={(e) => setForm({ ...form, suburb: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-sm"
                  placeholder="Suburb"
                />
              </div>
              {form.role === 'junior_rpn' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Assigned Leader RPN
                  </label>
                  <select
                    value={form.leaderRpnId}
                    onChange={(e) => setForm({ ...form, leaderRpnId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-xs font-bold uppercase outline-none"
                  >
                    <option value="">No Leader Assigned</option>
                    {rpns
                      .filter((r) => r.role === 'leader_rpn')
                      .map((l) => (
                        <option key={l.rpnId} value={l.rpnId}>
                          {l.fullName}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-itred text-white p-4 rounded font-black uppercase tracking-widest text-[11px] hover:bg-[#d96a1a] transition-all flex justify-center items-center gap-2 shadow-lg shadow-orange-100"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                  {editingRpn ? 'Authorized Update' : 'Initialize Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const ConsoleRPNDetailPage = () => {
  const { rpnId } = useParams();
  const [rpn, setRpn] = useState<RPNAgent | null>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalVendors: 0,
    activeSubs: 0,
    pendingActivations: 0,
    totalRevenue: 0,
    estCommission: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rpnId) return;
    const fetchRpn = async () => {
      const docSnap = await getDoc(doc(db, 'rpn_agents', rpnId));
      if (docSnap.exists()) {
        setRpn({ rpnId: docSnap.id, ...docSnap.data() } as RPNAgent);
      }
    };

    const qVendors = query(collection(db, 'vendors'), where('rpnId', '==', rpnId));
    const unsubscribeVendors = onSnapshot(qVendors, (snapshot) => {
      const vendorList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setVendors(vendorList);

      // Calculate stats (rough estimate for now)
      const active = vendorList.filter((v: any) => v.subscriptionStatus === 'active').length;
      const pending = vendorList.filter(
        (v: any) => v.subscriptionStatus === 'pending_activation',
      ).length;

      // Revenue needs to come from finance or subscription history
      // For now, let's just use what's on the vendor if we have it
      let revenue = 0;
      vendorList.forEach((v: any) => {
        revenue += v.totalSubscriptionPaid || 0;
      });

      setStats({
        totalVendors: snapshot.size,
        activeSubs: active,
        pendingActivations: pending,
        totalRevenue: revenue,
        estCommission: revenue * 0.12, // 12% placeholder
      });
      setLoading(false);
    });

    fetchRpn();
    return () => unsubscribeVendors();
  }, [rpnId]);

  if (loading)
    return (
      <div className="text-center py-20">
        <Loader2 className="animate-spin inline-block text-orange-itred" />
      </div>
    );
  if (!rpn) return <div className="text-center py-20">Agent Not Found</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link
          to="/console/rpn"
          className="p-2 bg-white industrial-border border-slate-200 rounded text-slate-400 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
            Agent Performance View
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            RPN Network / <span className="text-slate-900">{rpn.fullName}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded industrial-border border-slate-200 shadow-sm relative overflow-hidden">
            <div
              className={`absolute top-0 left-0 w-full h-1 ${rpn.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}
            ></div>
            <div className="mb-6">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-1">
                Agent Profile
              </h3>
              <div className="w-16 h-16 bg-slate-50 rounded-lg flex items-center justify-center text-xl font-black text-slate-300 border border-slate-100 mb-4">
                {rpn.fullName.substring(0, 2).toUpperCase()}
              </div>
              <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
                {rpn.fullName}
              </h4>
              <p className="text-[10px] font-bold text-orange-itred uppercase tracking-widest">
                {safeString(rpn.role).replace('_', ' ')}
              </p>
            </div>
            <div className="space-y-4 pt-6 border-t border-slate-50">
              <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  Location Concentration
                </p>
                <p className="text-[10px] font-bold text-slate-600">
                  {rpn.city}, {rpn.suburb}
                </p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  Contact Identity
                </p>
                <p className="text-[10px] font-bold text-slate-600">{rpn.phone}</p>
                <p className="text-[9px] text-slate-400 font-mono">{rpn.email}</p>
              </div>
            </div>
          </div>

          <div className="bg-charcoal p-8 rounded industrial-border shadow-2xl space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2">
              Estimated Commissions
            </h3>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Accumulated Total
              </p>
              <p className="text-2xl font-black text-white tracking-tighter">
                ${stats.estCommission.toFixed(2)}
              </p>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1 italic">
                Pending Approval
              </p>
            </div>
            <div className="pt-4 space-y-2">
              <p className="text-[8px] font-bold text-slate-500 uppercase leading-relaxed">
                Commission is calculated at 12% for onboardings and 8% for renewals. Payments
                processed monthly.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard label="Direct Vendors" value={stats.totalVendors} icon={Store} color="blue" />
            <StatCard
              label="Active Subs"
              value={stats.activeSubs}
              icon={ShieldCheck}
              color="emerald"
            />
            <StatCard
              label="Pending Act"
              value={stats.pendingActivations}
              icon={Clock}
              color="orange"
            />
            <StatCard
              label="Net Revenue"
              value={`$${stats.totalRevenue.toFixed(0)}`}
              icon={DollarSign}
              color="slate"
            />
          </div>

          <div className="bg-white rounded industrial-border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">
                Assigned Merchant Registry
              </h3>
              <span className="text-[9px] font-bold text-slate-400 uppercase">
                {vendors.length} Records Detected
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Merchant
                    </th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Plan
                    </th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Status
                    </th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">
                      Contributed Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v: any) => (
                    <tr
                      key={v.id}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 leading-none">
                        <p className="text-[10px] font-black text-slate-900 uppercase">
                          {v.businessName}
                        </p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-1">
                          {v.city || 'Zimbabwe'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-600 uppercase">
                        {v.planCode || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                            v.subscriptionStatus === 'active'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                        >
                          {v.subscriptionStatus || 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-black text-slate-900">
                        ${(v.totalSubscriptionPaid || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {vendors.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-[10px] font-bold text-slate-400 uppercase italic"
                      >
                        No vendors attributed to this agent yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ConsoleRPNVerificationPage = () => {
  const { user, hasPermission } = useAuth();
  const [vendors, setVendors] = useState<any[]>([]);
  const [agents, setAgents] = useState<RPNAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch pending vendors
    const qVendors = query(
      collection(db, 'vendors'),
      where('rpnStatus', '==', 'pending_verification'),
    );
    const unsubVendors = onSnapshot(qVendors, (snap) => {
      setVendors(
        snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as any)
          .filter((v: any) => v.rpnReferralCode),
      );
      setLoading(false);
    });

    // Fetch active agents for selection
    const qAgents = query(collection(db, 'rpn_agents'), where('status', '==', 'active'));
    const unsubAgents = onSnapshot(qAgents, (snap) => {
      setAgents(snap.docs.map((doc) => ({ rpnId: doc.id, ...doc.data() }) as RPNAgent));
    });

    return () => {
      unsubVendors();
      unsubAgents();
    };
  }, []);

  const handleApprove = async () => {
    if (!selectedVendor || !selectedAgentId) return;
    setLoading(true);
    setError(null);

    const agent = agents.find((a) => a.rpnId === selectedAgentId);
    if (!agent) {
      setError('Selected agent not found');
      setLoading(false);
      return;
    }

    try {
      const batch = writeBatch(db);
      const rpnData = {
        rpnId: agent.rpnId,
        rpnCode: agent.rpnCode,
        rpnName: agent.fullName,
        rpnStatus: 'verified',
        rpnVerifiedAt: serverTimestamp(),
        rpnVerifiedBy: user?.uid,
        updatedAt: serverTimestamp(),
      };

      batch.update(doc(db, 'vendors', selectedVendor.id), rpnData);
      batch.update(doc(db, 'app_users', selectedVendor.id), rpnData);

      await batch.commit();

      await createAuditLog({
        action: 'RPN_REFERRAL_VERIFIED',
        targetType: 'vendor',
        targetId: selectedVendor.id,
        metadata: {
          rpnId: agent.rpnId,
          rpnCode: agent.rpnCode,
          vendorName: selectedVendor.businessName,
        },
      });

      setIsApproveModalOpen(false);
      setSelectedVendor(null);
      setSelectedAgentId('');
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedVendor) return;
    setLoading(true);
    setError(null);

    try {
      const batch = writeBatch(db);
      const rpnData = {
        rpnStatus: 'rejected',
        rpnRejectedAt: serverTimestamp(),
        rpnRejectedBy: user?.uid,
        rpnRejectionReason: rejectReason,
        updatedAt: serverTimestamp(),
      };

      batch.update(doc(db, 'vendors', selectedVendor.id), rpnData);
      batch.update(doc(db, 'app_users', selectedVendor.id), rpnData);

      await batch.commit();

      await createAuditLog({
        action: 'RPN_REFERRAL_REJECTED',
        targetType: 'vendor',
        targetId: selectedVendor.id,
        metadata: {
          reason: rejectReason,
          vendorName: selectedVendor.businessName,
        },
      });

      setIsRejectModalOpen(false);
      setSelectedVendor(null);
      setRejectReason('');
    } catch (err: any) {
      console.error('Rejection error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasPermission('rpn.verify') && !hasPermission('super_admin')) {
    return <div className="p-10 text-center">Unauthorized Access</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg industrial-border shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold tracking-tighter uppercase text-slate-900">
          RPN Verification Queue
        </h1>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
          Pending Attribute Review Node
        </p>
      </div>

      <div className="bg-white industrial-border rounded-lg shadow-sm overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Merchant
                </th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  RPN Code Provided
                </th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  City
                </th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Created At
                </th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-[10px] font-black text-slate-900 uppercase">
                      {v.businessName}
                    </p>
                    <p className="text-[8px] text-slate-400 mt-0.5">{v.id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">
                      {v.rpnReferralCode}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-600 uppercase">
                    {v.city || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-400">
                    {v.createdAt?.toDate ? v.createdAt.toDate().toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setSelectedVendor(v);
                        setSelectedAgentId('');
                        setIsApproveModalOpen(true);
                      }}
                      className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-all"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => {
                        setSelectedVendor(v);
                        setRejectReason('');
                        setIsRejectModalOpen(true);
                      }}
                      className="px-3 py-1 bg-red-50 text-red-600 rounded text-[9px] font-black uppercase tracking-widest border border-red-100 hover:bg-red-100 transition-all"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-20 text-center text-slate-400 text-[10px] font-bold uppercase italic tracking-widest"
                  >
                    No pending RPN verifications detected in queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approve Modal */}
      {isApproveModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white industrial-border border-slate-200 rounded shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                APPROVE RPN ATTRIBUTION
              </h3>
              <button
                onClick={() => setIsApproveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-4 bg-orange-50 rounded border border-orange-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Target Vendor</p>
                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  {selectedVendor?.businessName}
                </p>
                <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase">
                  Entered Code:{' '}
                  <span className="text-orange-itred font-mono">
                    {selectedVendor?.rpnReferralCode}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Select Authenticated RPN Agent
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-xs font-bold uppercase outline-none focus:border-orange-itred"
                >
                  <option value="">-- SELECT AGENT --</option>
                  {agents.map((a) => (
                    <option key={a.rpnId} value={a.rpnId}>
                      {a.fullName} ({a.rpnCode})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleApprove}
                disabled={loading || !selectedAgentId}
                className="w-full h-12 bg-emerald-600 text-white rounded font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                Confirm Attribution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white industrial-border border-slate-200 rounded shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                REJECT RPN ATTRIBUTION
              </h3>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-4 bg-red-50 rounded border border-red-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Target Vendor</p>
                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  {selectedVendor?.businessName}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Rejection Reason
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-xs font-bold outline-none focus:border-red-500"
                  placeholder="Invalid code, typo, or agent non-existent..."
                ></textarea>
              </div>

              <button
                onClick={handleReject}
                disabled={loading || !rejectReason}
                className="w-full h-12 bg-red-600 text-white rounded font-black uppercase tracking-widest text-[10px] hover:bg-red-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <X size={16} />}
                Reject Verification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color }: any) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    slate: 'bg-slate-50 text-slate-900 border-slate-200',
  };
  return (
    <div
      className={`p-6 rounded industrial-border border shadow-sm ${colors[color as keyof typeof colors]}`}
    >
      <div className="flex justify-between items-start mb-4">
        <p className="text-[9px] font-black uppercase tracking-widest leading-none">{label}</p>
        <Icon size={16} className="opacity-40" />
      </div>
      <p className="text-2xl font-black tracking-tighter leading-none">{value}</p>
    </div>
  );
};

export const VendorNotices = () => {
  const { vendorId } = useAuth();
  const { checkQuota } = useSubscription();
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    body: '',
    type: 'announcement',
    status: 'published',
    visibility: 'public',
    startsAt: '',
    endsAt: '',
  });

  useEffect(() => {
    if (!vendorId) return;
    const q = query(
      collection(db, 'notices'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc'),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotices(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [vendorId]);

  const handleOpenModal = (notice: any = null) => {
    setError(null);
    if (!notice) {
      const quota = checkQuota('notices');
      if (!quota.allowed) {
        setError(quota.message!);
        return;
      }
    }
    if (notice) {
      setEditingNotice(notice);
      setForm({
        title: notice.title || '',
        body: notice.body || '',
        type: notice.type || 'announcement',
        status: notice.status || 'published',
        visibility: notice.visibility || 'public',
        startsAt: notice.startsAt
          ? new Date(notice.startsAt.toDate()).toISOString().slice(0, 16)
          : '',
        endsAt: notice.endsAt ? new Date(notice.endsAt.toDate()).toISOString().slice(0, 16) : '',
      });
    } else {
      setEditingNotice(null);
      setForm({
        title: '',
        body: '',
        type: 'announcement',
        status: 'published',
        visibility: 'public',
        startsAt: '',
        endsAt: '',
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) return;

    // Final Client-Side Validation
    if (form.title.length > 100) return setError('Title exceeds 100 character limit.');
    if (form.body.length > 1000) return setError('Body exceeds 1000 character limit.');

    if (form.startsAt && form.endsAt) {
      const start = new Date(form.startsAt).getTime();
      const end = new Date(form.endsAt).getTime();
      if (end <= start)
        return setError('Notice expiration must be after the publication start time.');
    }

    setLoading(true);

    try {
      const noticeData = {
        ...form,
        vendorId,
        startsAt: form.startsAt ? Timestamp.fromDate(new Date(form.startsAt)) : null,
        endsAt: form.endsAt ? Timestamp.fromDate(new Date(form.endsAt)) : null,
        updatedAt: serverTimestamp(),
      };

      if (editingNotice) {
        await updateDoc(doc(db, 'notices', editingNotice.id), noticeData);
        await createAuditLog({
          action: 'VENDOR_NOTICE_UPDATED',
          targetType: 'notice',
          targetId: editingNotice.id,
          vendorId,
          metadata: { title: form.title },
        });
      } else {
        const docRef = await addDoc(collection(db, 'notices'), {
          ...noticeData,
          createdAt: serverTimestamp(),
        });
        await createAuditLog({
          action: 'VENDOR_NOTICE_CREATED',
          targetType: 'notice',
          targetId: docRef.id,
          vendorId,
          metadata: { title: form.title },
        });
      }
      setModalOpen(false);
    } catch (err: any) {
      console.error('Save notice failed:', err);
      setError('Failed to save notice. System error.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure? This action is permanent.')) return;
    try {
      await deleteDoc(doc(db, 'notices', id));
      await createAuditLog({
        action: 'VENDOR_NOTICE_DELETED',
        targetType: 'notice',
        targetId: id,
        vendorId: vendorId!,
        metadata: {},
      });
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
            Merchant Notices
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 mt-1">
            Portal / <span className="text-slate-900">Communication Node</span>
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-orange-itred text-white px-4 py-2 rounded font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-[#d96a1a] transition-all"
        >
          <Plus size={14} /> New Notice
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col shadow-sm"
          >
            <div className="p-5 flex-grow">
              <div className="flex justify-between items-start mb-3">
                <span
                  className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                    notice.type === 'alert'
                      ? 'bg-red-50 text-red-600 border-red-100'
                      : notice.type === 'promotion'
                        ? 'bg-orange-50 text-orange-600 border-orange-100'
                        : 'bg-blue-50 text-blue-600 border-blue-100'
                  }`}
                >
                  {notice.type}
                </span>
                <div className="flex gap-1">
                  <span
                    className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                      notice.status === 'published'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-slate-50 text-slate-600 border-slate-100'
                    }`}
                  >
                    {notice.status}
                  </span>
                </div>
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight mb-2">
                {notice.title}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{notice.body}</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(notice)}
                  className="text-slate-400 hover:text-orange-itred transition-colors"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => handleDelete(notice.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {notice.visibility} // {notice.createdAt?.toDate().toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="text-center py-12">
          <Loader2 className="animate-spin inline-block text-orange-itred" />
        </div>
      )}
      {!loading && notices.length === 0 && (
        <div className="text-center py-20 bg-white industrial-border border-dashed border-2 rounded-lg">
          <Bell className="mx-auto text-slate-200 mb-4" size={48} />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            No merchant notices detected in channel.
          </p>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          ></div>
          <div className="relative bg-white w-full max-w-lg rounded-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-charcoal text-white rounded-t-lg">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">
                  Notice Configuration
                </h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  Protocol Integration
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Headline
                    </label>
                    <span
                      className={`text-[8px] font-mono ${form.title.length > 90 ? 'text-orange-itred' : 'text-slate-400'}`}
                    >
                      {form.title.length}/100
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-xs font-bold outline-none focus:border-orange-itred"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Content Body
                    </label>
                    <span
                      className={`text-[8px] font-mono ${form.body.length > 900 ? 'text-orange-itred' : 'text-slate-400'}`}
                    >
                      {form.body.length}/1000
                    </span>
                  </div>
                  <textarea
                    required
                    rows={4}
                    maxLength={1000}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-xs font-medium outline-none focus:border-orange-itred"
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                  ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Type
                    </label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-xs font-bold outline-none focus:border-orange-itred"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                      <option value="announcement">Announcement</option>
                      <option value="promotion">Promotion</option>
                      <option value="alert">Alert</option>
                      <option value="service_update">Service Update</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Visibility
                    </label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-xs font-bold outline-none focus:border-orange-itred"
                      value={form.visibility}
                      onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                    >
                      <option value="public">Public (Storefront)</option>
                      <option value="private">Private (Admin Only)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Start Date
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded text-[10px] font-bold outline-none focus:border-orange-itred"
                      value={form.startsAt}
                      onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      End Date (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      className={`w-full bg-slate-50 border p-3 rounded text-[10px] font-bold outline-none focus:border-orange-itred ${
                        form.startsAt &&
                        form.endsAt &&
                        new Date(form.endsAt) <= new Date(form.startsAt)
                          ? 'border-red-300 text-red-500'
                          : 'border-slate-200'
                      }`}
                      value={form.endsAt}
                      onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                    />
                    {form.startsAt &&
                      form.endsAt &&
                      new Date(form.endsAt) <= new Date(form.startsAt) && (
                        <p className="text-[8px] font-bold text-red-500 uppercase">
                          Must be after start date
                        </p>
                      )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-itred text-white py-4 rounded font-bold uppercase tracking-widest text-[10px] hover:bg-[#d96a1a] transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                {editingNotice ? 'Update Notice Protocol' : 'Deploy Notice to Channel'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const VendorSubscription = () => {
  const { vendorId, user, appUser } = useAuth();
  const {
    plan,
    usage,
    subscription: currentSub,
    daysRemaining,
    isTrial,
    isExpired,
  } = useSubscription();

  useEffect(() => {
    if (vendorId) {
      console.log('[SUBS_PAGE] Rendering for vendorId:', vendorId);
      console.log('[SUBS_PAGE] Subscription loaded:', !!currentSub);
      if (currentSub) {
        console.log('[SUBS_PAGE] Status:', currentSub.status);
        console.log('[SUBS_PAGE] PlanCode:', currentSub.planCode);
        console.log(
          '[SUBS_PAGE] ExpiresAt:',
          currentSub.expiresAt?.toDate?.() || currentSub.expiresAt,
        );
        console.log('[SUBS_PAGE] Days Remaining:', daysRemaining);
      }
    }
  }, [vendorId, currentSub, daysRemaining]);

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  // Form fields
  const [activationType, setActivationType] = useState('proof_of_payment');
  const [paymentMethod, setPaymentMethod] = useState('ecocash');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [proofOfPaymentText, setProofOfPaymentText] = useState('');
  const [requestedMonths, setRequestedMonths] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) return;

    const qPlans = query(
      collection(db, 'plans'),
      where('active', '==', true),
      orderBy('sortOrder', 'asc'),
    );
    const unsubscribePlans = onSnapshot(qPlans, (snapshot) => {
      setPlans(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubscribePlans();
    };
  }, [vendorId]);

  const subscription = currentSub;

  const seedStarterPlans = async () => {
    setSeedError(null);
    if (!window.confirm('DEV ONLY: Seed starter plans?')) return;

    console.log('Starting seed plans process...');
    console.log('Current User:', user?.email);
    console.log('Current Role:', appUser?.role);
    console.log('Current Vendor ID:', vendorId);

    const starterPlans = [
      {
        planId: 'starter',
        name: 'Starter',
        code: 'starter',
        description: 'Entry plan for small vendors starting on iTred.',
        price: 5,
        currency: 'USD',
        billingCycle: 'monthly',
        features: ['products', 'public discovery', 'basic catalogue'],
        limits: {
          products: 50,
          catalogues: 2,
          branches: 1,
          staff: 1,
          notices: 0,
        },
        active: true,
        sortOrder: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      {
        planId: 'growth',
        name: 'Growth',
        code: 'growth',
        description:
          'Growth plan for vendors using products, orders, branches, delivery, and offline catalogues.',
        price: 12,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'products',
          'public discovery',
          'offline catalogue',
          'orders',
          'branches',
          'delivery',
          '5 notices',
        ],
        limits: {
          products: 300,
          catalogues: 10,
          branches: 3,
          staff: 5,
          notices: 5,
        },
        active: true,
        sortOrder: 2,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      {
        planId: 'pro',
        name: 'Pro',
        code: 'pro',
        description:
          'Advanced plan for larger vendors needing more products, catalogues, staff, branches, and priority listing.',
        price: 25,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'advanced products',
          'offline catalogues',
          'orders',
          'staff',
          'branches',
          'delivery',
          'priority listing',
          '20 notices',
        ],
        limits: {
          products: 1000,
          catalogues: 30,
          branches: 10,
          staff: 20,
          notices: 20,
        },
        active: true,
        sortOrder: 3,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ];

    try {
      for (const plan of starterPlans) {
        console.log(`Writing plan: ${plan.name}...`);
        await setDoc(doc(db, 'plans', plan.planId), plan);
      }
      console.log('Seed plans success!');
      alert('Starter plans seeded. Access Restricted Node.');
    } catch (err: any) {
      console.error('Seed plans failed with full Firebase error:', err);
      let errorMessage = `Seed plans failed: ${err.code || 'unknown'}. ${err.message}`;
      if (err.code === 'permission-denied') {
        errorMessage = `You are logged in as ${appUser?.role || 'unknown'}. Plan seeding requires super_admin permission (isConsoleAdmin).`;
      }
      setSeedError(errorMessage);
    }
  };

  const handleActivationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vendorId) {
      console.error('Missing vendorId');
      setSeedError('Vendor ID is missing. Please re-login.');
      return;
    }

    if (!selectedPlan) {
      console.error('No plan selected');
      setSeedError('No plan selected. Please close this form and select a plan again.');
      return;
    }

    const selectedPlanId = selectedPlan.planId || selectedPlan.id || '';
    const selectedPlanCode = selectedPlan.code || selectedPlan.planId || selectedPlan.id || '';
    const selectedPlanName = selectedPlan.name || selectedPlanCode || 'Unknown Plan';

    if (!selectedPlanId) {
      console.error('selectedPlanId is missing. Plan object:', selectedPlan);
      setSeedError('Selected plan ID is missing. Please close this form and select a plan again.');
      return;
    }

    setSubmitting(true);
    setSeedError(null);

    console.log('Starting activation request submit...');
    console.log('Current User UID:', user?.uid);
    console.log('Current Role:', appUser?.role);
    console.log('Current Vendor ID:', vendorId);
    console.log('Selected plan object:', selectedPlan);

    const newRequestId = `REQ-${Date.now()}`;
    const reqData = removeUndefinedFields({
      requestId: newRequestId,
      vendorId,
      vendorName: appUser?.businessName || appUser?.displayName || 'Vendor Owner',
      selectedPlanId,
      selectedPlanCode,
      selectedPlanName,
      activationType: activationType || 'proof_of_payment',
      paymentMethod: paymentMethod || 'other',
      amountPaid: Number(amountPaid) || 0,
      currency: 'USD',
      paymentReference: paymentReference || '',
      payerName: payerName || '',
      payerPhone: payerPhone || '',
      notes: notes || '',
      proofOfPaymentText: proofOfPaymentText || '',
      requestedMonths: Number(requestedMonths) || 1,
      status: 'submitted',
      adminNotes: '',
      // RPN Attribution
      rpnId: appUser?.rpnId || '',
      rpnName: appUser?.rpnName || '',
      rpnCode: appUser?.rpnCode || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log('Activation request payload:', reqData);

    try {
      console.log('Creating activation request:', newRequestId);
      await setDoc(doc(db, 'activation_requests', newRequestId), reqData);
      console.log('Activation request created.');

      await createAuditLog({
        action: 'ACTIVATION_REQUEST_SUBMITTED',
        targetType: 'activation_request',
        targetId: newRequestId,
        vendorId,
      });

      // Update subscription
      const subId = subscription?.id || `SUB-${vendorId}`;
      const subData = removeUndefinedFields({
        subscriptionId: subId,
        vendorId,
        planId: selectedPlanId,
        planCode: selectedPlanCode,
        status: 'pending_activation',
        startsAt: null,
        expiresAt: null,
        activationSource: activationType || 'proof_of_payment',
        lastActivationRequestId: newRequestId,
        updatedAt: serverTimestamp(),
        ...(subscription ? {} : { createdAt: serverTimestamp() }),
      });

      console.log('Subscription payload:', subData);

      try {
        console.log('Creating or updating subscription:', subId);
        await setDoc(doc(db, 'subscriptions', subId), subData, { merge: true });
        console.log('Subscription created or updated.');

        await createAuditLog({
          action: 'SUBSCRIPTION_PENDING_ACTIVATION',
          targetType: 'subscription',
          targetId: subId,
          vendorId,
        });
      } catch (subErr: any) {
        console.error('Subscription update failed:', subErr);
        setSeedError(
          'Activation request was submitted, but subscription status could not be updated. Check Firestore rules for subscriptions.',
        );
      }

      setRequestId(newRequestId);
      console.log('Activation request complete.');
    } catch (err: any) {
      console.error('Activation request failed with Firebase error:', err);
      handleFirestoreError(err, OperationType.WRITE, 'activation_requests');
      setSeedError(`Activation failed: ${err.code || 'unknown'}. ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getWhatsAppActivationMessage = () => {
    if (!selectedPlan) return '';
    let message = `Hello seiGEN Commerce,\nI have submitted an iTred activation request.\n\n`;
    message += `Vendor ID: ${vendorId}\n`;
    message += `Plan: ${selectedPlan.name}\n`;
    message += `Activation Type: ${safeString(activationType).replace('_', ' ').toUpperCase()}\n`;
    message += `Payment Method: ${paymentMethod.toUpperCase()}\n`;
    message += `Amount Paid: USD ${amountPaid}\n`;
    message += `Reference: ${paymentReference}\n`;
    message += `Requested Months: ${requestedMonths}\n`;
    message += `Payer: ${payerName}\n`;
    message += `Phone: ${payerPhone}\n\n`;
    message += `Please review and activate.`;
    return message;
  };

  const handleWhatsAppRedirect = () => {
    const message = getWhatsAppActivationMessage();
    window.open(`https://wa.me/263774479121?text=${encodeURIComponent(message)}`, '_blank');
    setIsRequestModalOpen(false);
    setRequestedMonths(1);
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'expired':
        return 'bg-red-50 text-red-600 border-red-100';
      case 'pending_activation':
        return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'trial':
        return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'suspended':
        return 'bg-slate-700 text-white border-slate-800';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-lg industrial-border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
            License & Subscription
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            Operational Tier // Network Authority
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={seedStarterPlans}
            className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100 px-3 py-1 rounded hover:bg-slate-50"
          >
            Dev: Seed Plans
          </button>
        </div>
      </div>

      {seedError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-bold uppercase tracking-widest animate-in fade-in duration-300">
          <AlertTriangle className="inline-block mr-2" size={16} />
          {seedError}
        </div>
      )}

      {/* Plan Quotas & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {plan && (
            <div className="bg-white p-8 rounded-lg industrial-border shadow-sm border border-slate-200">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                <Activity size={14} className="text-orange-itred" /> Protocol Quota Utilization
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <QuotaIndicator
                  label="Inventory"
                  used={usage.products}
                  limit={plan.limits.products}
                />
                <QuotaIndicator
                  label="Branches"
                  used={usage.branches}
                  limit={plan.limits.branches}
                />
                <QuotaIndicator
                  label="Catalogues"
                  used={usage.catalogues}
                  limit={plan.limits.catalogues}
                />
                <QuotaIndicator label="Staff" used={usage.staff} limit={plan.limits.staff} />
                <QuotaIndicator label="Notices" used={usage.notices} limit={plan.limits.notices} />
              </div>
            </div>
          )}

          <div className="bg-white industrial-border border-slate-200 rounded-lg p-8 shadow-sm">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Current Operational Protocol
                </h3>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                  {subscription ? `${subscription.planCode} Plan` : 'No Active Plan'}
                </h2>
              </div>
              <span
                className={`px-4 py-2 rounded-full border text-[10px] font-bold uppercase tracking-widest shadow-sm ${getStatusStyles(subscription?.status || 'inactive')}`}
              >
                {safeString(subscription?.status).replace('_', ' ') || 'UNLICENSED'}
              </span>
            </div>

            {subscription?.status === 'pending_activation' && (
              <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-4">
                <Info className="text-blue-500 flex-shrink-0 mt-1" size={20} />
                <div>
                  <p className="text-xs font-bold text-blue-900 uppercase tracking-tight">
                    Activation Under Review
                  </p>
                  <p className="text-[10px] text-blue-700 mt-1 uppercase tracking-widest">
                    seiGEN Commerce is verifying your payment. Access will be unlocked shortly.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-slate-50">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Expiry Date
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {subscription?.expiresAt
                    ? (
                        subscription.expiresAt.toDate?.() || subscription.expiresAt
                      ).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Status Engine
                </p>
                <p
                  className={`text-lg font-bold uppercase tracking-tight ${daysRemaining !== null && daysRemaining! < 7 ? 'text-orange-itred' : 'text-slate-900'}`}
                >
                  {subscription
                    ? `${daysRemaining} ${subscription.status === 'trial' ? 'Trial' : ''} Days Remaining`
                    : subscription?.status === 'pending_activation'
                      ? 'Activation Queue Active'
                      : 'Activation Required'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Billing Cycle
                </p>
                <p className="text-lg font-bold text-slate-900 uppercase tracking-tighter">
                  Monthly Renewal
                </p>
              </div>
            </div>
          </div>

          {subscription?.status === 'expired' && (
            <div className="p-6 bg-red-50 border border-red-100 rounded-lg flex items-center gap-4 text-red-800 animate-pulse">
              <AlertTriangle size={24} />
              <p className="text-xs font-bold uppercase tracking-widest">
                Protocol Expired. Some operational nodes may be restricted. Renew immediately.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-charcoal text-white p-8 rounded-lg shadow-xl shadow-slate-200">
            <CreditCard className="text-orange-itred mb-4" size={32} />
            <h4 className="text-lg font-bold uppercase tracking-tight mb-2">Manual Activation</h4>
            <p className="text-xs text-slate-400 leading-relaxed uppercase tracking-widest">
              We support EcoCash, InnBucks, and Mukuru for local Zimbabwe settlements.
            </p>
            <div className="mt-6 pt-6 border-t border-slate-700 space-y-3">
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tight flex items-center gap-2 font-mono">
                InnBucks: +263 774 479 121
              </p>
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tight flex items-center gap-2 font-mono">
                EcoCash: *151*... (Call Merchant)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Catalog */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold tracking-tighter text-slate-900 uppercase flex items-center gap-3">
          Available Protocols <div className="h-[2px] flex-1 bg-slate-100"></div>
        </h2>

        {plans.length === 0 && !loading && (
          <div className="p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg text-center">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              No active plans are available yet. Contact seiGEN Commerce.
            </p>
            <div className="mt-4 p-4 bg-orange-50 border border-orange-100 rounded inline-block text-left">
              <p className="text-[9px] text-orange-800 font-bold uppercase tracking-tight leading-relaxed">
                IMPORTANT: If plans are missing, create them from Firebase Console <br />
                or login as super_admin (isConsoleAdmin) to seed them.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white industrial-border rounded-lg overflow-hidden transition-all flex flex-col ${subscription?.planId === plan.planId ? 'border-orange-itred shadow-lg ring-1 ring-orange-itred/50' : 'border-slate-200 hover:border-slate-300 shadow-sm'}`}
            >
              <div className="p-8 border-b border-slate-50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                    {plan.name}
                  </h3>
                  {subscription?.planId === plan.planId && (
                    <span className="bg-orange-itred text-white text-[8px] font-bold px-2 py-1 rounded uppercase tracking-widest">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-black text-slate-900 font-mono">
                    ${plan.price}
                  </span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    / Per Month
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 uppercase tracking-tight leading-relaxed min-h-[40px]">
                  {plan.description}
                </p>
              </div>

              <div className="p-8 flex-1 space-y-4">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                  Capabilities:
                </h4>
                <ul className="space-y-3">
                  {plan.features.map((f: string, i: number) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-[10px] font-bold text-slate-600 uppercase tracking-tight"
                    >
                      <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="pt-6 mt-6 border-t border-slate-50">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Resource Quotas:
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    <div>Products: {plan.limits.products}</div>
                    <div>Branches: {plan.limits.branches}</div>
                    <div>Staff: {plan.limits.staff}</div>
                    <div>Catalogues: {plan.limits.catalogues}</div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 mt-auto">
                <button
                  onClick={() => {
                    setSelectedPlan(plan);
                    setIsRequestModalOpen(true);
                    setRequestId(null);
                  }}
                  className={`w-full py-4 rounded font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${subscription?.planId === plan.planId ? 'bg-charcoal text-white hover:bg-slate-800' : 'bg-orange-itred text-white hover:bg-[#d96a1a] shadow-lg shadow-orange-100'}`}
                >
                  {subscription?.planId === plan.planId ? 'Renew Protocol' : 'Select Protocol'}{' '}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activation Modal */}
      {isRequestModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white industrial-border border-slate-200 rounded-lg shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tighter">
                  Request Activation
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Tier: {selectedPlan.name} // Cluster Alpha
                </p>
              </div>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {!requestId ? (
              <form onSubmit={handleActivationSubmit} className="p-8 overflow-y-auto space-y-6">
                <div className="p-4 bg-orange-50 border border-orange-100 rounded text-center mb-4">
                  <p className="text-lg font-black text-slate-900 font-mono tracking-tighter">
                    Total Due: ${(selectedPlan.price * requestedMonths).toFixed(2)} USD
                  </p>
                  <p className="text-[9px] font-bold text-orange-itred uppercase tracking-widest">
                    Includes Node Access for {requestedMonths}{' '}
                    {requestedMonths === 1 ? 'Month' : 'Months'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Activation Mode
                    </label>
                    <select
                      value={activationType}
                      onChange={(e) => setActivationType(e.target.value)}
                      className="w-full industrial-border border-slate-200 p-3 text-sm rounded font-bold uppercase tracking-tight bg-white outline-none focus:ring-1 focus:ring-orange-itred"
                    >
                      <option value="proof_of_payment">PROOF OF PAYMENT</option>
                      <option value="manual">MANUAL ASSISTANCE</option>
                      <option value="rpn_assisted">RPN ASSISTED</option>
                      <option value="scratch_card">SCRATCH CARD</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full industrial-border border-slate-200 p-3 text-sm rounded font-bold uppercase tracking-tight bg-white outline-none focus:ring-1 focus:ring-orange-itred"
                    >
                      <option value="ecocash">ECOCASH</option>
                      <option value="innbucks">INNBUCKS</option>
                      <option value="mukuru">MUKURU</option>
                      <option value="bank_transfer">BANK TRANSFER</option>
                      <option value="cash">CASH DEPOT</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Amount Paid (USD)
                    </label>
                    <input
                      type="number"
                      required
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="w-full industrial-border border-slate-200 p-3 text-sm focus:ring-1 focus:ring-orange-itred outline-none rounded"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Months to Activate
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="12"
                      value={requestedMonths}
                      onChange={(e) => setRequestedMonths(parseInt(e.target.value))}
                      className="w-full industrial-border border-slate-200 p-3 text-sm focus:ring-1 focus:ring-orange-itred outline-none rounded"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Transaction Reference
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full industrial-border border-slate-200 p-3 text-sm focus:ring-1 focus:ring-orange-itred outline-none rounded"
                    placeholder="Ref: ABC123XYZ"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Payer Name
                    </label>
                    <input
                      type="text"
                      required
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      className="w-full industrial-border border-slate-200 p-3 text-sm focus:ring-1 focus:ring-orange-itred outline-none rounded"
                      placeholder="Your Name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Payer Phone
                    </label>
                    <input
                      type="tel"
                      required
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                      className="w-full industrial-border border-slate-200 p-3 text-sm focus:ring-1 focus:ring-orange-itred outline-none rounded"
                      placeholder="+263..."
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Proof Translation (Optional)
                  </label>
                  <textarea
                    value={proofOfPaymentText}
                    onChange={(e) => setProofOfPaymentText(e.target.value)}
                    className="w-full industrial-border border-slate-200 p-3 text-sm outline-none rounded h-20 resize-none"
                    placeholder="Copy-paste SMS confirmation or describing proof..."
                  />
                </div>

                {seedError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded text-red-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle size={14} />
                    {seedError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-orange-itred text-white p-5 rounded font-black uppercase tracking-widest hover:bg-[#d96a1a] transition-all flex justify-center items-center gap-2 shadow-lg shadow-orange-100 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    'Submit Activation Request'
                  )}
                </button>
              </form>
            ) : (
              <div className="p-12 text-center space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-100 shadow-inner">
                  <CheckCircle2 size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                    Request Registered
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 font-bold uppercase tracking-widest leading-relaxed">
                    Your submission is secured in the activation queue. Verification may take 2-4
                    hours.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded border border-slate-100 font-mono text-[10px] text-slate-400 uppercase">
                  Reference ID: {requestId}
                </div>
                <button
                  onClick={handleWhatsAppRedirect}
                  className="w-full bg-[#25D366] text-white p-5 rounded font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex justify-center items-center gap-3 shadow-xl shadow-emerald-100"
                >
                  <MessageSquare size={24} /> Fast-Track on WhatsApp
                </button>
                <button
                  onClick={() => setIsRequestModalOpen(false)}
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Return to Console
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// CONSOLE PAGES
export const ConsoleMonitor = () => {
  const { user, appUser, hasPermission } = useAuth();
  const [stats, setStats] = useState({ pendingActivations: 0 });

  useEffect(() => {
    if (!hasPermission('activation_requests.view')) return;
    const q = query(collection(db, 'activation_requests'), where('status', '==', 'submitted'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setStats({ pendingActivations: snapshot.size });
      },
      (err) => {
        console.error('Monitor stats sync error:', err);
      },
    );
    return () => unsubscribe();
  }, [hasPermission]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-lg industrial-border shadow-sm border border-slate-200">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
              System Command
            </h1>
            <p className="text-slate-500 text-xs font-medium">ADMINISTRATIVE INTERFACE ACTIVE</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-slate-50 border rounded">
            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Admin Identity</p>
            <p className="text-xs font-bold text-slate-700 truncate">{user?.email}</p>
          </div>
          <div className="p-4 bg-slate-50 border rounded">
            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Clearance Level</p>
            <p className="text-xs font-bold text-orange-itred uppercase">
              {safeString(appUser?.role).replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {hasPermission('vendors.view') && (
          <DashLink to="/console/vendors" icon={<Store size={18} />} label="Merchants" />
        )}
        {hasPermission('products.view') && (
          <DashLink to="/console/products" icon={<Package size={18} />} label="Products" />
        )}
        {hasPermission('plans.view') && (
          <DashLink to="/console/plans" icon={<LayoutDashboard size={18} />} label="Plans" />
        )}
        {hasPermission('subscriptions.view') && (
          <DashLink to="/console/subscriptions" icon={<CreditCard size={18} />} label="Leases" />
        )}
        {hasPermission('activation_requests.view') && (
          <DashLink to="/console/activation-requests" icon={<Activity size={18} />} label="Queue" />
        )}
        {hasPermission('audit_logs.view') && (
          <DashLink to="/console/audit-logs" icon={<FileText size={18} />} label="Audits" />
        )}
        {hasPermission('health.view') && (
          <DashLink to="/console/health" icon={<Laptop size={18} />} label="Health" />
        )}
        {hasPermission('console_staff.view') && (
          <DashLink to="/console/staff" icon={<Shield size={18} />} label="Staff" />
        )}
      </div>

      {/* Quick Stats or Activation Insight */}
      {hasPermission('activation_requests.view') && (
        <div className="bg-slate-900 p-8 rounded-lg text-white">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-orange-itred rounded flex items-center justify-center text-white">
              <ClipboardList size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold uppercase tracking-tight">Activation Control</h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                {stats.pendingActivations} requests awaiting protocol validation
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-300 max-w-xl leading-relaxed mb-6">
            New vendor activation requests are pending review. Approving a request activates the
            vendor's subscription protocol and unlocks their storefront metadata.
          </p>
          <Link
            to="/console/activation-requests"
            className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded text-xs font-black uppercase tracking-widest hover:bg-orange-itred hover:text-white transition-all"
          >
            Open Activation Queue <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
};

export const ConsoleActivationRequests = () => {
  const { user, appUser, hasPermission } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processing, setProcessing] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [relatedData, setRelatedData] = useState<{
    vendor: any;
    subscription: any;
    plan: any;
  } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'activation_requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setRequests(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Activation queue sync error:', err);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedRequest) {
      setRelatedData(null);
      return;
    }

    const fetchRelated = async () => {
      try {
        const vid = selectedRequest.vendorId;
        const pid = selectedRequest.selectedPlanId;

        const [vSnap, sSnap, pSnap] = await Promise.all([
          getDoc(doc(db, 'vendors', vid)),
          getDoc(doc(db, 'subscriptions', vid)),
          getDoc(doc(db, 'plans', pid)),
        ]);

        setRelatedData({
          vendor: vSnap.exists() ? vSnap.data() : null,
          subscription: sSnap.exists() ? sSnap.data() : null,
          plan: pSnap.exists() ? pSnap.data() : null,
        });
      } catch (err) {
        console.error('Error fetching related data:', err);
      }
    };

    fetchRelated();
  }, [selectedRequest]);

  const filteredRequests = requests.filter((req) => {
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const searchStr =
      `${req.vendorName} ${req.vendorId} ${req.paymentReference} ${req.payerPhone}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleAction = async (status: 'approved' | 'rejected' | 'under_review') => {
    if (!selectedRequest) return;

    // Permission Check
    if (status === 'approved' || status === 'rejected') {
      if (!hasPermission('activation_requests.approve')) {
        alert('INSUFFICIENT CLEARANCE: activation_requests.approve protocol required.');
        return;
      }
    }

    if (status === 'rejected' && !adminNotes.trim()) {
      alert('ADMIN NOTE REQUIRED: Please specify rejection rationale.');
      return;
    }

    if (
      status === 'approved' &&
      !window.confirm('CONFIRM ACTIVATION: Execute subscription extension script?')
    ) {
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      const requestId = selectedRequest.id;
      const vendorId = selectedRequest.vendorId;

      if (!requestId || !vendorId) {
        throw new Error(
          `MISSING CRITICAL IDENTIFIERS: requestId=${requestId}, vendorId=${vendorId}`,
        );
      }

      const batch = writeBatch(db);

      // 1. Prepare Activation Request Update
      const reqRef = doc(db, 'activation_requests', requestId);
      const reqUpdate: any = {
        status,
        adminNotes,
        updatedAt: serverTimestamp(),
      };

      if (status === 'approved') {
        reqUpdate.approvedAt = serverTimestamp();
        reqUpdate.approvedBy = user?.uid;
        reqUpdate.approvedByEmail = user?.email;
      } else if (status === 'rejected') {
        reqUpdate.rejectedAt = serverTimestamp();
        reqUpdate.rejectedBy = user?.uid;
        reqUpdate.rejectedByEmail = user?.email;
        reqUpdate.rejectionReason = adminNotes;
      } else if (status === 'under_review') {
        reqUpdate.reviewedAt = serverTimestamp();
        reqUpdate.reviewedBy = user?.uid;
      }

      batch.update(reqRef, reqUpdate);

      // 2. If Approved, Extend Subscription and Update Vendor
      let subscriptionUpdate = null;
      let vendorUpdate = null;
      let auditLog: any = null;

      if (status === 'approved') {
        const requestedMonths = Number(selectedRequest.requestedMonths) || 1;
        const planCode = selectedPlanCodeFromRequest(selectedRequest);

        // Date Logic
        const now = new Date();
        let startsAt = Timestamp.fromDate(now);
        let expiresAt = new Date(now);

        const existingSub = relatedData?.subscription;
        const isCurrentlyActive =
          existingSub?.status === 'active' &&
          existingSub?.expiresAt &&
          (existingSub.expiresAt.toDate
            ? existingSub.expiresAt.toDate()
            : new Date(existingSub.expiresAt)) > now;

        if (isCurrentlyActive) {
          const currentExpiry = existingSub.expiresAt.toDate
            ? existingSub.expiresAt.toDate()
            : new Date(existingSub.expiresAt);
          startsAt = existingSub.startsAt; // Maintain current start
          expiresAt = new Date(currentExpiry);
        }

        // Add months safely
        expiresAt.setMonth(expiresAt.getMonth() + requestedMonths);

        const subRef = doc(db, 'subscriptions', vendorId);
        subscriptionUpdate = {
          subscriptionId: vendorId,
          vendorId,
          planId: selectedRequest.selectedPlanId || planCode || 'starter',
          planCode: planCode || selectedRequest.selectedPlanId || 'starter',
          status: 'active',
          activationSource: 'manual_approval',
          lastActivationRequestId: requestId,
          startsAt,
          expiresAt: Timestamp.fromDate(expiresAt),
          updatedAt: serverTimestamp(),
          createdAt: existingSub?.createdAt || serverTimestamp(),
          // Carry over RPN attribution if missing on subscription but present on request
          rpnId: existingSub?.rpnId || selectedRequest.rpnId || '',
          rpnName: existingSub?.rpnName || selectedRequest.rpnName || '',
          rpnCode: existingSub?.rpnCode || selectedRequest.rpnCode || '',
        };

        batch.set(subRef, subscriptionUpdate, { merge: true });

        // Update Vendor Status
        const vendorRef = doc(db, 'vendors', vendorId);
        vendorUpdate = {
          subscriptionStatus: 'active',
          planCode: planCode || selectedRequest.selectedPlanId || 'starter',
          updatedAt: serverTimestamp(),
          // Carry over RPN attribution if missing
          rpnId: relatedData?.vendor?.rpnId || selectedRequest.rpnId || '',
          rpnName: relatedData?.vendor?.rpnName || selectedRequest.rpnName || '',
          rpnCode: relatedData?.vendor?.rpnCode || selectedRequest.rpnCode || '',
        };
        batch.set(vendorRef, vendorUpdate, { merge: true });

        // Prepare Audit Log Document
        const auditRef = doc(collection(db, 'audit_logs'));
        auditLog = {
          action: 'ACTIVATION_APPROVED',
          actorUid: user?.uid || '',
          actorEmail: user?.email || '',
          actorRole: appUser?.role || '',
          targetType: 'activation_request',
          targetId: requestId,
          vendorId,
          metadata: {
            planCode,
            requestedMonths,
            amountPaid: selectedRequest.amountPaid,
            oldExpiry: existingSub?.expiresAt || null,
            newExpiry: Timestamp.fromDate(expiresAt),
          },
          createdAt: serverTimestamp(),
        };
        batch.set(auditRef, auditLog);
      } else if (status === 'rejected') {
        const auditRef = doc(collection(db, 'audit_logs'));
        auditLog = {
          action: 'ACTIVATION_REJECTED',
          actorUid: user?.uid || '',
          actorEmail: user?.email || '',
          actorRole: appUser?.role || '',
          targetType: 'activation_request',
          targetId: requestId,
          vendorId,
          metadata: { reason: adminNotes },
          createdAt: serverTimestamp(),
        };
        batch.set(auditRef, auditLog);
      }

      // DIAGNOSTICS
      console.log('[ACTIVATION APPROVAL START]', {
        requestId,
        vendorId,
        selectedPlanId: selectedRequest.selectedPlanId,
        selectedPlanCode: selectedPlanCodeFromRequest(selectedRequest),
        requestedMonths: Number(selectedRequest.requestedMonths) || 1,
        amountPaid: selectedRequest.amountPaid,
        currentUserUid: user?.uid,
        currentUserEmail: user?.email,
        currentAppUserRole: appUser?.role,
        currentPermissions: appUser?.consolePermissions,
      });

      console.log('[ACTIVATION APPROVAL PATHS]', {
        activationPath: `activation_requests/${requestId}`,
        subscriptionPath: status === 'approved' ? `subscriptions/${vendorId}` : null,
        vendorPath: status === 'approved' ? `vendors/${vendorId}` : null,
        auditPath: 'audit_logs/[AUTO]',
      });

      console.log('[ACTIVATION APPROVAL PAYLOADS]', {
        activationUpdate: reqUpdate,
        subscriptionUpdate,
        vendorUpdate,
        auditLog,
      });

      // Execute Atomic Transaction
      console.log('[APPROVAL SUBSCRIPTION REF]', doc(db, 'subscriptions', vendorId).path);
      console.log('[APPROVAL SUBSCRIPTION PAYLOAD]', subscriptionUpdate);

      await batch.commit();

      // VERIFICATION READ-BACK
      if (status === 'approved') {
        const verifySnap = await getDoc(doc(db, 'subscriptions', vendorId));
        const verifyData = verifySnap.data();
        console.log('[APPROVAL SUBSCRIPTION VERIFY]', verifyData);

        if (!verifyData || verifyData.status !== 'active') {
          throw new Error(
            "ALARM: Approval completed but subscription read-back does not show 'active' status. Check subscriptionRef path and rules.",
          );
        }
      }

      setSelectedRequest(null);
      setAdminNotes('');
      setError(null);
    } catch (err: any) {
      console.error('[ACTIVATION APPROVAL FAILED]', err);
      const errorCode = err.code || 'UNKNOWN_CODE';
      const errorMsg = err.message || 'Unknown error';

      if (
        errorMsg.toLowerCase().includes('permission-denied') ||
        errorCode === 'permission-denied'
      ) {
        setError(
          `Approval blocked by Firestore rules at batch commit. Check subscriptions/vendors/audit_logs update rules. CODE: ${errorCode} | MSG: ${errorMsg}`,
        );
      } else {
        setError(`APPROVAL EXECUTION FAILED: [${errorCode}] ${errorMsg}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const selectedPlanCodeFromRequest = (req: any) => {
    return req.selectedPlanCode || req.selectedPlanId?.toLowerCase() || 'starter';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      submitted: 'bg-blue-100 text-blue-700',
      under_review: 'bg-orange-100 text-orange-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-700'}`}
      >
        {safeString(status).replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white industrial-border rounded-lg p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
              Activation Queue
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-1">GOVERNANCE & PROTOCOLS</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="text"
                placeholder="Search repository..."
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 pl-9 text-xs outline-none focus:border-orange-itred"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none focus:border-orange-itred font-bold uppercase tracking-widest"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-slate-300" size={40} />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-20 text-center border-2 border-dashed border-slate-100 rounded">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              No matching requests found in system.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Request ID
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Vendor
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Details
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Status
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Created
                  </th>
                  <th className="py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-4">
                      <p className="text-xs font-mono font-bold text-slate-900">{req.requestId}</p>
                    </td>
                    <td className="py-4">
                      <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                        {req.vendorName}
                      </p>
                      <p className="text-[9px] text-slate-400 font-mono italic">{req.vendorId}</p>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded">
                          {req.selectedPlanCode || 'PLAN'}
                        </span>
                        <span className="text-xs text-slate-500">
                          ${req.amountPaid} {req.currency}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold mt-0.5">
                        {safeString(req.activationType).replace('_', ' ')} • {req.paymentMethod}
                      </p>
                    </td>
                    <td className="py-4">{getStatusBadge(req.status)}</td>
                    <td className="py-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">
                        {req.createdAt?.toDate().toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-4 text-right">
                      <button
                        onClick={() => setSelectedRequest(req)}
                        className="p-2 text-slate-400 hover:text-orange-itred hover:bg-orange-50 rounded transition-all"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Drawer / Overlay */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 lg:industrial-border-l">
            <header className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-tight">Request Details</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  {selectedRequest.requestId}
                </p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-2 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Top Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded">
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">
                    Status Protocol
                  </p>
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-900 uppercase">
                      {safeString(selectedRequest.status).replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded">
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">
                    Approval Window
                  </p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-900 uppercase">
                      Awaiting Action
                    </span>
                  </div>
                </div>
              </div>

              {/* Current State Summary */}
              {relatedData && (
                <section className="p-4 bg-slate-900 rounded-lg space-y-4 border border-slate-800">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Activity size={12} /> System Current State
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">
                        Active Subscription
                      </p>
                      <p className="text-xs font-bold text-white uppercase">
                        {relatedData.subscription ? (
                          <span
                            className={
                              relatedData.subscription.status === 'active'
                                ? 'text-emerald-400'
                                : 'text-orange-400'
                            }
                          >
                            {relatedData.subscription.planCode || 'EXISTING'} (
                            {relatedData.subscription.status})
                          </span>
                        ) : (
                          'NO SUBSCRIPTION'
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">
                        Expiry Date
                      </p>
                      <p className="text-xs font-bold text-slate-300">
                        {relatedData.subscription?.expiresAt
                          ? relatedData.subscription.expiresAt.toDate().toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                  {relatedData.plan && (
                    <div className="pt-2 border-t border-slate-800">
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">
                        Selected Plan Rules
                      </p>
                      <p className="text-[10px] text-slate-400 italic">
                        ${relatedData.plan.price}/mo •{' '}
                        {relatedData.plan.description || 'Active Plan Protocol'}
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* Vendor Block */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Store size={12} /> Merchant Profile{' '}
                  <div className="h-[1px] flex-1 bg-slate-100"></div>
                </h3>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center text-slate-400 font-bold">
                    {selectedRequest.vendorName?.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-md font-bold text-slate-900 uppercase leading-none mb-1">
                      {selectedRequest.vendorName}
                    </h4>
                    <p className="text-[10px] font-mono text-slate-500 mb-2 truncate max-w-[200px]">
                      {selectedRequest.vendorId}
                    </p>
                    <div className="flex gap-2">
                      <a
                        href={`/vendors/${selectedRequest.vendorId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[9px] bg-slate-900 text-white px-2 py-1 rounded font-bold uppercase tracking-tighter hover:bg-orange-itred transition-colors flex items-center gap-1"
                      >
                        Public View <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                </div>
              </section>

              {/* Payment Data */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <CreditCard size={12} /> Financial Metadata{' '}
                  <div className="h-[1px] flex-1 bg-slate-100"></div>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem
                    label="Plan Protocol"
                    value={`${selectedRequest.selectedPlanCode} (${selectedRequest.requestedMonths} Months)`}
                  />
                  <DetailItem
                    label="Total Due"
                    value={`$${selectedRequest.amountPaid} ${selectedRequest.currency}`}
                  />
                  <DetailItem
                    label="Payment Channel"
                    value={`${selectedRequest.paymentMethod} / ${selectedRequest.activationType}`}
                  />
                  <DetailItem label="Ref Identifier" value={selectedRequest.paymentReference} />
                  <DetailItem label="Payer Identity" value={selectedRequest.payerName} />
                  <DetailItem label="Contact Point" value={selectedRequest.payerPhone} />
                </div>
              </section>

              {/* Text Fields */}
              <section className="space-y-6">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                    Proof of Payment Snapshot
                  </h3>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded text-xs font-mono whitespace-pre-wrap leading-relaxed text-slate-600">
                    {selectedRequest.proofOfPaymentText || 'NO TEXT SNAPSHOT ATTACHED'}
                  </div>
                </div>
                {selectedRequest.notes && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      Merchant Directive (Notes)
                    </h3>
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded text-xs text-orange-900 leading-relaxed italic">
                      "{selectedRequest.notes}"
                    </div>
                  </div>
                )}
              </section>

              {/* Admin Input */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Shield size={12} /> Console Protocols{' '}
                  <div className="h-[1px] flex-1 bg-slate-100"></div>
                </h3>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-pulse">
                    <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={16} />
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-red-700 tracking-widest">
                        Protocol Breach Detected
                      </p>
                      <p className="text-[10px] text-red-600 font-mono break-words">{error}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Administrative Notes
                  </label>
                  <textarea
                    className="w-full bg-slate-50 border border-slate-200 rounded p-4 text-xs outline-none focus:border-slate-900 min-h-[100px] resize-none"
                    placeholder="Enter audit notation or reason for protocol override..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                  />
                </div>
              </section>
            </div>

            {hasPermission('activation_requests.approve') ? (
              <footer className="p-6 bg-slate-50 border-t border-slate-200 grid grid-cols-3 gap-3">
                <button
                  disabled={processing}
                  onClick={() => handleAction('under_review')}
                  className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded hover:border-orange-itred hover:text-orange-itred transition-all disabled:opacity-50"
                >
                  <Clock size={16} />
                  <span className="text-[9px] font-black uppercase tracking-widest mt-1">
                    Review
                  </span>
                </button>
                <button
                  disabled={processing}
                  onClick={() => handleAction('rejected')}
                  className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded hover:border-red-600 hover:text-red-600 transition-all disabled:opacity-50"
                >
                  <X size={16} />
                  <span className="text-[9px] font-black uppercase tracking-widest mt-1">
                    Reject
                  </span>
                </button>
                <button
                  disabled={processing}
                  onClick={() => handleAction('approved')}
                  className="col-span-1 flex flex-col items-center justify-center p-3 bg-slate-900 text-white rounded hover:bg-orange-itred transition-all shadow-lg disabled:opacity-50"
                >
                  {processing ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  <span className="text-[9px] font-black uppercase tracking-widest mt-1">
                    Approve
                  </span>
                </button>
              </footer>
            ) : (
              <footer className="p-6 bg-orange-50 border-t border-orange-100 text-orange-700 text-[10px] font-bold uppercase text-center rounded-b-lg font-mono">
                Security Clearance [activation_requests.approve] Required for protocol execution
              </footer>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{label}</p>
    <p className="text-xs font-bold text-slate-900 truncate">{value || 'N/A'}</p>
  </div>
);

export const ConsoleVendors = () => {
  const { user, appUser, hasPermission } = useAuth();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [rpns, setRpns] = useState<RPNAgent[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'vendors'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setVendors(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Vendor registry sync error:', err);
        setLoading(false);
      },
    );

    const qRpns = query(collection(db, 'rpn_agents'), where('status', '==', 'active'));
    const unsubscribeRpns = onSnapshot(qRpns, (snapshot) => {
      setRpns(snapshot.docs.map((doc) => ({ rpnId: doc.id, ...doc.data() }) as RPNAgent));
    });

    return () => {
      unsubscribe();
      unsubscribeRpns();
    };
  }, []);

  const filteredVendors = vendors.filter((v) => {
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    const searchStr =
      `${v.businessName} ${v.vendorId} ${v.city} ${v.sector} ${v.rpnName || ''}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleUpdateVendor = async (vendorId: string, updates: any) => {
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'vendors', vendorId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      // Also update app_users and subscriptions if rpnId is changed
      if (updates.rpnId !== undefined) {
        const batch = writeBatch(db);
        const userRef = doc(db, 'app_users', vendorId);
        const subRef = doc(db, 'subscriptions', vendorId);

        batch.update(userRef, {
          rpnId: updates.rpnId,
          updatedAt: serverTimestamp(),
        });
        batch.set(subRef, { rpnId: updates.rpnId, updatedAt: serverTimestamp() }, { merge: true });

        await batch.commit();

        await createAuditLog({
          action: updates.rpnId ? 'RPN_VENDOR_ASSIGNED' : 'RPN_VENDOR_UNASSIGNED',
          targetType: 'vendor',
          targetId: vendorId,
          metadata: { rpnId: updates.rpnId, rpnName: updates.rpnName },
        });
      }

      await logActivity({
        action: 'CONSOLE_VENDOR_UPDATED',
        actorUid: user?.uid || '',
        actorEmail: user?.email || '',
        actorRole: appUser?.role || '',
        targetType: 'vendor',
        targetId: vendorId,
        metadata: updates,
      });

      if (selectedVendor && selectedVendor.id === vendorId) {
        setSelectedVendor({ ...selectedVendor, ...updates });
      }
    } catch (err: any) {
      console.error('Update failed:', err);
      handleFirestoreError(err, OperationType.WRITE, 'vendors');
      alert(`Update failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-700',
      published: 'bg-emerald-100 text-emerald-700',
      suspended: 'bg-red-100 text-red-700',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-700'}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white industrial-border rounded-lg p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
              Merchant Registry
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-1">VENDOR CATALOG MANAGEMENT</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="text"
                placeholder="Search merchants..."
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 pl-9 text-xs outline-none focus:border-orange-itred"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none focus:border-orange-itred font-bold uppercase tracking-widest"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-slate-300" size={40} />
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="p-20 text-center border-2 border-dashed border-slate-100 rounded">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              No merchants catalogued in system.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Merchant
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Location
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Sector
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Status
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Created
                  </th>
                  <th className="py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredVendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-4">
                      <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                        {v.businessName}
                      </p>
                      <p className="text-[9px] text-slate-400 font-mono italic">{v.id}</p>
                    </td>
                    <td className="py-4">
                      <p className="text-[10px] font-bold text-slate-600 uppercase">
                        {v.city || 'N/A'}
                      </p>
                      <p className="text-[9px] text-slate-400 uppercase">{v.suburb}</p>
                    </td>
                    <td className="py-4">
                      <span className="text-[9px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded uppercase">
                        {v.sector}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(v.status)}
                        <span
                          className={`text-[8px] font-bold uppercase ${v.visibility === 'public' ? 'text-blue-500' : 'text-slate-400'}`}
                        >
                          {v.visibility}
                        </span>
                      </div>
                    </td>
                    <td className="py-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">
                        {v.createdAt?.toDate().toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-4 text-right">
                      <button
                        onClick={() => setSelectedVendor(v)}
                        className="p-2 text-slate-400 hover:text-orange-itred hover:bg-orange-50 rounded transition-all"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vendor Detail Overlay */}
      {selectedVendor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <header className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-tight">Merchant Protocols</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  {selectedVendor.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedVendor(null)}
                className="p-2 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <Info size={12} /> Master Profile
                </h3>
                <div className="space-y-4">
                  <DetailItem label="Business Name" value={selectedVendor.businessName} />
                  <DetailItem
                    label="Owner UID"
                    value={selectedVendor.ownerId || selectedVendor.ownerUid}
                  />
                  <DetailItem
                    label="WhatsApp/Phone"
                    value={`${selectedVendor.whatsapp || 'N/A'} / ${selectedVendor.phone || 'N/A'}`}
                  />
                  <DetailItem
                    label="Location"
                    value={`${selectedVendor.location}, ${selectedVendor.suburb}, ${selectedVendor.city}`}
                  />
                  <DetailItem label="Business Type" value={selectedVendor.businessType} />

                  <div className="pt-4 border-t border-slate-50">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                      <Laptop size={12} className="text-orange-itred" /> POS Module Status
                    </p>
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-900 uppercase">
                          POS Entitlement
                        </p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                          Current Plan: {selectedVendor.planCode || 'Starter'}
                        </p>
                      </div>
                      {selectedVendor.posEnabled ? (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            Active
                          </span>
                        </div>
                      ) : (
                        <button
                          disabled={processing}
                          onClick={async () => {
                            if (
                              window.confirm(
                                "Activate POS for this vendor? This will provision a default Main Shop and set the plan to 'pos'.",
                              )
                            ) {
                              setProcessing(true);
                              try {
                                await activatePOSForVendor(selectedVendor.id, 'pos');
                                alert('POS ACTIVATED SUCCESSFULLY. Default shop provisioned.');
                                setSelectedVendor({
                                  ...selectedVendor,
                                  posEnabled: true,
                                  planCode: 'pos',
                                });
                              } catch (err: any) {
                                alert('POS ACTIVATION FAILED: ' + err.message);
                              } finally {
                                setProcessing(false);
                              }
                            }
                          }}
                          className="bg-orange-itred text-white px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all flex items-center gap-2"
                        >
                          {processing ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Plus size={12} />
                          )}
                          Activate POS
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">
                      Current RPN Attribution
                    </p>
                    <div className="flex flex-col gap-2">
                      <div className="flex-1 bg-slate-50 border border-slate-100 p-2 rounded flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-700 uppercase">
                            {selectedVendor.rpnName || 'Direct (No Agent)'}
                          </span>
                          {selectedVendor.rpnCode && (
                            <span className="text-[8px] font-mono font-black text-orange-itred">
                              {selectedVendor.rpnCode}
                            </span>
                          )}
                        </div>
                        {selectedVendor.rpnId && (
                          <button
                            onClick={() =>
                              handleUpdateVendor(selectedVendor.id, {
                                rpnId: '',
                                rpnName: 'Direct',
                                rpnCode: '',
                              })
                            }
                            className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Remove RPN"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {hasPermission('rpn.manage') && (
                <section>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                    <Users size={12} /> Re-Assign RPN Agent
                  </h3>
                  <div className="space-y-3">
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-orange-itred"
                      value={selectedVendor.rpnId || ''}
                      onChange={(e) => {
                        const rpn = rpns.find((r) => r.rpnId === e.target.value);
                        if (rpn) {
                          handleUpdateVendor(selectedVendor.id, {
                            rpnId: rpn.rpnId,
                            rpnName: rpn.fullName,
                            rpnCode: rpn.rpnCode || '',
                          });
                        }
                      }}
                    >
                      <option value="">SELECT AGENT FOR RE-ATTRIBUTION</option>
                      {rpns.map((rpn) => (
                        <option key={rpn.rpnId} value={rpn.rpnId}>
                          {rpn.fullName} ({rpn.rpnCode || 'No Code'})
                        </option>
                      ))}
                    </select>
                    <p className="text-[8px] text-slate-400 font-bold uppercase italic leading-tight">
                      Warning: Re-assigning the RPN will update attribution in merchants, user
                      profiles, and future finance cycles.
                    </p>
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <Shield size={12} /> Administrative Overrides
                </h3>
                {hasPermission('vendors.manage') ? (
                  <div className="space-y-6">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                        Publishing Status
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['draft', 'published', 'suspended'].map((s) => (
                          <button
                            key={s}
                            disabled={processing}
                            onClick={() =>
                              handleUpdateVendor(selectedVendor.id, {
                                status: s,
                              })
                            }
                            className={`p-2 text-[9px] font-black uppercase tracking-widest border rounded transition-all ${selectedVendor.status === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                        Market Visibility
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['private', 'public'].map((v) => (
                          <button
                            key={v}
                            disabled={processing}
                            onClick={() =>
                              handleUpdateVendor(selectedVendor.id, {
                                visibility: v,
                              })
                            }
                            className={`p-2 text-[9px] font-black uppercase tracking-widest border rounded transition-all ${selectedVendor.visibility === v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-orange-50 border border-orange-100 text-orange-700 text-[10px] font-bold uppercase text-center rounded">
                    Read-Only Access - Permission [vendors.manage] Required
                  </div>
                )}
              </section>
            </div>

            <footer className="p-6 bg-slate-50 border-t border-slate-200">
              <Link
                to={`/vendors/${selectedVendor.id}`}
                target="_blank"
                className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 p-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all hover:border-slate-900"
              >
                Open Storefront Node <ExternalLink size={14} />
              </Link>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export const ConsoleProducts = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Product inventory sync error:', err);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesVisibility = visibilityFilter === 'all' || p.visibility === visibilityFilter;
    const searchStr = `${p.name} ${p.vendorId} ${p.category}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
    return matchesStatus && matchesVisibility && matchesSearch;
  });

  const handleUpdateProduct = async (productId: string, updates: any) => {
    setProcessing(productId);
    try {
      await updateDoc(doc(db, 'products', productId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      await createAuditLog({
        action: 'CONSOLE_PRODUCT_UPDATED',
        targetType: 'product',
        targetId: productId,
        vendorId: products.find((p) => p.id === productId)?.vendorId || 'unknown',
        metadata: updates,
      });
    } catch (err: any) {
      console.error('Update failed:', err);
      handleFirestoreError(err, OperationType.WRITE, 'products');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white industrial-border rounded-lg p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
              Global Products
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-1">CROSS-NETWORK INVENTORY AUDIT</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="text"
                placeholder="Search products..."
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 pl-9 text-xs outline-none focus:border-orange-itred"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
          <select
            className="bg-slate-50 border border-slate-200 rounded p-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-orange-itred"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">S: ALL STATUS</option>
            <option value="published">S: PUBLISHED</option>
            <option value="draft">S: DRAFT</option>
          </select>
          <select
            className="bg-slate-50 border border-slate-200 rounded p-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-orange-itred"
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value)}
          >
            <option value="all">V: ALL VISIBILITY</option>
            <option value="public">V: PUBLIC</option>
            <option value="private">V: PRIVATE</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-slate-300" size={40} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-20 text-center border-2 border-dashed border-slate-100 rounded">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              No products detected in inventory.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Product Node
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Merchant
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Financials
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Status
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Visibility
                  </th>
                  <th className="py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] ? (
                          <img
                            src={p.images[0]}
                            alt=""
                            className="w-10 h-10 object-cover rounded border border-slate-100"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-slate-100 rounded border border-slate-100 flex items-center justify-center text-slate-400">
                            <Package size={16} />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                            {p.name}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono italic">{p.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <p className="text-[10px] font-bold text-slate-600 uppercase truncate max-w-[150px]">
                        {p.businessName || p.vendorId}
                      </p>
                    </td>
                    <td className="py-4">
                      <p className="text-xs font-black text-slate-900">${p.price}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">
                        {p.stockQty} In Stock
                      </p>
                    </td>
                    <td className="py-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${p.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${p.visibility === 'public' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        {p.visibility}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {p.status === 'published' ? (
                          <button
                            disabled={processing === p.id}
                            onClick={() => handleUpdateProduct(p.id, { status: 'draft' })}
                            className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors"
                          >
                            {processing === p.id ? '...' : 'Unpublish'}
                          </button>
                        ) : (
                          <button
                            disabled={processing === p.id}
                            onClick={() => handleUpdateProduct(p.id, { status: 'published' })}
                            className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-500 transition-colors"
                          >
                            {processing === p.id ? '...' : 'Publish'}
                          </button>
                        )}
                        <button
                          disabled={processing === p.id}
                          onClick={() =>
                            handleUpdateProduct(p.id, {
                              visibility: p.visibility === 'public' ? 'private' : 'public',
                            })
                          }
                          className="p-1 text-slate-300 hover:text-slate-600 transition-colors"
                        >
                          {p.visibility === 'public' ? <Shield size={14} /> : <Globe size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const ConsolePlans = () => {
  const { appUser } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  const isSuperAdmin = appUser?.role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    const q = query(collection(db, 'plans'), orderBy('sortOrder', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPlans(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Plan protocol sync error:', err);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setProcessing(true);
    try {
      const planData = {
        ...editingPlan,
        updatedAt: serverTimestamp(),
      };
      if (!editingPlan.id) {
        planData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'plans'), planData);
      } else {
        await updateDoc(doc(db, 'plans', editingPlan.id), planData);
      }

      await createAuditLog({
        action: 'CONSOLE_PLAN_UPDATED',
        targetType: 'plan',
        targetId: editingPlan.id || 'new',
        vendorId: 'system',
        metadata: planData,
      });

      setEditingPlan(null);
    } catch (err: any) {
      console.error('Save failed:', err);
      handleFirestoreError(err, OperationType.WRITE, 'plans');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white industrial-border rounded-lg p-8 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
              Pricing Plans
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-1">REVENUE PROTOCOL ADAPTATION</p>
          </div>
          {isSuperAdmin && (
            <button
              onClick={() =>
                setEditingPlan({
                  active: true,
                  features: [],
                  sortOrder: plans.length,
                })
              }
              className="bg-slate-900 text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-orange-itred transition-all flex items-center gap-2"
            >
              <Plus size={14} /> New Plan
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-slate-300" size={40} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`p-6 border rounded-lg transition-all ${plan.active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Layer {plan.sortOrder}
                  </span>
                  {isSuperAdmin && (
                    <button
                      onClick={() => setEditingPlan(plan)}
                      className="p-1 hover:text-orange-itred transition-colors"
                    >
                      <Edit size={14} />
                    </button>
                  )}
                </div>
                <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                  {plan.name}
                </h3>
                <p className="text-[10px] font-mono text-slate-400 mb-4">{plan.code}</p>
                <p className="text-2xl font-black text-slate-900 mb-6">
                  ${plan.price}
                  <span className="text-xs font-normal text-slate-400">/{plan.billingCycle}</span>
                </p>
                <div className="space-y-2 mb-6">
                  {plan.features?.map((f: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-[10px] text-slate-600 font-bold uppercase tracking-tight"
                    >
                      <Check size={10} className="text-emerald-500" /> {f}
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest ${plan.active ? 'text-emerald-500' : 'text-slate-400'}`}
                  >
                    {plan.active ? 'Protocol Active' : 'Protocol Stalled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editing Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in duration-200">
            <header className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold uppercase tracking-tight">
                {editingPlan.id ? 'Modify Plan Protocol' : 'Initialise New Plan'}
              </h2>
              <button
                onClick={() => setEditingPlan(null)}
                className="p-2 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </header>
            <form onSubmit={handleSavePlan} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                    Plan Name
                  </label>
                  <input
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs outline-none focus:border-slate-900"
                    value={editingPlan.name || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                    Plan Code
                  </label>
                  <input
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs outline-none focus:border-slate-900 font-mono"
                    value={editingPlan.code || ''}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                    Price (USD)
                  </label>
                  <input
                    type="number"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs outline-none focus:border-slate-900"
                    value={editingPlan.price || 0}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        price: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs outline-none focus:border-slate-900"
                    value={editingPlan.sortOrder || 0}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        sortOrder: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                  Description
                </label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs outline-none focus:border-slate-900 min-h-[80px]"
                  value={editingPlan.description || ''}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <button
                disabled={processing}
                type="submit"
                className="w-full bg-slate-900 text-white p-4 rounded text-xs font-black uppercase tracking-widest hover:bg-orange-itred transition-all flex items-center justify-center gap-2"
              >
                {processing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  'Execute Protocol Write'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const ConsoleSubscriptions = () => {
  const { user, appUser, hasPermission } = useAuth();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'subscriptions'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setSubscriptions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Subscription lease sync error:', err);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const filteredSubs = subscriptions.filter((s) => {
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const searchStr = `${s.vendorId} ${s.planCode}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleUpdateSub = async (subId: string, updates: any) => {
    setProcessing(subId);
    try {
      await updateDoc(doc(db, 'subscriptions', subId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        action: 'CONSOLE_SUBSCRIPTION_UPDATED',
        actorUid: user?.uid || '',
        actorEmail: user?.email || '',
        actorRole: appUser?.role || '',
        targetType: 'subscription',
        targetId: subId,
        metadata: updates,
      });
    } catch (err: any) {
      console.error('Update failed:', err);
      handleFirestoreError(err, OperationType.WRITE, 'subscriptions');
    } finally {
      setProcessing(null);
    }
  };

  const getDaysRemaining = (expiresAt: any) => {
    if (!expiresAt) return 'N/A';
    const expiry = expiresAt.toDate();
    const today = new Date();
    const diff = expiry.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white industrial-border rounded-lg p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
              Vendor Subscriptions
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-1">CAPACITY & LEASE MANAGEMENT</p>
          </div>
          <div className="flex gap-4">
            <select
              className="bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none focus:border-orange-itred font-bold uppercase tracking-widest"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All States</option>
              <option value="active">Active</option>
              <option value="pending_activation">Pending</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-slate-300" size={40} />
          </div>
        ) : filteredSubs.length === 0 ? (
          <div className="p-20 text-center border-2 border-dashed border-slate-100 rounded">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              No active leases on system.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Vendor Identity
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Plan Protocol
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Lease Window
                  </th>
                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Status
                  </th>
                  <th className="py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSubs.map((s) => {
                  const days = getDaysRemaining(s.expiresAt);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4">
                        <p className="text-xs font-mono font-bold text-slate-900">{s.vendorId}</p>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded">
                            {s.planCode}
                          </span>
                          {s.entitlements?.pos && (
                            <span className="text-[8px] font-black bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200">
                              POS
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">
                          Expires: {s.expiresAt?.toDate().toLocaleDateString()}
                        </p>
                        <p
                          className={`text-[9px] font-black uppercase tracking-tighter ${Number(days) < 7 ? 'text-red-500' : 'text-slate-400'}`}
                        >
                          {days} Days Remaining
                        </p>
                      </td>
                      <td className="py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {hasPermission('subscriptions.manage') ? (
                            s.status === 'active' ? (
                              <button
                                disabled={processing === s.id}
                                onClick={() => handleUpdateSub(s.id, { status: 'suspended' })}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                title="Suspend Protocol"
                              >
                                <Shield size={14} />
                              </button>
                            ) : (
                              <button
                                disabled={processing === s.id}
                                onClick={() => handleUpdateSub(s.id, { status: 'active' })}
                                className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
                                title="Reactivate Protocol"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            )
                          ) : (
                            <span className="text-[8px] font-bold text-slate-400 uppercase italic">
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const ConsoleAuditLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setLogs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Audit log sync error:', err);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter((l) => actionFilter === 'all' || l.action === actionFilter);

  return (
    <div className="space-y-6">
      <div className="bg-white industrial-border rounded-lg p-8 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
              Diagnostic Logs
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-1">REAL-TIME SYSTEM AUDIT TRAIL</p>
          </div>
          <select
            className="bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none focus:border-orange-itred font-bold uppercase tracking-widest"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">All Actions</option>
            {Array.from(new Set(logs.map((l) => l.action))).map((a: any) => (
              <option key={a} value={a}>
                {String(a).replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-slate-300" size={40} />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 bg-slate-50 border border-slate-100 rounded flex gap-4 items-start hover:border-slate-200 transition-colors"
              >
                <div className="p-2 bg-white rounded border border-slate-100 text-slate-400">
                  <History size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                      {log.action}
                    </p>
                    <p className="text-[9px] font-mono text-slate-400">
                      {log.timestamp?.toDate().toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-4 mt-1">
                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">
                      Target: {log.targetType} / {log.targetId}
                    </p>
                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">
                      Actor: {log.actorEmail || log.performedBy || log.actorUid || 'Unknown'}
                    </p>
                  </div>
                  {log.metadata && (
                    <p className="text-[8px] font-mono text-slate-400 mt-2 bg-white p-2 rounded truncate max-w-full">
                      {JSON.stringify(log.metadata)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// CONSOLE FINANCE PAGE
export const ConsoleFinancePage = () => {
  const { user, appUser, hasPermission } = useAuth();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
  const [requests, setRequests] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!hasPermission('finance.view')) return;

    logActivity({
      action: 'FINANCE_DASHBOARD_VIEWED',
      actorUid: user?.uid || '',
      actorEmail: user?.email || '',
      actorRole: appUser?.role || '',
      targetType: 'system',
      targetId: 'finance_dashboard',
    });

    const unsubRequests = onSnapshot(
      collection(db, 'activation_requests'),
      (snap) => {
        setRequests(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => console.error('Finance: Requests sync error', err),
    );

    const unsubSubs = onSnapshot(
      collection(db, 'subscriptions'),
      (snap) => {
        setSubscriptions(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => console.error('Finance: Subscriptions sync error', err),
    );

    const unsubVendors = onSnapshot(
      collection(db, 'vendors'),
      (snap) => {
        setVendors(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Finance: Vendors sync error', err);
        setLoading(false);
      },
    );

    return () => {
      unsubRequests();
      unsubSubs();
      unsubVendors();
    };
  }, []);

  // Helper to check if date is in period
  const isInPeriod = (timestamp: any) => {
    if (!timestamp) return false;
    if (period === 'all') return true;
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const day = 24 * 60 * 60 * 1000;

    switch (period) {
      case 'today':
        return diff < day;
      case 'week':
        return diff < 7 * day;
      case 'month':
        return diff < 30 * day;
      case 'year':
        return diff < 365 * day;
      default:
        return true;
    }
  };

  // CALCULATIONS
  const approvedRequests = requests.filter((r) =>
    ['active', 'approved', 'completed', 'verified'].includes(r.status),
  );
  const periodRequests = approvedRequests.filter((r) => isInPeriod(r.approvedAt || r.createdAt));

  const totalMoney = approvedRequests.reduce(
    (acc, r) => acc + (Number(r.amountPaid) || Number(r.amount) || 0),
    0,
  );
  const periodMoney = periodRequests.reduce(
    (acc, r) => acc + (Number(r.amountPaid) || Number(r.amount) || 0),
    0,
  );

  const pendingMoney = requests
    .filter((r) => r.status === 'submitted')
    .reduce((acc, r) => acc + (Number(r.amountPaid) || Number(r.amount) || 0), 0);

  // SUBSCRIBER STATS
  const activeRpns = Array.from(
    new Set([
      ...vendors.filter((v) => v.rpnId && v.rpnStatus === 'verified').map((v) => v.rpnId),
      ...requests.filter((r) => r.rpnId && r.rpnStatus === 'verified').map((r) => r.rpnId),
    ]),
  );

  // RPN Mapping for identification
  const rpnDataMap: Record<string, any> = {};
  const [rpnAgents, setRpnAgents] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rpn_agents'), (snap) => {
      setRpnAgents(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const getRpnInfo = (id: string) => {
    const agent = rpnAgents.find((a) => a.id === id);
    return agent ? { name: agent.fullName, code: agent.rpnCode } : { name: 'Unknown', code: id };
  };

  const subStats = {
    total: subscriptions.length,
    active: subscriptions.filter((s) => s.status === 'active').length,
    trial: subscriptions.filter((s) => s.status === 'trial').length,
    expired: subscriptions.filter((s) => s.status === 'expired').length,
    suspended: subscriptions.filter((s) => s.status === 'suspended').length,
    pending: requests.filter((r) => r.status === 'submitted').length,
  };

  // CHURN RISK
  const now = new Date();
  const imminentExpiry = subscriptions.filter((s) => {
    if (s.status !== 'active' && s.status !== 'trial') return false;
    if (!s.expiresAt) return false;
    const expiry = s.expiresAt.toDate ? s.expiresAt.toDate() : new Date(s.expiresAt);
    const diff = expiry.getTime() - now.getTime();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  }).length;

  // Geography & Sector Breakdown
  const cityMap: any = {};
  const sectorMap: any = {};
  vendors.forEach((v) => {
    const city = v.city || 'Unknown';
    cityMap[city] = (cityMap[city] || 0) + 1;

    const sector = v.sector || 'general';
    sectorMap[sector] = (sectorMap[sector] || 0) + 1;
  });

  // RPN Analytics
  const rpnMap: any = {};
  const rpnRevenueMap: any = {};
  const pendingVerificationCount = vendors.filter(
    (v) => v.rpnReferralCode && v.rpnStatus === 'pending_verification',
  ).length;

  vendors.forEach((v) => {
    if (v.rpnId && v.rpnStatus === 'verified') {
      rpnMap[v.rpnId] = (rpnMap[v.rpnId] || 0) + 1;
    }
  });

  approvedRequests.forEach((r) => {
    if (r.rpnId && r.rpnStatus === 'verified') {
      rpnRevenueMap[r.rpnId] = (rpnRevenueMap[r.rpnId] || 0) + (Number(r.amountPaid) || 0);
    }
  });

  const filteredRequests = requests
    .filter((r) => {
      const search = searchTerm.toLowerCase();
      return (
        r.vendorName?.toLowerCase().includes(search) ||
        r.paymentReference?.toLowerCase().includes(search) ||
        r.id.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const exportCSV = () => {
    if (!hasPermission('finance.view')) return;
    const headers = [
      'Request ID',
      'Vendor',
      'Plan',
      'Amount',
      'Currency',
      'Method',
      'Reference',
      'Status',
      'Date',
    ];
    const rows = approvedRequests.map((r) => [
      r.id,
      r.vendorName || r.vendorId,
      r.selectedPlanName || 'N/A',
      r.amountPaid || r.amount || 0,
      r.currency || 'USD',
      r.paymentMethod || 'N/A',
      r.paymentReference || 'N/A',
      r.status,
      r.createdAt?.toDate
        ? r.createdAt.toDate().toLocaleString()
        : new Date(r.createdAt).toLocaleString(),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers, ...rows].map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `itred_finance_export_${new Date().toISOString().split('T')[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();

    logActivity({
      action: 'FINANCE_EXPORT_GENERATED',
      actorUid: user?.uid || '',
      actorEmail: user?.email || '',
      actorRole: appUser?.role || '',
      targetType: 'system',
      targetId: 'finance_export',
    });
  };

  if (!hasPermission('finance.view')) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white industrial-border rounded-lg shadow-sm text-center">
        <Shield size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-black uppercase text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-sm">
          Your desk does not include finance.view protocol privileges
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Main Stats */}
      <div className="bg-slate-900 p-8 rounded-lg text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">
              Financial Intelligence
            </h1>
            <p className="text-orange-itred text-[10px] font-bold uppercase tracking-[0.3em] mt-1">
              Platform Revenue & Growth Monitor
            </p>
          </div>
          <div className="flex gap-2 bg-slate-800 p-1 rounded border border-slate-700">
            {['today', 'week', 'month', 'year', 'all'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p as any)}
                className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded transition-all ${period === p ? 'bg-orange-itred text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-800/50 p-6 rounded border border-slate-700/50">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
              Period Revenue
            </p>
            <h2 className="text-4xl font-black italic text-emerald-400 leading-none">
              ${periodMoney.toLocaleString()}
            </h2>
            <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-tighter">
              Gross received in {period}
            </p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded border border-slate-700/50">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
              Total Revenue
            </p>
            <h2 className="text-4xl font-black italic text-white leading-none">
              ${totalMoney.toLocaleString()}
            </h2>
            <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-tighter">
              Cumulative Platform Yield
            </p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded border border-slate-700/50">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
              Active Roster
            </p>
            <h2 className="text-4xl font-black italic text-sky-400 leading-none">
              {subStats.active}
            </h2>
            <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-tighter">
              Verified store operators
            </p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded border border-slate-700/50">
            <p className="text-[10px] text-orange-itred font-bold uppercase tracking-widest mb-1">
              Churn Watch
            </p>
            <h2 className="text-4xl font-black italic text-white leading-none">{imminentExpiry}</h2>
            <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-tighter">
              Subscriptions at risk (7 Days)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Breakdown */}
        <div className="bg-white industrial-border p-6 rounded-lg shadow-sm">
          <h3 className="text-[10px] font-black uppercase text-slate-900 tracking-widest mb-6 flex items-center gap-2 border-b-2 border-slate-900 pb-2">
            <PieChart size={12} /> Subscriber Status
          </h3>
          <div className="space-y-4">
            {[
              {
                label: 'Active',
                value: subStats.active,
                color: 'bg-emerald-500',
              },
              { label: 'Trial', value: subStats.trial, color: 'bg-sky-500' },
              {
                label: 'Pending',
                value: subStats.pending,
                color: 'bg-orange-500',
              },
              {
                label: 'Expired',
                value: subStats.expired,
                color: 'bg-red-500',
              },
              {
                label: 'Suspended',
                value: subStats.suspended,
                color: 'bg-slate-500',
              },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">{s.label}</span>
                  <span className="text-[10px] font-black text-slate-900">{s.value}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${s.color}`}
                    style={{
                      width: `${(s.value / (subStats.total || 1)) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Geography breakdown */}
        <div className="bg-white industrial-border p-6 rounded-lg shadow-sm">
          <h3 className="text-[10px] font-black uppercase text-slate-900 tracking-widest mb-6 flex items-center gap-2 border-b-2 border-slate-900 pb-2">
            <MapPin size={12} /> Area Concentration
          </h3>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {Object.entries(cityMap)
              .sort((a: any, b: any) => b[1] - a[1])
              .map(([city, count]: any) => (
                <div
                  key={city}
                  className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-100"
                >
                  <span className="text-[10px] font-black uppercase text-slate-700">{city}</span>
                  <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* RPN Analytics */}
        <div className="bg-white industrial-border p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-6 border-b-2 border-slate-900 pb-2">
            <h3 className="text-[10px] font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
              <Users size={12} /> RPN Performance
            </h3>
            {pendingVerificationCount > 0 && (
              <Link
                to="/console/rpn-verification"
                className="text-[8px] font-black uppercase bg-orange-50 text-orange-itred px-2 py-0.5 rounded border border-orange-100 hover:bg-orange-100 transition-colors"
              >
                {pendingVerificationCount} Pending Verification
              </Link>
            )}
          </div>
          {Object.keys(rpnMap).length > 0 ? (
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {Object.entries(rpnMap)
                .sort((a: any, b: any) => b[1] - a[1])
                .map(([rpnId, count]: any) => {
                  const info = getRpnInfo(rpnId);
                  return (
                    <div
                      key={rpnId}
                      className="flex flex-col p-3 bg-orange-50 rounded border border-orange-100 gap-2"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col truncate pr-2">
                          <span className="text-[10px] font-black uppercase text-orange-900 truncate">
                            {info.name}
                          </span>
                          <span className="text-[8px] font-mono text-slate-400 truncate">
                            {info.code}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 bg-orange-itred text-white text-[9px] font-black rounded whitespace-nowrap">
                          {count} stores
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-bold">
                        <span className="text-slate-500 uppercase italic">Revenue Share:</span>
                        <span className="text-emerald-600">
                          ${(rpnRevenueMap[rpnId] || 0).toLocaleString()} (est)
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 bg-slate-50 rounded text-center">
              <Users size={16} className="text-slate-300 mb-2" />
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                No RPN-linked subscriber data yet
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white industrial-border rounded-lg shadow-sm overflow-hidden">
        <header className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
              Revenue Stream
            </h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
              Verification & Activation History
            </p>
          </div>
          <div className="flex gap-4">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={12}
              />
              <input
                type="text"
                placeholder="SEARCH PAYMENTS..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border border-slate-200 rounded py-2 pl-8 pr-4 text-[10px] outline-none focus:border-orange-itred w-64 font-bold"
              />
            </div>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-orange-itred transition-all"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  Reference
                </th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  Vendor
                </th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  Amount
                </th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  RPN
                </th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  Status
                </th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-mono">
              {filteredRequests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-900">
                        {r.paymentReference || 'N/A'}
                      </span>
                      <span className="text-[8px] text-slate-400">{r.id}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-700">
                        {r.vendorName?.toUpperCase()}
                      </span>
                      <span className="text-[8px] text-slate-400">{r.selectedPlanName}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`text-[10px] font-black ${['approved', 'active', 'completed'].includes(r.status) ? 'text-emerald-600' : 'text-slate-400'}`}
                    >
                      {r.amountPaid || r.amount || '0'} {r.currency || 'USD'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 truncate max-w-[100px]">
                        {r.rpnCode || r.rpnName || 'Direct'}
                      </span>
                      {r.rpnId && (
                        <span className="text-[8px] text-slate-300 font-mono truncate">
                          {r.rpnId}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded-[2px] text-[8px] font-black uppercase tracking-widest ${
                        r.status === 'approved' || r.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : r.status === 'submitted'
                            ? 'bg-orange-100 text-orange-700'
                            : r.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-[9px] text-slate-400 italic">
                      {r.approvedAt?.toDate
                        ? r.approvedAt.toDate().toLocaleString()
                        : r.createdAt?.toDate
                          ? r.createdAt.toDate().toLocaleString()
                          : 'N/A'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRequests.length === 0 && (
          <div className="p-20 text-center bg-slate-50">
            <DollarSign className="mx-auto text-slate-200 mb-4" size={40} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              No payment records detected in current perimeter
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export const ConsoleHealth = () => {
  const { user, appUser, vendorId } = useAuth();
  const [counts, setCounts] = useState<any>({});

  useEffect(() => {
    const fetchCounts = async () => {
      const collectionNames = [
        'app_users',
        'vendors',
        'products',
        'orders',
        'activation_requests',
        'subscriptions',
        'audit_logs',
      ];
      const results: any = {};

      try {
        const countsPromises = collectionNames.map(async (c) => {
          const snapshot = await getCountFromServer(collection(db, c));
          return { name: c, count: snapshot.data().count };
        });

        const settled = await Promise.all(countsPromises);
        settled.forEach((res) => {
          results[res.name] = res.count;
        });
        setCounts(results);
      } catch (err) {
        console.error('Health fetch failed:', err);
      }
    };
    fetchCounts();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white industrial-border rounded-lg p-8 shadow-sm">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
              System Status
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-1">
              REAL-TIME MONITORING NODE ACTIVE
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="status-dot bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase">
              Node_Online
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mono">
          <HealthCard
            icon={<Database size={18} className="text-blue-500" />}
            label="Firebase"
            status="US-WEST1"
          />
          <HealthCard
            icon={<Key size={18} className="text-yellow-500" />}
            label="Auth"
            status="ACTIVE_FIREBASE"
          />
          <HealthCard
            icon={<Server size={18} className="text-orange-itred" />}
            label="Security"
            status="v2_STRICT"
          />
          <HealthCard
            icon={<Laptop size={18} className="text-slate-500" />}
            label="Runtime"
            status="CONTROLLED"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-4 space-y-6">
          <div className="bg-charcoal text-white rounded-lg p-6 industrial-border border-slate-800">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-6 border-b border-slate-800 pb-2">
              Active Session
            </h3>
            <div className="space-y-6">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block mb-1 font-bold">
                  Access Role
                </span>
                <span className="px-2 py-1 bg-orange-itred rounded text-[10px] font-bold tracking-widest">
                  {appUser?.role?.toUpperCase() || 'EXTERNAL'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block mb-1 font-bold">
                  User Identity
                </span>
                <span className="mono text-xs text-slate-300 block truncate">{user?.email}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block mb-1 font-bold">
                  Relational Link
                </span>
                <span className="mono text-xs text-slate-300">
                  {vendorId ? `VEN_${vendorId.substring(0, 8)}` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-8 bg-white industrial-border rounded-lg p-6">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-6 border-b pb-2">
            Diagnostic Output
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] mono">
            {Object.keys(counts).length > 0
              ? Object.entries(counts).map(([col, status]: [string, any]) => (
                  <div
                    key={col}
                    className="px-3 py-2 bg-slate-50 border border-slate-100 rounded text-slate-600 hover:border-orange-itred/30 transition-colors flex justify-between"
                  >
                    <span>{col}</span>
                    <span className="text-emerald-500 font-black">{status}</span>
                  </div>
                ))
              : [
                  'app_users',
                  'vendors',
                  'products',
                  'orders',
                  'catalogues',
                  'branches',
                  'audit_logs',
                  'plans',
                  'subscriptions',
                ].map((col) => (
                  <div
                    key={col}
                    className="px-3 py-2 bg-slate-50 border border-slate-100 rounded text-slate-600 hover:border-orange-itred/30 transition-colors"
                  >
                    {col}
                  </div>
                ))}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 italic text-[10px] text-slate-400 font-mono">
            // Foundation established successfully // No logical leaks detected // Ready for Phase 2
            expansion
          </div>
        </div>
      </div>
    </div>
  );
};

const HealthCard = ({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
}) => (
  <div className="bg-slate-50 p-4 industrial-border rounded border-slate-100 flex flex-col gap-2">
    <div className="bg-white w-fit p-2 rounded shadow-sm industrial-border border-slate-200">
      {icon}
    </div>
    <div>
      <p className="text-[9px] text-slate-400 uppercase tracking-tighter font-bold">{label}</p>
      <p className="text-xs font-bold text-slate-900 truncate">{status}</p>
    </div>
  </div>
);

export const ConsoleStaffPage = () => {
  const { user, appUser, hasPermission } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [inviteFormData, setInviteFormData] = useState({
    email: '',
    role: 'support_officer' as ConsoleRole,
    permissions: CONSOLE_ROLES.support_officer.defaultPermissions as PermissionKey[],
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const qStaff = query(collection(db, 'console_staff'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(qStaff);
        setStaff(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err: any) {
        console.error('Staff Fetch Error:', err);
      }
    };

    const fetchInvites = async () => {
      try {
        const qInvites = query(collection(db, 'console_invites'), orderBy('invitedAt', 'desc'));
        const snap = await getDocs(qInvites);
        setInvites(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err: any) {
        console.error('Invites Fetch Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
    fetchInvites();
  }, []);

  const handleRoleChange = (role: ConsoleRole) => {
    setInviteFormData({
      ...inviteFormData,
      role,
      permissions: CONSOLE_ROLES[role].defaultPermissions,
    });
  };

  const togglePermission = (perm: PermissionKey) => {
    setInviteFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviteCode('');

    // Diagnostics
    console.log('DIAGNOSTICS: ADMIN IDENTITY CHECK', {
      uid: user?.uid,
      email: user?.email,
      role: appUser?.role,
      consolePermissions: appUser?.consolePermissions,
      isSuperAdmin: appUser?.role === 'super_admin',
    });

    if (appUser?.role !== 'super_admin') {
      setError('INSUFFICIENT CLEARANCE: ONLY SUPER ADMIN MAY INITIALIZE INVITES');
      return;
    }

    if (!inviteFormData.email) {
      setError('EMAIL REQUIRED');
      return;
    }

    const inviteId = `INV-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitePayload = {
      inviteId: inviteId,
      email: inviteFormData.email.toLowerCase().trim(),
      role: inviteFormData.role,
      permissions: Array.isArray(inviteFormData.permissions) ? inviteFormData.permissions : [],
      status: 'pending',
      invitedBy: user?.uid,
      invitedAt: serverTimestamp(),
      acceptedAt: null,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    console.log('[CONSOLE INVITE PATH]', `console_invites/${inviteId}`);
    console.log('[CONSOLE INVITE AUTH]', {
      uid: user?.uid,
      email: user?.email,
    });
    console.log('[CONSOLE INVITE PAYLOAD]', invitePayload);

    try {
      await setDoc(doc(db, 'console_invites', inviteId), invitePayload);

      setInviteCode(inviteId);
      setSuccess(`STAFF INVITE PROTOCOL INITIALIZED FOR ${inviteFormData.email.toUpperCase()}`);

      await logActivity({
        action: 'CONSOLE_STAFF_INVITED',
        actorUid: user?.uid || '',
        actorEmail: user?.email || '',
        actorRole: appUser?.role || '',
        targetType: 'console_invite',
        targetId: inviteId,
        metadata: { email: inviteFormData.email, role: inviteFormData.role },
      });

      // Re-fetch invites manually
      const qInvites = query(collection(db, 'console_invites'), orderBy('invitedAt', 'desc'));
      const snap = await getDocs(qInvites);
      setInvites(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      setInviteFormData({
        email: '',
        role: 'support_officer' as ConsoleRole,
        permissions: CONSOLE_ROLES.support_officer.defaultPermissions as PermissionKey[],
      });
    } catch (err: any) {
      console.error('INVITE ERROR:', err);
      if (
        err.message.includes('permission-denied') ||
        err.message.includes('insufficient permissions')
      ) {
        const diag = `UID: ${user?.uid} | PATH: console_invites/${inviteId} | PAYLOAD: ${JSON.stringify(invitePayload)}`;
        setError(
          `Invite blocked. Check current user role is super_admin and invite payload matches rules. DIAG: ${diag}`,
        );
      } else {
        setError(err.message || 'INVITE FAILED');
      }
    }
  };

  const handleRevokeInvite = async (id: string, email: string) => {
    if (!window.confirm(`REVOKE INVITE FOR ${email}?`)) return;
    try {
      await setDoc(
        doc(db, 'console_invites', id),
        {
          status: 'revoked',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await logActivity({
        action: 'CONSOLE_INVITE_REVOKED',
        actorUid: user?.uid || '',
        actorEmail: user?.email || '',
        actorRole: appUser?.role || '',
        targetType: 'console_invite',
        targetId: id,
        metadata: { email },
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateStaffStatus = async (uid: string, email: string, status: string) => {
    try {
      await setDoc(
        doc(db, 'console_staff', uid),
        {
          status,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await setDoc(
        doc(db, 'app_users', uid),
        {
          profileStatus: status === 'active' ? 'active' : 'suspended',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await logActivity({
        action: status === 'active' ? 'CONSOLE_STAFF_ACTIVATED' : 'CONSOLE_STAFF_SUSPENDED',
        actorUid: user?.uid || '',
        actorEmail: user?.email || '',
        actorRole: appUser?.role || '',
        targetType: 'console_staff',
        targetId: uid,
        metadata: { email },
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!hasPermission('console_staff.view')) {
    return (
      <div className="p-20 text-center uppercase font-bold text-red-500">
        Unauthorized Desk Access Prohibited
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white industrial-border rounded-lg p-8 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase">
              Staff Roster
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-1">
              MANAGEMENT OF CONSOLE OPERATORS
            </p>
          </div>
          {hasPermission('console_staff.manage') && (
            <button
              onClick={() => setModalOpen(true)}
              className="bg-orange-itred text-white p-3 rounded font-bold uppercase tracking-widest hover:bg-[#d96a1a] flex items-center gap-2 text-[10px]"
            >
              <Plus size={14} /> Invite New Staff
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-slate-200" />
          </div>
        ) : (
          <div className="space-y-12">
            {/* Active Staff */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 border-b pb-2">
                Active Node Operators
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {staff.length === 0 ? (
                  <p className="text-[10px] text-slate-300 italic">
                    No operators currently assigned to this node cluster.
                  </p>
                ) : (
                  staff.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 bg-slate-50 border border-slate-100 rounded flex flex-wrap justify-between items-center gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-400">
                          <Briefcase size={16} />
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase text-slate-900">
                            {s.email}
                          </p>
                          <div className="flex gap-2 mt-0.5">
                            <span className="text-[8px] font-bold px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded uppercase tracking-wider">
                              {CONSOLE_ROLES[s.role as ConsoleRole]?.label || s.role}
                            </span>
                            <span
                              className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                            >
                              {s.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">
                          Permissions Breakdown
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {s.permissions?.slice(0, 5).map((p: string) => (
                            <span
                              key={p}
                              className="text-[7px] bg-white border border-slate-200 px-1 rounded text-slate-500 uppercase"
                            >
                              {p.split('.')[0]}
                            </span>
                          ))}
                          {s.permissions?.length > 5 && (
                            <span className="text-[7px] text-slate-400">
                              + {s.permissions.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasPermission('console_staff.manage') &&
                          s.role !== 'super_admin' &&
                          (s.status === 'active' ? (
                            <button
                              onClick={() => handleUpdateStaffStatus(s.id, s.email, 'suspended')}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                              title="Suspend Operator"
                            >
                              <Shield size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateStaffStatus(s.id, s.email, 'active')}
                              className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
                              title="Reactivate Operator"
                            >
                              <Check size={16} />
                            </button>
                          ))}
                        <div className="text-right">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">
                            Accepted At
                          </p>
                          <p className="text-[8px] font-mono text-slate-500">
                            {s.acceptedAt?.toDate().toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pending Invites */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 border-b pb-2">
                Pending Invitation Buffer
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {invites.filter((i) => i.status === 'pending').length === 0 ? (
                  <p className="text-[10px] text-slate-300 italic">
                    No pending invitations in current buffer.
                  </p>
                ) : (
                  invites
                    .filter((i) => i.status === 'pending')
                    .map((i) => (
                      <div
                        key={i.id}
                        className="p-3 bg-white border border-slate-100 rounded flex justify-between items-center text-[10px]"
                      >
                        <div className="flex items-center gap-4">
                          <Clock size={14} className="text-slate-300" />
                          <div>
                            <span className="font-bold text-slate-700">{i.email}</span>
                            <span className="mx-2 text-slate-300">|</span>
                            <span className="text-slate-500 font-medium uppercase">
                              {CONSOLE_ROLES[i.role as ConsoleRole]?.label}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-400 font-mono text-[9px] uppercase">
                            Sent {i.invitedAt?.toDate().toLocaleDateString()}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/console/accept-invite/${i.id}`;
                                navigator.clipboard.writeText(url);
                                alert('INVITE LINK COPIED TO CLIPBOARD');
                              }}
                              className="p-1.5 text-slate-400 hover:text-orange-itred"
                              title="Copy Invite Link"
                            >
                              <ExternalLink size={14} />
                            </button>
                            <button
                              onClick={() => handleRevokeInvite(i.id, i.email)}
                              className="p-1.5 text-slate-400 hover:text-red-500"
                              title="Revoke Invite"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-lg industrial-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-charcoal text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tighter uppercase">
                  Initialize Operator Invite
                </h2>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                  Console Credentials Dispatch
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleInvite} className="p-8 overflow-y-auto space-y-8">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={14} /> {success}
                  </p>
                  <div className="p-3 bg-white industrial-border rounded flex items-center justify-between gap-4">
                    <code className="text-[9px] font-mono select-all truncate">
                      {window.location.origin}/console/accept-invite/
                      {inviteCode}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/console/accept-invite/${inviteCode}`,
                        );
                        setSuccess('DISPATCH URI CAPTURED TO CLIPBOARD');
                      }}
                      className="text-[9px] text-slate-400 hover:text-orange-itred uppercase font-black"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Staff Target Email
                  </label>
                  <input
                    type="email"
                    className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-slate-50 text-xs font-bold uppercase"
                    value={inviteFormData.email}
                    onChange={(e) =>
                      setInviteFormData({
                        ...inviteFormData,
                        email: e.target.value,
                      })
                    }
                    placeholder="OPERATOR@ITRED.NET"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                      Console Role
                    </label>
                    <select
                      className="w-full p-3 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-white text-xs font-bold uppercase"
                      value={inviteFormData.role}
                      onChange={(e) => handleRoleChange(e.target.value as ConsoleRole)}
                    >
                      {Object.entries(CONSOLE_ROLES).map(([id, cfg]) => (
                        <option key={id} value={id}>
                          {cfg.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 border-b pb-2">
                    Desk Permissions Configuration
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 max-h-[200px] overflow-y-auto pr-2 no-scrollbar border-b pb-4">
                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-200 text-orange-itred focus:ring-orange-itred"
                          checked={inviteFormData.permissions.includes(key as PermissionKey)}
                          onChange={() => togglePermission(key as PermissionKey)}
                        />
                        <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors uppercase tracking-tight">
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="submit"
                  className="flex-grow bg-slate-900 text-white p-4 rounded font-bold uppercase tracking-[0.2em] hover:bg-black transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <Shield size={16} /> Dispatch Invitation
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-6 bg-slate-100 text-slate-500 rounded font-bold uppercase tracking-widest hover:bg-slate-200 text-[10px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const ConsoleInviteAcceptPage = () => {
  const { inviteId } = useParams<{ inviteId: string }>();
  const { user, appUser, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!inviteId) return;
    const fetchInvite = async () => {
      try {
        const docRef = doc(db, 'console_invites', inviteId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setInvite({ id: snap.id, ...snap.data() });
        } else {
          setError('INVITATION PROTOCOL NOT FOUND OR EXPIRED');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInvite();
  }, [inviteId]);

  const handleAccept = async () => {
    if (!user || !invite) return;
    setProcessing(true);
    setError('');

    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      setError(
        `IDENTITY MISMATCH: THIS INVITE WAS DISPATCHED TO ${invite.email.toUpperCase()}. LOGGED IN AS ${user.email.toUpperCase()}.`,
      );
      setProcessing(false);
      return;
    }

    try {
      const batch = writeBatch(db);

      // 1. Update app_users
      batch.set(
        doc(db, 'app_users', user.uid),
        {
          role: invite.role,
          consolePermissions: invite.permissions,
          profileStatus: 'active',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // 2. Create console_staff
      batch.set(doc(db, 'console_staff', user.uid), {
        uid: user.uid,
        email: user.email,
        role: invite.role,
        permissions: invite.permissions,
        status: 'active',
        invitedBy: invite.invitedBy,
        inviteId: invite.id,
        acceptedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Mark invite as accepted
      batch.update(doc(db, 'console_invites', invite.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      await logActivity({
        action: 'CONSOLE_INVITE_ACCEPTED',
        actorUid: user.uid,
        actorEmail: user.email || '',
        actorRole: invite.role,
        targetType: 'console_invite',
        targetId: invite.id,
        metadata: { email: user.email },
      });

      window.location.href = '/console';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading || authLoading)
    return (
      <div className="p-20 text-center animate-pulse uppercase tracking-[0.3em] font-black text-xs">
        Decrypting Invitation Packet...
      </div>
    );

  if (!invite || invite.status !== 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white industrial-border p-12 rounded-lg shadow-xl max-w-md w-full text-center">
          <Shield size={48} className="mx-auto text-slate-200 mb-6" />
          <h1 className="text-xl font-bold uppercase tracking-tighter text-slate-900 mb-4">
            Invite Restricted
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
            {error || 'THIS INVITATION HAS BEEN USED OR REVOKED.'}
          </p>
          <Link
            to="/"
            className="mt-8 inline-block text-orange-itred font-black uppercase text-[10px] tracking-widest border-b-2 border-orange-itred/20 hover:border-orange-itred"
          >
            Return to Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="bg-white industrial-border p-12 rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-orange-itred text-white rounded-lg flex items-center justify-center shadow-lg shadow-orange-itred/20">
            <Briefcase size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter uppercase text-slate-900 leading-none">
              Console Desk Access
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
              Invitation Validation Phase
            </p>
          </div>
        </div>

        <div className="space-y-6 text-[11px] font-bold uppercase tracking-widest mb-10">
          <div className="p-4 bg-slate-50 border border-slate-100 rounded space-y-4">
            <div className="flex justify-between border-b border-slate-200/50 pb-2">
              <span className="text-slate-400">Target Role</span>
              <span className="text-slate-900">
                {CONSOLE_ROLES[invite.role as ConsoleRole]?.label}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/50 pb-2">
              <span className="text-slate-400">Assigned Email</span>
              <span className="text-slate-900">{invite.email}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-2">
                Requested Clearances ({invite.permissions?.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {invite.permissions?.map((p: string) => (
                  <span
                    key={p}
                    className="bg-white border border-slate-100 px-2 py-0.5 rounded text-[8px] text-slate-500"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {!user ? (
            <div className="p-6 bg-orange-50 border border-orange-100 rounded text-center">
              <p className="text-orange-700 mb-6">
                IDENTITY AUTHENTICATION REQUIRED TO ACCEPT PACKET
              </p>
              <Link
                to={`/register?email=${invite.email}&invite=${invite.id}`}
                className="bg-slate-900 text-white p-4 rounded block hover:bg-black transition-all"
              >
                Initialize Identity registration
              </Link>
              <Link
                to={`/login?email=${invite.email}&invite=${invite.id}`}
                className="block mt-4 text-slate-400 hover:text-slate-600"
              >
                Already have an identity? Log in
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-center">
                  {error}
                </div>
              )}
              <button
                disabled={processing}
                onClick={handleAccept}
                className="w-full bg-orange-itred text-white p-5 rounded shadow-lg shadow-orange-itred/20 hover:bg-[#d96a1a] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {processing ? <Loader2 className="animate-spin" /> : <Shield size={18} />}
                {processing ? 'ESTABLISHING ACCESS NODE...' : 'ACTIVATE CONSOLE DESK ACCESS'}
              </button>
              <button
                onClick={logout}
                className="w-full text-center text-slate-400 hover:text-slate-600 font-bold uppercase tracking-widest text-[9px]"
              >
                Not {user.email}? Switch Identity
              </button>
            </div>
          )}
        </div>

        <div className="pt-8 border-t border-slate-100 flex items-center justify-between opacity-30">
          <span className="text-[9px] font-mono uppercase tracking-[0.3em]">
            iTred WebX Protocol
          </span>
          <span className="text-[9px] font-mono">0x4F4341</span>
        </div>
      </div>
    </div>
  );
};

export const DeliveryFulfilmentPage = () => {
  const { vendorId, user } = useAuth();
  const [orderIdInput, setOrderIdInput] = useState('');
  const [codeStr, setCodeStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);

  const handleVerifyOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOrder(null);
    setSuccess(null);

    try {
      const docRef = doc(db, 'orders', orderIdInput.trim().toUpperCase());
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        throw new Error('ORDER_NOT_FOUND: Protocol cross-reference failed. Verify Order ID.');
      }

      const data = snap.data();

      // Security: Order must be linked to current vendor context
      if (data.vendorId !== vendorId) {
        throw new Error('AUTHORIZATION_DENIED: Order belongs to a different vendor domain.');
      }

      if (data.fulfilmentCodeStatus === 'redeemed') {
        throw new Error(
          'PROTOCOL_ALREADY_REDEEMED: Delivery for this order was completed earlier.',
        );
      }

      if (data.fulfilmentCodeStatus === 'locked') {
        throw new Error(
          'SECURITY_LOCK: Code entry locked due to multiple failed attempts. Contact Vendor Owner.',
        );
      }

      setOrder({ id: snap.id, ...data });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFulfilment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    setLoading(true);
    setError(null);

    try {
      const docRef = doc(db, 'orders', order.id);
      const attempts = (order.fulfilmentCodeAttempts || 0) + 1;

      if (order.fulfilmentCode !== codeStr.trim()) {
        const isFinalAttempt = attempts >= 5;
        const status = isFinalAttempt ? 'locked' : 'issued';

        await updateDoc(docRef, {
          fulfilmentCodeAttempts: attempts,
          fulfilmentCodeStatus: status,
          updatedAt: serverTimestamp(),
        });

        await createAuditLog({
          action: isFinalAttempt ? 'FULFILMENT_CODE_LOCKED' : 'FULFILMENT_CODE_FAILED_ATTEMPT',
          targetType: 'order',
          targetId: order.id,
          vendorId: order.vendorId,
          metadata: {
            orderId: order.id,
            vendorId: order.vendorId,
            deliveryServiceId: order.deliveryServiceId || 'unknown',
            actorUid: user?.uid,
            actorEmail: user?.email,
            attempts,
          },
        });

        throw new Error(
          isFinalAttempt
            ? 'SECURITY_BREACH: Max attempts exceeded. Code status: LOCKED.'
            : `INVALID_CODE: Access denied. Attempt ${attempts}/5.`,
        );
      }

      // Success Match
      const batch = writeBatch(db);

      const statusBefore = order.status;
      const statusAfter = 'delivery_completed';

      batch.update(docRef, {
        status: statusAfter,
        deliveryStatus: 'completed',
        fulfilmentCodeStatus: 'redeemed',
        deliveredAt: serverTimestamp(),
        completedByUid: user?.uid || 'unknown',
        completedByEmail: user?.email || 'unknown',
        updatedAt: serverTimestamp(),
      });

      // Log activity
      const logId = `LOG-FULFIL-${Date.now()}`;
      batch.set(doc(db, 'audit_logs', logId), {
        action: 'DELIVERY_COMPLETED',
        targetType: 'order',
        targetId: order.id,
        vendorId: order.vendorId,
        performedBy: user?.uid,
        timestamp: serverTimestamp(),
        metadata: {
          orderId: order.id,
          vendorId: order.vendorId,
          deliveryServiceId: order.deliveryServiceId || 'unknown',
          actorUid: user?.uid,
          actorEmail: user?.email,
          statusBefore,
          statusAfter,
          method: 'secret_code',
        },
      });

      await batch.commit();
      setSuccess('DELIVERY_FULFILMENT_SUCCESSFUL: Order status updated to COMPLETED.');
      setOrder(null);
      setOrderIdInput('');
      setCodeStr('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-lg industrial-border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-charcoal text-white rounded">
            <Truck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-slate-900 uppercase underline decoration-orange-itred decoration-4">
              Logistics Fulfilment
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
              Terminal: Driver Verification Portal
            </p>
          </div>
        </div>

        {!order ? (
          <form onSubmit={handleVerifyOrder} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Search Protocol ID (Order ID)
              </label>
              <div className="relative">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="E.G. ORD-1725... "
                  value={orderIdInput}
                  onChange={(e) => setOrderIdInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-4 pl-12 rounded font-mono text-sm uppercase tracking-widest focus:ring-2 focus:ring-orange-itred outline-none transition-all"
                  required
                />
              </div>
            </div>
            <button
              disabled={loading}
              type="submit"
              className="w-full bg-orange-itred text-white py-4 rounded font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {loading ? 'CROSS-REFERENCING...' : 'INITIATE VERIFICATION'}
            </button>
          </form>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Authenticated Order
                </p>
                <h3 className="text-lg font-bold text-slate-900 uppercase">{order.customerName}</h3>
                <p className="text-[10px] text-slate-500 font-mono">
                  {order.id} | {order.preferredFulfillment?.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setOrder(null)}
                className="p-2 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitFulfilment} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Enter Secret Fulfilment Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="######"
                  value={codeStr}
                  onChange={(e) => setCodeStr(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-900 border border-slate-700 p-5 rounded font-mono text-3xl text-center text-white tracking-[1rem] focus:ring-2 focus:ring-orange-itred outline-none transition-all"
                  required
                />
                <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest">
                  Code provided by customer upon physical delivery.
                </p>
              </div>

              <button
                disabled={loading || codeStr.length < 6}
                type="submit"
                className="w-full bg-charcoal text-white py-5 rounded font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95 disabled:opacity-50"
              >
                {loading ? 'EXECUTING COMPLETION...' : 'AUTHORIZE & COMPLETE DELIVERY'}
              </button>
            </form>
          </div>
        )}

        {error && (
          <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded flex gap-3 text-red-600 items-start">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-tighter">System Alert</p>
              <p className="text-xs font-bold">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mt-8 p-6 bg-emerald-50 border border-emerald-100 rounded flex flex-col items-center text-center text-emerald-600 animate-in zoom-in duration-500">
            <CheckCircle2 size={48} className="mb-4" />
            <h3 className="text-lg font-black uppercase tracking-tighter">Verified</h3>
            <p className="text-sm font-bold max-w-sm">{success}</p>
            <button
              onClick={() => {
                setSuccess(null);
                setOrderIdInput('');
              }}
              className="mt-6 text-[10px] font-black uppercase tracking-widest underline"
            >
              Process Another Delivery
            </button>
          </div>
        )}
      </div>

      <div className="bg-slate-50 p-6 rounded border border-slate-200">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <ShieldCheck size={14} /> Security Disclosure
        </h4>
        <ul className="text-[10px] font-bold text-slate-500 space-y-2 uppercase leading-relaxed">
          <li>• Codes are single-use tokens issued specifically for this logistical unit.</li>
          <li>• Multiple incorrect attempts will trigger an automatic security lock.</li>
          <li>
            • Verification data is logged to the global audit trail including GPS (if enabled) and
            timestamp.
          </li>
        </ul>
      </div>
    </div>
  );
};

function removeUndefinedFields(obj: any) {
  if (!obj) return {};
  return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== undefined));
}
