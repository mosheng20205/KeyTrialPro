import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api } from "./api";
import { AppShell, type NavKey } from "./components/AppShell";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { mockApprovals, mockAuditLogs, mockLicenses, mockPlatformOverview, mockProductOverview, mockProducts, mockRiskEvents } from "./mockData";
import { AddLicensePage } from "./pages/AddLicensePage";
import { AddProductPage } from "./pages/AddProductPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { AuditPage } from "./pages/AuditPage";
import { LicenseInventoryPage } from "./pages/LicenseInventoryPage";
import { LicensesPage } from "./pages/LicensesPage";
import { LoginPage } from "./pages/LoginPage";
import { PlatformOverviewPage } from "./pages/PlatformOverviewPage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { ProductOverviewPage } from "./pages/ProductOverviewPage";
import { RiskCenterPage } from "./pages/RiskCenterPage";
import type { ApprovalTicket, AuditLogRecord, LicenseRecord, PlatformOverview, ProductOverview, ProductRecord, RiskEvent } from "./types";

const coreNavViews: NavKey[] = ["platform", "product", "risk", "approvals", "licenses", "policies", "audit"];

function getNavFromLocation(pathname: string, search: string): NavKey {
  if (pathname === "/admin/add-product") {
    return "add-product";
  }

  if (pathname === "/admin/add-license") {
    return "add-license";
  }

  const view = new URLSearchParams(search).get("view");
  if (view && coreNavViews.includes(view as NavKey)) {
    return view as NavKey;
  }

  return "platform";
}

function getPathForNav(nav: NavKey): string {
  if (nav === "add-product") {
    return "/admin/add-product";
  }

  if (nav === "add-license") {
    return "/admin/add-license";
  }

  return `/admin/?view=${nav}`;
}

function AdminApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductRecord[]>(mockProducts);
  const [activeProduct, setActiveProduct] = useState<string>(mockProducts[0]?.product_code ?? "");
  const [platformOverview, setPlatformOverview] = useState<PlatformOverview>(mockPlatformOverview);
  const [productOverview, setProductOverview] = useState<ProductOverview>(mockProductOverview);
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>(mockRiskEvents);
  const [approvals, setApprovals] = useState<ApprovalTicket[]>(mockApprovals);
  const [licenses, setLicenses] = useState<LicenseRecord[]>(mockLicenses);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(mockAuditLogs);
  const currentNav = getNavFromLocation(location.pathname, location.search);

  useEffect(() => {
    api.products().then((data) => {
      setProducts(data);
    });
    api.platformOverview().then(setPlatformOverview);
  }, []);

  useEffect(() => {
    if (products.length > 0 && !products.find((product) => product.product_code === activeProduct)) {
      setActiveProduct(products[0].product_code);
    }
  }, [activeProduct, products]);

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
      current={currentNav}
      onNavigate={(nextNav) => navigate(getPathForNav(nextNav))}
      products={products}
      activeProduct={activeProduct}
      activeProductRecord={activeProductRecord}
      onProductChange={setActiveProduct}
    >
      {currentNav === "platform" && <PlatformOverviewPage overview={platformOverview} />}
      {currentNav === "product" && <ProductOverviewPage product={activeProductRecord} overview={productOverview} />}
      {currentNav === "risk" && <RiskCenterPage events={riskEvents} />}
      {currentNav === "approvals" && <ApprovalsPage tickets={approvals} onDecision={refreshApprovals} />}
      {currentNav === "licenses" && (
        <div className="page-grid">
          <LicensesPage products={products} />
          <LicenseInventoryPage licenses={licenses} />
        </div>
      )}
      {currentNav === "policies" && <PoliciesPage productCode={activeProduct} />}
      {currentNav === "audit" && <AuditPage logs={auditLogs} />}
      {currentNav === "add-product" && <AddProductPage />}
      {currentNav === "add-license" && <AddLicensePage />}
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
                <AdminApp />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/add-license"
            element={
              <ProtectedRoute>
                <AdminApp />
              </ProtectedRoute>
            }
          />
          <Route path="/admin" element={<Navigate to="/admin/?view=platform" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
