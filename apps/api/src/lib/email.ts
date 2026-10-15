interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative; derived from the HTML when omitted */
  text?: string;
}

/**
 * HTML-only mail scores worse with spam filters, so every message also carries
 * a plain-text part.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(head|style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Where replies go; defaults to the sending address */
function replyToAddress(fallback: string | undefined): string | undefined {
  return process.env.EMAIL_REPLY_TO || fallback;
}

/* ------------------------------------------------------------------ */
/*  HTTPS email API (Brevo)           */
/* ------------------------------------------------------------------ */

async function sendViaBrevo(apiKey: string, { to, subject, html, text }: SendEmailInput): Promise<void> {
  const fromName = process.env.EMAIL_FROM_NAME ?? "CampusHub";
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!fromAddress) throw new Error("EMAIL_FROM_ADDRESS must be set to send via Brevo");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { name: fromName, email: fromAddress },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text ?? htmlToText(html),
      ...(replyToAddress(fromAddress) ? { replyTo: { email: replyToAddress(fromAddress) } } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Brevo send failed (${res.status}): ${await res.text()}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Public API (same signature as before)                              */
/* ------------------------------------------------------------------ */

export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<void> {
  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    // Dev-mode fallback: just log to the console
    console.warn(`[email:dev-mode] would send to ${to}: ${subject}
${html}`);
    return;
  }

  await sendViaBrevo(brevoKey, { to, subject, html, text });
}

export function isAllowedDomain(email: string): boolean {
  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? "fanshaweonline.ca";
  return email.toLowerCase().endsWith(`@${domain}`);
}

