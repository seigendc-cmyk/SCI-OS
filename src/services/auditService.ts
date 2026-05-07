import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface AuditLog {
  action: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  targetType: string;
  targetId: string;
  vendorId?: string;
  metadata?: any;
  createdAt?: any;
}

export async function logActivity(log: AuditLog) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      ...log,
      vendorId: log.vendorId || '',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('[AUDIT_FAILURE] Could not record activity but continuing operation', error);
  }
}
