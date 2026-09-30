import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useLocation } from "react-router";
import type { UserDto } from "@campushub/shared";
import { Nav } from "../components/Nav";
import { Avatar } from "../components/Avatar";
import { useAuth } from "../context/AuthContext";
import { toSquareAvatar } from "../lib/image";
import api from "../lib/api";

const YEAR_LABELS: Record<number, string> = {
  1: "1st year",
  2: "2nd year",
  3: "3rd year",
  4: "4th year",
};

function formatMemberSince(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const location = useLocation();
  const justSaved = (location.state as { saved?: boolean } | null)?.saved === true;

  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(justSaved ? "Profile saved!" : "");
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(true);

  async function refreshUser() {
    const res = await api.get<UserDto>("/profile/me");
    updateUser(res.data);
  }

  useEffect(() => {
    api
      .get<UserDto>("/profile/me")
      .then((res) => updateUser(res.data))
      .catch(() => setError("Failed to load profile"))
      .finally(() => setFetching(false));
  }, [updateUser]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    setSuccess("");
    setUploading(true);
    try {
      const image = await toSquareAvatar(file);
      await api.put("/profile/me/avatar", { image });
      await refreshUser();
      setSuccess("Profile picture updated!");
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to upload picture");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto() {
    setError("");
    setSuccess("");
    setUploading(true);
    try {
      await api.delete("/profile/me/avatar");
      await refreshUser();
      setSuccess("Profile picture removed");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to remove picture");
    } finally {
      setUploading(false);
    }
  }

  const profile = user?.profile ?? null;
  const name = profile?.displayName || user?.email?.split("@")[0] || "Student";
  const details = [
    profile?.program,
    profile?.yearOfStudy ? YEAR_LABELS[profile.yearOfStudy] ?? `Year ${profile.yearOfStudy}` : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Your profile</h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              This is how other Fanshawe students see you on CampusHub.
            </p>
          </div>
          <Link to="/profile/edit" className="btn-secondary shrink-0">
            Edit profile
          </Link>
        </div>

        <div className="mt-6 space-y-3" aria-live="polite">
          {error && <div className="alert-error">{error}</div>}
          {success && <div className="alert-success">{success}</div>}
        </div>

        {fetching && !user ? (
          <p className="mt-8 py-8 text-center text-sm text-muted">Loading profile…</p>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Identity card */}
            <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
              <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
                <div className="relative">
                  <Avatar name={name} src={profile?.avatarUrl} className="h-28 w-28 text-3xl" />
                  {uploading && (
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-xs font-medium text-white">
                      Saving…
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    aria-label="Change profile picture"
                    className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-brand text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-semibold text-ink">{name}</h2>
                  <p className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm text-ink-soft sm:justify-start">
                    <span className="truncate">{user?.email}</span>
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                      Verified
                    </span>
                  </p>
                  {details.length > 0 && (
                    <p className="mt-2 text-sm text-ink">{details.join(" · ")}</p>
                  )}
                  {user?.createdAt && (
                    <p className="mt-1 text-xs text-muted">
                      Member since {formatMemberSince(user.createdAt)}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm sm:justify-start">
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      disabled={uploading}
                      className="link disabled:opacity-60"
                    >
                      {profile?.avatarUrl ? "Change photo" : "Upload photo"}
                    </button>
                    {profile?.avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={uploading}
                        className="font-medium text-muted underline-offset-4 hover:text-danger hover:underline disabled:opacity-60"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* About */}
            <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
              <h3 className="text-sm font-semibold text-ink">About</h3>
              {profile?.bio ? (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{profile.bio}</p>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  No bio yet.{" "}
                  <Link to="/profile/edit" className="link">
                    Add one
                  </Link>
                </p>
              )}

              <h3 className="mt-6 text-sm font-semibold text-ink">Interests</h3>
              {profile?.interests?.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {profile.interests.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-md bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  No interests added.{" "}
                  <Link to="/profile/edit" className="link">
                    Add some
                  </Link>
                </p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
