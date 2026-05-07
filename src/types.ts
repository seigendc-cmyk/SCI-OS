export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  CONSOLE_ADMIN = 'console_admin',
  VENDOR_OWNER = 'vendor_owner',
  VENDOR_STAFF = 'vendor_staff',
  PUBLIC_USER = 'public_user',
  ACTIVATION_OFFICER = 'activation_officer',
  FINANCE_OFFER = 'finance_officer',
  SUPPORT_OFFICER = 'support_officer',
  RPN_MANAGER = 'rpn_manager',
  AUDITOR = 'auditor',
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  vendorId?: string;
  permissions?: string[];
  consolePermissions?: string[];
  profileStatus: 'complete' | 'incomplete' | 'active';
  createdAt: any;
  updatedAt: any;
}

export interface SubscriptionEntitlements {
  pos: boolean;
  maxBranches: number;
  maxTerminals: number;
  maxStaff: number;
  maxProducts: number;
  cataloguesPerMonth: number;
}

export interface Subscription {
  subscriptionId: string;
  vendorId: string;
  planCode: 'starter' | 'pos' | 'growth' | 'pro';
  status: 'trial' | 'active' | 'pending_activation' | 'expired';
  currentPrice: number;
  currency: string;
  entitlements: SubscriptionEntitlements;
  startsAt: any;
  expiresAt: any;
  createdAt: any;
  updatedAt: any;
}

export interface VendorBranch {
  branchId: string;
  vendorId: string;
  branchName: string;
  name: string; // for compatibility
  type: 'shop' | 'office' | 'warehouse';
  status: 'active' | 'inactive';
  isMain: boolean;
  isMainBranch?: boolean; // for compatibility
  city: string;
  address?: string;
  suburb?: string;
  district?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Vendor {
  id: string;
  ownerUid: string;
  name: string;
  businessName: string;
  slug: string;
  status: 'draft' | 'published' | 'suspended';
  visibility: 'public' | 'private';
  verified: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface AuditLogEntry {
  actorUid: string;
  actorRole: string;
  vendorId?: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: any;
  createdAt: any;
}

export interface RPNAgent {
  rpnId: string;
  rpnCode?: string;
  fullName: string;
  email: string;
  phone: string;
  whatsapp: string;
  city: string;
  district: string;
  suburb: string;
  role: 'junior_rpn' | 'leader_rpn' | 'imm';
  status: 'active' | 'suspended';
  leaderRpnId?: string;
  serviceArea: string;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}
