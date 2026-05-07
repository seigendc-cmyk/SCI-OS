import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PublicLayout, VendorLayout, ConsoleLayout } from './layouts/Layouts';
import {
  ProtectedRoute,
  VendorRoute,
  ConsoleRoute,
  POSProtectedRoute,
} from './components/guards/RouteGuards';
import {
  WelcomePage,
  ITredListingPage,
  VendorsPage,
  VendorDetailPage,
  ProductDetailPage,
  CataloguesPage,
  CatalogueDetailPage,
  LoginPage,
  RegisterPage,
  CompleteProfilePage,
  ConsoleLoginPage,
  POSPlanGate,
  VendorDashboard,
  VendorProfile,
  VendorProducts,
  VendorBranches,
  VendorCatalogues,
  VendorOrders,
  VendorSubscription,
  VendorDelivery,
  VendorStaff,
  VendorNotices,
  ConsoleMonitor,
  ConsoleVendors,
  ConsoleHealth,
  ConsoleActivationRequests,
  ConsoleProducts,
  ConsolePlans,
  ConsoleSubscriptions,
  ConsoleAuditLogs,
  ConsoleStaffPage,
  ConsoleInviteAcceptPage,
  ConsoleFinancePage,
  ConsoleRPNPage,
  ConsoleRPNDetailPage,
  ConsoleRPNVerificationPage,
  DeliveryFulfilmentPage,
  BusinessTermsPage,
  PrivacyPage,
  SupportPage,
  RPNPage,
} from './pages/Pages';

import StaffInviteAcceptPage from './pages/StaffInviteAcceptPage';

import { VendorPOSDashboard } from './pages/vendor/pos/VendorPOSDashboard';
import { VendorPOSShifts } from './pages/vendor/pos/VendorPOSShifts';
import { VendorPOSTerminalScreen } from './pages/vendor/pos/VendorPOSTerminalScreen';
import { VendorPOSSettings } from './pages/vendor/pos/VendorPOSSettings';
import { VendorPOSBI } from './pages/vendor/pos/VendorPOSBI';
import { VendorPOSAccounting } from './pages/vendor/pos/VendorPOSAccounting';
import { VendorPOSReturns } from './pages/vendor/pos/VendorPOSReturns';
import { VendorPOSReports } from './pages/vendor/pos/VendorPOSReports';
import { VendorPOSCustomers } from './pages/vendor/pos/VendorPOSCustomers';
import { VendorPOSCustomerAccounts } from './pages/vendor/pos/VendorPOSCustomerAccounts';
import { VendorPOSLayby } from './pages/vendor/pos/VendorPOSLayby';
import { VendorPOSApprovals } from './pages/vendor/pos/VendorPOSApprovals';
import { VendorPOSSalesHistory } from './pages/vendor/pos/VendorPOSSalesHistory';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/itred" element={<ITredListingPage />} />
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="/vendors/:vendorId" element={<VendorDetailPage />} />
            <Route path="/products/:productId" element={<ProductDetailPage />} />
            <Route path="/catalogues" element={<CataloguesPage />} />
            <Route path="/catalogues/:catalogueId" element={<CatalogueDetailPage />} />

            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/complete-profile" element={<CompleteProfilePage />} />

            {/* Staff Invite Acceptance Route */}
            <Route path="/staff-invite/:inviteCode" element={<StaffInviteAcceptPage />} />

            {/* Internal Console Login */}
            <Route path="/console-login" element={<ConsoleLoginPage />} />

            {/* Console Invite Acceptance Route */}
            <Route path="/console/accept-invite/:inviteId" element={<ConsoleInviteAcceptPage />} />

            {/* Footer Links */}
            <Route path="/business-terms" element={<BusinessTermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/rpn" element={<RPNPage />} />
          </Route>

          {/* Vendor Routes */}
          <Route
            path="/vendor"
            element={
              <ProtectedRoute>
                <VendorRoute>
                  <VendorLayout />
                </VendorRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<VendorDashboard />} />
            <Route path="profile" element={<VendorProfile />} />
            <Route path="products" element={<VendorProducts />} />
            <Route path="branches" element={<VendorBranches />} />
            <Route path="catalogues" element={<VendorCatalogues />} />
            <Route path="orders" element={<VendorOrders />} />
            <Route path="subscription" element={<VendorSubscription />} />
            <Route path="delivery" element={<VendorDelivery />} />
            <Route path="staff" element={<VendorStaff />} />
            <Route path="notices" element={<VendorNotices />} />
            <Route path="delivery-fulfilment" element={<DeliveryFulfilmentPage />} />

            {/* POS Activation Gate */}
            <Route path="pos/activate" element={<POSPlanGate />} />

            {/* POS Routes Gated By Subscription */}
            <Route
              path="pos"
              element={
                <POSProtectedRoute>
                  <VendorPOSDashboard />
                </POSProtectedRoute>
              }
            />
            <Route
              path="pos/terminal"
              element={
                <POSProtectedRoute>
                  <VendorPOSTerminalScreen />
                </POSProtectedRoute>
              }
            />
            <Route
              path="pos/shifts"
              element={
                <POSProtectedRoute>
                  <VendorPOSShifts />
                </POSProtectedRoute>
              }
            />
            <Route
              path="pos/settings"
              element={
                <POSProtectedRoute>
                  <VendorPOSSettings />
                </POSProtectedRoute>
              }
            />
            <Route
              path="pos/bi"
              element={
                <POSProtectedRoute>
                  <VendorPOSBI />
                </POSProtectedRoute>
              }
            />
            <Route
              path="pos/accounting"
              element={
                <POSProtectedRoute>
                  <VendorPOSAccounting />
                </POSProtectedRoute>
              }
            />
            <Route
              path="pos/reports"
              element={
                <POSProtectedRoute>
                  <VendorPOSReports />
                </POSProtectedRoute>
              }
            />
            <Route
              path="pos/customers"
              element={
                <POSProtectedRoute>
                  <VendorPOSCustomers />
                </POSProtectedRoute>
              }
            />
            <Route
              path="pos/customer-accounts"
              element={
                <POSProtectedRoute>
                  <VendorPOSCustomerAccounts />
                </POSProtectedRoute>
              }
            />
            <Route
              path="pos/layby"
              element={
                <POSProtectedRoute>
                  <VendorPOSLayby />
                </POSProtectedRoute>
              }
            />
            <Route
              path="pos/approvals"
              element={
                <POSProtectedRoute>
                  <VendorPOSApprovals />
                </POSProtectedRoute>
              }
            />
            <Route
              path="pos/returns"
              element={
                <POSProtectedRoute>
                  <VendorPOSReturns />
                </POSProtectedRoute>
              }
            />
            <Route
              path="pos/sales-history"
              element={
                <POSProtectedRoute>
                  <VendorPOSSalesHistory />
                </POSProtectedRoute>
              }
            />
          </Route>

          {/* Console Routes */}
          <Route
            path="/console"
            element={
              <ProtectedRoute>
                <ConsoleRoute>
                  <ConsoleLayout />
                </ConsoleRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<ConsoleMonitor />} />
            <Route path="overview" element={<ConsoleMonitor />} />
            <Route path="system-health" element={<ConsoleHealth />} />
            <Route path="audit-logs" element={<ConsoleAuditLogs />} />

            <Route path="merchants" element={<ConsoleVendors />} />
            <Route path="activation-requests" element={<ConsoleActivationRequests />} />
            <Route path="products" element={<ConsoleProducts />} />
            <Route path="plans" element={<ConsolePlans />} />
            <Route path="subscriptions" element={<ConsoleSubscriptions />} />
            <Route path="staff" element={<ConsoleStaffPage />} />
            <Route path="financial-analytics" element={<ConsoleFinancePage />} />

            <Route path="rpn" element={<ConsoleRPNPage />} />
            <Route path="rpn/:rpnId" element={<ConsoleRPNDetailPage />} />
            <Route path="rpn-verification" element={<ConsoleRPNVerificationPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
