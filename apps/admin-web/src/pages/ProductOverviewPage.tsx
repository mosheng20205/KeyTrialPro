import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { StatCard } from "../components/StatCard";
import { TrendBars } from "../components/TrendBars";
import type { ProductIntegration, ProductOverview, ProductRecord } from "../types";

type ProductOverviewPageProps = {
  product: ProductRecord | undefined;
  overview: ProductOverview;
};

export function ProductOverviewPage({ product, overview }: ProductOverviewPageProps) {
  const [integration, setIntegration] = useState<ProductIntegration | null>(null);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    if (!product?.product_code) {
      setIntegration(null);
      return;
    }

    let disposed = false;
    setIntegration(null);
    setCopyStatus("");

    api.productIntegration(product.product_code)
      .then((payload) => {
        if (!disposed) {
          setIntegration(payload);
        }
      })
      .catch(() => {
        if (!disposed) {
          setIntegration(null);
        }
      });

    return () => {
      disposed = true;
    };
  }, [product?.product_code]);

  const integrationBundle = useMemo(() => {
    if (!integration) {
      return "";
    }

    return JSON.stringify(integration.sdkParameters, null, 2);
  }, [integration]);

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label}已复制。`);
    } catch {
      setCopyStatus(`${label}复制失败，请手动复制。`);
    }
  };

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">产品范围</p>
          <h3>{overview.productName}</h3>
          <p className="hero-copy">
            产品级许可证、试用控制、机器指纹遥测。
            {product?.trial_duration_minutes && product.trial_duration_minutes > 0 ? (
              <>
                试用时长：<strong>{product.trial_duration_minutes} 分钟</strong>，心跳间隔：
                <strong>{product.heartbeat_interval_seconds} 秒</strong>。
              </>
            ) : (
              <> 当前产品已关闭试用，仅允许正式授权链路。</>
            )}
          </p>
        </div>
      </section>

      <section className="stat-grid">
        <StatCard label="已激活" value={String(overview.totalActivatedCount)} hint="拥有有效绑定的唯一设备数。" />
        <StatCard label="当前在线" value={String(overview.onlineCount)} hint="当前在线窗口内刷新了心跳的设备。" />
        <StatCard label="今日试用" value={String(overview.trialStartedToday)} hint="今日新增的试用会话数。" />
        <StatCard label="今日风险事件" value={String(overview.riskEventCount)} hint="需要关注的风险标记事件。" tone="alert" />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">SDK 对接</p>
            <h3>当前产品的接入参数</h3>
            <p className="section-note">不再需要直接查数据库。这里整理了客户端初始化最常用的 4 个参数，可直接复制给接入方。</p>
          </div>
          {integration ? (
            <button className="action-button" type="button" onClick={() => copyText("对接参数包", integrationBundle)}>
              复制全部参数
            </button>
          ) : null}
        </div>

        {integration ? (
          <div className="integration-layout">
            <article className="integration-item-card">
              <div className="integration-item-head">
                <label htmlFor="integration-product-code">product_code</label>
                <span className="integration-item-tag">产品标识</span>
              </div>
              <div className="integration-input-row">
                <input id="integration-product-code" className="integration-input readonly-input monospace-input" readOnly value={integration.productCode} />
                <button className="integration-copy-button" type="button" onClick={() => copyText("product_code", integration.productCode)}>
                  复制
                </button>
              </div>
            </article>

            <article className="integration-item-card">
              <div className="integration-item-head">
                <label htmlFor="integration-server-url">server_url</label>
                <span className="integration-item-tag">服务地址</span>
              </div>
              <div className="integration-input-row">
                <input id="integration-server-url" className="integration-input readonly-input monospace-input" readOnly value={integration.serverUrl} />
                <button className="integration-copy-button" type="button" onClick={() => copyText("server_url", integration.serverUrl)}>
                  复制
                </button>
              </div>
            </article>

            <article className="integration-item-card">
              <div className="integration-item-head">
                <label htmlFor="integration-app-key">client_app_key</label>
                <span className="integration-item-tag">签名密钥</span>
              </div>
              <div className="integration-input-row">
                <input id="integration-app-key" className="integration-input readonly-input monospace-input" readOnly value={integration.clientAppKey} />
                <button className="integration-copy-button" type="button" onClick={() => copyText("client_app_key", integration.clientAppKey)}>
                  复制
                </button>
              </div>
            </article>

            <article className="integration-item-card">
              <div className="integration-item-head">
                <label htmlFor="integration-cert-pins">cert_pins</label>
                <span className="integration-item-tag">{integration.certPins ? "TLS Pin" : "待配置"}</span>
              </div>
              <div className="integration-input-row">
                <input id="integration-cert-pins" className="integration-input readonly-input monospace-input" readOnly value={integration.certPins || "未配置"} />
                <button className="integration-copy-button" type="button" onClick={() => copyText("cert_pins", integration.certPins)}>
                  复制
                </button>
              </div>
            </article>

            <article className="integration-item-card integration-field-wide integration-bundle-card">
              <div className="integration-item-head">
                <label htmlFor="integration-bundle">参数包</label>
                <span className="integration-item-tag">JSON</span>
              </div>
              <textarea id="integration-bundle" className="integration-bundle readonly-textarea monospace-input" readOnly value={integrationBundle} />
            </article>
          </div>
        ) : (
          <p className="section-note">正在加载当前产品的对接参数...</p>
        )}

        {copyStatus ? <p className="inline-status">{copyStatus}</p> : null}
      </section>

      <TrendBars title="每日产品活跃" points={overview.trend} mode="active" />
      <TrendBars title="每日试用启动" points={overview.trend} mode="trial" />
    </div>
  );
}
