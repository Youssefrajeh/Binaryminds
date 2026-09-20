import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import { AuthLayout } from "../components/AuthLayout";
import api from "../lib/api";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromState = (location.state as { email?: string })?.email || "";

  const [email, setEmail] = useState(emailFromState);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/reset-password", { email, otp, newPassword });
      setSuccess(res.data.message);
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the code we sent to your email, then choose a new password."
      footer={
        <>
          Remember your password?{" "}
          <Link to="/login" className="text-pen underline-offset-4 hover:underline">
            Log in
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
        {success && (
          <div className="border border-pen/30 bg-pen/5 px-4 py-3 font-body text-sm text-pen">
            {success}
          </div>
        )}

        <div>
          <label htmlFor="reset-email" className="mb-1.5 block font-body text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="reset-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pen"
          />
        </div>

        <div>
          <label htmlFor="reset-otp" className="mb-1.5 block font-body text-sm font-medium text-ink">
            Reset code
          </label>
          <input
            id="reset-otp"
            type="text"
            inputMode="numeric"
            required
            maxLength={6}
            placeholder="6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full border border-rule bg-paper px-4 py-2.5 font-mono text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pen"
          />
        </div>

        <div>
          <label htmlFor="reset-password" className="mb-1.5 block font-body text-sm font-medium text-ink">
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            required
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pen"
          />
        </div>

        <div>
          <label htmlFor="reset-confirm" className="mb-1.5 block font-body text-sm font-medium text-ink">
            Confirm new password
          </label>
          <input
            id="reset-confirm"
            type="password"
            required
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pen"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-pen py-3 font-body text-sm font-semibold tracking-wide text-paper transition-colors hover:bg-pen-dark disabled:opacity-50"
        >
          {loading ? "Resetting…" : "Reset password"}
        </button>
      </form>
    </AuthLayout>
  );
}
