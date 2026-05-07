export interface ReceiptData {
  vendorName: string;
  vendorPhone?: string;
  vendorWhatsApp?: string;
  branchName?: string;
  terminalName: string;
  operatorEmail: string;
  receiptNumber: string;
  saleId: string;
  date: Date;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  total: number;
  paymentMethod: string;
  customerName?: string;
  laybyDeposit?: number;
  laybyBalance?: number;
}

export function generate80ColumnReceipt(data: ReceiptData): string {
  const width = 32; // Standard narrow thermal printer width (approx 32-40 chars)
  const divider = '-'.repeat(width);
  const doubleDivider = '='.repeat(width);

  const center = (text: string) => {
    const space = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(space) + text;
  };

  const justify = (left: string, right: string) => {
    const space = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(space) + right;
  };

  let r = '';
  r += center(data.vendorName.toUpperCase()) + '\n';
  if (data.branchName) r += center(data.branchName) + '\n';
  if (data.vendorPhone) r += center(`TEL: ${data.vendorPhone}`) + '\n';
  r += divider + '\n';

  r += justify('RECEIPT:', data.receiptNumber) + '\n';
  r += justify('DATE:', data.date.toLocaleString()) + '\n';
  r += justify('TERM:', data.terminalName) + '\n';
  r += justify('OP:', data.operatorEmail.split('@')[0]) + '\n';
  if (data.customerName) r += justify('CUSTOMER:', data.customerName) + '\n';
  r += divider + '\n';

  r += justify('QTY ITEM', 'TOTAL') + '\n';
  r += divider + '\n';

  data.items.forEach((item) => {
    // Item name might be long, wrap it? Or truncate?
    const name = item.name.length > 20 ? item.name.substring(0, 17) + '...' : item.name;
    r += `${item.quantity} x ${name}\n`;
    r += justify(`  @ ${item.unitPrice.toFixed(2)}`, item.lineTotal.toFixed(2)) + '\n';
  });

  r += divider + '\n';
  r += justify('ORDER TOTAL:', data.subtotal.toFixed(2)) + '\n';

  if (data.paymentMethod === 'layby') {
    r += justify('DEPOSIT PAID:', (data.laybyDeposit || 0).toFixed(2)) + '\n';
    r += justify('BALANCE DUE:', (data.laybyBalance || 0).toFixed(2)) + '\n';
  } else {
    r += justify('TOTAL PAID:', data.total.toFixed(2)) + '\n';
  }

  r += justify('METHOD:', data.paymentMethod.toUpperCase()) + '\n';
  r += doubleDivider + '\n';

  r += center('THANK YOU FOR BUYING') + '\n';
  r += center('POWERED BY ITRED') + '\n';
  r += center('BY SEIGEN COMMERCE') + '\n';

  return r;
}

export function getWhatsAppReceiptUrl(receiptText: string, customerPhone?: string): string {
  const encoded = encodeURIComponent(receiptText);
  if (customerPhone) {
    const clean = customerPhone.replace(/\+/g, '').replace(/\s+/g, '');
    return `https://wa.me/${clean}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}
