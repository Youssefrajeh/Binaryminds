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
/*  Gmail API over HTTPS — same Gmail account, no SMTP ports needed    */
/* ------------------------------------------------------------------ */

interface GmailApiConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  user: string;
}

function getGmailApiConfig(): GmailApiConfig | null {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const user = process.env.SMTP_USER;
  if (!clientId || !clientSecret || !refreshToken || !user) return null;
  return { clientId, clientSecret, refreshToken, user };
}

async function sendViaGmailApi(config: GmailApiConfig, { to, subject, html }: SendEmailInput): Promise<void> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenRes.ok) {
    throw new Error(`Gmail token refresh failed (${tokenRes.status}): ${await tokenRes.text()}`);
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Build the MIME message with nodemailer, then hand it to the Gmail API
  const fromName = process.env.EMAIL_FROM_NAME ?? "CampusHub";
  const composer = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const { message } = await composer.sendMail({
    from: `"${fromName}" <${config.user}>`,
    to,
    subject,
    html,
  });

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: (message as Buffer).toString("base64url") }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!sendRes.ok) {
    throw new Error(`Gmail API send failed (${sendRes.status}): ${await sendRes.text()}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Public API (same signature as before)                              */
/* ------------------------------------------------------------------ */

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const gmailApi = getGmailApiConfig();
  if (gmailApi) {
    await sendViaGmailApi(gmailApi, { to, subject, html });
    return;
  }

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

