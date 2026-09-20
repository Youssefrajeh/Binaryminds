import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "../components/AuthLayout";
import api from "../lib/api";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/auth/forgot-password", { email });
      navigate("/reset-password", { state: { email } });
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset code."
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

        <div>
          <label htmlFor="forgot-email" className="mb-1.5 block font-body text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            required
            placeholder="you@fanshaweonline.ca"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pen"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-pen py-3 font-body text-sm font-semibold tracking-wide text-paper transition-colors hover:bg-pen-dark disabled:opacity-50"
        >
          {loading ? "Sending code…" : "Send reset code"}
        </button>
      </form>
    </AuthLayout>
  );
}
