import type { ReactNode } from "react";
import type { ProductRecord } from "../types";

export type NavKey =
  | "platform"
  | "product"
  | "risk"
  | "approvals"
  | "licenses"
  | "policies"
  | "audit"
  | "add-product"
  | "add-license";

type AppShellProps = {
  current: NavKey;
  onNavigate: (key: NavKey) => void;
  products: ProductRecord[];
  activeProduct: string;
  activeProductRecord?: ProductRecord;
  onProductChange: (value: string) => void;
  children: ReactNode;
};

const navItems: Array<{ key: NavKey; label: string; hint: string }> = [
  { key: "platform", label: "平台概览", hint: "先看全局健康度" },
  { key: "product", label: "产品运营", hint: "聚焦当前产品指标" },
  { key: "risk", label: "风险中心", hint: "查看设备与环境异常" },
  { key: "approvals", label: "审批队列", hint: "处理换绑和恢复申请" },
  { key: "licenses", label: "许可证", hint: "管理卡密库存与授权" },
  { key: "policies", label: "策略配置", hint: "维护试用、授权和安全规则" },
  { key: "audit", label: "审计日志", hint: "回溯关键管理动作" },
  { key: "add-product", label: "新增产品", hint: "创建并初始化默认配置" },
  { key: "add-license", label: "添加卡密", hint: "快速录入许可证" },
];

const navMeta: Record<NavKey, { eyebrow: string; title: string; description: string }> = {
  platform: {
    eyebrow: "控制台",
    title: "先看平台，再钻取到具体产品",
    description: "把全局健康度、待处理积压和趋势变化放在同一视图里，减少在多张页面之间来回切换。",
  },
  product: {
    eyebrow: "产品运营",
    title: "当前产品的激活、试用和活跃趋势",
    description: "切换产品范围后，这里的概览、趋势和统计会同步刷新，避免把别的产品数据带进当前判断。",
  },
  risk: {
    eyebrow: "风险中心",
    title: "围绕当前产品集中处理异常信号",
    description: "把风险事件、处置动作和策略联动放在一个工作区，减少误操作和上下文丢失。",
  },
  approvals: {
    eyebrow: "审批队列",
    title: "只处理当前产品待审核的绑定与恢复申请",
    description: "审批视图跟随产品范围变化，便于单产品排查和批量处理。",
  },
  licenses: {
    eyebrow: "许可证",
    title: "卡密库存、状态和授权明细集中管理",
    description: "把卡密录入和库存查询放在同一工作区，减少跳转成本。",
  },
  policies: {
    eyebrow: "策略配置",
    title: "试用、授权、安全规则在这里统一维护",
    description: "页面直接作用于当前产品。切换产品范围后，策略内容会同步切换，不再需要额外确认上下文。",
  },
  audit: {
    eyebrow: "审计日志",
    title: "追踪关键动作和系统变更",
    description: "日志默认绑定当前产品范围，复盘时更容易定位单产品问题。",
  },
  "add-product": {
    eyebrow: "新增产品",
    title: "创建产品时自动初始化默认策略",
    description: "新产品创建后会自动生成默认试用策略、许可证策略和安全配置，避免后续页面出现空配置。",
  },
  "add-license": {
    eyebrow: "添加卡密",
    title: "快速录入卡密并关联到当前产品策略",
    description: "卡密创建会沿用产品默认策略，减少重复输入。",
  },
};

export function AppShell({
  current,
  onNavigate,
  products,
  activeProduct,
  activeProductRecord,
  onProductChange,
  children,
}: AppShellProps) {
  const currentMeta = navMeta[current];

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="sidebar-header">
          <p className="brand-kicker">KeyTrialPro</p>
          <h1>许可证控制台</h1>
          <p className="sidebar-copy">多产品许可证管理、设备指纹风控、试用与授权策略在同一套后台集中维护。</p>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={item.key === current ? "nav-button nav-button-active" : "nav-button"}
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              <span className="nav-button-label">{item.label}</span>
              <span className="nav-button-meta">{item.hint}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-copy">
            <p className="eyebrow">{currentMeta.eyebrow}</p>
            <h2>{currentMeta.title}</h2>
            <p className="topbar-description">{currentMeta.description}</p>
          </div>
          <div className="topbar-meta">
            <div className="status-pill">MFA 已启用</div>
          </div>
        </header>

        <section className="workspace-context" aria-label="当前工作区产品范围">
          <div className="context-card">
            <div className="context-copy">
              <span className="scope-summary-label">当前工作产品</span>
              <strong>{activeProductRecord?.name ?? "未选择产品"}</strong>
              <div className="context-meta">
                <span>{activeProductRecord?.product_code ?? (activeProduct || "no-product")}</span>
                <span>{activeProductRecord?.status === "active" ? "已启用" : "未启用"}</span>
              </div>
            </div>

            <div className="context-select-wrap">
              <label className="context-select-label" htmlFor="workspace-product-select">
                切换产品范围
              </label>
              <select
                id="workspace-product-select"
                value={activeProduct}
                onChange={(event) => onProductChange(event.target.value)}
                disabled={products.length === 0}
              >
                {products.map((product) => (
                  <option value={product.product_code} key={product.product_code}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="workspace-context-hint">进入任一菜单页时，这里就是当前操作对象。概览、策略、风控、许可证和审计日志都会跟随这个产品范围联动。</p>
        </section>

        {children}
      </main>
    </div>
  );
}
