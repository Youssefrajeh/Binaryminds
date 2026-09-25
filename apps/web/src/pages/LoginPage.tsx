import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
import { PasswordInput } from "../components/PasswordInput";
import api from "../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password });
      login(res.data.token, res.data.user);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your CampusHub account."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" className="link">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="alert-error">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="login-email" className="field-label">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            placeholder="you@fanshaweonline.ca"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm font-medium text-ink">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-brand hover:underline underline-offset-4"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            required
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
