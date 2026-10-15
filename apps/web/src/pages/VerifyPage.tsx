import { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const email = (location.state as { email?: string })?.email || "";

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const lastSubmittedOtp = useRef<string>("");
  const isSubmitting = useRef(false);

  /* Tick the resend cooldown down once a second */
  const cooling = cooldown > 0;
  useEffect(() => {
    if (!cooling) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooling]);

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setError("");
    setResendMessage("");
    setResending(true);
    try {
      await api.post("/auth/resend-verification", { email });
      setResendMessage("A new code is on its way. It can take a few minutes to arrive.");
    } catch (err: any) {
      setError(err.response?.data?.error || "Could not resend the code");
    } finally {
      setResending(false);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }

  /* Auto-submit when all 6 digits are filled */
  const submitOtp = useCallback(async (otp: string) => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/verify", { email, otp });
      login(res.data.token, res.data.user);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || "Verification failed");
    } finally {
      isSubmitting.current = false;
      setLoading(false);
    }
  }, [email, login, navigate]);

  useEffect(() => {
    const otp = digits.join("");
    if (otp.length === 6 && otp !== lastSubmittedOtp.current) {
      lastSubmittedOtp.current = otp;
      submitOtp(otp);
    } else if (otp.length < 6) {
      lastSubmittedOtp.current = "";
    }
  }, [digits, submitOtp]);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const otp = digits.join("");
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }
    submitOtp(otp);
  }

  if (!email) {
    return (
      <AuthLayout title="Verification">
        <p className="text-sm text-ink-soft">
          No email provided.{" "}
          <Link to="/register" className="link">
            Register first
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={`We sent a 6-digit code to ${email}. Fanshawe email can take a few minutes to arrive — check Junk too.`}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
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
              onChange={(e) => handleChange(i, e.target.value)}
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
          {loading ? "Verifying…" : "Verify"}
        </button>

        <div className="text-center text-xs text-muted">
          {resendMessage && (
            <p className="mb-2" role="status">
              {resendMessage}
            </p>
          )}
          <span>Didn't receive the code? </span>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            className="link disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline"
          >
            {resending
              ? "Sending…"
              : cooldown > 0
                ? `Resend code in ${cooldown}s`
                : "Resend code"}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
