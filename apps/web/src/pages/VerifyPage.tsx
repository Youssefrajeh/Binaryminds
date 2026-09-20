import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export function VerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const email = (location.state as { email?: string })?.email || "";

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
    setError("");

    const otp = digits.join("");
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/verify", { email, otp });
      login(res.data.token, res.data.user);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  if (!email) {
    return (
      <AuthLayout title="Verification">
        <p className="font-body text-sm text-ink-soft">
          No email provided.{" "}
          <Link to="/register" className="text-pen underline-offset-4 hover:underline">
            Register first
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={`We sent a 6-digit code to ${email}. Check your inbox (and spam folder).`}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="border border-stamp/30 bg-stamp/5 px-4 py-3 font-body text-sm text-stamp">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-3">
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
              className="h-14 w-11 border border-rule bg-paper text-center font-mono text-xl text-ink outline-none transition-colors focus:border-pen"
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-pen py-3 font-body text-sm font-semibold tracking-wide text-paper transition-colors hover:bg-pen-dark disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify"}
        </button>

        <p className="text-center font-body text-xs text-muted">
          Didn't receive the code? Check your spam folder, or{" "}
          <Link to="/register" className="text-pen underline-offset-4 hover:underline">
            try again
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
