import { Fragment } from "react";
import type { RiskEvent } from "../types";

type RiskCenterPageProps = {
  events: RiskEvent[];
};

function translateRiskLevel(level: string): string {
  const normalized = level.trim().toLowerCase();
  switch (normalized) {
    case "critical":
      return "严重";
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
    default:
      return level;
  }
}

function translateSummary(summary: string): string {
  const normalized = summary.trim();

  switch (normalized) {
    case "Debugger flag detected during client attestation.":
      return "客户端校验阶段检测到调试器标记。";
    case "License key not found for product.":
      return "当前产品下未找到对应卡密。";
    case "License has reached the maximum binding count.":
      return "该卡密已达到最大绑定次数。";
    case "Challenge session has expired.":
      return "挑战会话已过期。";
    case "Challenge verification failed.":
      return "挑战校验失败。";
    case "Machine fingerprint mismatch detected.":
      return "检测到机器指纹不匹配。";
    default:
      return summary;
  }
}

export function RiskCenterPage({ events }: RiskCenterPageProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">风险中心</p>
          <h3>最新机器码异常</h3>
        </div>
      </div>

      <div className="table-grid risk-grid">
        <div className="table-head">产品</div>
        <div className="table-head">机器码</div>
        <div className="table-head">类型</div>
        <div className="table-head">风险等级</div>
        <div className="table-head">摘要</div>
        {events.map((event) => (
          <Fragment key={event.id}>
            <div className="table-cell" key={`product-${event.id}`}>
              {event.product_name}
            </div>
            <div className="table-cell table-cell-break table-cell-code" key={`machine-${event.id}`}>
              {event.machine_id}
            </div>
            <div className="table-cell table-cell-break table-cell-code" key={`type-${event.id}`}>
              {event.event_type}
            </div>
            <div className="table-cell" key={`risk-${event.id}`}>
              <span className={`risk-pill risk-${event.risk_level}`}>{translateRiskLevel(event.risk_level)}</span>
            </div>
            <div className="table-cell table-cell-wide" key={`summary-${event.id}`}>
              {translateSummary(event.summary)}
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
