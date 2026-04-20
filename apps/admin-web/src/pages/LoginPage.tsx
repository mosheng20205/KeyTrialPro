import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [mfaCode, setMfaCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.login(email, password) as { requiresMfa?: boolean; challengeToken?: string; token?: string; admin?: unknown };
      if (result.requiresMfa && result.challengeToken) {
        setChallengeToken(result.challengeToken);
        setStep("mfa");
      } else if (result.token) {
        await login(email, password);
        navigate("/admin/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.verifyMfa(challengeToken, mfaCode);
      await verifyMfa(mfaCode, challengeToken);
      navigate("/admin/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "MFA 验证失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1 className="login-title">KeyTrialPro 管理后台</h1>
        <p className="login-subtitle">请登录以继续</p>

        {error && <div className="login-error">{error}</div>}

        {step === "credentials" ? (
          <form onSubmit={handleCredentials} className="login-form">
            <div className="form-group">
              <label htmlFor="email">管理员邮箱</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">密码</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                required
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
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                pattern="\d{6}"
                required
                autoFocus
              />
              <p className="form-hint">请输入 authenticator 应用中的六位验证码</p>
            </div>
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "验证中..." : "验证"}
            </button>
            <button type="button" className="login-back" onClick={() => setStep("credentials")}>
              返回重新输入密码
            </button>
          </form>
        )}
      </div>
    </div>
  );
}