import nodemailer from "nodemailer";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/* ------------------------------------------------------------------ */
/*  Create a reusable SMTP transporter (Gmail)                         */
/* ------------------------------------------------------------------ */

function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

// Lazy-initialised so env vars are read after dotenv loads
let _transporter: ReturnType<typeof createTransporter> | undefined;
function getTransporter() {
  if (_transporter === undefined) _transporter = createTransporter();
  return _transporter;
}

/* ------------------------------------------------------------------ */
/*  Public API (same signature as before)                              */
/* ------------------------------------------------------------------ */

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    // Dev-mode fallback: just log to the console
    console.warn(`[email:dev-mode] would send to ${to}: ${subject}\n${html}`);
    return;
  }

  const fromName = process.env.EMAIL_FROM_NAME ?? "CampusHub";
  const fromAddress = process.env.SMTP_USER!;

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    html,
  });
}

export function isAllowedDomain(email: string): boolean {
  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? "fanshaweonline.ca";
  return email.toLowerCase().endsWith(`@${domain}`);
}

