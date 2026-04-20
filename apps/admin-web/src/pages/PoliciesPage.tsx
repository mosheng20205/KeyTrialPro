import { useEffect, useState } from "react";
import { api } from "../api";
import type { ProductPolicy, RiskRule, SecurityProfile } from "../types";

type PoliciesPageProps = {
  productCode: string;
};

export function PoliciesPage({ productCode }: PoliciesPageProps) {
  const [policy, setPolicy] = useState<ProductPolicy | null>(null);
  const [securityProfile, setSecurityProfile] = useState<SecurityProfile | null>(null);
  const [riskRules, setRiskRules] = useState<RiskRule[]>([]);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    api.policy(productCode).then(setPolicy);
    api.securityProfile(productCode).then(setSecurityProfile);
    api.riskRules(productCode).then((rules) =>
      setRiskRules(
        rules.map((rule) => ({
          ruleCode: rule.ruleCode ?? rule.rule_code ?? "",
          thresholdValue: rule.thresholdValue ?? rule.threshold_value ?? "",
          actionCode: rule.actionCode ?? rule.action_code ?? "",
          enabled: Boolean(rule.enabled),
        })),
      ),
    );
  }, [productCode]);

  if (policy === null) {
    return <section className="panel">正在加载策略...</section>;
  }

  const currentPolicy = policy;
  const currentLicensePolicy = currentPolicy.licensePolicies?.[0];
  if (!currentLicensePolicy) {
    return <section className="panel">该产品暂无许可证策略配置。</section>;
  }

  async function savePolicy() {
    if (!currentLicensePolicy) return;
    const payload = {
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
    };
    await api.savePolicy(productCode, payload);
    setStatus("策略已保存。");
  }

  async function saveRiskRule(rule: RiskRule) {
    await api.saveRiskRule(productCode, rule);
    setStatus(`风险规则 ${rule.ruleCode} 已保存。`);
  }

  async function saveSecurityProfile() {
    if (securityProfile === null) {
      return;
    }

    await api.saveSecurityProfile(productCode, securityProfile);
    setStatus("安全配置已保存。");
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">产品策略</p>
            <h3>{currentPolicy.productName}</h3>
          </div>
          <button className="action-button" onClick={savePolicy}>
            保存策略
          </button>
        </div>

        <div className="form-grid">
          <label>
            试用时长(分钟)
            <input
              type="number"
              value={currentPolicy.trialPolicy.trialDurationMinutes}
              onChange={(event) =>
                setPolicy({
                  ...currentPolicy,
                  trialPolicy: { ...currentPolicy.trialPolicy, trialDurationMinutes: Number(event.target.value) },
                })
              }
            />
          </label>
          <label>
            心跳间隔(秒)
            <input
              type="number"
              value={currentPolicy.trialPolicy.heartbeatIntervalSeconds}
              onChange={(event) =>
                setPolicy({
                  ...currentPolicy,
                  trialPolicy: { ...currentPolicy.trialPolicy, heartbeatIntervalSeconds: Number(event.target.value) },
                })
              }
            />
          </label>
          <label>
            离线宽限(分钟)
            <input
              type="number"
              value={currentPolicy.trialPolicy.offlineGraceMinutes}
              onChange={(event) =>
                setPolicy({
                  ...currentPolicy,
                  trialPolicy: { ...currentPolicy.trialPolicy, offlineGraceMinutes: Number(event.target.value) },
                })
              }
            />
          </label>
          <label>
            试用最大换机次数
            <input
              type="number"
              value={currentPolicy.trialPolicy.maxRebindCount}
              onChange={(event) =>
                setPolicy({
                  ...currentPolicy,
                  trialPolicy: { ...currentPolicy.trialPolicy, maxRebindCount: Number(event.target.value) },
                })
              }
            />
          </label>
          <label>
            降级模式
            <select
              value={currentPolicy.trialPolicy.degradeMode}
              onChange={(event) =>
                setPolicy({
                  ...currentPolicy,
                  trialPolicy: { ...currentPolicy.trialPolicy, degradeMode: event.target.value },
                })
              }
            >
              <option value="read_only">只读</option>
              <option value="block">阻止</option>
              <option value="activation_only">仅激活</option>
            </select>
          </label>
          <label>
            许可证类型
            <select
              value={currentLicensePolicy.licenseType}
              onChange={(event) =>
                setPolicy({
                  ...currentPolicy,
                  licensePolicies: [
                    {
                      ...currentLicensePolicy,
                      licenseType: event.target.value,
                    },
                  ],
                })
              }
            >
              <option value="standard">标准</option>
              <option value="premium">高级</option>
              <option value="trial_plus">试用增强</option>
            </select>
          </label>
          <label>
            最大绑定数
            <input
              type="number"
              value={currentLicensePolicy.maxBindings}
              onChange={(event) =>
                setPolicy({
                  ...currentPolicy,
                  licensePolicies: [{ ...currentLicensePolicy, maxBindings: Number(event.target.value) }],
                })
              }
            />
          </label>
          <label>
            换机限制
            <input
              type="number"
              value={currentLicensePolicy.rebindLimit}
              onChange={(event) =>
                setPolicy({
                  ...currentPolicy,
                  licensePolicies: [{ ...currentLicensePolicy, rebindLimit: Number(event.target.value) }],
                })
              }
            />
          </label>
        </div>
        {status ? <p className="inline-status">{status}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">原生安全配置</p>
            <h3>产品认证要求</h3>
          </div>
          <button className="action-button" onClick={saveSecurityProfile} disabled={securityProfile === null}>
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
              挑战失败容忍度
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
              启用反调试
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
              启用反虚拟机
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
              启用Hook检测
            </label>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">风险规则</p>
            <h3>产品级阈值配置</h3>
          </div>
        </div>
        <div className="ticket-list">
          {riskRules.map((rule, index) => (
            <article className="ticket-card policy-rule-card" key={rule.ruleCode}>
              <label>
                规则编码
                <input
                  value={rule.ruleCode}
                  onChange={(event) => {
                    const next = [...riskRules];
                    next[index] = { ...rule, ruleCode: event.target.value };
                    setRiskRules(next);
                  }}
                />
              </label>
              <label>
                阈值
                <input
                  value={rule.thresholdValue}
                  onChange={(event) => {
                    const next = [...riskRules];
                    next[index] = { ...rule, thresholdValue: event.target.value };
                    setRiskRules(next);
                  }}
                />
              </label>
              <label>
                动作
                <input
                  value={rule.actionCode}
                  onChange={(event) => {
                    const next = [...riskRules];
                    next[index] = { ...rule, actionCode: event.target.value };
                    setRiskRules(next);
                  }}
                />
              </label>
              <button className="action-button" onClick={() => saveRiskRule(rule)}>
                保存规则
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
