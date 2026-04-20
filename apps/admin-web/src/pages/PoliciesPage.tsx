import { useEffect, useState } from "react";
import { api } from "../api";
import type { ProductPolicy, RiskRule, SecurityProfile } from "../types";

type PoliciesPageProps = {
  productCode: string;
};

const defaultLicensePolicy = {
  policyCode: "default",
  licenseType: "standard",
  maxBindings: 1,
  rebindLimit: 3,
  requiresManualReviewAfterLimit: true,
};

function normalizeRiskRule(rule: RiskRule): RiskRule {
  return {
    ...rule,
    ruleCode: rule.ruleCode ?? rule.rule_code ?? "",
    thresholdValue: rule.thresholdValue ?? rule.threshold_value ?? "",
    actionCode: rule.actionCode ?? rule.action_code ?? "",
    enabled: Boolean(rule.enabled),
  };
}

export function PoliciesPage({ productCode }: PoliciesPageProps) {
  const [policy, setPolicy] = useState<ProductPolicy | null>(null);
  const [securityProfile, setSecurityProfile] = useState<SecurityProfile | null>(null);
  const [riskRules, setRiskRules] = useState<RiskRule[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let disposed = false;

    setPolicy(null);
    setSecurityProfile(null);
    setRiskRules([]);
    setStatus("");

    Promise.all([
      api.policy(productCode),
      api.securityProfile(productCode),
      api.riskRules(productCode),
    ]).then(([nextPolicy, nextSecurityProfile, nextRiskRules]) => {
      if (disposed) {
        return;
      }

      setPolicy(nextPolicy);
      setSecurityProfile(nextSecurityProfile);
      setRiskRules(nextRiskRules.map(normalizeRiskRule));
    });

    return () => {
      disposed = true;
    };
  }, [productCode]);

  if (policy === null) {
    return <section className="panel">正在加载策略配置...</section>;
  }

  const currentPolicy = policy;
  const currentLicensePolicy = currentPolicy.licensePolicies[0] ?? defaultLicensePolicy;
  const isUsingFallbackLicensePolicy = currentPolicy.licensePolicies.length === 0;

  const updateTrialPolicy = <K extends keyof ProductPolicy["trialPolicy"]>(
    key: K,
    value: ProductPolicy["trialPolicy"][K],
  ) => {
    setPolicy({
      ...policy,
      trialPolicy: {
        ...policy.trialPolicy,
        [key]: value,
      },
    });
  };

  const updateLicensePolicy = <K extends keyof typeof defaultLicensePolicy>(
    key: K,
    value: (typeof defaultLicensePolicy)[K],
  ) => {
    setPolicy({
      ...policy,
      licensePolicies: [
        {
          ...currentLicensePolicy,
          [key]: value,
        },
      ],
    });
  };

  const updateRiskRule = (index: number, patch: Partial<RiskRule>) => {
    setRiskRules((currentRules) =>
      currentRules.map((rule, ruleIndex) => (ruleIndex === index ? normalizeRiskRule({ ...rule, ...patch }) : rule)),
    );
  };

  async function savePolicy() {
    await api.savePolicy(productCode, {
      trialDurationMinutes: currentPolicy.trialPolicy.trialDurationMinutes,
      heartbeatIntervalSeconds: currentPolicy.trialPolicy.heartbeatIntervalSeconds,
      offlineGraceMinutes: currentPolicy.trialPolicy.offlineGraceMinutes,
      maxRebindCount: currentPolicy.trialPolicy.maxRebindCount,
      degradeMode: currentPolicy.trialPolicy.degradeMode,
      policyCode: currentLicensePolicy.policyCode,
      licenseType: currentLicensePolicy.licenseType,
      maxBindings: currentLicensePolicy.maxBindings,
      rebindLimit: currentLicensePolicy.rebindLimit,
      requiresManualReviewAfterLimit: currentLicensePolicy.requiresManualReviewAfterLimit,
    });

    setStatus("策略已保存。");
  }

  async function saveSecurityProfile() {
    if (securityProfile === null) {
      return;
    }

    await api.saveSecurityProfile(productCode, securityProfile);
    setStatus("安全配置已保存。");
  }

  async function saveRiskRule(rule: RiskRule) {
    await api.saveRiskRule(productCode, rule);
    setStatus(`风险规则 ${rule.ruleCode || "未命名规则"} 已保存。`);
  }

  const addRiskRule = () => {
    setRiskRules((currentRules) => [
      ...currentRules,
      {
        ruleCode: "",
        thresholdValue: "",
        actionCode: "",
        enabled: true,
      },
    ]);
  };

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">产品策略</p>
            <h3>{currentPolicy.productName}</h3>
            <p className="section-note">当前正在编辑产品 `{currentPolicy.productCode}` 的试用与许可证策略。</p>
          </div>
          <div className="policy-actions">
            <button className="action-button" onClick={savePolicy} type="button">
              保存策略
            </button>
          </div>
        </div>

        {isUsingFallbackLicensePolicy ? (
          <div className="info-banner info-banner-warning">
            当前产品还没有独立的许可证策略记录，页面已回退到默认策略。点击“保存策略”后会自动写入数据库。
          </div>
        ) : null}

        <div className="policy-layout">
          <article className="policy-card">
            <p className="eyebrow">试用策略</p>
            <div className="form-grid">
              <label>
                试用时长（分钟）
                <input
                  type="number"
                  value={currentPolicy.trialPolicy.trialDurationMinutes}
                  onChange={(event) => updateTrialPolicy("trialDurationMinutes", Number(event.target.value))}
                />
              </label>
              <label>
                心跳间隔（秒）
                <input
                  type="number"
                  value={currentPolicy.trialPolicy.heartbeatIntervalSeconds}
                  onChange={(event) => updateTrialPolicy("heartbeatIntervalSeconds", Number(event.target.value))}
                />
              </label>
              <label>
                离线宽限（分钟）
                <input
                  type="number"
                  value={currentPolicy.trialPolicy.offlineGraceMinutes}
                  onChange={(event) => updateTrialPolicy("offlineGraceMinutes", Number(event.target.value))}
                />
              </label>
              <label>
                试用最大换绑次数
                <input
                  type="number"
                  value={currentPolicy.trialPolicy.maxRebindCount}
                  onChange={(event) => updateTrialPolicy("maxRebindCount", Number(event.target.value))}
                />
              </label>
              <label>
                降级模式
                <select
                  value={currentPolicy.trialPolicy.degradeMode}
                  onChange={(event) => updateTrialPolicy("degradeMode", event.target.value)}
                >
                  <option value="read_only">只读</option>
                  <option value="block">阻止使用</option>
                  <option value="activation_only">仅允许激活</option>
                </select>
              </label>
            </div>
          </article>

          <article className="policy-card">
            <p className="eyebrow">许可证策略</p>
            <div className="form-grid">
              <label>
                策略代码
                <input
                  value={currentLicensePolicy.policyCode}
                  onChange={(event) => updateLicensePolicy("policyCode", event.target.value)}
                />
              </label>
              <label>
                许可证类型
                <select
                  value={currentLicensePolicy.licenseType}
                  onChange={(event) => updateLicensePolicy("licenseType", event.target.value)}
                >
                  <option value="standard">标准版</option>
                  <option value="premium">高级版</option>
                  <option value="trial_plus">试用增强版</option>
                </select>
              </label>
              <label>
                最大绑定数
                <input
                  type="number"
                  value={currentLicensePolicy.maxBindings}
                  onChange={(event) => updateLicensePolicy("maxBindings", Number(event.target.value))}
                />
              </label>
              <label>
                换绑限制
                <input
                  type="number"
                  value={currentLicensePolicy.rebindLimit}
                  onChange={(event) => updateLicensePolicy("rebindLimit", Number(event.target.value))}
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={currentLicensePolicy.requiresManualReviewAfterLimit}
                  onChange={(event) => updateLicensePolicy("requiresManualReviewAfterLimit", event.target.checked)}
                />
                超出换绑限制后转人工审批
              </label>
            </div>
          </article>
        </div>

        {status ? <p className="inline-status">{status}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">安全配置</p>
            <h3>客户端认证要求</h3>
            <p className="section-note">这里的配置会影响 DLL 客户端在激活、验证和机器绑定时的判定方式。</p>
          </div>
          <button className="action-button" onClick={saveSecurityProfile} disabled={securityProfile === null} type="button">
            保存安全配置
          </button>
        </div>

        {securityProfile ? (
          <div className="form-grid">
            <label>
              机器绑定模式
              <select
                value={securityProfile.machineBindingMode}
                onChange={(event) =>
                  setSecurityProfile({
                    ...securityProfile,
                    machineBindingMode: event.target.value,
                  })
                }
              >
                <option value="strict">严格</option>
                <option value="balanced">均衡</option>
                <option value="lenient">宽松</option>
              </select>
            </label>
            <label>
              Challenge 失败容忍次数
              <input
                type="number"
                value={securityProfile.challengeFailTolerance}
                onChange={(event) =>
                  setSecurityProfile({
                    ...securityProfile,
                    challengeFailTolerance: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={securityProfile.antiDebugEnabled}
                onChange={(event) =>
                  setSecurityProfile({
                    ...securityProfile,
                    antiDebugEnabled: event.target.checked,
                  })
                }
              />
              启用反调试检测
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={securityProfile.antiVmEnabled}
                onChange={(event) =>
                  setSecurityProfile({
                    ...securityProfile,
                    antiVmEnabled: event.target.checked,
                  })
                }
              />
              启用反虚拟机检测
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={securityProfile.hookDetectionEnabled}
                onChange={(event) =>
                  setSecurityProfile({
                    ...securityProfile,
                    hookDetectionEnabled: event.target.checked,
                  })
                }
              />
              启用 Hook 检测
            </label>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">风险规则</p>
            <h3>产品级阈值与处置动作</h3>
            <p className="section-note">风险规则为空时也可以先新增一条规则，再逐条保存到后端。</p>
          </div>
          <button className="action-button action-button-secondary" onClick={addRiskRule} type="button">
            新增规则
          </button>
        </div>

        {riskRules.length > 0 ? (
          <div className="ticket-list risk-rule-list">
            {riskRules.map((rule, index) => (
              <article className="ticket-card policy-rule-card" key={`${rule.ruleCode || "new-rule"}-${index}`}>
                <label>
                  规则编码
                  <input value={rule.ruleCode} onChange={(event) => updateRiskRule(index, { ruleCode: event.target.value })} />
                </label>
                <label>
                  阈值
                  <input
                    value={rule.thresholdValue}
                    onChange={(event) => updateRiskRule(index, { thresholdValue: event.target.value })}
                  />
                </label>
                <label>
                  动作
                  <input value={rule.actionCode} onChange={(event) => updateRiskRule(index, { actionCode: event.target.value })} />
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={Boolean(rule.enabled)}
                    onChange={(event) => updateRiskRule(index, { enabled: event.target.checked })}
                  />
                  已启用
                </label>
                <button className="action-button" onClick={() => saveRiskRule(rule)} type="button">
                  保存规则
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="info-banner">当前产品还没有风险规则，可以先新增一条默认规则再保存。</div>
        )}
      </section>
    </div>
  );
}
