import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  serverTimestamp,
  writeBatch,
  increment,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createBIEvent, BIEventType } from './biService';
import { createPOSEvent } from './orderService';
import { createAccountingJournalDraft } from './accountingService';

export interface SaleReturnItem {
  productId: string;
  productName: string;
  originalQty: number;
  returnQty: number;
  unitPrice: number;
  lineTotal: number;
  costPrice?: number;
}

export interface ReturnRequestParams {
  vendorId: string;
  originalSale: any;
  user: { uid: string; email: string | null };
  appUser: any;
  returnItems: SaleReturnItem[];
  reason: string;
  refundMethod: 'cash' | 'credit_note' | 'exchange';
}

const safeString = (value: any, fallback = '') =>
  typeof value === 'string' ? value : value == null ? fallback : String(value);

const safeNumber = (value: any, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const stripUndefined = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined);
  }

  if (
    obj &&
    typeof obj === 'object' &&
    !(obj instanceof Date) &&
    !(obj.constructor?.name === 'FieldValueImpl')
  ) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, stripUndefined(value)]),
    );
  }

  return obj;
};

const assertNoUndefined = (obj: any, path = 'payload') => {
  if (obj === undefined) {
    throw new Error(`Undefined value detected at ${path}`);
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => assertNoUndefined(v, `${path}[${i}]`));
  } else if (
    obj &&
    typeof obj === 'object' &&
    !(obj instanceof Date) &&
    !(obj.constructor?.name === 'FieldValueImpl') &&
    !(obj.constructor?.name === 't')
  ) {
    Object.entries(obj).forEach(([k, v]) => assertNoUndefined(v, `${path}.${k}`));
  }
};

export const createReturnRequest = async (params: ReturnRequestParams) => {
  const { vendorId, originalSale, user, appUser, returnItems, reason, refundMethod } = params;

  console.log('[RETURN REQUEST CREATE START]', {
    saleId: originalSale.id,
    vendorId,
    itemsCount: returnItems.length,
    refundMethod,
  });

  try {
    const returnId =
      `RET-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`.toUpperCase();
    const now = serverTimestamp();

    const normalizedItems = returnItems.map((item, idx) => {
      const originalQty = safeNumber(item.originalQty ?? (item as any).quantity ?? 0, 0);
      const returnQty = safeNumber(item.returnQty, 0);
      const unitPrice = safeNumber(item.unitPrice, 0);
      const costPrice = safeNumber(item.costPrice, 0);
      const lineTotal = returnQty * unitPrice;
      const costTotal = returnQty * costPrice;

      return stripUndefined({
        saleItemId: safeString((item as any).saleItemId ?? (item as any).id, `item-${idx}`),
        productId: safeString(item.productId, 'unknown'),
        productName: safeString(item.productName, 'Unknown item'),
        originalQty,
        soldQty: originalQty,
        returnQty,
        unitPrice,
        costPrice,
        lineTotal,
        costTotal,
      });
    });

    const totalRefund = normalizedItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const totalCostReversal = normalizedItems.reduce(
      (sum, i) => sum + (i.costPrice || 0) * i.returnQty,
      0,
    );

    const batch = writeBatch(db);

    // 1. Create Return Request
    const returnPayload = stripUndefined({
      returnId,
      vendorId: safeString(vendorId),
      originalSaleId: safeString(originalSale.saleId ?? originalSale.id),
      originalReceiptNumber: safeString(
        originalSale.receiptNumber,
        safeString(originalSale.saleId ?? originalSale.id),
      ),
      terminalId: safeString(originalSale.terminalId, 'UNKNOWN'),
      terminalName: safeString(originalSale.terminalName ?? originalSale.terminalId, 'Terminal'),
      shiftId: safeString(originalSale.shiftId, 'UNKNOWN'),
      requestedByUid: safeString(user.uid),
      requestedByEmail: safeString(user.email, 'system'),
      reason: safeString(reason),
      status: 'pending',
      refundMethod: safeString(refundMethod, 'cash'),
      items: normalizedItems,
      totalRefund: safeNumber(totalRefund),
      totalCostReversal: safeNumber(totalCostReversal),
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    console.log('[RETURN REQUEST PAYLOAD SANITIZED]', returnPayload);
    assertNoUndefined(returnPayload, 'returnDoc');
    batch.set(doc(db, 'pos_return_requests', returnId), returnPayload);

    // 2. Create Approval Request
    const approvalId = `APP-${Date.now()}`;
    const approvalPayload = stripUndefined({
      approvalId,
      vendorId: safeString(vendorId),
      requestType: 'POS_RETURN_REFUND',
      sourceCollection: 'pos_return_requests',
      sourceId: returnId,
      originalSaleId: safeString(originalSale.saleId ?? originalSale.id),
      // Legacy fields (retained)
      requestedByUid: safeString(user.uid),
      requestedByEmail: safeString(user.email, 'system'),
      // Draft-compatible fields (dual-write)
      requestedBy: safeString(user.uid),
      createdAt: now,
      // Decision fields (kept as pending)
      status: 'pending',
      reason: safeString(reason),
      amount: safeNumber(totalRefund),
      updatedAt: now,
    });


    assertNoUndefined(approvalPayload, 'approvalDoc');
    batch.set(doc(db, 'approval_requests', approvalId), approvalPayload);

    console.log('[RETURN REQUEST BATCH COMMIT]');
    await batch.commit();
    console.log('[RETURN REQUEST SUCCESS]', returnId);

    // Events (Non-blocking)
    createPOSEvent({
      vendorId: safeString(vendorId),
      terminalId: safeString(originalSale.terminalId, 'UNKNOWN'),
      shiftId: safeString(originalSale.shiftId, 'UNKNOWN'),
      eventType: 'REFUND_REQUESTED',
      actorUid: user.uid,
      actorEmail: user.email!,
      metadata: stripUndefined({
        returnId,
        saleId: originalSale.id,
        totalRefund,
      }),
    }).catch((e) => console.warn('Failed to create POS event for return', e));

    createBIEvent({
      vendorId: safeString(vendorId),
      userId: user.uid,
      userEmail: user.email!,
      userRole: appUser?.role || 'vendor_staff',
      eventType: BIEventType.REFUND_REQUESTED,
      severity: 'warning',
      message: `Refund requested for sale ${originalSale.id}. Amount: $${totalRefund.toFixed(2)}.`,
      metadata: stripUndefined({ returnId, saleId: originalSale.id }),
    }).catch((e) => console.warn('Failed to create BI event for return', e));

    return {
      success: true,
      returnId,
      approvalId,
    };
  } catch (err: any) {
    console.error('[RETURN REQUEST ERROR]', err);
    throw err;
  }
};

export const approveReturnRequest = async (
  vendorId: string,
  requestId: string,
  user: { uid: string; email: string | null },
  appUser: any,
) => {
  let approveStep = 'init';
  console.log('[RETURN APPROVAL START]', { requestId, vendorId });

  try {
    // 1. Load the return request
    approveStep = 'load_return_request';
    const reqRef = doc(db, 'pos_return_requests', requestId);
    const reqSnap = await getDoc(reqRef);

    if (!reqSnap.exists()) {
      throw new Error('Return request not found.');
    }

    const requestData = reqSnap.data() as any;
    const targetVendorId = safeString(requestData.vendorId || vendorId);

    console.log('[APPROVE RETURN STEP]', {
      approveStep,
      requestId,
      targetVendorId,
      approvedByUid: user.uid,
    });

    const now = serverTimestamp();
    const batch = writeBatch(db);

    // 2. Prepare return update
    approveStep = 'prepare_return_update';
    const returnUpdate = stripUndefined({
      status: 'approved',
      approvedAt: now,
      approvedByUid: safeString(user.uid),
      approvedByEmail: safeString(user.email, 'system'),
      updatedAt: now,
    });
    batch.update(reqRef, returnUpdate);

    // 3. Query and prepare approval request update
    approveStep = 'query_approval_request';
    console.log('[APPROVE RETURN STEP]', { approveStep, requestId });

    const approvalsSnap = await getDocs(
      query(
        collection(db, 'approval_requests'),
        where('vendorId', '==', targetVendorId),
        where('sourceCollection', '==', 'pos_return_requests'),
        where('sourceId', '==', requestId),
        where('status', '==', 'pending'),
      ),
    );

    if (approvalsSnap.empty) {
      console.warn('[RETURN APPROVAL] APPROVAL_REQUEST_LINK_MISSING for', requestId);
      // Create a warning event
      const warnEventId = `EVENT-WARN-${Date.now()}`;
      const warnPayload = stripUndefined({
        vendorId: targetVendorId,
        terminalId: 'SYSTEM',
        shiftId: 'SYSTEM',
        eventType: 'SYSTEM_WARNING',
        actorUid: user.uid,
        actorEmail: user.email || 'system',
        metadata: {
          warning: 'APPROVAL_REQUEST_LINK_MISSING',
          returnId: requestId,
          message:
            'A return request was approved but no pending approval_request was found to link.',
        },
        createdAt: now,
      });
      batch.set(doc(db, 'pos_events', warnEventId), warnPayload);
    } else {
      approveStep = 'prepare_approval_update';
      const approvalUpdate = stripUndefined({
        status: 'approved',
        // Legacy fields (retained)
        approvedAt: now,
        approvedByUid: safeString(user.uid),
        approvedByEmail: safeString(user.email, 'system'),
        // Draft-compatible fields (dual-write)
        approvedBy: safeString(user.uid),
        decidedAt: now,
        updatedAt: now,
      });


      approvalsSnap.docs.forEach((d) => {
        batch.update(d.ref, approvalUpdate);
      });
    }

    // 4. Commit the batch
    approveStep = 'batch_commit';
    console.log('[APPROVE RETURN STEP]', { approveStep, requestId });
    await batch.commit();
    console.log('[RETURN APPROVAL SUCCESS]', requestId);

    // 5. Create Events (Non-blocking)
    approveStep = 'prepare_pos_event';
    createPOSEvent({
      vendorId: targetVendorId,
      terminalId: safeString(requestData.terminalId, 'UNKNOWN'),
      shiftId: safeString(requestData.shiftId, 'UNKNOWN'),
      eventType: 'REFUND_APPROVED' as any,
      actorUid: user.uid,
      actorEmail: user.email!,
      metadata: stripUndefined({
        returnId: requestId,
        saleId: requestData.originalSaleId,
        totalRefund: safeNumber(requestData.totalRefund),
      }),
    }).catch((e) => console.warn('Failed to create POS event for return approval', e));

    approveStep = 'prepare_bi_event';
    createBIEvent({
      vendorId: targetVendorId,
      userId: user.uid,
      userEmail: user.email!,
      userRole: appUser?.role || 'vendor_staff',
      eventType: BIEventType.REFUND_APPROVED,
      severity: 'info',
      message: `Refund request ${requestId} approved by ${user.email}.`,
      metadata: stripUndefined({
        returnId: requestId,
        action: 'approved',
        saleId: requestData.originalSaleId,
        totalRefund: safeNumber(requestData.totalRefund),
      }),
    }).catch((e) => console.warn('Failed to create BI event for return approval', e));

    return { success: true };
  } catch (err: any) {
    console.error('[APPROVE RETURN FAILED]', {
      approveStep,
      requestId,
      vendorId,
      code: err.code,
      message: err.message,
    });
    throw new Error(`Approval failed at ${approveStep}: ${err.message}`);
  }
};

export const rejectReturnRequest = async (
  vendorId: string,
  requestId: string,
  user: { uid: string; email: string | null },
  appUser: any,
  reason: string,
) => {
  console.log('[RETURN REJECTION START]', requestId);

  const reqRef = doc(db, 'pos_return_requests', requestId);
  const reqSnap = await getDoc(reqRef);

  if (!reqSnap.exists()) {
    throw new Error('Return request not found.');
  }

  const requestData = reqSnap.data() as any;
  const targetVendorId = safeString(requestData.vendorId || vendorId);

  const now = serverTimestamp();
  const batch = writeBatch(db);

  batch.update(reqRef, {
    status: 'rejected',
    rejectedAt: now,
    rejectedByUid: safeString(user.uid),
    rejectedByEmail: safeString(user.email, 'system'),
    rejectionReason: safeString(reason),
    updatedAt: now,
  });

  // Find linked approval request
  console.log('[RETURN REJECTION] Finding linked approval_requests');
  const approvalsSnap = await getDocs(
    query(
      collection(db, 'approval_requests'),
      where('sourceId', '==', requestId),
      where('status', '==', 'pending'),
    ),
  );

  approvalsSnap.docs.forEach((d) => {
    batch.update(d.ref, {
      status: 'rejected',
      // Legacy fields (retained)
      approvedAt: now,
      approvedByUid: safeString(user.uid),
      approvedByEmail: safeString(user.email, 'system'),
      rejectedAt: now,
      rejectedByUid: safeString(user.uid),
      rejectedByEmail: safeString(user.email, 'system'),
      // Draft-compatible fields (dual-write)
      approvedBy: safeString(user.uid),
      decidedAt: now,
      updatedAt: now,
    });
  });


  console.log('[RETURN REJECTION] Committing batch for', requestId);
  await batch.commit();

  await createBIEvent({
    vendorId: targetVendorId,
    userId: user.uid,
    userEmail: user.email!,
    userRole: appUser?.role || 'vendor_staff',
    eventType: BIEventType.APP_ACTIVITY_LOGGED,
    severity: 'warning',
    message: `Refund request ${requestId} rejected by ${user.email}. Reason: ${reason}`,
    metadata: stripUndefined({
      returnId: requestId,
      action: 'rejected',
      reason,
      saleId: requestData.originalSaleId,
    }),
  }).catch((e) => console.warn('Failed to create BI event for return rejection', e));
};

export const completeReturnRefund = async (params: {
  vendorId: string;
  returnRequest: any;
  user: { uid: string; email: string | null };
  appUser: any;
}) => {
  const { vendorId, returnRequest, user, appUser } = params;
  const requestId = returnRequest.id;
  let completeStep = 'init';

  console.log('[COMPLETE REFUND START]', { requestId, vendorId });

  try {
    // 1. Re-read the request to prevent duplicate completion
    completeStep = 'load_latest_request';
    const reqRef = doc(db, 'pos_return_requests', requestId);
    const reqSnap = await getDoc(reqRef);

    if (!reqSnap.exists()) {
      throw new Error('Return request not found in database.');
    }

    const latestRequest = reqSnap.data() as any;

    if (latestRequest.status === 'completed') {
      console.warn('[COMPLETE REFUND] ALREADY_COMPLETED', requestId);
      return {
        alreadyCompleted: true,
        refundSaleId: latestRequest.refundSaleId,
        refundReceiptNumber: latestRequest.refundReceiptNumber,
      };
    }

    if (latestRequest.status !== 'approved') {
      throw new Error(
        `Cannot complete refund. Request status is '${latestRequest.status}', expected 'approved'.`,
      );
    }

    // 2. Prepare context
    completeStep = 'prepare_context';
    const now = serverTimestamp();
    const batch = writeBatch(db);
    const refundSaleId = `SALE-REF-${Date.now()}`;
    const refundReceiptNumber = `RFN-${Date.now().toString().slice(-6)}`;
    const originalSaleId = safeString(latestRequest.originalSaleId);

    // --- POS draft compatibility guards ---
    // DRAFT_pos_hardened_firestore.rules requires `pos_sales` creation to satisfy:
    // - vendorId
    // - shiftId
    // - terminalId
    // - referenced shift is OPEN
    // - terminal belongs to the same vendor

    // Shift pre-check
    const shiftId = safeString(latestRequest.shiftId, 'UNKNOWN');
    if (!shiftId || shiftId === 'UNKNOWN') {
      throw new Error(
        'Refund completion requires an open POS shift. Open a shift or complete this refund through a manager-controlled backend flow.',
      );
    }

    const shiftSnap = await getDoc(doc(db, 'pos_shifts', shiftId));
    if (!shiftSnap.exists()) {
      throw new Error(
        'Refund completion requires an open POS shift. Open a shift or complete this refund through a manager-controlled backend flow.',
      );
    }
    const shiftData = shiftSnap.data() as any;
    const shiftVendorId = safeString(shiftData.vendorId);
    const shiftStatus = safeString(shiftData.status);
    if (shiftVendorId !== safeString(vendorId) || shiftStatus !== 'open') {
      throw new Error(
        'Refund completion requires an open POS shift. Open a shift or complete this refund through a manager-controlled backend flow.',
      );
    }

    // Terminal pre-check
    const terminalId = safeString(latestRequest.terminalId, 'UNKNOWN');
    if (!terminalId || terminalId === 'UNKNOWN') {
      throw new Error(
        'Refund completion requires a valid POS terminal linked to this vendor.',
      );
    }

    const terminalSnap = await getDoc(doc(db, 'pos_terminals', terminalId));
    if (!terminalSnap.exists()) {
      throw new Error(
        'Refund completion requires a valid POS terminal linked to this vendor.',
      );
    }
    const terminalData = terminalSnap.data() as any;
    const terminalVendorId = safeString(terminalData.vendorId);
    if (terminalVendorId !== safeString(vendorId)) {
      throw new Error(
        'Refund completion requires a valid POS terminal linked to this vendor.',
      );
    }


    console.log('[COMPLETE REFUND STEP]', {
      completeStep,
      requestId,
      originalSaleId,
      refundSaleId,
    });

    // 3. Update Return Request
    completeStep = 'update_return_request';
    batch.update(
      reqRef,
      stripUndefined({
        status: 'completed',
        completedAt: now,
        completedByUid: safeString(user.uid),
        completedByEmail: safeString(user.email, 'system'),
        refundSaleId: refundSaleId,
        refundReceiptNumber: refundReceiptNumber,
        updatedAt: now,
      }),
    );

    // 4. Create Refund Sale Record (Negative totals)
    completeStep = 'create_refund_sale';
    const refundPayload = stripUndefined({
      saleId: refundSaleId,
      originalSaleId: originalSaleId,
      receiptNumber: refundReceiptNumber,
      vendorId: safeString(vendorId),
      terminalId: safeString(latestRequest.terminalId, 'UNKNOWN'),
      shiftId: safeString(latestRequest.shiftId, 'UNKNOWN'),
      status: 'completed',
      saleType: 'refund',
      paymentMethod: safeString(latestRequest.refundMethod, 'cash'),
      subtotal: -safeNumber(latestRequest.totalRefund),
      grandTotal: -safeNumber(latestRequest.totalRefund),
      operatorEmail: safeString(user.email, 'system'),
      operatorUid: safeString(user.uid),
      createdAt: now,
      completedAt: now,
      updatedAt: now,
    });
    batch.set(doc(db, 'pos_sales', refundSaleId), refundPayload);

    // 5. Create Items & Stock Reversal
    completeStep = 'process_items_and_stock';
    const items = latestRequest.items || [];
    for (const item of items) {
      const refundItemId = `REF-ITEM-${Date.now()}-${item.productId}-${Math.random().toString(36).substring(2, 5)}`;
      const returnQty = safeNumber(item.returnQty);
      const lineTotal = safeNumber(item.lineTotal);
      const productId = safeString(item.productId);

      // Sale Item (Negative)
      batch.set(
        doc(db, 'pos_sale_items', refundItemId),
        stripUndefined({
          itemId: refundItemId,
          saleId: refundSaleId,
          vendorId: safeString(vendorId),
          productId,
          productName: safeString(item.productName),
          quantity: -returnQty,
          unitPrice: safeNumber(item.unitPrice),
          lineTotal: -lineTotal,
          costPrice: safeNumber(item.costPrice),
          createdAt: now,
        }),
      );

      // Stock Reversal
      if (productId !== 'unknown') {
        const prodRef = doc(db, 'products', productId);
        batch.update(prodRef, {
          stockQty: increment(returnQty),
          stockStatus: 'in_stock',
          updatedAt: now,
        });

        // Ledger
        const ledgerId = `LEDG-REF-${Date.now()}-${productId}`;
        batch.set(
          doc(db, 'inventory_ledger', ledgerId),
          stripUndefined({
            ledgerId,
            vendorId: safeString(vendorId),
            productId,
            movementType: 'sales_return',
            quantityChange: returnQty,
            referenceId: refundSaleId,
            originalSaleId: originalSaleId,
            notes: `Sales Return: ${requestId}`,
            createdAt: now,
          }),
        );
      }
    }

    // 6. Update Original Sale
    completeStep = 'update_original_sale';
    // TODO hardening: this original sale update will be blocked by strict draft rules and must move to callable/backend or append-only return summary.
    batch.update(doc(db, 'pos_sales', originalSaleId), {
      hasReturn: true,
      returnedAmount: increment(safeNumber(latestRequest.totalRefund)),
      updatedAt: now,
    });


    // 7. Accounting
    completeStep = 'prepare_accounting';
    try {
      const getAccId = (code: string) => `${vendorId}-${code}`;
      const totalRefund = safeNumber(latestRequest.totalRefund);
      const totalCostReversal = safeNumber(latestRequest.totalCostReversal);

      const lines: any[] = [
        {
          accountId: getAccId('4000'),
          accountCode: '4000',
          accountName: 'Sales Revenue',
          debit: totalRefund,
          credit: 0,
          description: `Sales Return Reversal: ${originalSaleId}`,
        },
      ];

      const refundMethod = latestRequest.refundMethod;
      if (refundMethod === 'cash') {
        lines.push({
          accountId: getAccId('1000'),
          accountCode: '1000',
          accountName: 'Cash on Hand',
          debit: 0,
          credit: totalRefund,
          description: `Cash Refund: ${refundSaleId}`,
        });
      } else if (refundMethod === 'credit_note') {
        lines.push({
          accountId: getAccId('2300'),
          accountCode: '2300',
          accountName: 'Refund Liability',
          debit: 0,
          credit: totalRefund,
          description: `Credit Note Issued: ${refundSaleId}`,
        });
      } else {
        // Default fallback
        lines.push({
          accountId: getAccId('1000'),
          accountCode: '1000',
          accountName: 'Refund Clearing',
          debit: 0,
          credit: totalRefund,
          description: `Refund (${refundMethod}): ${refundSaleId}`,
        });
      }

      if (totalCostReversal > 0) {
        lines.push({
          accountId: getAccId('1200'),
          accountCode: '1200',
          accountName: 'Inventory',
          debit: totalCostReversal,
          credit: 0,
          description: `Inventory Reversal: ${requestId}`,
        });
        lines.push({
          accountId: getAccId('5000'),
          accountCode: '5000',
          accountName: 'Cost of Goods Sold',
          debit: 0,
          credit: totalCostReversal,
          description: `COGS Reversal: ${requestId}`,
        });
      }

      await createAccountingJournalDraft({
        vendorId: safeString(vendorId),
        sourceType: 'pos_refund',
        sourceId: refundSaleId,
        journalDate: now,
        lines,
        userId: user.uid,
        userEmail: user.email!,
        userRole: appUser?.role || 'vendor_owner',
      });
    } catch (accErr) {
      console.warn('[REFUND ACCOUNTING ERROR - SKIPPED]', accErr);
    }

    // 8. Commit
    completeStep = 'batch_commit';
    console.log('[COMPLETE REFUND STEP]', { completeStep, requestId });
    await batch.commit();
    console.log('[COMPLETE REFUND SUCCESS]', { requestId, refundSaleId });

    // 9. Events (Non-blocking)
    completeStep = 'prepare_pos_event';
    createPOSEvent({
      vendorId: safeString(vendorId),
      terminalId: safeString(latestRequest.terminalId, 'UNKNOWN'),
      shiftId: safeString(latestRequest.shiftId, 'UNKNOWN'),
      eventType: 'REFUND_COMPLETED' as any,
      actorUid: user.uid,
      actorEmail: user.email!,
      metadata: stripUndefined({
        returnId: requestId,
        saleId: originalSaleId,
        refundSaleId,
        totalRefund: safeNumber(latestRequest.totalRefund),
      }),
    }).catch((e) => console.warn('Failed to create POS event for refund completion', e));

    completeStep = 'prepare_bi_event';
    createBIEvent({
      vendorId: safeString(vendorId),
      userId: user.uid,
      userEmail: user.email!,
      userRole: appUser?.role || 'vendor_owner',
      eventType: BIEventType.SALES_RETURN_COMPLETED,
      severity: 'info',
      message: `Refund completed for sale ${originalSaleId}. Amount: $${safeNumber(latestRequest.totalRefund).toFixed(2)}.`,
      metadata: stripUndefined({
        returnId: requestId,
        refundSaleId,
        originalSaleId,
      }),
    }).catch((e) => console.warn('Failed to create BI event for refund completion', e));

    return {
      success: true,
      refundSaleId,
      refundReceiptNumber,
    };
  } catch (err: any) {
    console.error('[COMPLETE REFUND FAILED]', {
      completeStep,
      requestId,
      vendorId,
      code: err.code,
      message: err.message,
    });
    throw new Error(`Refund completion failed at ${completeStep}: ${err.message}`);
  }
};
