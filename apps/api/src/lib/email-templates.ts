/* ------------------------------------------------------------------ */
/*  Professional HTML email templates for CampusHub                     */
/*  Uses inline CSS for maximum email-client compatibility              */
/* ------------------------------------------------------------------ */

const BRAND = "#b3122e";
const BRAND_DARK = "#8f0e24";
const BRAND_SOFT = "#fbeaed";

/**
 * Shared outer shell used by every email.
 * Fully inline-styled for Gmail / Outlook / Apple Mail compatibility.
 */
function layout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
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
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header banner -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND} 0%,${BRAND_DARK} 100%);padding:32px 40px;text-align:center;">
              <!-- Logo mark -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:42px;height:42px;background:rgba(255,255,255,0.18);border-radius:12px;text-align:center;vertical-align:middle;font-size:22px;color:#ffffff;font-weight:bold;">
                    ✦
                  </td>
                  <td style="padding-left:14px;">
                    <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Campus</span><span style="font-size:24px;font-weight:700;color:rgba(255,255,255,0.85);letter-spacing:-0.5px;">Hub</span>
                  </td>
                </tr>
              </table>
              <p style="margin:10px 0 0;font-size:12px;color:rgba(255,255,255,0.7);letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">
                Fanshawe College Student Portal
              </p>
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding:36px 40px 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid #eef0f3;padding-top:24px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">
                      This email was sent by CampusHub for Fanshawe College students.
                    </p>
                    <p style="margin:0;font-size:12px;color:#9ca3af;">
                      If you didn't request this, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Sub-footer -->
        <p style="margin:24px 0 0;font-size:11px;color:#b0b5bf;text-align:center;">
          © ${new Date().getFullYear()} CampusHub · Built by Binary Minds
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Renders a large OTP code block that's easy to read and copy.
 */
function otpBlock(otp: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:${BRAND_SOFT};border:2px dashed ${BRAND};border-radius:12px;padding:0;">
          <tr>
            <td style="padding:18px 36px;">
              <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:${BRAND};font-family:'Courier New',Courier,monospace;">
                ${otp}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

/* ------------------------------------------------------------------ */
/*  Public template functions                                          */
/* ------------------------------------------------------------------ */

export function verificationEmailHtml(otp: string, expiryMinutes: number): string {
  return layout(`
    <!-- Icon -->
    <div style="text-align:center;margin-bottom:8px;">
      <span style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;background-color:${BRAND_SOFT};font-size:26px;text-align:center;">
        ✉️
      </span>
    </div>

    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111318;text-align:center;">
      Verify Your Email
    </h1>
    <p style="margin:0 0 4px;font-size:15px;color:#454b57;text-align:center;line-height:1.6;">
      Welcome to CampusHub! Enter the code below to verify your Fanshawe student email and activate your account.
    </p>

    ${otpBlock(otp)}

    <p style="margin:0 0 24px;font-size:13px;color:#737a88;text-align:center;">
      This code expires in <strong style="color:#454b57;">${expiryMinutes} minutes</strong>.
    </p>

    <!-- Divider tip -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:10px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#737a88;line-height:1.5;">
            <strong style="color:#454b57;">💡 Tip:</strong> Copy and paste the code into the verification page. Don't share this code with anyone.
          </p>
        </td>
      </tr>
    </table>
  `);
}

export function passwordResetEmailHtml(otp: string, expiryMinutes: number): string {
  return layout(`
    <!-- Icon -->
    <div style="text-align:center;margin-bottom:8px;">
      <span style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;background-color:${BRAND_SOFT};font-size:26px;text-align:center;">
        🔐
      </span>
    </div>

    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111318;text-align:center;">
      Reset Your Password
    </h1>
    <p style="margin:0 0 4px;font-size:15px;color:#454b57;text-align:center;line-height:1.6;">
      We received a request to reset the password for your CampusHub account. Use the code below to set a new password.
    </p>

    ${otpBlock(otp)}

    <p style="margin:0 0 24px;font-size:13px;color:#737a88;text-align:center;">
      This code expires in <strong style="color:#454b57;">${expiryMinutes} minutes</strong>.
    </p>

    <!-- Security notice -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef3f2;border-radius:10px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#737a88;line-height:1.5;">
            <strong style="color:#b42318;">⚠️ Security:</strong> If you didn't request a password reset, please ignore this email. Your account is safe.
          </p>
        </td>
      </tr>
    </table>
  `);
}
