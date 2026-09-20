import { useState, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { Nav } from "../components/Nav";
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

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Your profile</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          This is how other Fanshawe students see you on CampusHub.
        </p>

        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          {fetching ? (
            <p className="py-8 text-center text-sm text-muted">Loading profile…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
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

          <div className="rounded-lg bg-canvas px-4 py-3">
            <p className="text-xs font-medium text-muted">Email</p>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-ink">
              {user?.email}
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                Verified
              </span>
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-name" className="field-label">
                Display name *
              </label>
              <input
                id="profile-name"
                type="text"
                required
                maxLength={50}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="field-input"
              />
            </div>

            <div>
              <label htmlFor="profile-program" className="field-label">
                Program
              </label>
              <input
                id="profile-program"
                type="text"
                maxLength={100}
                placeholder="e.g. Computer Programming"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                className="field-input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="profile-year" className="field-label">
              Year of study
            </label>
            <select
              id="profile-year"
              value={yearOfStudy}
              onChange={(e) => setYearOfStudy(e.target.value)}
              className="field-input"
            >
              <option value="">Select year</option>
              <option value="1">1st year</option>
              <option value="2">2nd year</option>
              <option value="3">3rd year</option>
              <option value="4">4th year</option>
            </select>
          </div>

          <div>
            <label htmlFor="profile-bio" className="field-label">
              Bio
            </label>
            <textarea
              id="profile-bio"
              rows={3}
              maxLength={500}
              placeholder="Tell other students about yourself…"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="field-input resize-none"
            />
            <p className="mt-1 text-right text-xs text-muted">{bio.length}/500</p>
          </div>

          <div>
            <label htmlFor="profile-interests" className="field-label">
              Interests
            </label>
            <div className="flex min-h-11 flex-wrap gap-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-xs transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
              {interests.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeInterest(tag)}
                    className="ml-0.5 text-brand/60 transition-colors hover:text-brand"
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
                className="min-w-30 flex-1 border-none bg-transparent py-1 text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
            <p className="mt-1 text-xs text-muted">
              Press Enter or comma to add. {interests.length}/10
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-6"
          >
            {loading ? "Saving…" : "Save profile"}
          </button>
        </form>
          )}
        </div>
      </main>
    </div>
  );
}
