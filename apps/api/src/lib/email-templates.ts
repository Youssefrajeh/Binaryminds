/* ------------------------------------------------------------------ */
/*  Professional HTML email templates for CampusHub                     */
/*  Uses inline CSS for maximum email-client compatibility              */
/* ------------------------------------------------------------------ */

const BRAND = "#b3122e";
const INK = "#111827";
const BODY = "#4b5563";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

/**
 * Public origin that serves /email-logo.png. Email clients block SVG and data
 * URIs, so the logo has to be a PNG at an absolute https URL.
 */
function logoUrl(): string | null {
  const base = (process.env.APP_URL || (process.env.CLIENT_URL ?? "").split(",")[0] || "").trim().replace(/\/$/, "");
  return base ? `${base}/email-logo.png` : null;
}

/** Logo image plus wordmark; falls back to the wordmark alone when no public URL is configured. */
function logoBlock(): string {
  const url = logoUrl();
  const img = url
    ? `<td style="padding-right:12px;vertical-align:middle;"><img src="${url}" width="44" height="33" alt="CampusHub" style="display:block;border:0;outline:none;" /></td>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${img}
                  <td style="vertical-align:middle;">
                    <span style="font-family:${FONT};font-size:26px;font-weight:800;color:${INK};letter-spacing:-1px;">campus<span style="color:#f2a33a;">-</span><span style="color:${BRAND};">hub</span></span>
                  </td>
                </tr>
              </table>`;
}

/**
 * Shared outer shell used by every email. Inline styles and tables only:
 * Outlook (including Microsoft 365) ignores gradients, shadows and most CSS
 * layout, so the design relies on solid colours, borders and spacing.
 */
function layout(preheader: string, content: string): string {
  return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <title>CampusHub</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:${FONT};">
  <!-- Preheader: the preview text shown next to the subject in the inbox -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f3f4f6;opacity:0;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:560px;background-color:#ffffff;border:1px solid ${LINE};border-radius:8px;">

          <!-- Brand accent bar -->
          <tr>
            <td height="4" bgcolor="${BRAND}" style="height:4px;line-height:4px;font-size:0;background-color:${BRAND};border-radius:8px 8px 0 0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:28px 40px 20px;border-bottom:1px solid ${LINE};">
              ${logoBlock()}
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px 40px 8px;font-family:${FONT};">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid ${LINE};padding-top:20px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
                    You are receiving this email because someone used this address on CampusHub,
                    the student community for Fanshawe College. If that wasn't you, you can safely ignore this message.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->

        <p style="margin:20px 0 0;font-family:${FONT};font-size:11px;color:#9ca3af;text-align:center;">
          © ${new Date().getFullYear()} CampusHub · Built by Binary Minds
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/** Large, selectable one-time code on a solid panel. */
function otpBlock(otp: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
    <tr>
      <td align="center" bgcolor="#f9fafb" style="background-color:#f9fafb;border:1px solid ${LINE};border-radius:8px;padding:22px 16px;">
        <span style="font-family:'Courier New',Courier,monospace;font-size:38px;font-weight:700;letter-spacing:10px;color:${INK};">${otp}</span>
      </td>
    </tr>
  </table>`;
}

interface EmailContent {
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string;
  otp: string;
  expiryMinutes: number;
  noteTitle: string;
  note: string;
}

/** Same structure for every code email so they read as one product. */
function codeEmail(c: EmailContent): string {
  return layout(
    c.preheader,
    `
    <p style="margin:0 0 8px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND};">
      ${c.eyebrow}
    </p>
    <h1 style="margin:0 0 12px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:700;color:${INK};">
      ${c.title}
    </h1>
    <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.65;color:${BODY};">
      ${c.intro}
    </p>

    ${otpBlock(c.otp)}

    <p style="margin:12px 0 28px;font-family:${FONT};font-size:13px;color:${MUTED};text-align:center;">
      This code expires in <strong style="color:${INK};">${c.expiryMinutes} minutes</strong>.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td width="3" bgcolor="${BRAND}" style="width:3px;background-color:${BRAND};font-size:0;line-height:0;">&nbsp;</td>
        <td bgcolor="#f9fafb" style="background-color:#f9fafb;padding:14px 18px;font-family:${FONT};font-size:13px;line-height:1.6;color:${BODY};">
          <strong style="color:${INK};">${c.noteTitle}</strong> ${c.note}
        </td>
      </tr>
    </table>`,
  );
}

/* ------------------------------------------------------------------ */
/*  Public template functions                                          */
/* ------------------------------------------------------------------ */

/** Names are user input, so they must not be able to inject markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function verificationEmailHtml(otp: string, expiryMinutes: number, firstName?: string | null): string {
  const greeting = firstName?.trim() ? `Hello ${escapeHtml(firstName.trim())},<br /><br />` : "";
  return codeEmail({
    preheader: `Your CampusHub verification code is ${otp}. It expires in ${expiryMinutes} minutes.`,
    eyebrow: "Email verification",
    title: "Verify your email address",
    intro:
      `${greeting}Welcome to CampusHub. Enter the code below on the verification page to confirm your Fanshawe student email and activate your account.`,
    otp,
    expiryMinutes,
    noteTitle: "Keep it private.",
    note: "CampusHub will never ask you for this code by phone, chat or email. Don't share it with anyone.",
  });
}

export function passwordResetEmailHtml(otp: string, expiryMinutes: number): string {
  return codeEmail({
    preheader: `Your CampusHub password reset code is ${otp}. It expires in ${expiryMinutes} minutes.`,
    eyebrow: "Password reset",
    title: "Reset your password",
    intro:
      "We received a request to reset the password for your CampusHub account. Enter the code below to choose a new password.",
    otp,
    expiryMinutes,
    noteTitle: "Didn't request this?",
    note: "You can ignore this email and your password will stay the same. Your account is safe.",
  });
}
