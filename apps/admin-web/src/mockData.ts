import type { ApprovalTicket, AuditLogRecord, LicenseRecord, PlatformOverview, ProductOverview, ProductPolicy, ProductRecord, RiskEvent, RiskRule, SecurityProfile } from "./types";

const trend = [
  { date: "2026-04-05", daily_new_activated_count: 38, daily_active_count: 122, daily_trial_started_count: 20, daily_trial_expired_count: 5, daily_risk_event_count: 2, total_activated_count: 860 },
  { date: "2026-04-06", daily_new_activated_count: 44, daily_active_count: 141, daily_trial_started_count: 22, daily_trial_expired_count: 6, daily_risk_event_count: 4, total_activated_count: 904 },
  { date: "2026-04-07", daily_new_activated_count: 47, daily_active_count: 148, daily_trial_started_count: 24, daily_trial_expired_count: 7, daily_risk_event_count: 3, total_activated_count: 951 },
  { date: "2026-04-08", daily_new_activated_count: 51, daily_active_count: 155, daily_trial_started_count: 25, daily_trial_expired_count: 9, daily_risk_event_count: 4, total_activated_count: 1002 },
  { date: "2026-04-09", daily_new_activated_count: 63, daily_active_count: 164, daily_trial_started_count: 27, daily_trial_expired_count: 10, daily_risk_event_count: 5, total_activated_count: 1065 },
  { date: "2026-04-10", daily_new_activated_count: 58, daily_active_count: 173, daily_trial_started_count: 31, daily_trial_expired_count: 8, daily_risk_event_count: 3, total_activated_count: 1123 },
  { date: "2026-04-11", daily_new_activated_count: 72, daily_active_count: 181, daily_trial_started_count: 35, daily_trial_expired_count: 10, daily_risk_event_count: 6, total_activated_count: 1195 }
];

export const mockPlatformOverview: PlatformOverview = {
  totalActivatedCount: 1195,
  onlineCount: 181,
  trialActiveCount: 76,
  approvalBacklogCount: 9,
  topProducts: [
    { product_code: "desktop-pro", name: "Desktop Pro", total_activated_count: 640 },
    { product_code: "studio-max", name: "Studio Max", total_activated_count: 412 },
    { product_code: "lite-agent", name: "Lite Agent", total_activated_count: 143 },
  ],
  trend,
};

export const mockProducts: ProductRecord[] = [
  { id: 1, product_code: "desktop-pro", name: "Desktop Pro", status: "active", trial_duration_minutes: 60, heartbeat_interval_seconds: 180 },
  { id: 2, product_code: "studio-max", name: "Studio Max", status: "active", trial_duration_minutes: 1440, heartbeat_interval_seconds: 300 },
  { id: 3, product_code: "lite-agent", name: "Lite Agent", status: "active", trial_duration_minutes: 30, heartbeat_interval_seconds: 120 },
];

export const mockProductOverview: ProductOverview = {
  productId: 1,
  productCode: "desktop-pro",
  productName: "Desktop Pro",
  totalActivatedCount: 640,
  onlineCount: 101,
  trialStartedToday: 16,
  riskEventCount: 3,
  trend,
};

export const mockRiskEvents: RiskEvent[] = [
  { id: 301, product_id: 1, machine_id: "4f0b...a8d2", event_type: "machine_change", risk_level: "high", summary: "Baseboard and system disk changed within one hour.", created_at: "2026-04-18 13:20:10", product_name: "Desktop Pro" },
  { id: 302, product_id: 1, machine_id: "f91a...7bb1", event_type: "debugger_detected", risk_level: "critical", summary: "Debugger signature detected during verify.", created_at: "2026-04-18 12:52:04", product_name: "Desktop Pro" },
  { id: 303, product_id: 2, machine_id: "1c2d...772e", event_type: "trial_abuse", risk_level: "medium", summary: "Repeated short-interval IP jumps during trial.", created_at: "2026-04-18 11:09:55", product_name: "Studio Max" },
];

export const mockApprovals: ApprovalTicket[] = [
  { id: 501, product_id: 1, ticket_type: "rebind_request", machine_id: "4f0b...a8d2", status: "pending", requested_by: "support@client-a.com", created_at: "2026-04-18 13:30:00" },
  { id: 502, product_id: 2, ticket_type: "trial_restore", machine_id: "1c2d...772e", status: "under_review", requested_by: "ops@client-b.com", created_at: "2026-04-18 12:06:00" },
];

export const mockLicenses: LicenseRecord[] = [
  { id: 1, product_id: 1, license_key: "DESKTOP-PRO-001", status: "active", expires_at: "2026-05-18 10:00:00", max_bindings: 1, product_name: "Desktop Pro" },
  { id: 2, product_id: 2, license_key: "STUDIO-MAX-001", status: "active", expires_at: "2026-07-18 10:00:00", max_bindings: 2, product_name: "Studio Max" },
];

export const mockAuditLogs: AuditLogRecord[] = [
  { id: 801, product_id: 1, actor_type: "client", actor_id: "4f0b...a8d2", action_code: "license.activate", target_type: "license", target_id: "1", ip_address: "203.0.113.12", created_at: "2026-04-18 14:01:00" },
  { id: 802, product_id: 1, actor_type: "admin", actor_id: "admin@example.com", action_code: "policy.save", target_type: "product", target_id: "1", ip_address: "10.0.0.12", created_at: "2026-04-18 12:14:00" },
  { id: 803, product_id: 2, actor_type: "client", actor_id: "1c2d...772e", action_code: "trial.start", target_type: "trial_session", target_id: "trial-stub", ip_address: "198.51.100.22", created_at: "2026-04-18 11:48:00" },
];

export const mockPolicy: ProductPolicy = {
  productId: 1,
  productCode: "desktop-pro",
  productName: "Desktop Pro",
  productDefaults: {
    trialDurationMinutes: 60,
    heartbeatIntervalSeconds: 180,
    offlineGraceMinutes: 5,
  },
  trialPolicy: {
    trialDurationMinutes: 60,
    heartbeatIntervalSeconds: 180,
    offlineGraceMinutes: 5,
    maxRebindCount: 3,
    degradeMode: "read_only",
  },
  licensePolicies: [
    {
      policyCode: "default",
      licenseType: "standard",
      maxBindings: 1,
      rebindLimit: 3,
      requiresManualReviewAfterLimit: true,
    },
  ],
};

export const mockRiskRules: RiskRule[] = [
  { ruleCode: "hardware_change_score", thresholdValue: "50", actionCode: "manual_review", enabled: true },
  { ruleCode: "challenge_failure_limit", thresholdValue: "3", actionCode: "temporary_block", enabled: true },
];

export const mockSecurityProfile: SecurityProfile = {
  productId: 1,
  productCode: "desktop-pro",
  machineBindingMode: "strict",
  antiDebugEnabled: true,
  antiVmEnabled: true,
  hookDetectionEnabled: true,
  challengeFailTolerance: 3,
};
