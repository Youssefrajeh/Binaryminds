import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
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
      const msg = err.response?.data?.error || "Something went wrong";
      if (msg.includes("verify your email")) {
        setError(msg);
      } else {
        setError(msg);
      }
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
          <Link to="/register" className="text-pen underline-offset-4 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="border border-stamp/30 bg-stamp/5 px-4 py-3 font-body text-sm text-stamp">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="login-email" className="mb-1.5 block font-body text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            placeholder="you@fanshaweonline.ca"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pen"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="font-body text-sm font-medium text-ink">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="font-body text-xs text-muted underline-offset-4 hover:text-pen hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            required
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pen"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-pen py-3 font-body text-sm font-semibold tracking-wide text-paper transition-colors hover:bg-pen-dark disabled:opacity-50"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
