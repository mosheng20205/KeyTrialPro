import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppShell, type NavKey } from "./components/AppShell";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { api } from "./api";
import { PlatformOverviewPage } from "./pages/PlatformOverviewPage";
import { ProductOverviewPage } from "./pages/ProductOverviewPage";
import { RiskCenterPage } from "./pages/RiskCenterPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { LicensesPage } from "./pages/LicensesPage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { AuditPage } from "./pages/AuditPage";
import { LicenseInventoryPage } from "./pages/LicenseInventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { AddProductPage } from "./pages/AddProductPage";
import { AddLicensePage } from "./pages/AddLicensePage";
import type { ApprovalTicket, AuditLogRecord, LicenseRecord, PlatformOverview, ProductOverview, ProductRecord, RiskEvent } from "./types";
import { mockApprovals, mockAuditLogs, mockLicenses, mockPlatformOverview, mockProductOverview, mockProducts, mockRiskEvents } from "./mockData";

function AdminApp() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [nav, setNav] = useState<NavKey>("platform");
  const [products, setProducts] = useState<ProductRecord[]>(mockProducts);
  const [activeProduct, setActiveProduct] = useState<string>(mockProducts[0]?.product_code ?? "");
  const [platformOverview, setPlatformOverview] = useState<PlatformOverview>(mockPlatformOverview);
  const [productOverview, setProductOverview] = useState<ProductOverview>(mockProductOverview);
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>(mockRiskEvents);
  const [approvals, setApprovals] = useState<ApprovalTicket[]>(mockApprovals);
  const [licenses, setLicenses] = useState<LicenseRecord[]>(mockLicenses);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(mockAuditLogs);

  useEffect(() => {
    api.products().then((data) => {
      setProducts(data);
      if (data.length > 0 && !data.find((product) => product.product_code === activeProduct)) {
        setActiveProduct(data[0].product_code);
      }
    });
    api.platformOverview().then(setPlatformOverview);
  }, [activeProduct]);

  useEffect(() => {
    if (!activeProduct) {
      return;
    }

    api.productOverview(activeProduct).then(setProductOverview);
    api.riskEvents(activeProduct).then(setRiskEvents);
    api.approvals(activeProduct).then(setApprovals);
    api.licenses(activeProduct).then(setLicenses);
    api.auditLogs(activeProduct).then(setAuditLogs);
  }, [activeProduct]);

  const refreshApprovals = () => {
    if (!activeProduct) {
      return;
    }
    api.approvals(activeProduct).then(setApprovals);
  };

  const activeProductRecord = products.find((product) => product.product_code === activeProduct);

  return (
    <AppShell
      current={nav}
      onNavigate={setNav}
      products={products}
      activeProduct={activeProduct}
      onProductChange={setActiveProduct}
    >
      {nav === "platform" && <PlatformOverviewPage overview={platformOverview} />}
      {nav === "product" && <ProductOverviewPage product={activeProductRecord} overview={productOverview} />}
      {nav === "risk" && <RiskCenterPage events={riskEvents} />}
      {nav === "approvals" && <ApprovalsPage tickets={approvals} onDecision={refreshApprovals} />}
      {nav === "licenses" && (
        <div className="page-grid">
          <LicensesPage products={products} />
          <LicenseInventoryPage licenses={licenses} />
        </div>
      )}
      {nav === "policies" && <PoliciesPage productCode={activeProduct} />}
      {nav === "audit" && <AuditPage logs={auditLogs} />}
    </AppShell>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route
            path="/admin/"
            element={
              <ProtectedRoute>
                <AdminApp />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/add-product"
            element={
              <ProtectedRoute>
                <AddProductPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/add-license"
            element={
              <ProtectedRoute>
                <AddLicensePage />
              </ProtectedRoute>
            }
          />
          <Route path="/admin/" element={<Navigate to="/admin/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}