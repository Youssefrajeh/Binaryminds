import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";

const EFFECTIVE_DATE = "September 30, 2026";
// Set this to the address students should use for questions, reports and privacy requests
const CONTACT_EMAIL = "";

type Block = string | string[];

interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

const sections: Section[] = [
  {
    id: "about",
    title: "1. About campus-hub and these Terms",
    blocks: [
      "campus-hub is a student-built community platform for Fanshawe College students. It is developed and operated by Binary Minds, a team of Fanshawe students (\"we\", \"us\", \"our\"), as a course project. campus-hub is not affiliated with, operated by, or endorsed by Fanshawe College.",
      "These Terms and Conditions (the \"Terms\") are a legal agreement between you and us. By creating an account or using campus-hub, you agree to these Terms. If you do not agree, please do not use campus-hub.",
    ],
  },
  {
    id: "eligibility",
    title: "2. Who can use campus-hub",
    blocks: [
      "To create an account you must be a current Fanshawe College student with a valid @fanshaweonline.ca email address, and you must verify that address with the code we send you.",
      "You must be able to form a binding contract. In Ontario the age of majority is 18. If you are under 18, you may use campus-hub only with the permission of a parent or legal guardian who agrees to these Terms on your behalf.",
      "One person, one account. You may not create an account for someone else or use another person's email address.",
    ],
  },
  {
    id: "account",
    title: "3. Your account",
    blocks: [
      [
        "Provide accurate information and keep your profile up to date.",
        "Keep your password confidential. You are responsible for activity that happens under your account.",
        "Tell us promptly if you believe someone else has accessed your account.",
        "You may stop using campus-hub at any time and may ask us to delete your account and the personal information associated with it.",
      ],
    ],
  },
  {
    id: "conduct",
    title: "4. Acceptable use",
    blocks: [
      "campus-hub only works if students can trust each other. You agree that you will not:",
      [
        "break any law that applies to you, including the Criminal Code of Canada and Ontario law;",
        "harass, threaten, bully, stalk or discriminate against anyone, including on grounds protected by the Ontario Human Rights Code;",
        "post content that is hateful, sexually explicit, violent, defamatory, or that invades someone's privacy;",
        "impersonate another person or misrepresent your connection to Fanshawe College or any organization;",
        "post or share someone else's personal information without their consent;",
        "send spam, chain messages, or unsolicited advertising;",
        "upload malware, attempt to gain unauthorized access, scrape data, or interfere with how campus-hub operates;",
        "use campus-hub to commit or help with academic misconduct, such as buying, selling or sharing assignments, tests or exam answers in breach of Fanshawe College policy.",
      ],
      "You also remain bound by Fanshawe College's own policies, including its Student Code of Conduct, when you interact with other students here.",
    ],
  },
  {
    id: "content",
    title: "5. Content you post",
    blocks: [
      "You keep ownership of what you post, including your profile, photos, messages, study group posts, listings and lost and found posts (\"your content\").",
      "So that we can run the service, you give us a non-exclusive, royalty-free, worldwide licence to host, store, reproduce and display your content on campus-hub, only for the purpose of operating and improving it. This licence ends when your content is deleted, except for copies kept in routine backups for a limited time.",
      "You are responsible for your content. Only post things you have the right to share, and do not post content that infringes anyone's copyright, trademark or other rights.",
      "We do not review everything that is posted, but we may remove content or restrict accounts that we reasonably believe break these Terms or the law.",
    ],
  },
  {
    id: "messaging",
    title: "6. Messages and study groups",
    blocks: [
      "You can send direct messages to other students and chat in study groups you join. A first message to someone you have not talked to arrives as a request that they can accept, ignore or block.",
      "Messages are stored on our servers so that they can be delivered and shown in your conversations. They are not end-to-end encrypted. Do not share passwords, banking details or other sensitive information in messages.",
      "We do not routinely read private messages. We may access them when it is necessary to investigate a report, keep the service secure, or comply with a legal obligation.",
    ],
  },
  {
    id: "marketplace",
    title: "7. Marketplace, lost and found, and meeting in person",
    blocks: [
      "campus-hub lets students list items, post lost and found notices and arrange to meet. We only provide the place to connect. We are not a party to any sale, exchange or other arrangement between students, we do not handle payments, and we do not verify, inspect or guarantee any item, listing or user.",
      "You may not list or trade anything that is illegal to sell or possess, or that is unsafe or restricted, including weapons, alcohol, tobacco and vaping products, cannabis, prescription or illegal drugs, stolen or counterfeit goods, and recalled products.",
      "Dealings with other students are at your own risk. When meeting someone, choose a public, well-lit place on campus, consider bringing a friend, and inspect items before paying. If you feel unsafe, contact Campus Security or, in an emergency, call 911.",
    ],
  },
  {
    id: "privacy",
    title: "8. Privacy",
    blocks: [
      "We handle personal information in line with the principles of Canada's Personal Information Protection and Electronic Documents Act (PIPEDA). In summary:",
      [
        "What we collect: your Fanshawe email address, your password (stored only in hashed form), the profile details and photo you choose to add, and the content and messages you create.",
        "Why: to verify that you are a Fanshawe student, run your account, show your profile to other students, deliver messages, and keep the service safe.",
        "Sharing: we do not sell your personal information. Your profile is visible to other signed-in students. We use service providers for hosting, database storage and email delivery, and may disclose information where the law requires it.",
        "Where it is stored: our service providers may store and process information on servers outside Canada, including in the United States, where it is subject to the laws of that country.",
        "Your choices: you can see and edit your profile at any time, and you can ask us for access to, correction of, or deletion of your personal information.",
        "Retention: we keep information only as long as needed for these purposes. Because campus-hub is a course project, it may be shut down and its data deleted at the end of the project.",
      ],
      "We take reasonable steps to protect your information, but no online service can guarantee absolute security.",
    ],
  },
  {
    id: "email",
    title: "9. Emails from us",
    blocks: [
      "We send emails that are needed to operate your account, such as verification codes and password reset codes. In keeping with Canada's Anti-Spam Legislation (CASL), we will not send you promotional emails unless you have agreed to receive them, and any such email will include a way to unsubscribe.",
    ],
  },
  {
    id: "ip",
    title: "10. Our intellectual property and copyright complaints",
    blocks: [
      "The campus-hub name, logo, design and software belong to Binary Minds or are used with permission. \"Fanshawe\" and related names and marks belong to Fanshawe College and are used only to describe who the platform is for. You may not copy or reuse campus-hub's branding or code except as the law allows or with our permission.",
      "If you believe content on campus-hub infringes your copyright, contact us with a description of the work, where the content appears, and your contact details. We will review the notice and respond as required under the Copyright Act (Canada).",
    ],
  },
  {
    id: "reporting",
    title: "11. Reporting and enforcement",
    blocks: [
      "If you see content or behaviour that breaks these Terms, please report it to us. We may warn a user, remove content, or suspend or close an account, depending on how serious the issue is. Where we believe there is a risk of harm or a possible offence, we may notify Fanshawe College or law enforcement.",
    ],
  },
  {
    id: "disclaimer",
    title: "12. No warranties",
    blocks: [
      "campus-hub is a student project provided \"as is\" and \"as available\". To the fullest extent permitted by law, we make no promises that it will be uninterrupted, secure or error-free, or that content posted by users is accurate or reliable. Features may change, and the service may be paused or discontinued at any time.",
    ],
  },
  {
    id: "liability",
    title: "13. Limitation of liability",
    blocks: [
      "To the fullest extent permitted by law, Binary Minds and its members will not be liable for any indirect, incidental, special or consequential damages, or for any loss arising from your dealings with other users, from content posted by users, or from your use of or inability to use campus-hub. campus-hub is free to use, and to the extent we are found liable, our total liability is limited to CAD $50.",
      "Nothing in these Terms limits or excludes any rights or remedies you have under the Ontario Consumer Protection Act, 2002 or any other law that cannot be waived or limited by agreement.",
    ],
  },
  {
    id: "indemnity",
    title: "14. Your responsibility for claims",
    blocks: [
      "If someone brings a claim against us because of your content or because you broke these Terms or the law, you agree to cover the reasonable losses and costs we incur as a result, to the extent permitted by law.",
    ],
  },
  {
    id: "termination",
    title: "15. Suspension and termination",
    blocks: [
      "You may close your account at any time. We may suspend or close your account if you break these Terms, if you are no longer a Fanshawe student, or if we stop operating campus-hub. Sections that by their nature should continue, such as those on content licences, disclaimers, liability and governing law, continue to apply after your account is closed.",
    ],
  },
  {
    id: "changes",
    title: "16. Changes to these Terms",
    blocks: [
      "We may update these Terms as campus-hub develops. When we make a material change, we will post the new version here with a new effective date and give reasonable notice on the site or by email. If you keep using campus-hub after the change takes effect, you accept the updated Terms.",
    ],
  },
  {
    id: "law",
    title: "17. Governing law",
    blocks: [
      "These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada that apply in Ontario. Subject to any rights you have under consumer protection law, you and we agree that the courts located in Ontario have jurisdiction over any dispute about these Terms or campus-hub.",
    ],
  },
  {
    id: "general",
    title: "18. General",
    blocks: [
      "These Terms are the entire agreement between you and us about campus-hub. If a court finds part of these Terms unenforceable, the rest remains in effect. If we do not enforce a term, that does not mean we have waived it. You may not transfer your account or your rights under these Terms to anyone else.",
    ],
  },
];

export function TermsPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-muted">Effective {EFFECTIVE_DATE}</p>

        <nav aria-label="Contents" className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Contents</p>
          <ol className="mt-3 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-ink-soft transition hover:text-brand">
                  {section.title}
                </a>
              </li>
            ))}
            <li>
              <a href="#contact" className="text-ink-soft transition hover:text-brand">
                19. Contact us
              </a>
            </li>
          </ol>
        </nav>

        <div className="mt-8 space-y-10 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-10">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
                {section.blocks.map((block, i) =>
                  typeof block === "string" ? (
                    <p key={i}>{block}</p>
                  ) : (
                    <ul key={i} className="list-disc space-y-1.5 pl-5">
                      {block.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </section>
          ))}

          <section id="contact" className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-ink">19. Contact us</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Questions about these Terms, reports about content or users, and requests about your personal
              information can be sent to the Binary Minds team
              {CONTACT_EMAIL ? (
                <>
                  {" "}
                  at{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="link">
                    {CONTACT_EMAIL}
                  </a>
                </>
              ) : null}
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
