import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import type { AdminProfile } from "../types";

export function AdminAccountPage() {
  const { updateAdmin } = useAuth();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    mfaEnabled: true,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    let disposed = false;

    api
      .accountProfile()
      .then((data) => {
        if (disposed) {
          return;
        }

        setProfile(data);
        setForm({
          email: data.email,
          displayName: data.displayName,
          mfaEnabled: data.mfaEnabled,
        });
      })
      .catch((err: unknown) => {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "加载管理员资料失败。");
        }
      })
      .finally(() => {
        if (!disposed) {
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSavingProfile(true);

    try {
      const nextProfile = await api.updateAccountProfile(form);
      setProfile(nextProfile);
      updateAdmin({
        id: nextProfile.id,
        email: nextProfile.email,
        displayName: nextProfile.displayName,
        roleCode: nextProfile.roleCode,
        mfaEnabled: nextProfile.mfaEnabled,
      });
      setSuccess("管理员资料已更新。");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存管理员资料失败。");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("两次输入的新密码不一致。");
      return;
    }

    setSavingPassword(true);

    try {
      await api.changeAccountPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordSuccess("管理员密码已更新。");
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "修改密码失败。");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <section className="panel">正在加载管理员设置...</section>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">管理员设置</p>
            <h3>账号、密码与 MFA</h3>
            <p className="section-note">日常维护建议直接在后台完成；`.env` 更适合首个管理员初始化或紧急重置。</p>
          </div>
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}
        {success ? <div className="alert alert-success">{success}</div> : null}

        <form className="account-layout" onSubmit={handleProfileSubmit}>
          <div className="account-card">
            <div className="account-card-header">
              <h4>资料与登录方式</h4>
              <span className="account-role">{profile?.roleCode ?? "platform_super_admin"}</span>
            </div>

            <div className="form-grid">
              <label>
                管理员邮箱
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="admin@example.com"
                  required
                />
              </label>

              <label>
                显示名称
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                  placeholder="Platform Administrator"
                  required
                />
              </label>

              <label className="checkbox-row account-checkbox">
                <input
                  type="checkbox"
                  checked={form.mfaEnabled}
                  onChange={(event) => setForm((current) => ({ ...current, mfaEnabled: event.target.checked }))}
                />
                <span>
                  启用 MFA 登录校验
                  <small>对应数据库字段 `admins.mfa_enabled`。</small>
                </span>
              </label>

              <label>
                当前状态
                <input type="text" value={profile?.status ?? "active"} readOnly className="readonly-input" />
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                {savingProfile ? "保存中..." : "保存管理员资料"}
              </button>
            </div>
          </div>

          <div className="account-card">
            <div className="account-card-header">
              <h4>MFA 配置材料</h4>
              <span className={form.mfaEnabled ? "status-pill" : "status-pill status-pill-muted"}>
                {form.mfaEnabled ? "MFA 已开启" : "MFA 已关闭"}
              </span>
            </div>

            <p className="section-note">首次启用 MFA 时，请将下面的密钥录入到支持 TOTP 的认证器应用。</p>

            <div className="form-grid">
              <label className="form-grid-wide">
                MFA Secret
                <input type="text" value={profile?.mfaSecret ?? ""} readOnly className="readonly-input monospace-input" />
              </label>

              <label className="form-grid-wide">
                Provisioning URI
                <textarea
                  value={profile?.mfaProvisioningUri ?? ""}
                  readOnly
                  className="readonly-textarea monospace-input"
                  rows={3}
                />
              </label>
            </div>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">密码维护</p>
            <h3>修改管理员密码</h3>
            <p className="section-note">修改密码后，当前会话保持可用，新密码会立即用于后续登录。</p>
          </div>
        </div>

        {passwordError ? <div className="alert alert-error">{passwordError}</div> : null}
        {passwordSuccess ? <div className="alert alert-success">{passwordSuccess}</div> : null}

        <form className="account-password-grid" onSubmit={handlePasswordSubmit}>
          <label>
            当前密码
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
              required
            />
          </label>

          <label>
            新密码
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
              minLength={8}
              required
            />
          </label>

          <label>
            确认新密码
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              minLength={8}
              required
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={savingPassword}>
              {savingPassword ? "提交中..." : "更新密码"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Bootstrap 说明</p>
            <h3>可选的 .env 初始化项</h3>
          </div>
        </div>
        <div className="account-env-note">
          <p>如果你希望用 `.env` 初始化首个管理员，或在线上做一次性应急重置，可以配置下面这些键：</p>
          <code>ADMIN_BOOTSTRAP_EMAIL</code>
          <code>ADMIN_BOOTSTRAP_PASSWORD</code>
          <code>ADMIN_BOOTSTRAP_DISPLAY_NAME</code>
          <code>ADMIN_BOOTSTRAP_MFA_ENABLED</code>
          <code>ADMIN_BOOTSTRAP_MFA_SECRET</code>
          <code>ADMIN_BOOTSTRAP_FORCE_SYNC</code>
          <p>建议平时留空；只有需要初始化或强制覆盖管理员资料时再启用，并在完成后关闭 `ADMIN_BOOTSTRAP_FORCE_SYNC`。</p>
        </div>
      </section>
    </div>
  );
}
