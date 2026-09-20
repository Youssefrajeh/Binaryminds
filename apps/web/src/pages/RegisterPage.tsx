import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "../components/AuthLayout";
import api from "../lib/api";

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

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
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
          <label htmlFor="register-email" className="mb-1.5 block font-body text-sm font-medium text-ink">
            Fanshawe email
          </label>
          <input
            id="register-email"
            type="email"
            required
            placeholder="you@fanshaweonline.ca"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pen"
          />
        </div>

        <div>
          <label htmlFor="register-password" className="mb-1.5 block font-body text-sm font-medium text-ink">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            required
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pen"
          />
        </div>

        <div>
          <label htmlFor="register-confirm" className="mb-1.5 block font-body text-sm font-medium text-ink">
            Confirm password
          </label>
          <input
            id="register-confirm"
            type="password"
            required
            placeholder="Re-enter your password"
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
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>
    </AuthLayout>
  );
}
