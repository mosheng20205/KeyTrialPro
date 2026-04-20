import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";

export function AddProductPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    product_code: "",
    name: "",
    client_app_key: "",
    trial_duration_minutes: "60",
    heartbeat_interval_seconds: "180",
    offline_grace_minutes: "5",
    status: "active",
  });

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.createProduct({
        product_code: form.product_code,
        name: form.name,
        client_app_key: form.client_app_key || undefined,
        trial_duration_minutes: parseInt(form.trial_duration_minutes, 10),
        heartbeat_interval_seconds: parseInt(form.heartbeat_interval_seconds, 10),
        offline_grace_minutes: parseInt(form.offline_grace_minutes, 10),
        status: form.status,
      });
      void result;
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
        <h2>新增产品</h2>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-group">
            <label htmlFor="product_code">产品编码 *</label>
            <input
              id="product_code"
              type="text"
              value={form.product_code}
              onChange={(e) => update("product_code", e.target.value)}
              placeholder="例如：my-app-v1"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">产品名称 *</label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="例如：我的应用"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="client_app_key">App Key（自动生成留空）</label>
            <input
              id="client_app_key"
              type="text"
              value={form.client_app_key}
              onChange={(e) => update("client_app_key", e.target.value)}
              placeholder="留空则自动生成"
            />
          </div>

          <div className="form-group">
            <label htmlFor="trial_duration_minutes">试用时长（分钟）</label>
            <input
              id="trial_duration_minutes"
              type="number"
              min="1"
              value={form.trial_duration_minutes}
              onChange={(e) => update("trial_duration_minutes", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="heartbeat_interval_seconds">心跳间隔（秒）</label>
            <input
              id="heartbeat_interval_seconds"
              type="number"
              min="30"
              value={form.heartbeat_interval_seconds}
              onChange={(e) => update("heartbeat_interval_seconds", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="offline_grace_minutes">离线宽限期（分钟）</label>
            <input
              id="offline_grace_minutes"
              type="number"
              min="0"
              value={form.offline_grace_minutes}
              onChange={(e) => update("offline_grace_minutes", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">状态</label>
            <select id="status" value={form.status} onChange={(e) => update("status", e.target.value)}>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">产品创建成功，即将返回...</div>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "创建中..." : "创建产品"}
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