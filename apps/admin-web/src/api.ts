import { mockApprovals, mockAuditLogs, mockLicenses, mockPlatformOverview, mockPolicy, mockProductOverview, mockProducts, mockRiskEvents, mockRiskRules, mockSecurityProfile } from "./mockData";
import type { AdminProfile, ApprovalTicket, AuditLogRecord, LicenseDetail, LicenseListResponse, LicenseLogResponse, LicenseRecord, PlatformOverview, ProductOverview, ProductPolicy, ProductRecord, RiskEvent, RiskRule, SecurityProfile, TrendPoint } from "./types";

const TOKEN_KEY = "ktp_token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

function handleUnauthorized(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("ktp_admin");
  window.location.href = "/admin/login";
}

async function getJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(url, { headers: authHeaders() });
    if (!response.ok) {
      if (response.status === 401) {
        handleUnauthorized();
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
      handleUnauthorized();
    }
    return fallback;
  }

  const payload = await response.json();
  return (payload.data ?? fallback) as T;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        success?: boolean;
        data?: T;
        error?: { message?: string };
      }
    | null;

  if (!response.ok || payload?.success === false) {
    if (response.status === 401) {
      handleUnauthorized();
    }

    throw new Error(payload?.error?.message ?? `Request failed with status ${response.status}`);
  }

  return payload?.data as T;
}

export const api = {
  login(email: string, password: string): Promise<{ requiresMfa: boolean; challengeToken?: string; token?: string; admin?: unknown }> {
    return fetch("/api/admin/auth/login.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
      .then((response) => response.json())
      .then((payload) => payload.data ?? payload);
  },

  verifyMfa(challengeToken: string, mfaCode: string): Promise<{ token: string; admin: unknown }> {
    return fetch("/api/admin/auth/mfa_verify.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeToken, mfaCode }),
    })
      .then((response) => response.json())
      .then((payload) => payload.data ?? payload);
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
  licenses(params: { productCode?: string; page?: number; pageSize?: number; status?: string; query?: string }): Promise<LicenseListResponse> {
    const search = new URLSearchParams();
    if (params.productCode) {
      search.set("productId", params.productCode);
    }
    if (params.page) {
      search.set("page", String(params.page));
    }
    if (params.pageSize) {
      search.set("pageSize", String(params.pageSize));
    }
    if (params.status && params.status !== "all") {
      search.set("status", params.status);
    }
    if (params.query) {
      search.set("query", params.query);
    }

    const suffix = search.toString() ? `?${search.toString()}` : "";
    return getJson(`/api/admin/licenses/list.php${suffix}`, {
      items: mockLicenses,
      pagination: {
        page: 1,
        pageSize: mockLicenses.length,
        total: mockLicenses.length,
        totalPages: 1,
      },
      filters: {
        status: params.status ?? "all",
        query: params.query ?? "",
      },
    });
  },
  licenseDetail(licenseId: number): Promise<LicenseDetail> {
    return requestJson(`/api/admin/licenses/detail.php?licenseId=${licenseId}`);
  },
  licenseLogs(licenseId: number, page = 1, pageSize = 20): Promise<LicenseLogResponse> {
    return requestJson(`/api/admin/licenses/logs.php?licenseId=${licenseId}&page=${page}&pageSize=${pageSize}`);
  },
  updateLicenseStatus(licenseId: number, status: string): Promise<LicenseDetail> {
    return requestJson("/api/admin/licenses/status.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseId, status }),
    });
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
  accountProfile(): Promise<AdminProfile> {
    return requestJson("/api/admin/account/profile.php");
  },
  updateAccountProfile(payload: { email: string; displayName: string; mfaEnabled: boolean }): Promise<AdminProfile> {
    return requestJson("/api/admin/account/update.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  changeAccountPassword(payload: { currentPassword: string; newPassword: string }): Promise<{ status: string }> {
    return requestJson("/api/admin/account/change_password.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
};
