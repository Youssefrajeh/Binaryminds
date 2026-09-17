interface SectionEntry {
  tag: string;
  title: string;
  copy: string;
}

const sections: SectionEntry[] = [
  {
    tag: "MKT",
    title: "Marketplace",
    copy: "Sell your old textbooks and dorm gear directly to someone in your program — no shipping, no strangers off campus.",
  },
  {
    tag: "L&F",
    title: "Lost & Found",
    copy: "Post what you lost or found, with a photo and where it turned up. Close it out once it's back with its owner.",
  },
  {
    tag: "EVT",
    title: "Campus Events",
    copy: "See what clubs and programs are actually running this week, and RSVP so organizers know who's coming.",
  },
];

export function Sections() {
  return (
    <section className="border-y border-rule">
      <div className="mx-auto grid max-w-5xl divide-y divide-rule md:grid-cols-3 md:divide-x md:divide-y-0">
        {sections.map((section) => (
          <div key={section.tag} className="px-6 py-10 md:px-8">
            <span className="font-mono text-xs tracking-[0.2em] text-stamp">
              {section.tag}
            </span>
            <h2 className="mt-3 font-display text-2xl text-ink">{section.title}</h2>
            <p className="mt-3 font-body text-[0.95rem] leading-relaxed text-ink-soft">
              {section.copy}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
