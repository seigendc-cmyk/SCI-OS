import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  addDoc,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../contexts/AuthContext';
import { createBIEvent, BIEventType } from './biService';

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  price: number;
  lineTotal: number;
  imageUrl?: string;
}

export interface OrderData {
  vendorId: string;
  vendorName?: string;
  source: 'storefront' | 'catalogue' | 'itred_marketplace' | 'offline_catalogue' | 'manual';
  sourceId: string;
  customerName: string;
  customerPhone: string;
  customerWhatsApp?: string;
  customerLocation: string;
  customerNotes: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  preferredFulfillment: 'pickup' | 'delivery' | 'not_specified';
  branchId?: string;
  branchName?: string;
  deliveryServiceId?: string;
}

export const createAuditLog = async (data: {
  action: string;
  targetType: string;
  targetId: string;
  vendorId?: string;
  metadata?: any;
}) => {
  try {
    const logId = `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
    await setDoc(doc(db, 'audit_logs', logId), {
      ...data,
      vendorId: data.vendorId || 'system',
      performedBy: auth.currentUser?.uid || 'public_user',
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Silent Audit Log Failure:', err);
  }
};

export const createPOSEvent = async (data: {
  vendorId: string;
  branchId?: string;
  terminalId?: string;
  shiftId?: string;
  eventType: string;
  actorUid: string;
  actorEmail: string;
  actorRole?: string;
  metadata?: any;
}) => {
  try {
    const eventId =
      `POS-EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase();
    await setDoc(doc(db, 'pos_events', eventId), {
      ...data,
      eventId,
      role: data.actorRole || 'staff',
      createdAt: serverTimestamp(),
    });

    // Trigger matching BI Event
    let biEventType: BIEventType | null = null;
    switch (data.eventType) {
      case 'POS_SHIFT_OPENED':
        biEventType = BIEventType.SHIFT_OPENED;
        break;
      case 'POS_SHIFT_CLOSED_ATTEMPTED':
        biEventType = BIEventType.SHIFT_CLOSED;
        break;
      case 'POS_TERMINAL_ACCESSED':
        biEventType = BIEventType.APP_ACTIVITY_LOGGED;
        break;
      case 'POS_TERMINAL_CREATED':
        biEventType = BIEventType.APP_ACTIVITY_LOGGED;
        break;
    }

    if (biEventType) {
      await createBIEvent({
        vendorId: data.vendorId,
        branchId: data.branchId,
        terminalId: data.terminalId,
        shiftId: data.shiftId,
        userId: data.actorUid,
        userEmail: data.actorEmail,
        userRole: data.actorRole || 'staff',
        eventType: biEventType,
        severity: 'info',
        message: `POS Operation: ${data.eventType}`,
        metadata: data.metadata,
      });
    }
  } catch (err) {
    console.warn('Silent POS Event Failure:', err);
  }
};

export const generateOrderWhatsAppMessage = (order: OrderData, orderId?: string) => {
  let message = `*NEW ORDER SUBMITTED (iTred)*\n`;
  message += `--------------------------\n`;
  if (orderId) message += `*Order ID:* ${orderId}\n`;
  if (order.vendorName) message += `*Vendor:* ${order.vendorName}\n`;
  message += `*Customer:* ${order.customerName}\n`;
  message += `*Phone:* ${order.customerPhone}\n`;
  message += `*Location:* ${order.customerLocation || 'Not specified'}\n`;
  message += `*Fulfillment:* ${order.preferredFulfillment.toUpperCase()}\n`;

  if (order.branchName) {
    message += `*Pickup Point:* ${order.branchName}\n`;
  }

  message += `*Source:* ${order.source?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}\n`;

  if (order.customerNotes) {
    message += `*Notes:* ${order.customerNotes}\n`;
  }

  message += `\n*ITEMS:*\n`;
  order.items.forEach((item) => {
    message += `- ${item.name} (${item.sku})\n  Qty: ${item.qty} x $${item.price.toFixed(2)} | Line: $${item.lineTotal.toFixed(2)}\n`;
  });

  message += `\n*TOTAL AMOUNT: $${order.totalAmount.toFixed(2)} ${order.currency}*\n`;
  message += `--------------------------\n`;
  message += `*IMPORTANT:* This order is pending vendor confirmation. Please wait for a response regarding stock and delivery/pickup schedule.`;

  return message;
};

export const generateFulfilmentCode = () => {
  // Generate a 6-digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const generateStatusUpdateWhatsAppMessage = (
  order: any,
  type:
    | 'accepted'
    | 'rejected'
    | 'preparing'
    | 'delivery'
    | 'pickup'
    | 'completed'
    | 'fulfilment_code',
  extra?: any,
) => {
  let message = `*ORDER UPDATE: ${order.orderId}*\n`;
  message += `--------------------------\n`;

  switch (type) {
    case 'accepted':
      message += `✅ Your order has been *ACCEPTED*.\nWe are now processing your items.`;
      break;
    case 'rejected':
      message += `❌ Your order was *DECLINED*.\n*Reason:* ${extra?.reason || 'Unavailable'}\nWe apologize for the inconvenience.`;
      break;
    case 'preparing':
      message += `👨‍🍳 Your order is currently being *PREPARED* in our warehouse.`;
      break;
    case 'delivery':
      message += `🚚 Your order has been *DISPATCHED*.\n*Courier:* ${order.deliveryServiceName || 'Standard Delivery'}\n*SECRET CODE:* ${order.fulfilmentCode || '####'}\n\n*IMPORTANT:* Only provide the secret code to the driver once you have received and inspected your package.`;
      break;
    case 'fulfilment_code':
      message += `🔑 *DELIVERY FULFILMENT CODE:* ${order.fulfilmentCode}\n\nProvide this code to the delivery person only after receiving and inspecting your items. This confirms the handover.`;
      break;
    case 'pickup':
      message += `📍 Your order is *READY FOR PICKUP*.\n*Location:* ${order.branchName || 'Main Branch'}\n*Hours:* Please check store profile for operating hours.`;
      break;
    case 'completed':
      message += `✨ Your order has been *COMPLETED*.\nThank you for shopping with ${order.vendorName || 'us'} via iTred. We hope to serve you again!`;
      break;
  }

  message += `\n--------------------------\n`;
  message += `Order Link: ${window.location.origin}/itred/listing/${order.vendorId}`;

  return message;
};

export const createOrder = async (orderData: OrderData) => {
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
  const whatsappMessage = generateOrderWhatsAppMessage(orderData, orderId);

  const finalOrder = {
    ...orderData,
    orderId,
    status: 'submitted',
    paymentStatus: 'unpaid',
    whatsappMessage,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'orders', orderId), finalOrder);

    // Log action
    await createAuditLog({
      action: 'ORDER_SUBMITTED',
      targetType: 'order',
      targetId: orderId,
      vendorId: orderData.vendorId,
      metadata: { source: orderData.source },
    });

    return { success: true, orderId, whatsappMessage };
  } catch (err) {
    console.error('Order creation failed:', err);
    // Fallback for WhatsApp is handled by the UI
    return { success: false, error: err, whatsappMessage };
  }
};
