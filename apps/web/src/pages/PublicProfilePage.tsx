import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import type { PublicProfileDto } from "@campushub/shared";
import { Nav } from "../components/Nav";
import { Avatar } from "../components/Avatar";
import { MessageButton } from "../components/MessageButton";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const YEAR_LABELS: Record<number, string> = {
  1: "1st year",
  2: "2nd year",
  3: "3rd year",
  4: "4th year",
};

export function PublicProfilePage() {
  const { userId } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfileDto | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || userId === user?.id) return;
    setLoading(true);
    setError("");
    api
      .get<PublicProfileDto>(`/profile/${userId}`)
      .then((res) => setProfile(res.data))
      .catch(() => setError("This student could not be found."))
      .finally(() => setLoading(false));
  }, [userId, user?.id]);

  // Your own public page is just your profile
  if (userId && userId === user?.id) {
    return <Navigate to="/profile" replace />;
  }

  const details = profile
    ? [profile.program, profile.yearOfStudy ? YEAR_LABELS[profile.yearOfStudy] ?? `Year ${profile.yearOfStudy}` : null].filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Loading profile…</p>
        ) : error || !profile ? (
          <div className="text-center">
            <p className="text-sm text-muted">{error || "This student could not be found."}</p>
            <Link to="/messages" className="link mt-2 inline-block text-sm">
              Back to messages
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
              <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
                <Avatar name={profile.displayName} src={profile.avatarUrl} className="h-28 w-28 text-3xl" />
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-xl font-semibold text-ink">{profile.displayName}</h1>
                  {details.length > 0 && <p className="mt-1 text-sm text-ink">{details.join(" · ")}</p>}
                  <p className="mt-1 text-xs text-muted">
                    Member since{" "}
                    {new Date(profile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  </p>
                  <div className="mt-4">
                    <MessageButton recipientId={profile.id} />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
              <h2 className="text-sm font-semibold text-ink">About</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                {profile.bio || "No bio yet."}
              </p>

              {profile.interests.length > 0 && (
                <>
                  <h2 className="mt-6 text-sm font-semibold text-ink">Interests</h2>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {profile.interests.map((tag) => (
                      <li key={tag} className="rounded-md bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
                        {tag}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
