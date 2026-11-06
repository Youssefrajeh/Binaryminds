import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
import { PasswordInput } from "../components/PasswordInput";
import { FanshaweEmailInput } from "../components/FanshaweEmailInput";
import { LoginMascot, type MascotMood } from "../components/LoginMascot";
import api from "../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("expired") === "true";
  const suspendedSession = searchParams.get("suspended") === "true";
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [reaction, setReaction] = useState<"error" | "success" | null>(null);

  const mood: MascotMood =
    reaction ??
    (focused === "password" ? (passwordVisible ? "peeking" : "hiding") : focused === "email" ? "watching" : "idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email) {
      setError("Enter your Fanshawe ID, e.g. y_rajeh");
      return;
    }
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password });
      setReaction("success");
      // Give the happy bounce a moment before leaving the page
      setTimeout(() => {
        login(res.data.token, res.data.user);
        navigate("/", { replace: true });
      }, 550);
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.code === "ACCOUNT_SUSPENDED"
        ? `Your account is suspended.${data.reason ? ` Reason: ${data.reason}${/[.!?]$/.test(data.reason) ? "" : "."}` : ""} Contact a campus-hub administrator if you think this is a mistake.`
        : data?.error || "Something went wrong");
      setReaction("error");
      setTimeout(() => setReaction(null), 700);
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your campus-hub account."
      hero={<LoginMascot mood={mood} lookAt={email.replace(/@.*/, "").length / 28} />}
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
        {suspendedSession && !error && (
          <div role="alert" className="alert-error">
            Your account is suspended, so you've been signed out. Contact a campus-hub administrator if you think this is a mistake.
          </div>
        )}

        {sessionExpired && !suspendedSession && !error && (
          <div className="alert-info">
            Your session expired after 10 minutes of inactivity. Please log in again.
          </div>
        )}

        {error && (
          <div role="alert" className="alert-error">
            {error}
          </div>
        )}

        <FanshaweEmailInput
          id="login-email"
          required
          value={email}
          onChange={setEmail}
          onFocus={() => setFocused("email")}
          onBlur={() => setFocused(null)}
        />

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
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            onVisibilityChange={setPasswordVisible}
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
