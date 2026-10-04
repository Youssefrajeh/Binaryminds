import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Nav } from "../components/Nav";
import { Avatar } from "../components/Avatar";
import { MessageButton } from "../components/MessageButton";
import api from "../lib/api";

export interface MemberResult {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  program: string | null;
}

const MIN_QUERY_LENGTH = 2;

export function MembersPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_QUERY_LENGTH;

  useEffect(() => {
    if (tooShort) return;

    let cancelled = false;
    // Wait for the user to pause typing before hitting the API
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get<MemberResult[]>("/profile/search", { params: { q: trimmed } });
        if (cancelled) return;
        setResults(res.data);
        setSearched(true);
      } catch (err: any) {
        if (cancelled) return;
        setError(err.response?.data?.error || "Could not search for students");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, tooShort]);

  const showResults = !tooShort && searched;

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="text-4xl font-bold">Find students</h1>
        <p className="mt-2 text-lg text-muted">Search for a Fanshawe student by name to view their profile or send a message.</p>

        <label htmlFor="member-search" className="sr-only">
          Search students by name
        </label>
        <input
          id="member-search"
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="mt-8 w-full rounded-lg border border-line bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
        />

        {error && <div className="alert-error mt-6">{error}</div>}

        {!error && tooShort && trimmed.length > 0 && (
          <p className="mt-6 text-sm text-ink-soft">Type at least {MIN_QUERY_LENGTH} characters to search.</p>
        )}

        {!error && !tooShort && loading && <p className="mt-6 text-sm text-ink-soft">Searching…</p>}

        {!error && showResults && !loading && results.length === 0 && (
          <p className="mt-6 text-sm text-ink-soft">No students found for “{trimmed}”.</p>
        )}

        {!error && !tooShort && results.length > 0 && (
          <ul className="mt-6 space-y-3" aria-label="Search results">
            {results.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm"
              >
                <Link to={`/u/${member.id}`} className="flex min-w-0 items-center gap-3 hover:opacity-90">
                  <Avatar name={member.displayName} src={member.avatarUrl} className="h-11 w-11 text-sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{member.displayName}</span>
                    {member.program && <span className="block truncate text-sm text-ink-soft">{member.program}</span>}
                  </span>
                </Link>
                <MessageButton recipientId={member.id} className="btn-secondary shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
