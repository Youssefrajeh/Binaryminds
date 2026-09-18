interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM ?? "CampusHub <no-reply@campushub.dev>";

  if (!apiKey || apiKey === "change-me") {
    console.warn(`[email:dev-mode] would send to ${to}: ${subject}\n${html}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    throw new Error(`Email send failed: ${res.status} ${await res.text()}`);
  }
}

export function isAllowedDomain(email: string): boolean {
  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? "fanshaweonline.ca";
  return email.toLowerCase().endsWith(`@${domain}`);
}
