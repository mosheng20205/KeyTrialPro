import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { ProductPolicy } from "../types";

function generateLicenseKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = [4, 4, 4, 4];

  return segments
    .map((length) => {
      let output = "";
      for (let index = 0; index < length; index += 1) {
        output += chars[Math.floor(Math.random() * chars.length)];
      }
      return output;
    })
    .join("-");
}

export function AddLicensePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [products, setProducts] = useState<Array<{ id: number; name: string; product_code: string }>>([]);
  const [policies, setPolicies] = useState<Record<number, ProductPolicy>>({});
  const [form, setForm] = useState({
    product_id: "",
    license_key: generateLicenseKey(),
    quantity: 1,
    license_type: "standard",
    status: "active",
    max_bindings: 1,
    expires_at: "",
  });

  useEffect(() => {
    api.products().then((data) => {
      setProducts(data);

      if (data.length > 0) {
        const firstId = data[0].id;
        setForm((prev) => ({ ...prev, product_id: String(firstId) }));
        loadPolicy(firstId);
      }
    });
  }, []);

  const getDefaultBindings = (policy: ProductPolicy, licenseType: string): number => {
    const matchedPolicy = policy.licensePolicies?.find((licensePolicy) => licensePolicy.licenseType === licenseType);
    return matchedPolicy?.maxBindings ?? 1;
  };

  const loadPolicy = (productId: number) => {
    api.policy(String(productId)).then((policy) => {
      setPolicies((prev) => ({ ...prev, [productId]: policy }));
      setForm((prev) => ({
        ...prev,
        max_bindings: getDefaultBindings(policy, prev.license_type),
      }));
    });
  };

  const handleProductChange = (productId: string) => {
    const parsedProductId = parseInt(productId, 10);
    const policy = policies[parsedProductId];

    if (policy) {
      setForm((prev) => ({
        ...prev,
        product_id: productId,
        max_bindings: getDefaultBindings(policy, prev.license_type),
      }));
      return;
    }

    setForm((prev) => ({ ...prev, product_id: productId }));
    loadPolicy(parsedProductId);
  };

  const handleTypeChange = (licenseType: string) => {
    const parsedProductId = parseInt(form.product_id, 10);
    const policy = policies[parsedProductId];

    setForm((prev) => ({
      ...prev,
      license_type: licenseType,
      max_bindings: policy ? getDefaultBindings(policy, licenseType) : 1,
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess(false);
    setCreatedCount(0);
    setLoading(true);

    try {
      const quantity = Math.max(1, Math.min(500, form.quantity || 1));
      const response = await api.createLicense({
        product_id: parseInt(form.product_id, 10),
        license_key: quantity === 1 ? form.license_key : undefined,
        quantity,
        license_type: form.license_type,
        status: form.status,
        max_bindings: form.max_bindings,
        expires_at: form.expires_at || undefined,
      });

      setCreatedCount(response.createdCount ?? quantity);
      setSuccess(true);
      setTimeout(() => navigate("/admin/?view=licenses"), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const isBatchMode = form.quantity > 1;

  return (
    <div className="page">
      <div className="page-header">
        <h2>添加卡密</h2>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-group">
            <label htmlFor="product_id">关联产品 *</label>
            <select id="product_id" value={form.product_id} onChange={(event) => handleProductChange(event.target.value)} required>
              {products.map((product) => (
                <option key={product.product_code} value={String(product.id)}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="quantity">生成数量</label>
            <input
              id="quantity"
              type="number"
              min="1"
              max="500"
              value={form.quantity}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  quantity: Math.max(1, Math.min(500, parseInt(event.target.value, 10) || 1)),
                }))
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="license_key">卡密密钥 {isBatchMode ? "" : "*"}</label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                id="license_key"
                type="text"
                value={isBatchMode ? "批量生成时由服务端自动生成" : form.license_key}
                onChange={(event) => setForm((prev) => ({ ...prev, license_key: event.target.value.toUpperCase() }))}
                required={!isBatchMode}
                disabled={isBatchMode}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setForm((prev) => ({ ...prev, license_key: generateLicenseKey() }))}
                disabled={isBatchMode}
                style={{ whiteSpace: "nowrap" }}
              >
                重新生成
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="license_type">许可证类型</label>
            <select id="license_type" value={form.license_type} onChange={(event) => handleTypeChange(event.target.value)}>
              <option value="standard">标准版</option>
              <option value="professional">专业版</option>
              <option value="enterprise">企业版</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="max_bindings">最大绑定数</label>
            <input
              id="max_bindings"
              type="number"
              min="1"
              value={form.max_bindings}
              onChange={(event) => setForm((prev) => ({ ...prev, max_bindings: parseInt(event.target.value, 10) || 1 }))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="expires_at">到期时间（留空永久）</label>
            <input
              id="expires_at"
              type="date"
              value={form.expires_at}
              onChange={(event) => setForm((prev) => ({ ...prev, expires_at: event.target.value }))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">状态</label>
            <select id="status" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="active">激活</option>
              <option value="inactive">停用</option>
            </select>
          </div>

          {error ? <div className="alert alert-error">{error}</div> : null}
          {success ? <div className="alert alert-success">已成功添加 {createdCount} 张卡密，即将返回许可证列表。</div> : null}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "添加中..." : "添加卡密"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/admin/?view=licenses")}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
