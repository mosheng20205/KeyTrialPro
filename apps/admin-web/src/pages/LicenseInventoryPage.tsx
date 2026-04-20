import { Fragment } from "react";
import type { LicenseRecord } from "../types";

type LicenseInventoryPageProps = {
  licenses: LicenseRecord[];
};

export function LicenseInventoryPage({ licenses }: LicenseInventoryPageProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">许可证库存</p>
          <h3>已发放的产品密钥</h3>
        </div>
      </div>

      <div className="table-grid license-grid">
        <div className="table-head">产品</div>
        <div className="table-head">许可证密钥</div>
        <div className="table-head">状态</div>
        <div className="table-head">过期时间</div>
        <div className="table-head">最大绑定数</div>
        {licenses.map((license) => (
          <Fragment key={license.id}>
            <div className="table-cell" key={`product-${license.id}`}>{license.product_name}</div>
            <div className="table-cell" key={`key-${license.id}`}>{license.license_key}</div>
            <div className="table-cell" key={`status-${license.id}`}>{license.status}</div>
            <div className="table-cell" key={`expires-${license.id}`}>{license.expires_at ?? "Never"}</div>
            <div className="table-cell" key={`bindings-${license.id}`}>{license.max_bindings}</div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
