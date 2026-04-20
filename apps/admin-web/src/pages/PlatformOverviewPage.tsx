import { StatCard } from "../components/StatCard";
import { TrendBars } from "../components/TrendBars";
import type { PlatformOverview } from "../types";

type PlatformOverviewPageProps = {
  overview: PlatformOverview;
};

export function PlatformOverviewPage({ overview }: PlatformOverviewPageProps) {
  return (
    <div className="page-grid">
      <section className="stat-grid">
        <StatCard label="激活总数" value={String(overview.totalActivatedCount)} hint="所有产品的唯一活跃设备数。" />
        <StatCard label="当前在线" value={String(overview.onlineCount)} hint="最近 5 分钟内活跃的设备。" />
        <StatCard label="试用中" value={String(overview.trialActiveCount)} hint="仍在服务端授权试用窗口内的设备。" />
        <StatCard label="待审批" value={String(overview.approvalBacklogCount)} hint="待人工审核的申请。" tone="alert" />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">按产品</p>
            <h3>已激活设备</h3>
          </div>
        </div>
        <div className="product-list">
          {overview.topProducts.map((product) => (
            <div className="product-row" key={product.product_code}>
              <div>
                <strong>{product.name}</strong>
                <span>{product.product_code}</span>
              </div>
              <strong>{product.total_activated_count}</strong>
            </div>
          ))}
        </div>
      </section>

      <TrendBars title="每日新增激活" points={overview.trend} mode="activated" />
      <TrendBars title="每日活跃设备" points={overview.trend} mode="active" />
    </div>
  );
}

