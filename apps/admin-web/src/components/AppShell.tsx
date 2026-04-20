import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { ProductRecord } from "../types";

export type NavKey = "platform" | "product" | "risk" | "approvals" | "licenses" | "policies" | "audit" | "add-product" | "add-license";

type AppShellProps = {
  current: NavKey;
  onNavigate: (key: NavKey) => void;
  products: ProductRecord[];
  activeProduct: string;
  onProductChange: (value: string) => void;
  children: ReactNode;
};

const navItems: Array<{ key: NavKey; label: string }> = [
  { key: "platform", label: "平台概览" },
  { key: "product", label: "产品运营" },
  { key: "risk", label: "风险中心" },
  { key: "approvals", label: "审批队列" },
  { key: "licenses", label: "许可证" },
  { key: "policies", label: "策略配置" },
  { key: "audit", label: "审计日志" },
  { key: "add-product", label: "新增产品" },
  { key: "add-license", label: "添加卡密" },
];

export function AppShell({
  current,
  onNavigate,
  products,
  activeProduct,
  onProductChange,
  children,
}: AppShellProps) {
  const navigate = useNavigate();

  const handleNavigate = (key: NavKey) => {
    if (key === "add-product") {
      navigate("/admin/add-product");
    } else if (key === "add-license") {
      navigate("/admin/add-license");
    } else {
      onNavigate(key);
    }
  };

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div>
          <p className="brand-kicker">KeyTrialPro</p>
          <h1>许可证管理</h1>
          <p className="sidebar-copy">
            多产品许可证管理、机器指纹风险控制、短窗口在线追踪分析。
          </p>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={item.key === current ? "nav-button nav-button-active" : "nav-button"}
              onClick={() => handleNavigate(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="eyebrow">产品范围</span>
          <select value={activeProduct} onChange={(event) => onProductChange(event.target.value)}>
            {products.map((product) => (
              <option value={product.product_code} key={product.product_code}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">企业控制台</p>
            <h2>生产环境许可证运营，支持产品级隔离</h2>
          </div>
          <div className="status-pill">MFA 已启用</div>
        </header>
        {children}
      </main>
    </div>
  );
}