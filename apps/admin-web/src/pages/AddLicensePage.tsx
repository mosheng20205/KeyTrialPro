import { useState, useEffect, type FormEvent } from "react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";
import type { ProductPolicy } from "../types";

function generateLicenseKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = [4, 4, 4, 4];
  return segments
    .map((len) => {
      let s = "";
      for (let i = 0; i < len; i++) {
        s += chars[Math.floor(Math.random() * chars.length)];
      }
      return s;
    })
    .join("-");
}

export function AddLicensePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [products, setProducts] = useState<ProductPolicy["productId"] extends number ? Array<{ id: number; name: string; product_code: string }> : never>([]);
  const [policies, setPolicies] = useState<Record<number, ProductPolicy>>({});

  const [form, setForm] = useState({
    product_id: "",
    license_key: generateLicenseKey(),
    license_type: "standard",
    status: "active",
    max_bindings: 1,
    expires_at: "",
  });

  useEffect(() => {
    api.products().then((data) => {
      const prods = data as Array<{ id: number; name: string; product_code: string }>;
      setProducts(prods);
      if (prods.length > 0) {
        const firstId = prods[0].id;
        setForm((prev) => ({ ...prev, product_id: String(firstId) }));
        loadPolicy(firstId);
      }
    });
  }, []);

  const loadPolicy = (productId: number) => {
    api.policy(String(productId)).then((policy: unknown) => {
      const p = policy as ProductPolicy;
      if (!p) return;
      setPolicies((prev) => ({ ...prev, [productId]: p }));
      const defaultBindings = getDefaultBindings(p, form.license_type);
      setForm((prev) => ({ ...prev, max_bindings: defaultBindings }));
    });
  };

  const getDefaultBindings = (policy: ProductPolicy, licenseType: string): number => {
    const lp = policy.licensePolicies?.find((l) => l.licenseType === licenseType);
    return lp?.maxBindings ?? 1;
  };

  const handleProductChange = (productId: string) => {
    const pid = parseInt(productId, 10);
    const policy = policies[pid];
    if (policy) {
      setForm((prev) => ({
        ...prev,
        product_id: productId,
        max_bindings: getDefaultBindings(policy, prev.license_type),
      }));
    } else {
      setForm((prev) => ({ ...prev, product_id: productId }));
      loadPolicy(pid);
    }
  };

  const handleTypeChange = (licenseType: string) => {
    const pid = parseInt(form.product_id, 10);
    const policy = policies[pid];
    setForm((prev) => ({
      ...prev,
      license_type: licenseType,
      max_bindings: policy ? getDefaultBindings(policy, licenseType) : 1,
    }));
  };

  const handleNewKey = () => {
    setForm((prev) => ({ ...prev, license_key: generateLicenseKey() }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.createLicense({
        product_id: parseInt(form.product_id, 10),
        license_key: form.license_key,
        license_type: form.license_type,
        status: form.status,
        max_bindings: form.max_bindings,
        expires_at: form.expires_at || undefined,
      });
      setSuccess(true);
      setTimeout(() => navigate("/admin/"), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>添加卡密</h2>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-group">
            <label htmlFor="product_id">关联产品 *</label>
            <select
              id="product_id"
              value={form.product_id}
              onChange={(e) => handleProductChange(e.target.value)}
              required
            >
              {products.map((p) => (
                <option key={p.product_code} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="license_key">卡密密钥 *</label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                id="license_key"
                type="text"
                value={form.license_key}
                onChange={(e) => setForm((prev) => ({ ...prev, license_key: e.target.value.toUpperCase() }))}
                required
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-secondary" onClick={handleNewKey} style={{ whiteSpace: "nowrap" }}>
                重新生成
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="license_type">许可证类型</label>
            <select
              id="license_type"
              value={form.license_type}
              onChange={(e) => handleTypeChange(e.target.value)}
            >
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
              onChange={(e) => setForm((prev) => ({ ...prev, max_bindings: parseInt(e.target.value, 10) || 1 }))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="expires_at">到期时间（留空永久）</label>
            <input
              id="expires_at"
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm((prev) => ({ ...prev, expires_at: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">状态</label>
            <select id="status" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="active">激活</option>
              <option value="inactive">停用</option>
            </select>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">卡密添加成功，即将返回...</div>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "添加中..." : "添加卡密"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/admin/")}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
