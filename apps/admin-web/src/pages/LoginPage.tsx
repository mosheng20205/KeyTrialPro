import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCredentials = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.requiresMfa && result.challengeToken) {
        setChallengeToken(result.challengeToken);
        setStep("mfa");
      } else {
        navigate("/admin/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登录失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await verifyMfa(mfaCode, challengeToken);
      navigate("/admin/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "MFA 验证失败。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1 className="login-title">KeyTrialPro 管理后台</h1>
        <p className="login-subtitle">请输入管理员账号密码继续。默认种子账号只建议用于首次初始化，登录后请立即修改。</p>

        {error ? <div className="login-error">{error}</div> : null}

        {step === "credentials" ? (
          <form onSubmit={handleCredentials} className="login-form">
            <div className="form-group">
              <label htmlFor="email">管理员邮箱</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">密码</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入管理员密码"
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMfa} className="login-form">
            <div className="form-group">
              <label htmlFor="mfa">六位验证码</label>
              <input
                id="mfa"
                type="text"
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                pattern="\d{6}"
                required
                autoFocus
              />
              <p className="form-hint">请输入 TOTP 认证器中的六位验证码。</p>
            </div>
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "验证中..." : "验证 MFA"}
            </button>
            <button type="button" className="login-back" onClick={() => setStep("credentials")}>
              返回重新输入账号密码
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
