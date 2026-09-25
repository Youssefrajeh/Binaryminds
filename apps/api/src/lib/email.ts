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
    // Fail fast instead of hanging for minutes when SMTP ports are blocked
    // (e.g. Render's free tier blocks outbound 25/465/587).
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

/* ------------------------------------------------------------------ */
/*  HTTPS email API (Brevo) — works on hosts that block SMTP           */
/* ------------------------------------------------------------------ */

async function sendViaBrevo(apiKey: string, { to, subject, html }: SendEmailInput): Promise<void> {
  const fromName = process.env.EMAIL_FROM_NAME ?? "CampusHub";
  const fromAddress = process.env.EMAIL_FROM_ADDRESS ?? process.env.SMTP_USER;
  if (!fromAddress) throw new Error("EMAIL_FROM_ADDRESS (or SMTP_USER) must be set to send via Brevo");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { name: fromName, email: fromAddress },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Brevo send failed (${res.status}): ${await res.text()}`);
  }
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
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    await sendViaBrevo(brevoKey, { to, subject, html });
    return;
  }

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

