import { Fragment } from "react";
import type { ProductRecord } from "../types";

type LicensesPageProps = {
  products: ProductRecord[];
};

export function LicensesPage({ products }: LicensesPageProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">产品策略</p>
          <h3>试用与心跳默认值</h3>
        </div>
      </div>
      <div className="table-grid">
        <div className="table-head">产品</div>
        <div className="table-head">编码</div>
        <div className="table-head">状态</div>
        <div className="table-head">试用时长(分钟)</div>
        <div className="table-head">心跳间隔</div>
        {products.map((product) => (
          <Fragment key={product.id}>
            <div className="table-cell" key={`name-${product.id}`}>{product.name}</div>
            <div className="table-cell" key={`code-${product.id}`}>{product.product_code}</div>
            <div className="table-cell" key={`status-${product.id}`}>{product.status}</div>
            <div className="table-cell" key={`trial-${product.id}`}>{product.trial_duration_minutes}</div>
            <div className="table-cell" key={`hb-${product.id}`}>{product.heartbeat_interval_seconds}s</div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}

