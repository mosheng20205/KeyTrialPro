export type TrendPoint = {
  date: string;
  total_activated_count?: number;
  daily_new_activated_count: number;
  daily_active_count: number;
  daily_trial_started_count: number;
  daily_trial_expired_count: number;
  daily_risk_event_count: number;
};

export type PlatformOverview = {
  totalActivatedCount: number;
  onlineCount: number;
  trialActiveCount: number;
  approvalBacklogCount: number;
  topProducts: Array<{
    product_code: string;
    name: string;
    total_activated_count: number;
  }>;
  trend: TrendPoint[];
};

export type ProductOverview = {
  productId: number;
  productCode: string;
  productName: string;
  totalActivatedCount: number;
  onlineCount: number;
  trialStartedToday: number;
  riskEventCount: number;
  trend: TrendPoint[];
};

export type ProductRecord = {
  id: number;
  product_code: string;
  name: string;
  status: string;
  trial_duration_minutes: number;
  heartbeat_interval_seconds: number;
};

export type ProductPolicy = {
  productId: number;
  productCode: string;
  productName: string;
  productDefaults: {
    trialDurationMinutes: number;
    heartbeatIntervalSeconds: number;
    offlineGraceMinutes: number;
  };
  trialPolicy: {
    trialDurationMinutes: number;
    heartbeatIntervalSeconds: number;
    offlineGraceMinutes: number;
    maxRebindCount: number;
    degradeMode: string;
  };
  licensePolicies: Array<{
    policyCode: string;
    licenseType: string;
    maxBindings: number;
    rebindLimit: number;
    requiresManualReviewAfterLimit: boolean;
  }>;
};

export type RiskRule = {
  id?: number;
  product_id?: number;
  productId?: number;
  rule_code?: string;
  ruleCode: string;
  threshold_value?: string;
  thresholdValue: string;
  action_code?: string;
  actionCode: string;
  enabled: boolean | number;
};

export type SecurityProfile = {
  productId: number;
  productCode: string;
  machineBindingMode: string;
  antiDebugEnabled: boolean;
  antiVmEnabled: boolean;
  hookDetectionEnabled: boolean;
  challengeFailTolerance: number;
};

export type RiskEvent = {
  id: number;
  product_id: number;
  machine_id: string;
  event_type: string;
  risk_level: string;
  summary: string;
  created_at: string;
  product_name: string;
};

export type ApprovalTicket = {
  id: number;
  product_id: number;
  ticket_type: string;
  machine_id: string;
  status: string;
  requested_by: string | null;
  created_at: string;
};

export type LicenseRecord = {
  id: number;
  product_id: number;
  license_key: string;
  status: string;
  expires_at: string | null;
  max_bindings: number;
  product_name: string;
};

export type AuditLogRecord = {
  id: number;
  product_id: number | null;
  actor_type: string;
  actor_id: string;
  action_code: string;
  target_type: string;
  target_id: string;
  ip_address: string | null;
  created_at: string;
};
