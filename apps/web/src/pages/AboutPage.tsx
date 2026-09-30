import { Link } from "react-router";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { LogoMark } from "../components/Logo";
import { useAuth } from "../context/AuthContext";

const principles = [
  {
    title: "Verified students only",
    body: "Every account is tied to a verified @fanshaweonline.ca email address. When you message someone, join a study group or arrange to meet, you know you are dealing with another Fanshawe student.",
  },
  {
    title: "Built around student life",
    body: "There is no feed to scroll and nothing competing for your attention. campus-hub is organised around the things students actually need to get done, so nothing important gets buried.",
  },
  {
    title: "Your information stays yours",
    body: "We collect only what the platform needs to work, we do not sell personal information, and there are no ads. You choose what goes on your profile.",
  },
];

const availableNow = [
  { title: "Verified accounts", body: "Sign up with your Fanshawe email and confirm it with a one-time code." },
  { title: "Student profiles", body: "Add your program, year, interests and a photo so classmates can find you." },
  { title: "Messages", body: "Chat one-to-one in real time. First messages arrive as requests you can accept, ignore or block." },
  { title: "Study groups", body: "Create or join a group for your course. Every group has its own chat." },
];

const comingNext = [
  { title: "Marketplace", body: "Buy and sell textbooks and supplies, and meet on campus instead of shipping." },
  { title: "Lost & Found", body: "Post what you lost or found with a photo and location." },
  { title: "Campus events", body: "See what clubs and programs are running, and RSVP." },
];

export function AboutPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Nav />
      <main>
        {/* Intro */}
        <section className="mx-auto max-w-3xl px-6 pt-16 pb-14 text-center sm:pt-20">
          <LogoMark className="mx-auto h-16 w-22" />
          <p className="mt-6 text-sm font-semibold tracking-wide text-brand uppercase">About campus-hub</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            One place for Fanshawe student life
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            campus-hub is a platform built by Fanshawe students, for Fanshawe students. It replaces the scattered
            mix of Facebook groups, Discord servers and Instagram posts that students rely on to get through the
            school year.
          </p>
        </section>

        {/* Why */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-3xl px-6 py-14">
            <h2 className="text-xl font-semibold text-ink">Why we built it</h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-ink-soft">
              <p>
                Finding a study partner, selling last term's textbook or tracking down a lost student card usually
                means posting in three different apps and hoping the right person sees it. Those spaces are open
                to anyone, the posts disappear down a feed within hours, and you rarely know who you are talking
                to.
              </p>
              <p>
                We wanted something simpler: a single, trusted space where everyone is a verified Fanshawe
                student and everything is organised around what students need, not around keeping people
                scrolling.
              </p>
            </div>
          </div>
        </section>

        {/* Principles */}
        <section className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-xl font-semibold text-ink">What makes it different</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {principles.map((item) => (
              <div key={item.title} className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                <h3 className="text-base font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-14 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold text-ink">What you can do today</h2>
              <ul className="mt-5 space-y-4">
                {availableNow.map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <svg viewBox="0 0 16 16" className="mt-1 h-4 w-4 shrink-0 text-success" fill="currentColor" aria-hidden="true">
                      <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm3.78 5.28-4.5 5a.75.75 0 0 1-1.06.02l-2-2a.75.75 0 1 1 1.06-1.06l1.46 1.46 3.97-4.42a.75.75 0 0 1 1.07 1Z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-ink">Coming next</h2>
              <ul className="mt-5 space-y-4">
                {comingNext.map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--logo-accent)]" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="mx-auto max-w-3xl px-6 py-14">
          <h2 className="text-xl font-semibold text-ink">Who is behind it</h2>
          <div className="mt-4 space-y-4 text-base leading-relaxed text-ink-soft">
            <p>
              campus-hub is designed and built by <span className="font-medium text-ink">Binary Minds</span>, a
              team of three Fanshawe College students, as our project for the INFO-5103 course in Fall 2026. We
              are students building the tool we wished we had.
            </p>
            <p>
              campus-hub is an independent student project. It is not affiliated with, operated by, or endorsed by
              Fanshawe College. How we run the platform and handle your information is set out in our{" "}
              <Link to="/terms" className="link">
                Terms and Conditions
              </Link>
              .
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-ink">
              {isAuthenticated ? "Find your people" : "Join your classmates"}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              {isAuthenticated
                ? "Start or join a study group for your course."
                : "All you need is your Fanshawe student email."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {isAuthenticated ? (
                <Link to="/study-groups" className="btn-primary px-6">
                  Browse study groups
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn-primary px-6">
                    Get started
                  </Link>
                  <Link to="/login" className="btn-secondary px-6">
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
