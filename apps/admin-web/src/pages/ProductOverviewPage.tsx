import { StatCard } from "../components/StatCard";
import { TrendBars } from "../components/TrendBars";
import type { ProductOverview, ProductRecord } from "../types";

type ProductOverviewPageProps = {
  product: ProductRecord | undefined;
  overview: ProductOverview;
};

export function ProductOverviewPage({ product, overview }: ProductOverviewPageProps) {
  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">产品范围</p>
          <h3>{overview.productName}</h3>
          <p className="hero-copy">
            产品级许可证、试用控制、机器指纹遥测。试用时长：{" "}
            <strong>{product?.trial_duration_minutes ?? 0} 分钟</strong>，心跳间隔：{" "}
            <strong>{product?.heartbeat_interval_seconds ?? 0} 秒</strong>。
          </p>
        </div>
      </section>

      <section className="stat-grid">
        <StatCard label="已激活" value={String(overview.totalActivatedCount)} hint="拥有有效绑定的唯一设备数。" />
        <StatCard label="当前在线" value={String(overview.onlineCount)} hint="当前在线窗口内刷新了心跳的设备。" />
        <StatCard label="今日试用" value={String(overview.trialStartedToday)} hint="今日新增的试用会话数。" />
        <StatCard label="今日风险事件" value={String(overview.riskEventCount)} hint="需要关注的风险标记事件。" tone="alert" />
      </section>

      <TrendBars title="每日产品活跃" points={overview.trend} mode="active" />
      <TrendBars title="每日试用启动" points={overview.trend} mode="trial" />
    </div>
  );
}

