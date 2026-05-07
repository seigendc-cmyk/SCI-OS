import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  writeBatch,
  getDocs,
  Timestamp,
  addDoc,
} from 'firebase/firestore';
import {
  Laptop,
  ChevronRight,
  ShieldAlert,
  Search,
  Package,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCcw,
  CreditCard,
  Banknote,
  Printer,
  MessageSquare,
  Share2,
  User,
  Clock,
  Tag,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPOSEvent } from '../../../services/orderService';
import { createBIEvent, BIEventType } from '../../../services/biService';
import { createAccountingJournalDraft } from '../../../services/accountingService';
import { POSReceipt } from '../../../components/pos/POSReceipt';
import { ReceiptData } from '../../../services/receiptService';

interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stockQtyAtSaleAttempt: number;
}

export const VendorPOSTerminalScreen = () => {
  const { vendorId, user, role } = useAuth();
  const [terminals, setTerminals] = useState<any[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [diagStep, setDiagStep] = useState('init');
  const [diagError, setDiagError] = useState<string | null>(null);

  // Sales State
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Receipt state
  const [lastCompletedSale, setLastCompletedSale] = useState<ReceiptData | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Finalize Diagnostics
  const [saleErrorStep, setSaleErrorStep] = useState<string | null>(null);
  const [saleDiagInfo, setSaleDiagInfo] = useState<any>(null);

  // MODE SELECTION
  const [saleMode, setSaleMode] = useState<'cash' | 'credit' | 'layby'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [laybyDeposit, setLaybyDeposit] = useState<number>(0);

  // APPROVALS & OVERRIDES
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideItemIndex, setOverrideItemIndex] = useState<number | null>(null);
  const [overridePrice, setOverridePrice] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState('');

  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [cartDiscount, setCartDiscount] = useState<{
    value: number;
    type: 'fixed' | 'percent';
  }>({ value: 0, type: 'fixed' });
  const [discountReason, setDiscountReason] = useState('');
  const [pendingDiscountApproval, setPendingDiscountApproval] = useState<any>(null);

  useEffect(() => {
    if (!vendorId) return;
    const q = query(
      collection(db, 'approval_requests'),
      where('vendorId', '==', vendorId),
      where('status', '==', 'pending'),
      where('shiftId', '==', activeShift?.id || '_none'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setPendingApprovals(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [vendorId, activeShift]);

  const isOwner = role === 'vendor_owner' || role === 'owner';

  const handlePriceOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (overrideItemIndex === null || !vendorId || !user) return;

    const item = cart[overrideItemIndex];
    const amount = Math.abs(overridePrice - item.unitPrice);

    if (isOwner) {
      // Immediate apply for owner
      setCart((prev) =>
        prev.map((it, idx) =>
          idx === overrideItemIndex
            ? {
                ...it,
                unitPrice: overridePrice,
                lineTotal: overridePrice * it.quantity,
                overrideApproved: true,
              }
            : it,
        ),
      );
      setShowOverrideModal(false);
      setOverrideItemIndex(null);

      await createBIEvent({
        vendorId,
        userId: user.uid,
        userEmail: user.email!,
        userRole: role || 'owner',
        eventType: 'PRICE_OVERRIDE_APPROVED' as BIEventType,
        severity: 'info',
        message: `Owner approved immediate price override for ${item.productName} to $${overridePrice}`,
        metadata: {
          productId: item.productId,
          oldPrice: item.unitPrice,
          newPrice: overridePrice,
        },
      });
    } else {
      // Request approval for staff
      try {
        const reqRef = await addDoc(collection(db, 'approval_requests'), {
          vendorId,
          requestType: 'POS_PRICE_OVERRIDE',
          terminalId: selectedTerminal?.id,
          shiftId: activeShift?.id,
          requestedByUid: user.uid,
          requestedByEmail: user.email,
          status: 'pending',
          reason: overrideReason,
          amount: amount,
          metadata: {
            productId: item.productId,
            productName: item.productName,
            standardPrice: item.unitPrice,
            requestedPrice: overridePrice,
            cartLineIndex: overrideItemIndex,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await createBIEvent({
          vendorId,
          userId: user.uid,
          userEmail: user.email!,
          userRole: role || 'cashier',
          eventType: 'PRICE_OVERRIDE_REQUESTED' as BIEventType,
          severity: 'warning',
          message: `Price override requested for ${item.productName} by ${user.email}`,
          metadata: {
            productId: item.productId,
            requestedPrice: overridePrice,
            requestId: reqRef.id,
          },
        });

        setShowOverrideModal(false);
        setOverrideItemIndex(null);
        setOverrideReason('');
      } catch (err) {
        console.error('Override request failed', err);
        setError('Failed to submit approval request.');
      }
    }
  };

  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !user || cartDiscount.value <= 0) return;

    if (isOwner) {
      // Immediate apply
      setPendingDiscountApproval({ status: 'approved', ...cartDiscount });
      setShowDiscountModal(false);
      await createBIEvent({
        vendorId,
        userId: user.uid,
        userEmail: user.email!,
        userRole: role || 'owner',
        eventType: 'SALES_DISCOUNT_APPLIED' as BIEventType,
        severity: 'info',
        message: `Discount of ${cartDiscount.value}${cartDiscount.type === 'percent' ? '%' : '$'} applied by owner.`,
        metadata: { discount: cartDiscount, reason: discountReason },
      });
    } else {
      // Request approval
      try {
        const reqRef = await addDoc(collection(db, 'approval_requests'), {
          vendorId,
          requestType: 'POS_DISCOUNT',
          terminalId: selectedTerminal?.id,
          shiftId: activeShift?.id,
          requestedByUid: user.uid,
          requestedByEmail: user.email,
          status: 'pending',
          reason: discountReason,
          amount:
            cartDiscount.type === 'percent'
              ? (subtotal * cartDiscount.value) / 100
              : cartDiscount.value,
          metadata: {
            discountType: cartDiscount.type,
            discountValue: cartDiscount.value,
            saleSubtotal: subtotal,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await createBIEvent({
          vendorId,
          userId: user.uid,
          userEmail: user.email!,
          userRole: role || 'cashier',
          eventType: 'DISCOUNT_APPROVAL_REQUESTED' as BIEventType,
          severity: 'warning',
          message: `Discount approval requested by ${user.email}`,
          metadata: { discount: cartDiscount, requestId: reqRef.id },
        });

        setShowDiscountModal(false);
        setDiscountReason('');
      } catch (err) {
        console.error('Discount request failed', err);
        setError('Failed to submit discount request.');
      }
    }
  };

  // Auto-apply approved overrides
  useEffect(() => {
    const approved = pendingApprovals.filter((r) => r.status === 'approved');
    if (approved.length === 0) return;

    setCart((prev) => {
      let changed = false;
      const next = prev.map((item, idx) => {
        const approval = approved.find(
          (a) =>
            a.requestType === 'POS_PRICE_OVERRIDE' &&
            a.metadata?.productId === item.productId &&
            !item.overrideApproved,
        );
        if (approval) {
          changed = true;
          return {
            ...item,
            unitPrice: approval.metadata.requestedPrice,
            lineTotal: approval.metadata.requestedPrice * item.quantity,
            overrideApproved: true,
          };
        }
        return item;
      });
      return changed ? next : prev;
    });

    const approvedDiscount = approved.find((a) => a.requestType === 'POS_DISCOUNT');
    if (approvedDiscount) {
      setPendingDiscountApproval(approvedDiscount);
    }
  }, [pendingApprovals]);

  useEffect(() => {
    if (!vendorId) return;
    const q = query(
      collection(db, 'customers'),
      where('vendorId', '==', vendorId),
      where('status', '==', 'active'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setAllCustomers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [vendorId]);

  const filteredCustomersList = useMemo(() => {
    if (!customerSearch.trim()) return allCustomers.slice(0, 5);
    return allCustomers
      .filter(
        (c) =>
          c.fullName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
          c.phone?.includes(customerSearch),
      )
      .slice(0, 10);
  }, [allCustomers, customerSearch]);

  useEffect(() => {
    console.log('[TERMINAL INIT]', { authUid: user?.uid, vendorId });
    if (!vendorId) {
      setDiagStep('waiting_for_vendor_id');
      return;
    }

    setDiagStep('load_terminals');
    console.log('[TERMINAL LOAD TERMINALS START]');

    const qTerminals = query(
      collection(db, 'pos_terminals'),
      where('vendorId', '==', vendorId),
      where('status', '==', 'active'),
    );
    const unsubscribeTerminals = onSnapshot(
      qTerminals,
      (snap) => {
        try {
          const list = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            terminalName:
              doc.data().terminalName ||
              doc.data().name ||
              doc.data().code ||
              `Terminal ${doc.id.slice(-4)}`,
          }));
          console.log('[TERMINAL LOAD TERMINALS RESULT]', {
            count: list.length,
          });
          setTerminals(list);

          const savedId = localStorage.getItem(`pos_trm_${vendorId}`);
          if (savedId) {
            const found = list.find((t) => t.id === savedId);
            if (found) {
              console.log('[TERMINAL AUTO-SELECT]', {
                id: found.id,
                name: found.terminalName,
              });
              setSelectedTerminal(found);
            }
          } else if (list.length > 0) {
            // Auto-select first terminal if only one exists or just take first as default
            // setSelectedTerminal(list[0]);
          }
          setLoading(false);
          setDiagStep('terminals_loaded');
        } catch (err: any) {
          console.error('[TERMINAL LOAD_TERMINALS_CRASH]', err);
          setDiagError(`Terminal load crash: ${err.message}`);
          setDiagStep('load_terminals_failed');
          setLoading(false);
        }
      },
      (err) => {
        console.error('[TERMINAL LOAD_TERMINALS_ERROR]', err);
        setDiagError(`Terminal load error: ${err.code} - ${err.message}`);
        setDiagStep('load_terminals_error');
        setLoading(false);
      },
    );

    return () => unsubscribeTerminals();
  }, [vendorId, user]);

  useEffect(() => {
    if (!selectedTerminal) {
      setActiveShift(null);
      return;
    }

    try {
      localStorage.setItem(`pos_trm_${vendorId}`, selectedTerminal.id);
    } catch (e) {
      console.warn('[TERMINAL LOCALSTORAGE FAIL]', e);
    }

    setDiagStep('load_open_shift');
    console.log('[TERMINAL SHIFT CHECK START]', {
      vendorId,
      terminalId: selectedTerminal.id,
      terminalName: selectedTerminal.terminalName,
    });

    const qShift = query(
      collection(db, 'pos_shifts'),
      where('vendorId', '==', vendorId),
      where('terminalId', '==', selectedTerminal.id),
      where('status', '==', 'open'),
    );
    const unsubShift = onSnapshot(
      qShift,
      (snap) => {
        console.log('[TERMINAL SHIFT SNAPSHOT]', {
          empty: snap.empty,
          size: snap.size,
        });
        if (!snap.empty) {
          const sDoc = snap.docs[0];
          console.log('[TERMINAL SHIFT FOUND]', {
            id: sDoc.id,
            data: sDoc.data(),
          });
          setActiveShift({ id: sDoc.id, ...sDoc.data() });
          setDiagStep('shift_detected');
        } else {
          console.warn('[TERMINAL SHIFT NOT FOUND]', {
            terminalId: selectedTerminal.id,
          });
          setActiveShift(null);
          setDiagStep('no_open_shift');
        }
      },
      (err) => {
        console.error('[TERMINAL SHIFT ERROR]', err);
        setError(`Shift detection error: ${err.code} - ${err.message}`);
        setDiagError(`Shift detection error: ${err.code} - ${err.message}`);
        setDiagStep('shift_query_error');
      },
    );

    if (user && vendorId) {
      createPOSEvent({
        vendorId: vendorId,
        terminalId: selectedTerminal.id,
        eventType: 'POS_TERMINAL_ACCESSED',
        actorUid: user.uid,
        actorEmail: user.email!,
        actorRole: role,
      }).catch((e) => console.error('[POS_EVENT_FAIL]', e));
    }

    return () => unsubShift();
  }, [selectedTerminal, vendorId, user, role]);

  // Load Products
  useEffect(() => {
    if (!vendorId || !activeShift) return;

    setDiagStep('load_products');
    console.log('[TERMINAL PRODUCTS QUERY START]', { vendorId });

    const qProducts = query(collection(db, 'products'), where('vendorId', '==', vendorId));

    const unsubProducts = onSnapshot(
      qProducts,
      (snap) => {
        try {
          const list = snap.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              name: data.name || data.itemName || data.title || 'Unnamed Product',
              price: Number(data.price || data.sellingPrice || data.salePrice || 0),
              stockQty: Number(data.stockQty || data.quantity || data.qty || 0),
              sku: data.sku || '',
            };
          });
          console.log('[TERMINAL PRODUCTS QUERY RESULT]', {
            count: list.length,
          });
          setProducts(list);
          setDiagStep('ready');
        } catch (err: any) {
          console.error('[TERMINAL PRODUCTS_CRASH]', err);
          setDiagError(`Product load crash: ${err.message}`);
          setDiagStep('load_products_failed');
        }
      },
      (err) => {
        console.error('[TERMINAL PRODUCTS_ERROR]', err);
        setDiagError(`Product load error: ${err.code} - ${err.message}`);
        setDiagStep('load_products_error');
      },
    );

    return () => unsubProducts();
  }, [vendorId, activeShift]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products.slice(0, 12);

    const searchTerms = searchQuery
      .toLowerCase()
      .split(' ')
      .filter((t) => t.length > 0);
    return products
      .filter((p) => {
        const searchStr =
          `${p.name} ${p.sku || ''} ${p.brand || ''} ${p.category || ''} ${p.sector || ''} ${p.description || ''}`.toLowerCase();
        return searchTerms.every((term) => searchStr.includes(term));
      })
      .slice(0, 20);
  }, [products, searchQuery]);

  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);

  const discountAmount = useMemo(() => {
    if (!pendingDiscountApproval || pendingDiscountApproval.status !== 'approved') return 0;
    const disc = pendingDiscountApproval.metadata || pendingDiscountApproval; // handle both request object and direct state
    if (disc.discountType === 'percent' || disc.type === 'percent') {
      return (subtotal * (disc.discountValue || disc.value)) / 100;
    }
    return disc.discountValue || disc.value || 0;
  }, [subtotal, pendingDiscountApproval]);

  const grandTotal = Math.max(0, subtotal - discountAmount);

  const logZeroStockEvent = async (product: any, requestedQty: number) => {
    if (!user || !vendorId || !selectedTerminal || !activeShift) return;

    const metadata = {
      productId: product.id,
      productName: product.name,
      branchId: selectedTerminal.branchId,
      terminalId: selectedTerminal.id,
      shiftId: activeShift.id,
      cashierUid: user.uid,
      requestedQty,
      currentStock: product.stockQty || 0,
      possibleLostRevenue: requestedQty * (product.price || 0),
    };

    await createPOSEvent({
      vendorId,
      branchId: selectedTerminal.branchId,
      terminalId: selectedTerminal.id,
      shiftId: activeShift.id,
      eventType: 'POS_SALE_BLOCKED_ZERO_STOCK',
      actorUid: user.uid,
      actorEmail: user.email!,
      actorRole: role,
      metadata,
    });

    await createBIEvent({
      vendorId,
      branchId: selectedTerminal.branchId,
      terminalId: selectedTerminal.id,
      shiftId: activeShift.id,
      userId: user.uid,
      userEmail: user.email!,
      userRole: role || 'cashier',
      eventType: BIEventType.SALE_BLOCKED_ZERO_STOCK,
      severity: 'warning',
      message: `Sale blocked for ${product.name}: Zero or insufficient stock (${product.stockQty || 0} left).`,
      metadata,
    });
  };

  const addToCart = (product: any) => {
    if ((product.stockQty || 0) <= 0) {
      setError(`Sale blocked: zero stock for ${product.name}`);
      logZeroStockEvent(product, 1);
      return;
    }

    setError(null);
    setSuccess(null);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.stockQty) {
          setError(`Only ${product.stockQty} units available.`);
          logZeroStockEvent(product, existing.quantity + 1);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                lineTotal: (item.quantity + 1) * item.unitPrice,
              }
            : item,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku || 'N/A',
          unitPrice: Number(product.price) || 0,
          quantity: 1,
          lineTotal: Number(product.price) || 0,
          stockQtyAtSaleAttempt: product.stockQty,
        },
      ];
    });
  };

  const updateQty = (id: string, delta: number) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === id) {
            const newQty = Math.max(0, item.quantity + delta);
            if (newQty > 0 && newQty > product.stockQty) {
              setError(`Only ${product.stockQty} units available.`);
              logZeroStockEvent(product, newQty);
              return item;
            }
            return {
              ...item,
              quantity: newQty,
              lineTotal: newQty * item.unitPrice,
            };
          }
          return item;
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const handleCreateSaleDraft = async () => {
    if (cart.length === 0 || !vendorId || !selectedTerminal || !activeShift || !user) return;

    setIsProcessing(true);
    setError(null);

    try {
      const saleId = `SALE-DFT-${Date.now()}`;
      const now = serverTimestamp();

      const saleData = {
        saleId,
        vendorId,
        branchId: selectedTerminal.branchId,
        terminalId: selectedTerminal.id,
        shiftId: activeShift.id,
        cashierUid: user.uid,
        cashierEmail: user.email,
        status: 'draft',
        subtotal,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal,
        paymentMethod: 'cash',
        paymentStatus: 'unpaid',
        accountingStatus: 'not_started',
        stockStatus: 'not_deducted',
        createdAt: now,
        updatedAt: now,
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'pos_sales', saleId), saleData);

      cart.forEach((item, index) => {
        const itemId = `${saleId}-ITEM-${index}`;
        batch.set(doc(db, 'pos_sale_items', itemId), {
          itemId,
          saleId,
          vendorId,
          branchId: selectedTerminal.branchId,
          terminalId: selectedTerminal.id,
          shiftId: activeShift.id,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          stockQtyAtSaleAttempt: item.stockQtyAtSaleAttempt,
          createdAt: now,
        });
      });

      await batch.commit();

      await createPOSEvent({
        vendorId,
        branchId: selectedTerminal.branchId,
        terminalId: selectedTerminal.id,
        shiftId: activeShift.id,
        eventType: 'POS_SALE_DRAFT_CREATED',
        actorUid: user.uid,
        actorEmail: user.email!,
        actorRole: role,
        metadata: { saleId, grandTotal },
      });

      await createBIEvent({
        vendorId,
        branchId: selectedTerminal.branchId,
        terminalId: selectedTerminal.id,
        shiftId: activeShift.id,
        userId: user.uid,
        userEmail: user.email!,
        userRole: role || 'cashier',
        eventType: BIEventType.APP_ACTIVITY_LOGGED,
        severity: 'info',
        message: `Sale draft ${saleId} created for $${grandTotal}.`,
        metadata: { saleId, grandTotal },
      });

      setSuccess(`Draft Created: ${saleId}`);
      setLastSaleId(saleId);
    } catch (err: any) {
      console.error('[POS_SALE_DRAFT_ERROR]', err);
      setError(`Draft Creation Failed: ${err.code} - ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalizeSale = async (
    overrideMode?: 'cash' | 'credit' | 'layby',
    overrideTotal?: number,
  ) => {
    const mode = overrideMode || saleMode;
    const total = overrideTotal !== undefined ? overrideTotal : grandTotal;

    if (cart.length === 0 || !vendorId || !selectedTerminal || !activeShift || !user) return;

    if ((mode === 'credit' || mode === 'layby') && !selectedCustomer) {
      setError(`Customer selection required for ${mode} sales.`);
      return;
    }

    if (mode === 'layby' && laybyDeposit <= 0) {
      setError('Layby requires a minimum deposit.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    setSaleErrorStep('initializing');
    setSaleDiagInfo({
      vendorId,
      terminalId: selectedTerminal.id,
      shiftId: activeShift.id,
      cartCount: cart.length,
      mode,
    });

    try {
      const now = serverTimestamp();
      let finalSaleId = mode === 'layby' ? `LAY-${Date.now()}` : lastSaleId || `SALE-${Date.now()}`;
      const batch = writeBatch(db);

      let totalCOGS = 0;
      let costsMissing = false;
      const ledgerEntries: any[] = [];
      const productUpdates: any[] = [];

      // 1. Verify Stock and Prepare Updates/Ledgers
      setSaleErrorStep('verify_stock');
      for (const item of cart) {
        // ... rest of stock logic remains same for now as we deduct for both cash/credit
        // For layby we also reserve stock (deduct from inventory)
        setSaleDiagInfo((prev: any) => ({
          ...prev,
          currentProduct: item.productName,
        }));
        const pDoc = await getDoc(doc(db, 'products', item.productId));
        const pData = pDoc.data();

        if (!pData || pData.vendorId !== vendorId) {
          throw new Error(`Product ${item.productName} security mismatch.`);
        }

        const currentStock = Number(pData.stockQty || 0);
        if (currentStock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.productName}.`);
        }

        const unitCost = Number(pData.costPrice || pData.averageCost || 0);
        if (unitCost <= 0) costsMissing = true;
        const lineCOGS = unitCost * item.quantity;
        totalCOGS += lineCOGS;

        const newStock = currentStock - item.quantity;
        productUpdates.push({
          ref: doc(db, 'products', item.productId),
          data: {
            stockQty: newStock,
            stockStatus: newStock > 0 ? 'in_stock' : 'out_of_stock',
            updatedAt: now,
          },
        });

        const ledgerId = `LG-${finalSaleId}-${item.productId}`;
        ledgerEntries.push({
          ref: doc(db, 'inventory_ledger', ledgerId),
          data: {
            ledgerId,
            vendorId,
            branchId: selectedTerminal.branchId,
            terminalId: selectedTerminal.id,
            shiftId: activeShift.id,
            productId: item.productId,
            saleId: finalSaleId,
            movementType: mode === 'layby' ? 'layby_reserve' : 'sale',
            direction: 'out',
            quantity: item.quantity,
            stockBefore: currentStock,
            stockAfter: newStock,
            unitCost,
            unitPrice: item.unitPrice,
            totalCost: lineCOGS,
            totalSalesValue: item.lineTotal,
            actorUid: user.uid,
            actorEmail: user.email,
            createdAt: now,
            sourceModule: 'POS',
            sourceType: mode === 'layby' ? 'LAYBY' : 'SALE',
            sourceId: finalSaleId,
          },
        });
      }

      // 2. Mode specific document creation
      if (mode === 'credit') {
        // Check credit limit
        const customerRef = doc(db, 'customers', selectedCustomer.id);
        const custSnap = await getDoc(customerRef);
        const custData = custSnap.data();
        const currentBalance = Number(custData?.currentBalance || 0);
        const creditLimit = Number(custData?.creditLimit || 0);

        if (currentBalance + total > creditLimit) {
          throw new Error(
            `Credit limit exceeded. Available: $${(creditLimit - currentBalance).toFixed(2)}`,
          );
        }

        batch.update(customerRef, {
          currentBalance: currentBalance + total,
          updatedAt: now,
        });

        const ledgerRef = doc(collection(db, 'customer_account_ledger'));
        batch.set(ledgerRef, {
          vendorId,
          customerId: selectedCustomer.id,
          movementType: 'credit_sale',
          amount: total,
          balanceAfter: currentBalance + total,
          reference: finalSaleId,
          createdAt: now,
        });
      } else if (mode === 'layby') {
        const laybyRef = doc(db, 'layby_orders', finalSaleId);
        batch.set(laybyRef, {
          id: finalSaleId,
          vendorId,
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.fullName,
          totalAmount: total,
          depositPaid: laybyDeposit,
          balanceDue: total - laybyDeposit,
          status: 'open',
          createdAt: now,
          updatedAt: now,
          expiryDate: Timestamp.fromDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)), // 90 days default
        });

        const paymentId = `LAY-PAY-DEP-${finalSaleId}`;
        batch.set(doc(db, 'layby_payments', paymentId), {
          vendorId,
          laybyId: finalSaleId,
          customerId: selectedCustomer.id,
          amount: laybyDeposit,
          paymentMethod: 'cash',
          receiptNumber: `RCP-${paymentId}`,
          receivedByUid: user.uid,
          receivedByEmail: user.email,
          createdAt: now,
        });
      }

      // 3. Main Sale Record
      batch.set(doc(db, 'pos_sales', finalSaleId), {
        saleId: finalSaleId,
        vendorId,
        branchId: selectedTerminal.branchId,
        terminalId: selectedTerminal.id,
        shiftId: activeShift.id,
        cashierUid: user.uid,
        cashierEmail: user.email,
        status: mode === 'layby' ? 'layby_active' : 'completed',
        subtotal,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: total,
        saleType: mode,
        customerId: selectedCustomer?.id || null,
        paymentMethod: mode === 'credit' ? 'credit' : 'cash',
        paymentStatus: mode === 'cash' ? 'paid' : mode === 'credit' ? 'unpaid' : 'partial',
        accountingStatus: 'not_started',
        stockStatus: 'deducted',
        totalCOGS,
        laybyDeposit: mode === 'layby' ? laybyDeposit : 0,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      cart.forEach((item, index) => {
        const itemId = `${finalSaleId}-ITEM-${index}`;
        batch.set(doc(db, 'pos_sale_items', itemId), {
          itemId,
          saleId: finalSaleId,
          vendorId,
          branchId: selectedTerminal.branchId,
          terminalId: selectedTerminal.id,
          shiftId: activeShift.id,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          stockQtyAtSaleAttempt: item.stockQtyAtSaleAttempt,
          createdAt: now,
        });
      });

      productUpdates.forEach((u) => batch.update(u.ref, u.data));
      ledgerEntries.forEach((l) => batch.set(l.ref, l.data));

      await batch.commit();

      // 4. Accounting Journal
      try {
        const coaSnap = await getDocs(
          query(collection(db, 'chart_accounts'), where('vendorId', '==', vendorId)),
        );
        const standardCoaCount = coaSnap.docs.filter((d) => !d.data().test).length;

        if (standardCoaCount >= 18) {
          const journalLines = [];
          if (mode === 'cash') {
            journalLines.push(
              {
                accountId: `${vendorId}-1000`,
                accountCode: '1000',
                accountName: 'Cash on Hand',
                description: `Sale ${finalSaleId}`,
                debit: total,
                credit: 0,
              },
              {
                accountId: `${vendorId}-4000`,
                accountCode: '4000',
                accountName: 'Sales Revenue',
                description: `Sale ${finalSaleId}`,
                debit: 0,
                credit: total,
              },
            );
          } else if (mode === 'credit') {
            journalLines.push(
              {
                accountId: `${vendorId}-1100`,
                accountCode: '1100',
                accountName: 'Accounts Receivable',
                description: `Credit Sale ${finalSaleId}`,
                debit: total,
                credit: 0,
              },
              {
                accountId: `${vendorId}-4000`,
                accountCode: '4000',
                accountName: 'Sales Revenue',
                description: `Credit Sale ${finalSaleId}`,
                debit: 0,
                credit: total,
              },
            );
          } else if (mode === 'layby') {
            journalLines.push(
              {
                accountId: `${vendorId}-1000`,
                accountCode: '1000',
                accountName: 'Cash on Hand',
                description: `Layby Deposit ${finalSaleId}`,
                debit: laybyDeposit,
                credit: 0,
              },
              {
                accountId: `${vendorId}-2100`,
                accountCode: '2100',
                accountName: 'Unearned Revenue',
                description: `Layby Deposit ${finalSaleId}`,
                debit: 0,
                credit: laybyDeposit,
              },
            );
          }

          if (totalCOGS > 0) {
            journalLines.push(
              {
                accountId: `${vendorId}-5000`,
                accountCode: '5000',
                accountName: 'Cost of Goods Sold',
                description: `COGS: Sale ${finalSaleId}`,
                debit: totalCOGS,
                credit: 0,
              },
              {
                accountId: `${vendorId}-1200`,
                accountCode: '1200',
                accountName: 'Inventory',
                description: `Stock Ded: Sale ${finalSaleId}`,
                debit: 0,
                credit: totalCOGS,
              },
            );
          }

          await createAccountingJournalDraft({
            vendorId,
            sourceType: mode === 'layby' ? 'LAYBY' : 'SALE',
            sourceId: finalSaleId,
            journalDate: now,
            userId: user.uid,
            userEmail: user.email!,
            userRole: role || 'cashier',
            lines: journalLines,
          });
          await setDoc(
            doc(db, 'pos_sales', finalSaleId),
            { accountingStatus: 'draft_journal_created' },
            { merge: true },
          );
        }
      } catch (err) {
        console.error('Accounting journal failed', err);
      }

      // 5. Cleanup
      await createBIEvent({
        vendorId,
        userId: user.uid,
        userEmail: user.email!,
        userRole: role || 'cashier',
        eventType: (mode === 'credit'
          ? 'CREDIT_SALE_CREATED'
          : mode === 'layby'
            ? 'LAYBY_CREATED'
            : 'SALE_COMPLETED') as BIEventType,
        severity: 'info',
        message: `${mode.toUpperCase()} sale ${finalSaleId} completed.`,
        metadata: { saleId: finalSaleId, total },
      });

      setSuccess(`${mode.toUpperCase()} Sale Completed: ${finalSaleId}`);

      setLastCompletedSale({
        vendorName: 'iTred Vendor',
        vendorPhone: '',
        terminalName: selectedTerminal.terminalName,
        operatorEmail: user.email!,
        receiptNumber: `RCP-${finalSaleId}`,
        saleId: finalSaleId,
        date: new Date(),
        items: cart.map((i) => ({
          name: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        })),
        subtotal: total,
        total: total,
        paymentMethod: mode,
        customerName: selectedCustomer?.fullName,
        laybyDeposit: mode === 'layby' ? laybyDeposit : undefined,
        laybyBalance: mode === 'layby' ? total - laybyDeposit : undefined,
      });

      setCart([]);
      setSelectedCustomer(null);
      setLaybyDeposit(0);
      setSaleMode('cash');
    } catch (err: any) {
      console.error('Sale failed', err);
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (diagError) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white industrial-border border-red-200 rounded-2xl shadow-xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
            Terminal Fatal Error
          </h1>
          <p className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-3 py-1 rounded">
            Step: {diagStep}
          </p>
        </div>

        <div className="bg-slate-50 p-6 rounded-xl space-y-4 font-mono text-[9px] uppercase border border-slate-100">
          <div className="flex justify-between border-b border-slate-200 pb-2">
            <span className="text-slate-400">Error Code:</span>
            <span className="text-red-600 font-bold">POS_SYNC_FAIL</span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400">Diagnostic Logs:</span>
            <p className="text-slate-600 break-words font-black leading-relaxed">{diagError}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-3">
            <div>
              <span className="text-slate-400 block mb-1">Vendor ID:</span>
              <span className="text-slate-900 font-bold truncate block">
                {vendorId || 'MISSING'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Auth UID:</span>
              <span className="text-slate-900 font-bold truncate block">{user?.uid || 'NONE'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-slate-900 text-white p-4 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
        >
          <RefreshCcw size={16} />
          Rebase Terminal
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 space-y-6">
        <div
          data-testid="terminal-render-proof"
          className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em] mb-4"
        >
          Terminal Handshake Protocol Active
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-orange-itred rounded-full animate-spin"></div>
          <div className="space-y-1 text-center">
            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
              Establishing Handshake...
            </p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Protocol Node: {diagStep}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedTerminal) {
    return (
      <div className="max-w-md mx-auto space-y-8 pt-12 animate-in fade-in slide-in-from-bottom-4">
        <div className="text-center space-y-3">
          <Laptop size={48} className="mx-auto text-orange-itred" />
          <h1 className="text-2xl font-black tracking-tighter text-slate-900 uppercase">
            Station Identification
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed px-12">
            Select the physical terminal assigned to this hardware device to begin.
          </p>
        </div>

        <div className="bg-white industrial-border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {terminals.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                No terminals provisioned.
              </p>
              <Link
                to="/vendor/pos/settings"
                className="text-orange-itred font-black text-[10px] uppercase underline tracking-widest"
              >
                Enroll Terminal
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {terminals.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTerminal(t)}
                  className="w-full p-6 text-left flex justify-between items-center hover:bg-slate-50 transition-colors group"
                >
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm group-hover:text-orange-itred transition-colors">
                      {t.terminalName}
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                      CODE: {t.terminalCode} // Node: {t.branchId}
                    </p>
                  </div>
                  <ChevronRight
                    size={20}
                    className="text-slate-200 group-hover:translate-x-1 transition-all"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!activeShift) {
    return (
      <div className="max-w-md mx-auto space-y-8 pt-12 animate-in fade-in slide-in-from-bottom-4">
        <div className="text-center space-y-3">
          <ShieldAlert size={48} className="mx-auto text-orange-itred" />
          <h1 className="text-2xl font-black tracking-tighter text-slate-900 uppercase">
            Shift Not Detected
          </h1>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed px-12">
              Selected Terminal:{' '}
              <span className="text-slate-900">{selectedTerminal.terminalName}</span>
            </p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed px-12">
              Personnel must open a shift session before initializing sales.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            to="/vendor/pos/shifts"
            className="bg-emerald-500 text-white p-5 rounded-xl font-black uppercase tracking-widest text-[11px] text-center shadow-lg shadow-emerald-950/10 hover:bg-emerald-600 transition-all"
          >
            Open Station Shift
          </Link>
          <button
            onClick={() => setSelectedTerminal(null)}
            className="bg-white text-slate-400 p-5 rounded-xl border border-slate-200 font-black uppercase tracking-widest text-[11px] text-center hover:border-slate-300 transition-all"
          >
            Switch Terminal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
      <div
        data-testid="terminal-render-proof"
        className="absolute top-0 right-0 p-1 text-[6px] text-slate-200"
      >
        Terminal Mounted
      </div>
      {/* Receipt Modal */}
      {showReceiptModal && lastCompletedSale && (
        <POSReceipt data={lastCompletedSale} onClose={() => setShowReceiptModal(false)} />
      )}

      {/* Header Info */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl industrial-border border-slate-200 shadow-sm px-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white">
            <Laptop size={20} />
          </div>
          <div>
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight">
              {selectedTerminal.terminalName}
            </h2>
            <div className="flex items-center gap-3">
              <p className="text-[9px] font-black text-orange-itred uppercase tracking-widest">
                Active Shift: {activeShift.shiftId}
              </p>
              <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                Operator: {activeShift.openedByEmail}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setCart([]);
              setSuccess(null);
              setError(null);
            }}
            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Product Search & Grid */}
        <div className="lg:col-span-8 bg-white rounded-xl industrial-border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex gap-4">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                className="w-full bg-white border border-slate-200 p-3 pl-10 text-[11px] font-bold uppercase tracking-widest outline-none rounded focus:border-orange-itred transition-colors"
                placeholder="Search inventory (name, sku, brand, category)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 bg-white border border-slate-200 rounded text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12">
                <Package size={48} className="text-slate-100 mb-4" />
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  No matching inventory found
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((p) => {
                  const inCart = cart.find((c) => c.productId === p.id);
                  const outOfStock = (p.stockQty || 0) <= 0;

                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      disabled={outOfStock}
                      className={`group relative flex flex-col h-48 rounded-lg industrial-border overflow-hidden transition-all text-left ${outOfStock ? 'opacity-50 grayscale cursor-not-allowed bg-slate-50' : 'hover:border-orange-itred hover:shadow-md active:scale-[0.98]'}`}
                    >
                      <div className="h-24 bg-slate-50 relative overflow-hidden">
                        {p.images?.[0] ? (
                          <img
                            src={p.images[0]}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-200">
                            <Package size={24} />
                          </div>
                        )}
                        {inCart && (
                          <div className="absolute top-2 right-2 bg-orange-itred text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg">
                            {inCart.quantity}
                          </div>
                        )}
                        {outOfStock && (
                          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                            <span className="bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest">
                              Out of Stock
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-tight line-clamp-2 leading-tight">
                            {p.name}
                          </h4>
                          <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest truncate">
                            {p.sku || 'NO_SKU'}
                          </p>
                        </div>
                        <div className="flex justify-between items-end">
                          <span className="text-[11px] font-black text-slate-900">
                            $ {Number(p.price || 0).toFixed(2)}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                            {p.stockQty || 0} left
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="lg:col-span-4 bg-slate-900 rounded-xl flex flex-col shadow-2xl relative overflow-hidden border border-slate-800">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-orange-itred" />
              <h3 className="text-white text-xs font-black uppercase tracking-widest">
                Current Cart
              </h3>
            </div>
            <span className="bg-slate-800 text-[8px] font-black text-white px-2 py-1 rounded tracking-widest border border-slate-700">
              {cart.length} ITEMS
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-3 min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-4">
                <Search size={32} className="text-white" />
                <p className="text-[9px] font-black text-white uppercase tracking-[0.3em]">
                  Queue Terminal Active
                </p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div
                  key={item.productId}
                  className="bg-slate-800/50 border border-slate-800 p-3 rounded-lg flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="text-[10px] font-black text-white uppercase truncate tracking-tight">
                      {item.productName}
                    </h5>
                    <button
                      onClick={() => {
                        setOverrideItemIndex(index);
                        setOverridePrice(item.unitPrice);
                        setShowOverrideModal(true);
                      }}
                      className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 hover:underline ${item.overrideApproved ? 'text-orange-itred' : 'text-slate-500'}`}
                    >
                      $ {item.unitPrice.toFixed(2)}
                    </button>
                    {pendingApprovals.some(
                      (a) =>
                        a.requestType === 'POS_PRICE_OVERRIDE' &&
                        a.metadata?.productId === item.productId,
                    ) && (
                      <p className="text-[6px] font-black text-orange-itred uppercase animate-pulse mt-0.5">
                        Approval Pending
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1 border border-slate-800">
                    <button
                      onClick={() => updateQty(item.productId, -1)}
                      className="p-1 hover:text-white text-slate-500 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-[10px] font-black text-white w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.productId, 1)}
                      className="p-1 hover:text-white text-slate-500 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="text-[10px] font-black text-white w-16 text-right">
                    $ {item.lineTotal.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="p-6 bg-slate-950/80 border-t border-slate-800 shrink-0 space-y-6">
            {/* Messages Overlay */}
            {lastCompletedSale && !error && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-xl space-y-4 animate-in zoom-in-95">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                    <CheckCircle size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">
                      Sale Authorized
                    </p>
                    <p className="text-[8px] font-bold text-emerald-400 font-mono uppercase">
                      {lastCompletedSale.receiptNumber}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowReceiptModal(true)}
                    className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-white/5 transition-all"
                  >
                    <Printer size={12} /> View Receipt
                  </button>
                  <button
                    onClick={() => setLastCompletedSale(null)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/20"
                  >
                    <Plus size={12} /> New Sale
                  </button>
                </div>
              </div>
            )}

            {(error || success) && !lastCompletedSale && (
              <div
                className={`p-4 rounded-xl flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${error ? 'bg-red-950/50 border border-red-900/50' : 'bg-emerald-950/50 border border-emerald-900/50'}`}
              >
                <div className="flex items-start gap-3">
                  {error ? (
                    <XCircle className="text-red-500 mt-0.5 shrink-0" size={14} />
                  ) : (
                    <CheckCircle className="text-emerald-500 mt-0.5 shrink-0" size={14} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[10px] font-black uppercase tracking-widest leading-relaxed ${error ? 'text-red-200' : 'text-emerald-200'}`}
                    >
                      {error || success}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setError(null);
                      setSuccess(null);
                      setSaleErrorStep(null);
                    }}
                    className="ml-auto text-white/20 hover:text-white/40"
                  >
                    <XCircle size={14} />
                  </button>
                </div>

                {error && saleErrorStep && (
                  <div className="mt-2 pt-3 border-t border-red-900/30 font-mono text-[8px] uppercase space-y-2 text-red-400/80">
                    <div className="flex justify-between">
                      <span>Err Step:</span>
                      <span className="text-red-300 font-black">{saleErrorStep}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[7px] leading-tight opacity-70">
                      <div>
                        <span className="block text-red-500/50">VENDOR:</span>
                        <span className="block truncate">{saleDiagInfo?.vendorId}</span>
                      </div>
                      <div>
                        <span className="block text-red-500/50">TERM:</span>
                        <span className="block truncate">{saleDiagInfo?.terminalId}</span>
                      </div>
                      <div>
                        <span className="block text-red-500/50">SHIFT:</span>
                        <span className="block truncate">{saleDiagInfo?.shiftId}</span>
                      </div>
                      <div>
                        <span className="block text-red-500/50">ITEMS:</span>
                        <span className="block">{saleDiagInfo?.cartCount}</span>
                      </div>
                    </div>
                    {saleDiagInfo?.currentProduct && (
                      <div className="bg-red-950/30 p-2 rounded border border-red-900/20">
                        <span className="block text-red-500/50 mb-1">CURRENT ITEM:</span>
                        <span className="text-red-300 font-bold">
                          {saleDiagInfo.currentProduct}
                        </span>
                      </div>
                    )}
                    {saleDiagInfo?.coaCount !== undefined && (
                      <div className="flex justify-between text-[7px] border-t border-red-900/10 pt-2">
                        <span>COA_STATUS:</span>
                        <span
                          className={
                            saleDiagInfo.coaCount >= 18 ? 'text-emerald-400' : 'text-orange-400'
                          }
                        >
                          {saleDiagInfo.coaCount}/18 ACCOUNTS
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex justify-between items-center text-slate-500 text-[9px] font-black uppercase tracking-widest">
                <span>Cart Subtotal</span>
                <span>$ {subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-emerald-500 text-[9px] font-black uppercase tracking-widest">
                  <span>Discount Applied</span>
                  <span>-$ {discountAmount.toFixed(2)}</span>
                </div>
              )}
              {pendingApprovals.some((a) => a.requestType === 'POS_DISCOUNT') && (
                <div className="flex justify-between items-center text-orange-itred text-[9px] font-black uppercase tracking-widest animate-pulse">
                  <span>Discount Pending</span>
                  <Clock size={10} />
                </div>
              )}
              <div className="flex justify-between items-center text-slate-500 text-[9px] font-black uppercase tracking-widest border-t border-slate-800 pt-2">
                <button
                  onClick={() => setShowDiscountModal(true)}
                  className="hover:text-white transition-colors flex items-center gap-2"
                >
                  <Tag size={10} /> APPLY DISCOUNT
                </button>
                <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  DRFT_0.00
                </span>
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  Grand Total
                </span>
                <span className="text-white text-xl font-black tracking-tighter">
                  <span className="text-orange-itred text-sm mr-1">$</span>
                  {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* Sale Mode Selector */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-800 rounded-xl border border-slate-700">
                {(['cash', 'credit', 'layby'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setSaleMode(mode);
                      setError(null);
                      if (mode === 'cash') setSelectedCustomer(null);
                    }}
                    className={`py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${saleMode === mode ? 'bg-orange-itred text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Customer Selection */}
              {(saleMode === 'credit' || saleMode === 'layby') && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <div className="relative">
                    <User
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                      size={14}
                    />
                    <input
                      type="text"
                      placeholder="SEARCH CUSTOMER..."
                      className="w-full bg-slate-800 border border-slate-700 p-3 pl-10 text-[9px] font-black uppercase tracking-[0.2em] text-white outline-none rounded-xl focus:border-orange-itred"
                      value={selectedCustomer ? selectedCustomer.fullName : customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerSearch(true);
                        if (selectedCustomer) setSelectedCustomer(null);
                      }}
                      onFocus={() => setShowCustomerSearch(true)}
                    />
                    {selectedCustomer && (
                      <button
                        onClick={() => setSelectedCustomer(null)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      >
                        <XCircle size={14} />
                      </button>
                    )}
                  </div>

                  {showCustomerSearch && !selectedCustomer && (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-10 max-h-40 overflow-y-auto">
                      {filteredCustomersList.length > 0 ? (
                        filteredCustomersList.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setShowCustomerSearch(false);
                              setCustomerSearch('');
                            }}
                            className="w-full p-3 text-left hover:bg-slate-700 border-b border-slate-700 last:border-0 flex justify-between items-center"
                          >
                            <div>
                              <p className="text-[10px] font-black text-white uppercase">
                                {c.fullName}
                              </p>
                              <p className="text-[8px] font-bold text-slate-500">{c.phone}</p>
                            </div>
                            {c.creditLimit && (
                              <div className="text-right">
                                <p className="text-[8px] font-black text-orange-itred uppercase">
                                  Limit: ${c.creditLimit}
                                </p>
                                <p className="text-[7px] text-slate-500 uppercase">
                                  Bal: ${c.currentBalance || 0}
                                </p>
                              </div>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center">
                          <p className="text-[8px] font-black text-slate-500 uppercase italic">
                            No active customers found
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Layby Deposit */}
              {saleMode === 'layby' && selectedCustomer && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-2 italic">
                    Minimum Deposit Required
                  </label>
                  <input
                    type="number"
                    placeholder="DEPOSIT AMOUNT"
                    className="w-full bg-slate-800 border border-slate-700 p-3 text-[11px] font-black text-white outline-none rounded-xl focus:border-orange-itred tracking-widest"
                    value={laybyDeposit === 0 ? '' : laybyDeposit}
                    onChange={(e) => setLaybyDeposit(Number(e.target.value))}
                  />
                  <p className="text-[7px] text-slate-500 px-2 italic">
                    Balance remaining: ${(grandTotal - (laybyDeposit || 0)).toFixed(2)}
                  </p>
                </div>
              )}

              {/* Finalize Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={handleCreateSaleDraft}
                  disabled={cart.length === 0 || isProcessing}
                  className="bg-slate-800 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <RefreshCcw size={14} className="animate-spin" />
                  ) : (
                    <AlertCircle size={14} />
                  )}
                  Park Draft
                </button>
                <button
                  onClick={() => handleFinalizeSale()}
                  disabled={
                    cart.length === 0 ||
                    isProcessing ||
                    ((saleMode === 'credit' || saleMode === 'layby') && !selectedCustomer) ||
                    (saleMode === 'layby' && laybyDeposit <= 0) ||
                    pendingApprovals.length > 0
                  }
                  className={`${saleMode === 'cash' ? 'bg-emerald-500' : saleMode === 'credit' ? 'bg-orange-itred' : 'bg-blue-500'} text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-black/20`}
                >
                  {isProcessing ? (
                    <RefreshCcw size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle size={14} />
                  )}
                  {pendingApprovals.length > 0 ? 'Awaiting Approvals' : `Finalize ${saleMode}`}
                </button>
              </div>
            </div>

            <div className="text-center">
              <p className="text-[7px] text-slate-700 font-black uppercase tracking-[0.4em]">
                POS SALES ENGINE // v2.0-STABLE
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Price Override Modal */}
      {showOverrideModal && overrideItemIndex !== null && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-slate-900">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tighter">Price Override</h3>
                <p className="text-[8px] font-black text-orange-itred uppercase tracking-widest mt-0.5">
                  Authority Required
                </p>
              </div>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handlePriceOverride} className="p-6 space-y-4">
              <div className="p-4 bg-slate-900 rounded-xl space-y-1">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                  Standard Price
                </p>
                <p className="text-lg font-black text-white">
                  ${cart[overrideItemIndex].unitPrice.toFixed(2)}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">
                  New Unit Price ($)
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  autoFocus
                  className="w-full bg-slate-100 border-2 border-transparent focus:border-orange-itred p-4 rounded-xl text-xl font-black outline-none transition-all"
                  value={overridePrice === 0 ? '' : overridePrice}
                  onChange={(e) => setOverridePrice(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">
                  Reason for Override
                </label>
                <textarea
                  required
                  className="w-full bg-slate-100 border-2 border-transparent focus:border-orange-itred p-4 rounded-xl text-xs font-bold outline-none h-20 resize-none transition-all uppercase"
                  placeholder="e.g. COMPETITOR MATCH, BULK DISCOUNT..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <ShieldAlert size={14} /> {isOwner ? 'Apply Override' : 'Request Approval'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-slate-900">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tighter">Sales Discount</h3>
                <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mt-0.5">
                  Cart Level Protocol
                </p>
              </div>
              <button
                onClick={() => setShowDiscountModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleApplyDiscount} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCartDiscount((prev) => ({ ...prev, type: 'fixed' }))}
                  className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all ${cartDiscount.type === 'fixed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Fixed ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCartDiscount((prev) => ({ ...prev, type: 'percent' }))}
                  className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all ${cartDiscount.type === 'percent' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Percent (%)
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">
                  Discount Value
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  autoFocus
                  className="w-full bg-slate-100 border-2 border-transparent focus:border-blue-500 p-4 rounded-xl text-xl font-black outline-none transition-all"
                  value={cartDiscount.value === 0 ? '' : cartDiscount.value}
                  onChange={(e) =>
                    setCartDiscount((prev) => ({
                      ...prev,
                      value: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">
                  Reason for Discount
                </label>
                <textarea
                  required
                  className="w-full bg-slate-100 border-2 border-transparent focus:border-blue-500 p-4 rounded-xl text-xs font-bold outline-none h-20 resize-none transition-all uppercase"
                  placeholder="e.g. VIP CUSTOMER, PROMOTIONAL EVENT..."
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Tag size={14} /> {isOwner ? 'Apply Discount' : 'Request Approval'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && lastCompletedSale && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="w-full max-w-sm animate-in zoom-in-95 duration-500">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowReceiptModal(false)}
                className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full border border-white/10 transition-all"
              >
                <XCircle size={24} />
              </button>
            </div>
            <POSReceipt data={lastCompletedSale} />
          </div>
        </div>
      )}
    </div>
  );
};
