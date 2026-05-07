import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Package, MessageCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const POSPlanGate = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-2xl bg-white industrial-border rounded-2xl overflow-hidden shadow-2xl shadow-slate-200">
        <div className="bg-orange-itred p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
          <ShieldAlert size={48} className="mx-auto mb-4" />
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">
            POS Module Restricted
          </h1>
          <p className="text-orange-100 text-[10px] font-bold uppercase tracking-[0.3em]">
            Module // Point of Sale Activation Required
          </p>
        </div>

        <div className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row gap-12">
            <div className="flex-1">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 pb-2 border-b-2 border-slate-900 w-fit">
                Module Entitlements
              </h2>
              <ul className="space-y-4">
                {[
                  'Real-time Terminal Operations',
                  'Automated Shifts & Cash Control',
                  'Inventory & Stock Deduction',
                  'Thermal Receipt Printing',
                  'Advanced BI Sales Reporting',
                  'Returns & Approvals Protocol',
                ].map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-3 text-slate-600 font-bold text-[11px] uppercase tracking-tight"
                  >
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex-1 space-y-6">
              <div className="p-6 bg-slate-900 rounded-xl text-white">
                <Package size={24} className="text-orange-itred mb-4" />
                <h3 className="text-xs font-black uppercase tracking-widest mb-2">
                  Paid Module Activation
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed tracking-tighter">
                  Point of Sale is a premium module. Activate to link terminals, manage shops, and
                  process secure physical transactions.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  className="w-full bg-orange-itred text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
                  onClick={() => window.open('https://wa.me/YOUR_WHATSAPP_NUMBER', '_blank')}
                >
                  <MessageCircle size={18} />
                  Request POS Activation
                </button>
                <button
                  className="w-full bg-white border-2 border-slate-900 text-slate-900 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  onClick={() => navigate('/vendor')}
                >
                  <ArrowLeft size={18} />
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black">
                iT
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-900 uppercase">seiGEN Commerce</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  Enterprise Ecosystem
                </p>
              </div>
            </div>
            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em]">
              Deployment Phase: 2.1-M
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
