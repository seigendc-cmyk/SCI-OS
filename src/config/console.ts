export type ConsoleRole =
  | 'super_admin'
  | 'console_admin'
  | 'activation_officer'
  | 'finance_officer'
  | 'support_officer'
  | 'rpn_manager'
  | 'auditor';

export type PermissionKey =
  | 'dashboard.view'
  | 'activation_requests.view'
  | 'activation_requests.approve'
  | 'vendors.view'
  | 'vendors.manage'
  | 'products.view'
  | 'products.moderate'
  | 'plans.view'
  | 'plans.manage'
  | 'subscriptions.view'
  | 'subscriptions.manage'
  | 'finance.view'
  | 'finance.manage'
  | 'rpn.view'
  | 'rpn.manage'
  | 'audit_logs.view'
  | 'console_staff.view'
  | 'console_staff.manage'
  | 'health.view';

export interface RoleConfig {
  label: string;
  defaultPermissions: PermissionKey[];
}

export const CONSOLE_ROLES: Record<ConsoleRole, RoleConfig> = {
  super_admin: {
    label: 'Super Admin',
    defaultPermissions: [
      'dashboard.view',
      'activation_requests.view',
      'activation_requests.approve',
      'vendors.view',
      'vendors.manage',
      'products.view',
      'products.moderate',
      'plans.view',
      'plans.manage',
      'subscriptions.view',
      'subscriptions.manage',
      'finance.view',
      'finance.manage',
      'rpn.view',
      'rpn.manage',
      'audit_logs.view',
      'console_staff.view',
      'console_staff.manage',
      'health.view',
    ],
  },
  console_admin: {
    label: 'Console Admin',
    defaultPermissions: [
      'dashboard.view',
      'activation_requests.view',
      'activation_requests.approve',
      'vendors.view',
      'vendors.manage',
      'products.view',
      'products.moderate',
      'plans.view',
      'plans.manage',
      'subscriptions.view',
      'subscriptions.manage',
      'finance.view',
      'finance.manage',
      'rpn.view',
      'rpn.manage',
      'health.view',
    ],
  },
  activation_officer: {
    label: 'Activation Officer',
    defaultPermissions: [
      'dashboard.view',
      'activation_requests.view',
      'activation_requests.approve',
      'vendors.view',
    ],
  },
  finance_officer: {
    label: 'Finance Officer',
    defaultPermissions: ['dashboard.view', 'finance.view', 'finance.manage', 'subscriptions.view'],
  },
  support_officer: {
    label: 'Support Officer',
    defaultPermissions: [
      'dashboard.view',
      'vendors.view',
      'products.view',
      'products.moderate',
      'support_officer' as any,
    ],
  },
  rpn_manager: {
    label: 'RPN Manager',
    defaultPermissions: ['dashboard.view', 'rpn.view', 'rpn.manage'],
  },
  auditor: {
    label: 'Internal Auditor',
    defaultPermissions: ['dashboard.view', 'audit_logs.view', 'vendors.view', 'finance.view'],
  },
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'dashboard.view': 'View Console Dashboard',
  'activation_requests.view': 'View Activation Requests',
  'activation_requests.approve': 'Approve/Reject Activations',
  'vendors.view': 'View Vendor Directory',
  'vendors.manage': 'Manage Vendor Profiles',
  'products.view': 'View Marketplace Inventory',
  'products.moderate': 'Moderate/Flag Products',
  'plans.view': 'View Pricing Plans',
  'plans.manage': 'Create/Edit Plans',
  'subscriptions.view': 'View Subscriptions',
  'subscriptions.manage': 'Adjust Subscriptions',
  'finance.view': 'View Financial Reports',
  'finance.manage': 'Manage Payments/Refunds',
  'rpn.view': 'View RPN (Node) Stats',
  'rpn.manage': 'Manage RPN Topology',
  'audit_logs.view': 'View Security Audit Logs',
  'console_staff.view': 'View Staff Roster',
  'console_staff.manage': 'Invite/Manage Staff',
  'health.view': 'View System Health',
};
