import { isStrongPassword } from "@campushub/shared";
import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import { AuthLayout } from "../components/AuthLayout";
import { PasswordInput } from "../components/PasswordInput";
import { PasswordChecklist } from "../components/PasswordChecklist";
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
        {success && (
          <div className="alert-success">
            {success}
          </div>
        )}

        <div>
          <label htmlFor="reset-email" className="field-label">
            Email
          </label>
          <input
            id="reset-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </div>

        <div>
          <label htmlFor="reset-otp" className="field-label">
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
            className="field-input"
          />
        </div>

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
            className="field-input"
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
