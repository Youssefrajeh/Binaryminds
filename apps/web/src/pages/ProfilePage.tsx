import { useState, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export function ProfilePage() {
  const { user, updateUser } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [program, setProgram] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.get("/profile/me");
        const data = res.data;
        if (data.profile) {
          setDisplayName(data.profile.displayName || "");
          setProgram(data.profile.program || "");
          setYearOfStudy(data.profile.yearOfStudy?.toString() || "");
          setBio(data.profile.bio || "");
          setInterests(data.profile.interests || []);
        }
      } catch {
        setError("Failed to load profile");
      } finally {
        setFetching(false);
      }
    }
    loadProfile();
  }, []);

  function handleInterestKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && interestInput.trim()) {
      e.preventDefault();
      const tag = interestInput.trim().toLowerCase();
      if (!interests.includes(tag) && interests.length < 10) {
        setInterests([...interests, tag]);
      }
      setInterestInput("");
    }
    if (e.key === "Backspace" && !interestInput && interests.length > 0) {
      setInterests(interests.slice(0, -1));
    }
  }

  function removeInterest(tag: string) {
    setInterests(interests.filter((t) => t !== tag));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }

    setLoading(true);
    try {
      await api.put("/profile/me", {
        displayName: displayName.trim(),
        program: program.trim() || null,
        yearOfStudy: yearOfStudy ? parseInt(yearOfStudy, 10) : null,
        bio: bio.trim() || null,
        interests,
      });

      const profileRes = await api.get("/profile/me");
      updateUser(profileRes.data);

      setSuccess("Profile saved!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="flex min-h-screen flex-col bg-paper">
        <header className="border-b border-rule">
          <div className="mx-auto flex max-w-5xl items-center px-6 py-4">
            <Link to="/" className="font-mono text-sm font-bold tracking-[0.12em] text-ink">
              CAMPUSHUB
            </Link>
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center">
          <p className="font-body text-sm text-muted">Loading profile…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-mono text-sm font-bold tracking-[0.12em] text-ink">
            CAMPUSHUB
          </Link>
          <Link
            to="/"
            className="font-body text-sm text-ink-soft underline-offset-4 transition-colors hover:text-pen hover:underline"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-12">
        <h1 className="font-display text-3xl font-medium text-ink">Your Profile</h1>
        <p className="mt-2 font-body text-sm text-ink-soft">
          This is how other Fanshawe students see you on CampusHub.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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

          <div className="border border-rule bg-paper p-6 shadow-sm">
            <p className="mb-1 font-body text-xs font-medium uppercase tracking-wider text-muted">Email</p>
            <p className="font-body text-sm text-ink">{user?.email}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-name" className="mb-1.5 block font-body text-sm font-medium text-ink">
                Display name *
              </label>
              <input
                id="profile-name"
                type="text"
                required
                maxLength={50}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full border border-rule bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pen"
              />
            </div>

            <div>
              <label htmlFor="profile-program" className="mb-1.5 block font-body text-sm font-medium text-ink">
                Program
              </label>
              <input
                id="profile-program"
                type="text"
                maxLength={100}
                placeholder="e.g. Computer Programming"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                className="w-full border border-rule bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pen"
              />
            </div>
          </div>

          <div>
            <label htmlFor="profile-year" className="mb-1.5 block font-body text-sm font-medium text-ink">
              Year of study
            </label>
            <select
              id="profile-year"
              value={yearOfStudy}
              onChange={(e) => setYearOfStudy(e.target.value)}
              className="w-full border border-rule bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none transition-colors focus:border-pen"
            >
              <option value="">Select year</option>
              <option value="1">1st year</option>
              <option value="2">2nd year</option>
              <option value="3">3rd year</option>
              <option value="4">4th year</option>
            </select>
          </div>

          <div>
            <label htmlFor="profile-bio" className="mb-1.5 block font-body text-sm font-medium text-ink">
              Bio
            </label>
            <textarea
              id="profile-bio"
              rows={3}
              maxLength={500}
              placeholder="Tell other students about yourself…"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full resize-none border border-rule bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pen"
            />
            <p className="mt-1 text-right font-body text-xs text-muted">{bio.length}/500</p>
          </div>

          <div>
            <label htmlFor="profile-interests" className="mb-1.5 block font-body text-sm font-medium text-ink">
              Interests
            </label>
            <div className="flex min-h-[44px] flex-wrap gap-2 border border-rule bg-paper px-3 py-2 transition-colors focus-within:border-pen">
              {interests.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-pen/10 px-2.5 py-1 font-mono text-xs text-pen"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeInterest(tag)}
                    className="ml-0.5 text-pen/60 transition-colors hover:text-pen"
                    aria-label={`Remove ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                id="profile-interests"
                type="text"
                placeholder={interests.length === 0 ? "Type and press Enter…" : ""}
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={handleInterestKeyDown}
                className="min-w-[120px] flex-1 border-none bg-transparent py-1 font-body text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
            <p className="mt-1 font-body text-xs text-muted">
              Press Enter or comma to add. {interests.length}/10
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-pen px-8 py-3 font-body text-sm font-semibold tracking-wide text-paper transition-colors hover:bg-pen-dark disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save profile"}
          </button>
        </form>
      </main>
    </div>
  );
}
