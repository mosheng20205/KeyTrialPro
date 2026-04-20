import { mockApprovals, mockAuditLogs, mockLicenses, mockPlatformOverview, mockPolicy, mockProductOverview, mockProducts, mockRiskEvents, mockRiskRules, mockSecurityProfile } from "./mockData";
import type { ApprovalTicket, AuditLogRecord, LicenseRecord, PlatformOverview, ProductOverview, ProductPolicy, ProductRecord, RiskEvent, RiskRule, SecurityProfile, TrendPoint } from "./types";

const TOKEN_KEY = "ktp_token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function getJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(url, { headers: authHeaders() });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = "/admin/login";
        return fallback;
      }
      return fallback;
    }

    const payload = await response.json();
    return (payload.data ?? fallback) as T;
  } catch {
    return fallback;
  }
}

async function postJson<T>(url: string, body: unknown, fallback: T): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "/admin/login";
      return fallback;
    }
    return fallback;
  }
  const payload = await response.json();
  return (payload.data ?? fallback) as T;
}

export const api = {
  login(email: string, password: string): Promise<{ requiresMfa: boolean; challengeToken?: string; token?: string; admin?: unknown }> {
    return fetch("/api/admin/auth/login.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then((r) => r.json()).then((p) => p.data ?? p);
  },

  verifyMfa(challengeToken: string, mfaCode: string): Promise<{ token: string; admin: unknown }> {
    return fetch("/api/admin/auth/mfa_verify.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeToken, mfaCode }),
    }).then((r) => r.json()).then((p) => p.data ?? p);
  },

  platformOverview(): Promise<PlatformOverview> {
    return getJson("/api/admin/dashboard/platform_overview.php", mockPlatformOverview);
  },
  productOverview(productCode: string): Promise<ProductOverview> {
    return getJson(`/api/admin/dashboard/product_overview.php?productId=${productCode}`, {
      ...mockProductOverview,
      productCode,
    });
  },
  products(): Promise<ProductRecord[]> {
    return getJson("/api/admin/products/list.php", mockProducts);
  },
  policy(productCode: string): Promise<ProductPolicy> {
    return getJson(`/api/admin/policies/get.php?productId=${productCode}`, {
      ...mockPolicy,
      productCode,
      productName: mockProducts.find((product) => product.product_code === productCode)?.name ?? mockPolicy.productName,
    });
  },
  savePolicy(productCode: string, payload: Record<string, unknown>): Promise<{ status: string }> {
    return postJson("/api/admin/policies/save.php", { productId: productCode, ...payload }, { status: "saved" });
  },
  securityProfile(productCode: string): Promise<SecurityProfile> {
    return getJson(`/api/admin/security-profiles/get.php?productId=${productCode}`, {
      ...mockSecurityProfile,
      productCode,
    });
  },
  saveSecurityProfile(productCode: string, payload: Record<string, unknown>): Promise<{ status: string }> {
    return postJson("/api/admin/security-profiles/save.php", { productId: productCode, ...payload }, { status: "saved" });
  },
  riskEvents(productCode?: string): Promise<RiskEvent[]> {
    const suffix = productCode ? `?productId=${productCode}` : "";
    return getJson(`/api/admin/risk/events.php${suffix}`, mockRiskEvents);
  },
  riskRules(productCode: string): Promise<RiskRule[]> {
    return getJson(`/api/admin/risk/rules/list.php?productId=${productCode}`, mockRiskRules);
  },
  saveRiskRule(productCode: string, payload: RiskRule): Promise<{ status: string }> {
    return postJson("/api/admin/risk/rules/save.php", { productId: productCode, ...payload }, { status: "saved" });
  },
  approvals(productCode?: string): Promise<ApprovalTicket[]> {
    const suffix = productCode ? `?productId=${productCode}` : "";
    return getJson(`/api/admin/approvals/list.php${suffix}`, mockApprovals);
  },
  licenses(productCode?: string): Promise<LicenseRecord[]> {
    const suffix = productCode ? `?productId=${productCode}` : "";
    return getJson(`/api/admin/licenses/list.php${suffix}`, mockLicenses);
  },
  auditLogs(productCode?: string): Promise<AuditLogRecord[]> {
    const suffix = productCode ? `?productId=${productCode}` : "";
    return getJson(`/api/admin/audit/list.php${suffix}`, mockAuditLogs);
  },
  decideApproval(ticketId: number, decision: "approved" | "rejected"): Promise<{ status: string }> {
    return postJson("/api/admin/approvals/decision.php", { ticketId, decision, adminId: 1 }, { status: decision });
  },
  trends(productCode?: string): Promise<TrendPoint[]> {
    const suffix = productCode ? `?productId=${productCode}` : "";
    return getJson(`/api/admin/dashboard/trends.php${suffix}`, mockPlatformOverview.trend);
  },
  createProduct(data: Record<string, unknown>): Promise<{ product: unknown }> {
    return postJson("/api/admin/products/create.php", data, { product: {} });
  },
  createLicense(data: Record<string, unknown>): Promise<{ license: unknown }> {
    return postJson("/api/admin/licenses/create.php", data, { license: {} });
  },
};