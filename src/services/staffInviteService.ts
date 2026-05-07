import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './db';

type CreateStaffInviteInput = {
  vendorId: string;
  vendorName: string;
  staffName: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  role: string;
  permissions: string[];
  invitedBy: string;
  invitedByEmail: string;
};

function cleanPhone(value: string): string {
  return String(value || '').replace(/[^\d+]/g, '').trim();
}

function normalizeWhatsAppPhone(value: string): string {
  const cleaned = cleanPhone(value);

  if (cleaned.startsWith('+')) {
    return cleaned.replace('+', '');
  }

  if (cleaned.startsWith('0')) {
    return `263${cleaned.slice(1)}`;
  }

  return cleaned;
}

function generateInviteCode(): string {
  const partA = Math.random().toString(36).slice(2, 8).toUpperCase();
  const partB = Date.now().toString(36).slice(-5).toUpperCase();
  return `STAFF-${partA}-${partB}`;
}

function getAppBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

export function buildStaffInviteWhatsAppLink(params: {
  whatsapp: string;
  staffName: string;
  vendorName: string;
  role: string;
  inviteUrl: string;
  inviteCode: string;
}): string {
  const phone = normalizeWhatsAppPhone(params.whatsapp);

  const message = [
    `Hello ${params.staffName},`,
    ``,
    `You have been invited to join ${params.vendorName} on iTred by seiGEN Commerce.`,
    ``,
    `Role: ${params.role}`,
    `Invite Code: ${params.inviteCode}`,
    ``,
    `Open this link to accept your staff invite:`,
    params.inviteUrl,
    ``,
    `If you did not expect this invitation, please ignore this message.`,
  ].join('\n');

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildStaffInviteSmsLink(params: {
  phone: string;
  staffName: string;
  vendorName: string;
  inviteUrl: string;
  inviteCode: string;
}): string {
  const phone = cleanPhone(params.phone);

  const message = `${params.staffName}, you have been invited to join ${params.vendorName} on iTred. Invite Code: ${params.inviteCode}. Open: ${params.inviteUrl}`;

  return `sms:${phone}?body=${encodeURIComponent(message)}`;
}

export function buildStaffInviteEmailLink(params: {
  email: string;
  staffName: string;
  vendorName: string;
  role: string;
  inviteUrl: string;
  inviteCode: string;
}): string {
  const subject = `Staff invite: ${params.vendorName}`;
  const body = [
    `Hello ${params.staffName},`,
    ``,
    `You have been invited to join ${params.vendorName} on iTred by seiGEN Commerce.`,
    ``,
    `Role: ${params.role}`,
    `Invite Code: ${params.inviteCode}`,
    ``,
    `Accept your invite here:`,
    params.inviteUrl,
    ``,
    `Regards,`,
    `seiGEN Commerce`,
  ].join('\n');

  return `mailto:${params.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function createStaffInvite(input: CreateStaffInviteInput) {
  if (!db) {
    throw new Error('Firestore is not initialized.');
  }

  if (!input.vendorId) {
    throw new Error('Missing vendorId.');
  }

  if (!input.staffName.trim()) {
    throw new Error('Staff name is required.');
  }

  if (!input.phone.trim() && !input.whatsapp?.trim() && !input.email?.trim()) {
    throw new Error('Provide at least WhatsApp, phone, or email.');
  }

  const inviteCode = generateInviteCode();
  const baseUrl = getAppBaseUrl();
  const inviteUrl = `${baseUrl}/staff-invite/${inviteCode}`;

  const expiresAt = Timestamp.fromDate(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  );

  const payload = {
    vendorId: input.vendorId,
    vendorName: input.vendorName || 'Vendor Store',
    staffName: input.staffName.trim(),
    phone: cleanPhone(input.phone),
    whatsapp: cleanPhone(input.whatsapp || input.phone),
    email: input.email?.trim() || '',
    role: input.role,
    permissions: input.permissions || [],
    status: 'pending',
    inviteCode,
    inviteUrl,
    invitedBy: input.invitedBy,
    invitedByEmail: input.invitedByEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt,
  };

  const ref = await addDoc(collection(db, 'staff_invites'), payload);

  const invite = {
    inviteId: ref.id,
    ...payload,
  };

  return {
    inviteId: ref.id,
    invite,
    whatsappLink: buildStaffInviteWhatsAppLink({
      whatsapp: payload.whatsapp,
      staffName: payload.staffName,
      vendorName: payload.vendorName,
      role: payload.role,
      inviteUrl: payload.inviteUrl,
      inviteCode: payload.inviteCode,
    }),
    smsLink: buildStaffInviteSmsLink({
      phone: payload.phone || payload.whatsapp,
      staffName: payload.staffName,
      vendorName: payload.vendorName,
      inviteUrl: payload.inviteUrl,
      inviteCode: payload.inviteCode,
    }),
    emailLink: payload.email
      ? buildStaffInviteEmailLink({
          email: payload.email,
          staffName: payload.staffName,
          vendorName: payload.vendorName,
          role: payload.role,
          inviteUrl: payload.inviteUrl,
          inviteCode: payload.inviteCode,
        })
      : '',
  };
}

export async function getStaffInviteByCode(inviteCode: string) {
  if (!db) {
    throw new Error('Firestore is not initialized.');
  }

  const inviteRef = doc(db, 'staff_invites', inviteCode);
  const snap = await getDoc(inviteRef);

  if (!snap.exists()) {
    return null;
  }

  return {
    id: snap.id,
    ...snap.data(),
  };
}