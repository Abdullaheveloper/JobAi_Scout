import { useState } from "react";

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  error: string | null;
  loading: boolean;
}

export function LoginForm({ onLogin, error, loading }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    await onLogin(email.trim().toLowerCase(), password);
  };

  return (
    <div className="login-area">
      <div className="login-header">
        <h2>Sign in to JobAI Scout</h2>
        <p>Use your JobAI Scout website credentials to connect your account.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && <div className="alert">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="gradient-btn"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <button
          type="button"
          className="secondary"
          style={{ marginTop: 10 }}
        >
          Continue with Google
        </button>
      </form>
    </div>
  );
}
