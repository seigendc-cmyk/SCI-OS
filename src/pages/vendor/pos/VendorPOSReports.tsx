import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Filter,
  FileText,
  LayoutDashboard,
  Users,
  Monitor,
  Package,
  RotateCcw,
  Activity,
  Clock,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Printer,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  limit,
  startAt,
  endAt,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { BIEventType } from '../../../services/biService';

// HELPERS
const safeNumber = (val: any) => (isNaN(Number(val)) ? 0 : Number(val));
const formatCurrency = (val: number) => `$${val.toFixed(2)}`;

const exportToCSV = (filename: string, rows: any[]) => {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const cell = row[header] === null || row[header] === undefined ? '' : row[header];
          const cellStr = String(cell).replace(/"/g, '""');
          return `"${cellStr}"`;
        })
        .join(','),
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const TAB_CONFIG = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'daily', label: 'Daily Sales', icon: Calendar },
  { id: 'operators', label: 'Operators', icon: Users },
  { id: 'terminals', label: 'Terminals', icon: Monitor },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'variance', label: 'Variance', icon: Activity },
  { id: 'stock', label: 'Stock Movement', icon: Activity },
];

export const VendorPOSReports: React.FC = () => {
  const { user, appUser, vendorId, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>(
    'today',
  );
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [terminalFilter, setTerminalFilter] = useState('all');
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [saleTypeFilter, setSaleTypeFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtered Data
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [returnRequests, setReturnRequests] = useState<any[]>([]);
  const [biEvents, setBiEvents] = useState<any[]>([]);

  const isAuthorized =
    vendorId && (appUser?.role === 'vendor_owner' || hasPermission('pos.reports.view'));

  const getTimestamps = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (dateRange) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(now.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        if (customRange.start) start = new Date(customRange.start);
        if (customRange.end) end = new Date(customRange.end);
        break;
    }
    return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
  }, [dateRange, customRange]);

  const fetchData = async () => {
    if (!vendorId || !isAuthorized) return;
    setLoading(true);
    setError(null);
    console.log('[POS REPORTS LOAD] Triggering with range:', dateRange);

    try {
      const { start, end } = getTimestamps;

      const baseConstraints: QueryConstraint[] = [
        where('vendorId', '==', vendorId),
        where('createdAt', '>=', start),
        where('createdAt', '<=', end),
        orderBy('createdAt', 'desc'),
      ];

      // Fetch Sales
      const salesSnap = await getDocs(query(collection(db, 'pos_sales'), ...baseConstraints));
      const salesData = salesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSales(salesData);

      // Fetch Sale Items
      const itemsSnap = await getDocs(query(collection(db, 'pos_sale_items'), ...baseConstraints));
      setSaleItems(itemsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      // Fetch Shifts
      const shiftsSnap = await getDocs(query(collection(db, 'pos_shifts'), ...baseConstraints));
      setShifts(shiftsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      // Fetch Returns
      const returnsSnap = await getDocs(
        query(collection(db, 'pos_return_requests'), ...baseConstraints),
      );
      setReturnRequests(returnsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      // Fetch Stock Movements
      const stockSnap = await getDocs(
        query(collection(db, 'inventory_ledger'), ...baseConstraints),
      );
      setStockMovements(stockSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      // Fetch BI Events
      const biSnap = await getDocs(query(collection(db, 'biEvents'), ...baseConstraints));
      setBiEvents(biSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      console.log('[POS REPORTS DATA READY] Records retrieved:', {
        sales: salesData.length,
        items: itemsSnap.size,
        shifts: shiftsSnap.size,
      });
    } catch (err: any) {
      console.error('[POS REPORTS ERROR]', err);
      setError(err.message || 'Failed to aggregate report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [vendorId, getTimestamps]);

  // DERIVED METRICS
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (terminalFilter !== 'all' && s.terminalId !== terminalFilter) return false;
      if (operatorFilter !== 'all' && s.operatorEmail !== operatorFilter) return false;
      if (paymentFilter !== 'all' && s.paymentMethod !== paymentFilter) return false;
      if (saleTypeFilter !== 'all') {
        if (saleTypeFilter === 'sale' && s.saleType === 'refund') return false;
        if (saleTypeFilter === 'refund' && s.saleType !== 'refund') return false;
      }
      return true;
    });
  }, [sales, terminalFilter, operatorFilter, paymentFilter, saleTypeFilter]);

  const filteredItems = useMemo(() => {
    return saleItems.filter((i) => {
      const parentSale = sales.find((s) => s.id === i.saleId);
      if (!parentSale) return true; // Keep orphans or items without fetched parent for now
      if (terminalFilter !== 'all' && parentSale.terminalId !== terminalFilter) return false;
      if (operatorFilter !== 'all' && parentSale.operatorEmail !== operatorFilter) return false;
      if (paymentFilter !== 'all' && parentSale.paymentMethod !== paymentFilter) return false;
      if (saleTypeFilter !== 'all') {
        if (saleTypeFilter === 'sale' && parentSale.saleType === 'refund') return false;
        if (saleTypeFilter === 'refund' && parentSale.saleType !== 'refund') return false;
      }
      return true;
    });
  }, [saleItems, sales, terminalFilter, operatorFilter, paymentFilter, saleTypeFilter]);

  const metrics = useMemo(() => {
    const completedSales = filteredSales.filter(
      (s) => s.status === 'completed' && s.saleType !== 'refund',
    );
    const refunds = filteredSales.filter((s) => s.saleType === 'refund');

    const grossSales = completedSales.reduce((acc, s) => acc + safeNumber(s.grandTotal), 0);
    const refundTotal = refunds.reduce((acc, s) => acc + Math.abs(safeNumber(s.grandTotal)), 0);
    const netSales = grossSales - refundTotal;
    const transactions = completedSales.length;
    const itemsSold = filteredItems
      .filter((i) => {
        const s = sales.find((sl) => sl.id === i.saleId);
        return s?.saleType !== 'refund';
      })
      .reduce((acc, i) => acc + safeNumber(i.qty), 0);

    const abv = transactions > 0 ? netSales / transactions : 0;

    // Profit calc - needs cost data on items
    const cogs = filteredItems
      .filter((i) => {
        const s = sales.find((sl) => sl.id === i.saleId);
        return s?.saleType !== 'refund';
      })
      .reduce((acc, i) => acc + safeNumber(i.unitCost || 0) * safeNumber(i.qty), 0);

    const profit = netSales - cogs;

    const filteredShifts = shifts.filter((s) => {
      if (terminalFilter !== 'all' && s.terminalId !== terminalFilter) return false;
      if (operatorFilter !== 'all' && s.operatorEmail !== operatorFilter) return false;
      return true;
    });

    const totalVariance = filteredShifts.reduce((acc, s) => acc + safeNumber(s.varianceAmount), 0);

    return {
      grossSales,
      refundTotal,
      netSales,
      transactions,
      itemsSold,
      abv,
      profit,
      totalVariance,
      currentShifts: filteredShifts,
    };
  }, [filteredSales, filteredItems, shifts, sales]);

  const handlePrint = () => {
    window.print();
  };

  if (!isAuthorized) {
    return (
      <div className="bg-red-50 p-12 rounded-2xl border border-red-100 flex flex-col items-center text-center">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
          Access Restricted
        </h2>
        <p className="text-sm text-slate-500 max-w-md mt-2">
          Reports access requires Vendor Owner or POS Reports permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 print:p-0">
      {/* Header / Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 print:hidden">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
            POS Operations Suite
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
              Read-Only Analytics
            </span>
            <span className="text-[10px] font-black text-orange-itred uppercase tracking-widest bg-orange-50 px-2 py-1 rounded border border-orange-100 italic">
              v2.0 Industrial Suite
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 h-12 shadow-sm">
            <Calendar size={16} className="text-slate-400" />
            <select
              className="text-[10px] font-black uppercase tracking-widest bg-transparent outline-none cursor-pointer"
              value={dateRange}
              onChange={(e: any) => setDateRange(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <button
            onClick={fetchData}
            className="h-12 w-12 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
            title="Reload Data"
          >
            <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handlePrint}
            className="h-12 flex items-center gap-2 bg-slate-900 text-white px-6 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
          >
            <Printer size={16} /> Print Report
          </button>
        </div>
      </div>

      {/* Print Only Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-8 mb-12">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
              POS Terminal Intelligence Report
            </h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
              Vendor: {appUser?.businessName || 'Authorized Merchant'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              Generated At
            </p>
            <p className="text-xs font-black text-slate-900">{new Date().toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-8 flex gap-12">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Report Scope
            </p>
            <p className="text-sm font-black text-slate-900 uppercase">
              {dateRange.replace('_', ' ')}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Aggregate Range
            </p>
            <p className="text-sm font-black text-slate-900 uppercase">
              {getTimestamps.start.toDate().toLocaleDateString()} -{' '}
              {getTimestamps.end.toDate().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col gap-6 print:hidden">
        <div className="flex overflow-x-auto no-scrollbar gap-2">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                                whitespace-nowrap px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                                ${
                                  activeTab === tab.id
                                    ? 'bg-orange-itred text-white shadow-lg shadow-orange-500/20'
                                    : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                                }
                            `}
            >
              <div className="flex items-center gap-2">
                <tab.icon size={14} />
                {tab.label}
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl industrial-border border-slate-200 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-2">
              Terminal
            </label>
            <select
              className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-black uppercase outline-none focus:border-slate-300"
              value={terminalFilter}
              onChange={(e) => setTerminalFilter(e.target.value)}
            >
              <option value="all">All Terminals</option>
              {[...new Set(sales.map((s) => s.terminalId).filter(Boolean))].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-2">
              Operator
            </label>
            <select
              className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-black uppercase outline-none focus:border-slate-300"
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
            >
              <option value="all">All Operators</option>
              {[...new Set(sales.map((s) => s.operatorEmail).filter(Boolean))].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-2">
              Payment
            </label>
            <select
              className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-black uppercase outline-none focus:border-slate-300"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-2">
              Sale Type
            </label>
            <select
              className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-black uppercase outline-none focus:border-slate-300"
              value={saleTypeFilter}
              onChange={(e) => setSaleTypeFilter(e.target.value)}
            >
              <option value="all">All Sales</option>
              <option value="sale">Orders Only</option>
              <option value="refund">Refunds Only</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-orange-800 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
          <AlertCircle size={18} />
          <span>Reports could not load: {error}</span>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              label="Gross Sales"
              value={formatCurrency(metrics.grossSales)}
              icon={TrendingUp}
              color="emerald"
            />
            <MetricCard
              label="Refunds"
              value={formatCurrency(metrics.refundTotal)}
              icon={RotateCcw}
              color="red"
            />
            <MetricCard
              label="Net Sales"
              value={formatCurrency(metrics.netSales)}
              icon={DollarSign}
              color="slate"
            />
            <MetricCard
              label="Transactions"
              value={metrics.transactions.toString()}
              icon={FileText}
              color="blue"
            />
            <MetricCard
              label="Items Sold"
              value={metrics.itemsSold.toString()}
              icon={Package}
              color="purple"
            />
            <MetricCard
              label="Av. Basket Val"
              value={formatCurrency(metrics.abv)}
              icon={TrendingUp}
              color="orange"
            />
            <MetricCard
              label="GP Estimate"
              value={formatCurrency(metrics.profit)}
              icon={DollarSign}
              color="indigo"
            />
            <MetricCard
              label="Cash Variance"
              value={formatCurrency(metrics.totalVariance)}
              icon={Activity}
              color={metrics.totalVariance === 0 ? 'emerald' : 'orange'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="bg-white p-8 rounded-2xl industrial-border border-slate-200">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">
                Recent Shift Activity
              </h3>
              <div className="space-y-4">
                {metrics.currentShifts.slice(0, 5).map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all"
                  >
                    <div>
                      <p className="text-[10px] font-black text-slate-900 uppercase mb-1">
                        {shift.operatorEmail}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                        {shift.terminalId} // {shift.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-[10px] font-black ${safeNumber(shift.varianceAmount) === 0 ? 'text-emerald-500' : 'text-orange-500'}`}
                      >
                        {formatCurrency(safeNumber(shift.varianceAmount))}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                        Variance
                      </p>
                    </div>
                  </div>
                ))}
                {metrics.currentShifts.length === 0 && (
                  <EmptyState message="No shifts recorded for this period." />
                )}
              </div>
            </section>

            <section className="bg-white p-8 rounded-2xl industrial-border border-slate-200">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">
                Critical BI Events
              </h3>
              <div className="space-y-4">
                {biEvents
                  .filter((e) => e.severity === 'critical' || e.severity === 'warning')
                  .slice(0, 5)
                  .map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100"
                    >
                      <div
                        className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${evt.severity === 'critical' ? 'bg-red-500' : 'bg-orange-500'}`}
                      ></div>
                      <div>
                        <p className="text-[10px] font-black text-slate-900 uppercase mb-1">
                          {evt.message}
                        </p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                          {evt.eventType} // {evt.createdAt?.toDate?.().toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                {biEvents.length === 0 && <EmptyState message="No critical alerts detected." />}
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'daily' && (
        <ReportTable
          title="Daily Sales Summary"
          subtitle="Aggregated daily performance figures"
          filename="daily_sales_report"
          headers={[
            'Date',
            'Gross Sales',
            'Refunds',
            'Net Sales',
            'Transactions',
            'Items Sold',
            'ABV',
          ]}
          rows={useMemo(() => {
            const dailyMap: Record<string, any> = {};
            filteredSales.forEach((s) => {
              const dateStr = s.createdAt?.toDate?.().toLocaleDateString() || 'N/A';
              if (!dailyMap[dateStr]) {
                dailyMap[dateStr] = {
                  Date: dateStr,
                  'Gross Sales': 0,
                  Refunds: 0,
                  'Net Sales': 0,
                  Transactions: 0,
                  'Items Sold': 0,
                  RawGross: 0,
                  RawRefunds: 0,
                };
              }
              if (s.saleType === 'refund') {
                dailyMap[dateStr].RawRefunds += Math.abs(safeNumber(s.grandTotal));
              } else {
                dailyMap[dateStr].RawGross += safeNumber(s.grandTotal);
                dailyMap[dateStr].Transactions += 1;
              }
            });

            // Calculate totals per day and items sold
            Object.keys(dailyMap).forEach((key) => {
              const dm = dailyMap[key];
              dm['Items Sold'] = filteredItems
                .filter((i) => {
                  const s = filteredSales.find((sl) => sl.id === i.saleId);
                  return (
                    s?.saleType !== 'refund' &&
                    s?.createdAt?.toDate?.().toLocaleDateString() === key
                  );
                })
                .reduce((acc, i) => acc + safeNumber(i.qty), 0);

              dm['Gross Sales'] = formatCurrency(dm.RawGross);
              dm['Refunds'] = formatCurrency(dm.RawRefunds);
              dm['Net Sales'] = formatCurrency(dm.RawGross - dm.RawRefunds);
              dm['ABV'] = formatCurrency(
                dm.Transactions > 0 ? (dm.RawGross - dm.RawRefunds) / dm.Transactions : 0,
              );
            });

            return Object.values(dailyMap).sort(
              (a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime(),
            );
          }, [filteredSales, filteredItems])}
        />
      )}

      {activeTab === 'operators' && (
        <ReportTable
          title="Sales by Operator"
          subtitle="Performance tracking by cashier/staff"
          filename="operator_sales_report"
          headers={['Operator Email', 'Transactions', 'Gross Sales', 'Refunds', 'Net Sales', 'ABV']}
          rows={useMemo(() => {
            const opMap: Record<string, any> = {};
            filteredSales.forEach((s) => {
              const op = s.operatorEmail || 'System/Auto';
              if (!opMap[op]) {
                opMap[op] = {
                  'Operator Email': op,
                  Transactions: 0,
                  RawGross: 0,
                  RawRefunds: 0,
                };
              }
              if (s.saleType === 'refund') {
                opMap[op].RawRefunds += Math.abs(safeNumber(s.grandTotal));
              } else {
                opMap[op].RawGross += safeNumber(s.grandTotal);
                opMap[op].Transactions += 1;
              }
            });

            return Object.values(opMap).map((m) => ({
              ...m,
              'Gross Sales': formatCurrency(m.RawGross),
              Refunds: formatCurrency(m.RawRefunds),
              'Net Sales': formatCurrency(m.RawGross - m.RawRefunds),
              ABV: formatCurrency(
                m.Transactions > 0 ? (m.RawGross - m.RawRefunds) / m.Transactions : 0,
              ),
            }));
          }, [filteredSales])}
        />
      )}

      {activeTab === 'terminals' && (
        <ReportTable
          title="Sales by Terminal"
          subtitle="Performance by physical POS station"
          filename="terminal_sales_report"
          headers={[
            'Terminal ID',
            'Transactions',
            'Gross Sales',
            'Refunds',
            'Net Sales',
            'Last Sale',
          ]}
          rows={useMemo(() => {
            const termMap: Record<string, any> = {};
            filteredSales.forEach((s) => {
              const t = s.terminalId || 'UNKNOWN';
              if (!termMap[t]) {
                termMap[t] = {
                  'Terminal ID': t,
                  Transactions: 0,
                  RawGross: 0,
                  RawRefunds: 0,
                  'Last Sale': '',
                };
              }
              if (s.saleType === 'refund') {
                termMap[t].RawRefunds += Math.abs(safeNumber(s.grandTotal));
              } else {
                termMap[t].RawGross += safeNumber(s.grandTotal);
                termMap[t].Transactions += 1;
                const saleTime = s.createdAt?.toDate?.().toLocaleString();
                if (
                  !termMap[t]['Last Sale'] ||
                  new Date(saleTime).getTime() > new Date(termMap[t]['Last Sale']).getTime()
                ) {
                  termMap[t]['Last Sale'] = saleTime;
                }
              }
            });

            return Object.values(termMap).map((m) => ({
              ...m,
              'Gross Sales': formatCurrency(m.RawGross),
              Refunds: formatCurrency(m.RawRefunds),
              'Net Sales': formatCurrency(m.RawGross - m.RawRefunds),
            }));
          }, [filteredSales])}
        />
      )}

      {activeTab === 'products' && (
        <ReportTable
          title="Product Sales Performance"
          subtitle="Top selling items and profit margins"
          filename="product_performance_report"
          headers={[
            'Product Name',
            'SKU',
            'Qty Sold',
            'Gross Sales',
            'Net Qty',
            'Net Sales',
            'GP Est.',
          ]}
          rows={useMemo(() => {
            const prodMap: Record<string, any> = {};
            filteredItems.forEach((i) => {
              const key = i.productId || i.sku || 'N/A';
              if (!prodMap[key]) {
                prodMap[key] = {
                  'Product Name': i.name,
                  SKU: i.sku || 'N/A',
                  'Qty Sold': 0,
                  RawGross: 0,
                  'Net Qty': 0,
                  RawNet: 0,
                  RawGP: 0,
                };
              }
              const parentSale = filteredSales.find((s) => s.id === i.saleId);
              if (parentSale?.saleType === 'refund') {
                prodMap[key]['Net Qty'] -= safeNumber(i.qty);
                prodMap[key].RawNet -= safeNumber(i.lineTotal);
              } else if (parentSale) {
                // must belong to a filtered sale
                prodMap[key]['Qty Sold'] += safeNumber(i.qty);
                prodMap[key].RawGross += safeNumber(i.lineTotal);
                prodMap[key]['Net Qty'] += safeNumber(i.qty);
                prodMap[key].RawNet += safeNumber(i.lineTotal);
                const cost = safeNumber(i.unitCost || 0) * safeNumber(i.qty);
                prodMap[key].RawGP += safeNumber(i.lineTotal) - cost;
              }
            });

            return Object.values(prodMap)
              .map((m) => ({
                ...m,
                'Gross Sales': formatCurrency(m.RawGross),
                'Net Sales': formatCurrency(m.RawNet),
                'GP Est.': formatCurrency(m.RawGP),
              }))
              .sort((a, b) => b.RawNet - a.RawNet);
          }, [filteredItems, filteredSales])}
        />
      )}

      {activeTab === 'returns' && (
        <ReportTable
          title="Returns & Refunds Registry"
          subtitle="Audit trail of all return requests"
          filename="returns_audit_report"
          headers={[
            'Return ID',
            'Original Sale',
            'Status',
            'Method',
            'Amount',
            'Reason',
            'Requested At',
          ]}
          rows={useMemo(() => {
            return returnRequests
              .filter((r) => {
                if (operatorFilter !== 'all' && r.requestedByEmail !== operatorFilter) return false;
                return true;
              })
              .map((r) => ({
                'Return ID': r.id,
                'Original Sale': r.originalReceiptNumber || r.originalSaleId,
                Status: r.status,
                Method: r.refundMethod,
                Amount: formatCurrency(safeNumber(r.requestedTotal)),
                Reason: r.reason,
                'Requested At': r.createdAt?.toDate?.().toLocaleString(),
              }));
          }, [returnRequests, operatorFilter])}
        />
      )}

      {activeTab === 'variance' && (
        <ReportTable
          title="Cash Variance & Shift Audit"
          subtitle="Identifying discrepancies in terminal closing"
          filename="variance_audit_report"
          headers={[
            'Shift ID',
            'Operator',
            'Expected Cash',
            'Actual Cash',
            'Variance',
            'Closed At',
          ]}
          rows={useMemo(() => {
            return metrics.currentShifts
              .filter((s) => s.status === 'closed')
              .map((s) => ({
                'Shift ID': s.id,
                Operator: s.operatorEmail,
                'Expected Cash': formatCurrency(safeNumber(s.expectedCash)),
                'Actual Cash': formatCurrency(safeNumber(s.actualCash)),
                Variance: formatCurrency(safeNumber(s.varianceAmount)),
                'Closed At': s.closedAt?.toDate?.().toLocaleString() || 'N/A',
              }));
          }, [metrics.currentShifts])}
        />
      )}

      {activeTab === 'stock' && (
        <ReportTable
          title="Inventory Movement Audit"
          subtitle="History of all POS-related stock changes"
          filename="stock_movement_report"
          headers={['Date', 'Product', 'Type', 'Change', 'Before', 'After', 'Ref']}
          rows={useMemo(() => {
            return stockMovements
              .filter((m) => {
                // Link to filtered sales if useful? Stock movement is more absolute.
                // We can at least filter by operator if actor email exists
                if (operatorFilter !== 'all' && m.actorEmail !== operatorFilter) return false;
                return true;
              })
              .map((m) => ({
                Date: m.createdAt?.toDate?.().toLocaleString() || 'N/A',
                Product: m.productName || m.sku || 'N/A',
                Type: m.movementType,
                Change: m.quantityChange,
                Before: m.stockBefore,
                After: m.stockAfter,
                Ref: m.referenceId || m.saleId || 'N/A',
              }));
          }, [stockMovements, operatorFilter])}
        />
      )}
    </div>
  );
};

// SUB-COMPONENTS
const MetricCard = ({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: any;
  color: string;
}) => {
  const bgColors: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    red: 'bg-red-50 border-red-100 text-red-600',
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
    orange: 'bg-orange-50 border-orange-100 text-orange-600',
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-600',
    purple: 'bg-purple-50 border-purple-100 text-purple-600',
    slate: 'bg-slate-50 border-slate-100 text-slate-600',
  };

  return (
    <div className="bg-white p-6 rounded-2xl industrial-border border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            {label}
          </p>
          <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${bgColors[color] || bgColors.slate}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="h-1 w-0 group-hover:w-full bg-slate-900 transition-all duration-500 absolute bottom-0 left-0"></div>
    </div>
  );
};

const ReportTable = ({
  title,
  subtitle,
  headers,
  rows,
  filename,
}: {
  title: string;
  subtitle: string;
  headers: string[];
  rows: any[];
  filename: string;
}) => {
  return (
    <section className="bg-white rounded-2xl industrial-border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
      <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 print:bg-white print:p-4">
        <div>
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">{title}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {subtitle}
          </p>
        </div>
        <button
          onClick={() => exportToCSV(filename, rows)}
          className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm print:hidden"
        >
          <Download size={14} /> CSV Export
        </button>
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full text-left border-collapse min-w-[800px] print:min-w-0">
          <thead>
            <tr className="bg-slate-950 text-white border-b border-slate-800">
              {headers.map((h) => (
                <th key={h} className="p-6 text-[9px] font-black uppercase tracking-[0.2em]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                {headers.map((h) => (
                  <td
                    key={h}
                    className="p-6 text-[11px] font-black text-slate-600 uppercase tracking-tight group-hover:text-slate-900"
                  >
                    {row[h] === undefined ? '-' : String(row[h])}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="p-12">
                  <EmptyState message="No data matched the selected filters." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center opacity-40">
    <Monitor className="text-slate-300 mb-2" size={32} />
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{message}</p>
  </div>
);
