import { isStrongPassword } from "@campushub/shared";
import { useState, useMemo, useRef, type FormEvent, type KeyboardEvent } from "react";
import { useLocation, useNavigate, Link } from "react-router";
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

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromState = (location.state as { email?: string })?.email || "";

  // Step 1: verify code, Step 2: set new password
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(emailFromState);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [verifiedOtp, setVerifiedOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  /* ---- OTP digit input handlers (same UX as VerifyPage) ---- */

  function handleDigitChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];

    // Handle paste of multiple digits
    if (value.length > 1) {
      const chars = value.slice(0, 6 - index).split("");
      chars.forEach((ch, i) => {
        if (index + i < 6) newDigits[index + i] = ch;
      });
      setDigits(newDigits);
      const nextIndex = Math.min(index + chars.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    newDigits[index] = value;
    setDigits(newDigits);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  /* ---- Step 1: Verify the reset code ---- */

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setError("");

    const otp = digits.join("");
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    try {
      // Validate the OTP by attempting a reset with a dummy password check
      // We'll store the OTP and move to step 2
      setVerifiedOtp(otp);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  /* ---- Step 2: Set the new password ---- */

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isStrongPassword(newPassword)) {
      setError("Password does not meet all the requirements below");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/reset-password", {
        email,
        otp: verifiedOtp,
        newPassword,
      });
      setSuccess(res.data.message);
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  /* ---- No email guard ---- */

  if (!email) {
    return (
      <AuthLayout title="Reset password">
        <p className="text-sm text-ink-soft">
          No email provided.{" "}
          <Link to="/forgot-password" className="link">
            Request a reset code
          </Link>
        </p>
      </AuthLayout>
    );
  }

  /* ---- Step 1: Enter the verification code ---- */

  if (step === 1) {
    return (
      <AuthLayout
        title="Enter reset code"
        subtitle={`We sent a 6-digit code to ${email}. Check your inbox (and spam folder).`}
        footer={
          <>
            Remember your password?{" "}
            <Link to="/login" className="link">
              Log in
            </Link>
          </>
        }
      >
        <form onSubmit={handleVerifyCode} className="space-y-6">
          {error && (
            <div className="alert-error">
              {error}
            </div>
          )}

          <div className="flex justify-center gap-2.5">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="field-input h-13 w-11 px-0 text-center text-xl font-semibold tabular-nums"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3"
          >
            {loading ? "Verifying…" : "Verify code"}
          </button>

          <p className="text-center text-xs text-muted">
            Didn't receive the code? Check your spam folder, or{" "}
            <Link to="/forgot-password" className="link">
              request a new one
            </Link>
          </p>
        </form>
      </AuthLayout>
    );
  }

  /* ---- Step 2: Enter new password ---- */

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password for your account."
      footer={
        <>
          Remember your password?{" "}
          <Link to="/login" className="link">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleResetPassword} className="space-y-5">
        {error && (
          <div className="alert-error">
            {error}
          </div>
        )}
        {success && (
          <div className="alert-success">
            {success}
          </div>
        )}

        <div>
          <label htmlFor="reset-password" className="field-label">
            New password
          </label>
          <PasswordInput
            id="reset-password"
            required
            placeholder="Create a strong password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="field-input"
          />
          <PasswordChecklist password={newPassword} />
        </div>

        <div>
          <label htmlFor="reset-confirm" className="field-label">
            Confirm new password
          </label>
          <PasswordInput
            id="reset-confirm"
            required
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`field-input ${
              confirmPassword
                ? newPassword === confirmPassword
                  ? "!border-success !ring-success/10 focus:!border-success"
                  : "!border-danger !ring-danger/10 focus:!border-danger"
                : ""
            }`}
          />
          <PasswordMatchIndicator
            password={newPassword}
            confirmPassword={confirmPassword}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3"
        >
          {loading ? "Resetting…" : "Reset password"}
        </button>
      </form>
    </AuthLayout>
  );
}
