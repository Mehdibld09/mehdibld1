import nodemailer from "nodemailer";
import { db, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SMTP_KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from"] as const;

async function getSmtpConfig(): Promise<Record<(typeof SMTP_KEYS)[number], string>> {
  const rows = await db.select().from(siteSettingsTable);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    smtp_host: map.smtp_host ?? "",
    smtp_port: map.smtp_port ?? "587",
    smtp_user: map.smtp_user ?? "",
    smtp_pass: map.smtp_pass ?? "",
    smtp_from: map.smtp_from ?? "",
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const cfg = await getSmtpConfig();

  if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) {
    throw new Error("SMTP is not configured. Please set it in the admin panel under Site Settings → Email (SMTP).");
  }

  const transporter = nodemailer.createTransport({
    host: cfg.smtp_host,
    port: parseInt(cfg.smtp_port, 10) || 587,
    secure: parseInt(cfg.smtp_port, 10) === 465,
    auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: { rejectUnauthorized: false },
  });

  await transporter.sendMail({
    from: cfg.smtp_from || cfg.smtp_user,
    to,
    subject,
    html,
  });
}

// ─── Shared email base template ───────────────────────────────────────────────
function emailBase(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Steam Family</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

           <!-- Header -->
          <tr>
            <td style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                   <td style="background:#14b8a6;width:8px;height:32px;border-radius:4px;"></td>
                  <td style="padding-left:12px;">
                     <span style="font-size:20px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Steam <span style="color:#2dd4bf;">Family</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#18181b;border:1px solid #27272a;border-radius:16px;padding:36px 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;color:#52525b;font-size:12px;line-height:1.6;">
                This email was sent by Steam Family. If you didn't request it, you can safely ignore it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Email verification ────────────────────────────────────────────────────────
export function verificationEmailHtml(verifyUrl: string, username: string): string {
  return emailBase(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Verify your email</h1>
    <p style="margin:0 0 28px;color:#a1a1aa;font-size:15px;line-height:1.6;">
      Hi <strong style="color:#ffffff;">${escapeHtml(username)}</strong> — one quick step before you're in. Click the button below to confirm your email address.
    </p>

    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="background:#14b8a6;border-radius:10px;">
          <a href="${escapeHtml(verifyUrl)}"
             style="display:inline-block;padding:14px 32px;color:#09090b;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:-0.2px;">
            Verify Email Address
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;color:#71717a;font-size:13px;line-height:1.6;">
      Or copy and paste this link into your browser:
    </p>
    <div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:12px 16px;margin-bottom:24px;word-break:break-all;">
      <span style="color:#2dd4bf;font-size:13px;font-family:monospace;">${escapeHtml(verifyUrl)}</span>
    </div>

    <div style="border-top:1px solid #27272a;padding-top:20px;">
      <p style="margin:0;color:#52525b;font-size:13px;line-height:1.6;">
        This link expires in <strong style="color:#a1a1aa;">24 hours</strong>. If you didn't create an account, no action is needed.
      </p>
    </div>
  `);
}

// ─── 2FA login code ────────────────────────────────────────────────────────────
export function twoFactorEmailHtml(code: string, username: string): string {
  return emailBase(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Your login code</h1>
    <p style="margin:0 0 28px;color:#a1a1aa;font-size:15px;line-height:1.6;">
      Hi <strong style="color:#ffffff;">${escapeHtml(username)}</strong> — use the code below to complete your sign-in. It expires in 10 minutes.
    </p>

    <div style="background:#09090b;border:1px solid #14b8a6;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
      <span style="font-size:44px;font-weight:900;letter-spacing:12px;color:#2dd4bf;font-family:monospace;">${escapeHtml(code)}</span>
    </div>

    <div style="border-top:1px solid #27272a;padding-top:20px;">
      <p style="margin:0;color:#52525b;font-size:13px;line-height:1.6;">
        If you didn't try to sign in, ignore this email — your account is safe.
      </p>
    </div>
  `);
}

// ─── Registration email code ──────────────────────────────────────────────────
export function registrationCodeEmailHtml(code: string, username: string, verifyUrl: string): string {
  return emailBase(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Finish creating your account</h1>
    <p style="margin:0 0 24px;color:#a1a1aa;font-size:15px;line-height:1.6;">
      Hi <strong style="color:#ffffff;">${escapeHtml(username)}</strong> — enter this code in Steam Family to verify your email and activate your account.
    </p>

    <div style="background:#09090b;border:1px solid #14b8a6;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 10px;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Your verification code</p>
      <span style="font-size:42px;font-weight:900;letter-spacing:10px;color:#2dd4bf;font-family:monospace;">${escapeHtml(code)}</span>
    </div>

    <p style="margin:0 0 16px;color:#71717a;font-size:13px;line-height:1.6;">
      This code expires in <strong style="color:#a1a1aa;">10 minutes</strong>. You can also verify using the button below.
    </p>

    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:#14b8a6;border-radius:10px;">
          <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:14px 32px;color:#09090b;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">
            Open Verification Page
          </a>
        </td>
      </tr>
    </table>

    <div style="border-top:1px solid #27272a;padding-top:20px;">
      <p style="margin:0;color:#52525b;font-size:13px;line-height:1.6;">
        If you didn't create this account, you can safely ignore this email.
      </p>
    </div>
  `);
}

// ─── Password change code ─────────────────────────────────────────────────────
export function passwordChangeEmailHtml(code: string, username: string): string {
  return emailBase(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Confirm password change</h1>
    <p style="margin:0 0 24px;color:#a1a1aa;font-size:15px;line-height:1.6;">
      Hi <strong style="color:#ffffff;">${escapeHtml(username)}</strong> — enter this code in Steam Family to finish changing your password.
    </p>

    <div style="background:#09090b;border:1px solid #14b8a6;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 10px;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Password change code</p>
      <span style="font-size:42px;font-weight:900;letter-spacing:10px;color:#2dd4bf;font-family:monospace;">${escapeHtml(code)}</span>
    </div>

    <div style="border-top:1px solid #27272a;padding-top:20px;">
      <p style="margin:0;color:#52525b;font-size:13px;line-height:1.6;">
        This code expires in <strong style="color:#a1a1aa;">10 minutes</strong>. If you didn't request a password change, sign in and change your password immediately.
      </p>
    </div>
  `);
}
