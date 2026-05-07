import React, { useRef } from 'react';
import {
  ReceiptData,
  generate80ColumnReceipt,
  getWhatsAppReceiptUrl,
} from '../../services/receiptService';
import { Printer, Share2, X, Download, MessageSquare } from 'lucide-react';

interface POSReceiptProps {
  data: ReceiptData;
  onClose: () => void;
}

export const POSReceipt: React.FC<POSReceiptProps> = ({ data, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt ${data.receiptNumber}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              font-size: 12px; 
              width: 80mm; 
              margin: 0; 
              padding: 10mm;
              box-sizing: border-box;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 5px 0; }
            .double-divider { border-top: 2px solid #000; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; }
            .item-row td { vertical-align: top; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = () => {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleWhatsApp = () => {
    const text = generate80ColumnReceipt(data);
    const url = getWhatsAppReceiptUrl(text);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
          <div className="space-y-1">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
              Sale Receipt
            </h2>
            <p className="text-[10px] font-bold text-slate-400 font-mono uppercase">
              {data.receiptNumber}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-[#fafafa]">
          {/* Printable Content */}
          <div
            ref={printRef}
            className="bg-white p-6 shadow-sm border border-slate-200 font-mono text-[11px] text-slate-800 space-y-4"
          >
            <div className="text-center space-y-1">
              <h3 className="font-black text-xs uppercase tracking-tight">{data.vendorName}</h3>
              {data.branchName && <p className="uppercase">{data.branchName}</p>}
              {data.vendorPhone && <p>TEL: {data.vendorPhone}</p>}
            </div>

            <div className="border-t border-dashed border-slate-300 pt-3 space-y-1">
              <div className="flex justify-between">
                <span>RECEIPT:</span>
                <span className="font-bold">{data.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>DATE:</span>
                <span>
                  {data.date.toLocaleString([], {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>TERM:</span>
                <span className="uppercase">{data.terminalName}</span>
              </div>
              <div className="flex justify-between">
                <span>OP:</span>
                <span>{data.operatorEmail.split('@')[0]}</span>
              </div>
              {data.customerName && (
                <div className="flex justify-between">
                  <span>CUSTOMER:</span>
                  <span className="uppercase">{data.customerName}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-slate-300 pt-3">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 pb-1">
                    <th className="pb-1">QTY ITEM</th>
                    <th className="text-right pb-1">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50">
                  {data.items.map((item, idx) => (
                    <tr key={idx} className="item-row">
                      <td className="py-2 pr-4">
                        <div className="font-bold uppercase leading-tight">
                          {item.quantity} x {item.name}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          @ {item.unitPrice.toFixed(2)}
                        </div>
                      </td>
                      <td className="py-2 text-right font-bold align-bottom">
                        {item.lineTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-dashed border-slate-300 pt-3 space-y-1">
              <div className="flex justify-between">
                <span>ORDER TOTAL:</span>
                <span className="font-bold">{data.subtotal.toFixed(2)}</span>
              </div>
              {data.paymentMethod === 'layby' ? (
                <>
                  <div className="flex justify-between">
                    <span>DEPOSIT PAID:</span>
                    <span className="font-bold">{data.laybyDeposit?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[13px] pt-1">
                    <span className="font-black">BALANCE DUE:</span>
                    <span className="font-black">$ {data.laybyBalance?.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-[13px] pt-1">
                  <span className="font-black">GRAND TOTAL:</span>
                  <span className="font-black">$ {data.total.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1">
                <span>METHOD:</span>
                <span className="font-bold uppercase">{data.paymentMethod}</span>
              </div>
            </div>

            <div className="border-t-2 border-slate-900 pt-4 text-center space-y-1">
              <p className="font-black uppercase tracking-widest text-[9px]">
                THANK YOU FOR BUYING
              </p>
              <p className="text-[8px] text-slate-400">POWERED BY ITRED BY SEIGEN COMMERCE</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-100 rounded-b-3xl grid grid-cols-2 gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 p-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors"
          >
            <Printer size={16} />
            Print
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-2 p-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-colors"
          >
            <MessageSquare size={16} />
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};
