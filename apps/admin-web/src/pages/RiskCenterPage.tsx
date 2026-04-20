import { Fragment } from "react";
import type { RiskEvent } from "../types";

type RiskCenterPageProps = {
  events: RiskEvent[];
};

export function RiskCenterPage({ events }: RiskCenterPageProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">风险中心</p>
          <h3>最新机器码异常</h3>
        </div>
      </div>

      <div className="table-grid">
        <div className="table-head">产品</div>
        <div className="table-head">机器码</div>
        <div className="table-head">类型</div>
        <div className="table-head">风险等级</div>
        <div className="table-head">摘要</div>
        {events.map((event) => (
          <Fragment key={event.id}>
            <div className="table-cell" key={`product-${event.id}`}>{event.product_name}</div>
            <div className="table-cell" key={`machine-${event.id}`}>{event.machine_id}</div>
            <div className="table-cell" key={`type-${event.id}`}>{event.event_type}</div>
            <div className="table-cell" key={`risk-${event.id}`}>
              <span className={`risk-pill risk-${event.risk_level}`}>{event.risk_level}</span>
            </div>
            <div className="table-cell table-cell-wide" key={`summary-${event.id}`}>{event.summary}</div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
