import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.createProduct({
        product_code: form.product_code,
        name: form.name,
        client_app_key: form.client_app_key || undefined,
        trial_duration_minutes: parseInt(form.trial_duration_minutes, 10),
        heartbeat_interval_seconds: parseInt(form.heartbeat_interval_seconds, 10),
        offline_grace_minutes: parseInt(form.offline_grace_minutes, 10),
        status: form.status,
      });

      setSuccess(true);
      setTimeout(() => navigate("/admin/?view=platform"), 1500);
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
              onChange={(event) => update("product_code", event.target.value)}
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
              onChange={(event) => update("name", event.target.value)}
              placeholder="例如：我的应用"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="client_app_key">App Key（留空自动生成）</label>
            <input
              id="client_app_key"
              type="text"
              value={form.client_app_key}
              onChange={(event) => update("client_app_key", event.target.value)}
              placeholder="留空则由服务端自动生成"
            />
          </div>

          <div className="form-group">
            <label htmlFor="trial_duration_minutes">试用时长（分钟）</label>
            <input
              id="trial_duration_minutes"
              type="number"
              min="1"
              value={form.trial_duration_minutes}
              onChange={(event) => update("trial_duration_minutes", event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="heartbeat_interval_seconds">心跳间隔（秒）</label>
            <input
              id="heartbeat_interval_seconds"
              type="number"
              min="30"
              value={form.heartbeat_interval_seconds}
              onChange={(event) => update("heartbeat_interval_seconds", event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="offline_grace_minutes">离线宽限（分钟）</label>
            <input
              id="offline_grace_minutes"
              type="number"
              min="0"
              value={form.offline_grace_minutes}
              onChange={(event) => update("offline_grace_minutes", event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">状态</label>
            <select id="status" value={form.status} onChange={(event) => update("status", event.target.value)}>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </div>

          {error ? <div className="alert alert-error">{error}</div> : null}
          {success ? <div className="alert alert-success">产品创建成功，即将返回控制台。</div> : null}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "创建中..." : "创建产品"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/admin/?view=platform")}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
