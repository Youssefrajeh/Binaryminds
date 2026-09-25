import { isStrongPassword } from "@campushub/shared";
import { useState, useMemo, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "../components/AuthLayout";
import { PasswordInput } from "../components/PasswordInput";
import { PasswordChecklist } from "../components/PasswordChecklist";
import api from "../lib/api";

/* ------------------------------------------------------------------ */
/*  Password-match indicator with animated checkmark + shimmer         */
/* ------------------------------------------------------------------ */

function PasswordMatchIndicator({
  password,
  confirmPassword,
}: {
  password: string;
  confirmPassword: string;
}) {
  const status = useMemo(() => {
    if (!confirmPassword) return "idle";
    if (password === confirmPassword) return "match";
    return "mismatch";
  }, [password, confirmPassword]);

  if (status === "idle") return null;

  return (
    <div
      className={`mt-2.5 flex items-center gap-2 text-xs font-medium transition-all duration-300 ${
        status === "match" ? "text-success" : "text-danger"
      }`}
      style={{
        animation:
          status === "match" ? "matchReveal 0.5s ease-out both" : "none",
      }}
    >
      {status === "match" ? (
        <>
          {/* Animated checkmark circle */}
          <span className="password-match-icon">
            <svg
              viewBox="0 0 36 36"
              fill="none"
              style={{ width: 22, height: 22 }}
            >
              {/* Background circle with draw animation */}
              <circle
                cx="18"
                cy="18"
                r="16"
                stroke="var(--success)"
                strokeWidth="2"
                fill="var(--success-soft)"
                style={{
                  strokeDasharray: 100.5,
                  strokeDashoffset: 100.5,
                  animation: "drawCircle 0.4s ease-out 0.1s forwards",
                }}
              />
              {/* Checkmark with draw animation */}
              <path
                d="M11 18.5L16 23L25 13"
                stroke="var(--success)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 22,
                  strokeDashoffset: 22,
                  animation: "drawCheck 0.3s ease-out 0.45s forwards",
                }}
              />
            </svg>
          </span>
          <span className="password-match-text">Passwords match!</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: 14, lineHeight: 1 }}>○</span>
          <span>Passwords don't match yet</span>
        </>
      )}
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.toLowerCase().endsWith("@fanshaweonline.ca")) {
      setError("Please use your Fanshawe student email (@fanshaweonline.ca)");
      return;
    }

    if (!isStrongPassword(password)) {
      setError("Password does not meet all the requirements below");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/register", { email, password });
      navigate("/verify", { state: { email } });
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Only verified Fanshawe College students can join CampusHub."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="link">
            Log in
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
          <label htmlFor="register-email" className="field-label">
            Fanshawe email
          </label>
          <input
            id="register-email"
            type="email"
            required
            autoComplete="off"
            placeholder="you@fanshaweonline.ca"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </div>

        <div>
          <label htmlFor="register-password" className="field-label">
            Password
          </label>
          <PasswordInput
            id="register-password"
            required
            autoComplete="new-password"
            placeholder="Create a strong password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
          />
          <PasswordChecklist password={password} />
        </div>

        <div>
          <label htmlFor="register-confirm" className="field-label">
            Confirm password
          </label>
          <PasswordInput
            id="register-confirm"
            required
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`field-input ${
              confirmPassword
                ? password === confirmPassword
                  ? "!border-success !ring-success/10 focus:!border-success"
                  : "!border-danger !ring-danger/10 focus:!border-danger"
                : ""
            }`}
          />
          <PasswordMatchIndicator
            password={password}
            confirmPassword={confirmPassword}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>
    </AuthLayout>
  );
}
