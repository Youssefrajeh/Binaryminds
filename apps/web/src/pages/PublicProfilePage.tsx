import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import type { PublicProfileDto } from "@campushub/shared";
import { Nav } from "../components/Nav";
import { Avatar } from "../components/Avatar";
import { MessageButton } from "../components/MessageButton";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export function PublicProfilePage() {
  const { userId } = useParams();
  const { user } = useAuth();
  // Tagged with the id it was fetched for, so navigating to another student
  // shows "loading" until their profile arrives instead of the previous one
  const [result, setResult] = useState<{ userId: string; profile: PublicProfileDto | null; error: string } | null>(null);
  const loading = result?.userId !== userId;
  const profile = loading ? null : result?.profile ?? null;
  const error = loading ? "" : result?.error ?? "";

  useEffect(() => {
    if (!userId || userId === user?.id) return;
    let cancelled = false;
    api
      .get<PublicProfileDto>(`/profile/${userId}`)
      .then((res) => !cancelled && setResult({ userId, profile: res.data, error: "" }))
      .catch(() => !cancelled && setResult({ userId, profile: null, error: "This student could not be found." }));
    return () => {
      cancelled = true;
    };
  }, [userId, user?.id]);

  // Your own public page is just your profile
  if (userId && userId === user?.id) {
    return <Navigate to="/profile" replace />;
  }

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
                  <dl className="mt-3 space-y-1 text-sm">
                    <div><dt className="inline font-medium text-ink">Program: </dt><dd className="inline break-words text-ink-soft">{profile.program || "Not added"}</dd></div>
                    <div><dt className="inline font-medium text-ink">Year of study: </dt><dd className="inline text-ink-soft">{profile.yearOfStudy ? `Year ${profile.yearOfStudy}` : "Not added"}</dd></div>
                  </dl>
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

              {!!profile.courses?.length && <>
                <h2 className="mt-6 text-sm font-semibold text-ink">Courses</h2>
                <ul className="mt-2 flex flex-wrap gap-2">{profile.courses.map((course) => <li key={course} className="rounded-md bg-canvas px-2.5 py-1 text-xs font-medium text-ink-soft">{course}</li>)}</ul>
              </>}
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
