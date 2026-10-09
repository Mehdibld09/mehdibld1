import nodemailer from "nodemailer";
import { getAllSettings } from "./settingsStore";
import { recordEmailEvent, getEmailStats, resetEmailStats, type EmailPurpose } from "./emailStatsStore";
export { getEmailStats, resetEmailStats, type EmailPurpose };

function inferPurpose(subject: string): EmailPurpose {
  const s = subject.toLowerCase();
  if (s.includes("login code") || s.includes("2fa")) return "2fa_login";
  if (s.includes("verification") || s.includes("verify") || s.includes("finish creating") || s.includes("activate")) return "verify_email";
  if (s.includes("password")) return "password_reset";
  if (s.includes("test")) return "smtp_test";
  return "other";
}

export async function getSmtpConfig(): Promise<Record<string, string>> {
  const all = await getAllSettings();
  return {
    smtp_host: all.smtp_host ?? process.env.SMTP_HOST ?? "",
    smtp_port: all.smtp_port ?? process.env.SMTP_PORT ?? "587",
    smtp_user: all.smtp_user ?? process.env.SMTP_USER ?? "",
    smtp_pass: all.smtp_pass ?? process.env.SMTP_PASS ?? "",
    smtp_from: all.smtp_from ?? process.env.SMTP_FROM ?? "",
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

export interface SendEmailResult {
  success: boolean;
  messageId: string;
  response: string;
  accepted: string[];
  rejected: string[];
  durationMs: number;
  timestamp: string;
  logs: string[];
}

let lastSmtpResult: SendEmailResult | null = null;

export function getLastSmtpResult(): SendEmailResult | null {
  return lastSmtpResult;
}

export function formatSenderAddress(rawFrom?: string, fallbackUser?: string): string {
  const candidate = (rawFrom || fallbackUser || "").trim();
  if (!candidate) {
    return `"SteamFamily" <noreply@steamfamily.com>`;
  }

  // Handle format: "Display Name" <email@domain.com> or Display Name <email@domain.com>
  const angleMatch = candidate.match(/^(?:"?([^"<]+)"?\s*)?<([^>]+)>$/);
  if (angleMatch) {
    let displayName = angleMatch[1]?.trim() || "";
    const email = angleMatch[2]?.trim();
    const localPart = email.split("@")[0].toLowerCase();
    if (!displayName || displayName.toLowerCase() === "contact" || displayName.toLowerCase() === localPart) {
      displayName = "SteamFamily";
    }
    return `"${displayName}" <${email}>`;
  }

  // Plain email address (e.g. contact@domain.com) -> "SteamFamily" <contact@domain.com>
  if (candidate.includes("@")) {
    return `"SteamFamily" <${candidate}>`;
  }

  return `"SteamFamily" <${candidate}>`;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  purpose?: EmailPurpose
): Promise<SendEmailResult> {
  const startTime = Date.now();
  const effectivePurpose: EmailPurpose = purpose || inferPurpose(subject);
  const logs: string[] = [];
  const log = (msg: string) => {
    const time = new Date().toISOString().split("T")[1]?.slice(0, 8) || "";
    logs.push(`[${time}] ${msg}`);
  };

  log(`Initiating send request to <${to}> [purpose=${effectivePurpose}]...`);
  log(`Subject: "${subject}"`);

  const cfg = await getSmtpConfig();

  if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) {
    const err = new Error("SMTP is not configured. Please set your SMTP Host, Username, and Password in the admin panel under Site Settings → Email (SMTP).");
    log(`[ERROR] Configuration check failed: Host="${cfg.smtp_host || 'MISSING'}", User="${cfg.smtp_user || 'MISSING'}", Pass="${cfg.smtp_pass ? 'PRESENT' : 'MISSING'}"`);
    (err as any).logs = logs;
    await recordEmailEvent({
      recipient: to,
      subject,
      purpose: effectivePurpose,
      status: "failed",
      durationMs: Date.now() - startTime,
      error: "SMTP credentials not configured",
      provider: "None",
    });
    throw err;
  }

  const port = parseInt(cfg.smtp_port, 10) || 587;
  const isGmail = cfg.smtp_host.toLowerCase().includes("gmail.com") || cfg.smtp_user.toLowerCase().includes("gmail.com");
  const isBrevo = cfg.smtp_host.toLowerCase().includes("brevo.com") || cfg.smtp_host.toLowerCase().includes("sendinblue.com");

  if (isBrevo) {
    log(`Provider: Brevo (Sendinblue) SMTP Relay on port ${port}`);
  } else if (isGmail) {
    log(`Provider: Google Gmail SMTP on port ${port}`);
  }

  // Google App Passwords are 16 letters usually separated by spaces (e.g. "abcd efgh ijkl mnop").
  // Strip middle spaces so SMTP AUTH succeeds.
  let cleanPass = cfg.smtp_pass;
  if (isGmail || /^[a-zA-Z]{4}\s+[a-zA-Z]{4}\s+[a-zA-Z]{4}\s+[a-zA-Z]{4}$/.test(cleanPass)) {
    cleanPass = cleanPass.replace(/\s+/g, "");
    log(`Sanitized Google App Password whitespace (16 chars)`);
  }

  const senderFrom = formatSenderAddress(cfg.smtp_from, cfg.smtp_user);

  log(`Target SMTP server: ${cfg.smtp_host}:${port} (${port === 465 ? 'SSL direct' : 'STARTTLS'})`);
  log(`Auth user: ${cfg.smtp_user}`);
  log(`From header: ${senderFrom}`);

  const transporter = nodemailer.createTransport({
    host: cfg.smtp_host,
    port,
    secure: port === 465,
    auth: { user: cfg.smtp_user.trim(), pass: cleanPass.trim() },
    family: 4, // Force IPv4 to prevent IPv6 routing stalls in container environments
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    tls: {
      rejectUnauthorized: false,
      minVersion: "TLSv1.2",
    },
  });

  const mailOptions = {
    from: senderFrom,
    to,
    subject,
    html,
  };

  let lastError: any = null;
  // Retry once on transient network/socket drops
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      log(`Connecting to ${cfg.smtp_host}:${port} (Attempt ${attempt}/2)...`);
      const info = await transporter.sendMail(mailOptions);
      const durationMs = Date.now() - startTime;
      log(`✅ Connection established and email accepted by mail server!`);
      log(`Server response: ${info.response || '250 OK'}`);
      log(`Message-ID: ${info.messageId || 'N/A'}`);
      log(`Accepted recipients: ${(info.accepted || []).join(', ') || to}`);
      if (info.rejected && info.rejected.length > 0) {
        log(`[WARN] Rejected recipients: ${info.rejected.join(', ')}`);
      }
      log(`Completed in ${durationMs}ms`);

      const result: SendEmailResult = {
        success: true,
        messageId: info.messageId || "",
        response: info.response || "250 2.0.0 OK",
        accepted: (info.accepted || []) as string[],
        rejected: (info.rejected || []) as string[],
        durationMs,
        timestamp: new Date().toISOString(),
        logs,
      };

      await recordEmailEvent({
        recipient: to,
        subject,
        purpose: effectivePurpose,
        status: "success",
        durationMs,
        messageId: info.messageId || "",
        provider: isBrevo ? "Brevo" : isGmail ? "Gmail" : "SMTP",
      });

      lastSmtpResult = result;
      return result;
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      log(`[ERROR] Attempt ${attempt} failed: ${errMsg}`);

      const isTransient =
        errMsg.includes("ETIMEDOUT") ||
        errMsg.includes("ESOCKETTIMEDOUT") ||
        errMsg.includes("ECONNRESET") ||
        errMsg.includes("EAI_AGAIN") ||
        errMsg.includes("greeting timeout");

      if (attempt === 1 && isTransient) {
        log(`Transient socket drop detected. Retrying connection in 1.5 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      break;
    }
  }

  const rawMsg = lastError?.message || String(lastError);
  let userFriendlyMsg = `SMTP Error: ${rawMsg}`;

  if (isBrevo) {
    if (rawMsg.includes("535") || rawMsg.toLowerCase().includes("badcredentials") || rawMsg.toLowerCase().includes("invalid login") || rawMsg.toLowerCase().includes("authentication")) {
      userFriendlyMsg = "Brevo SMTP Authentication Failed (535): Invalid Brevo login email or SMTP Key. Go to Brevo → SMTP & API → Generate or copy your SMTP Key (starts with xsmtpsib-). Do NOT use your Brevo account password; you must use the generated SMTP Key.";
    } else if (rawMsg.includes("550") || rawMsg.includes("421") || rawMsg.toLowerCase().includes("sender") || rawMsg.toLowerCase().includes("unauthenticated")) {
      userFriendlyMsg = `Brevo Sender Error: The 'From' address (${cfg.smtp_from || cfg.smtp_user}) must be a verified sender in your Brevo account under 'Senders & IP' → 'Senders'.`;
    } else if (rawMsg.includes("ETIMEDOUT") || rawMsg.includes("ESOCKETTIMEDOUT") || rawMsg.includes("greeting timeout")) {
      userFriendlyMsg = `Brevo Connection Timeout: Could not reach smtp-relay.brevo.com:${port}. Try port 587.`;
    }
  } else if (rawMsg.includes("535") || rawMsg.toLowerCase().includes("badcredentials") || rawMsg.toLowerCase().includes("invalid login")) {
    userFriendlyMsg = "SMTP Authentication Failed (535): Invalid username or password. For Gmail, make sure 2-Step Verification is active and you are using a 16-character Google App Password (not your normal Google account password).";
  } else if (rawMsg.includes("ETIMEDOUT") || rawMsg.includes("ESOCKETTIMEDOUT") || rawMsg.includes("greeting timeout")) {
    userFriendlyMsg = `SMTP Connection Timeout: Server did not respond at ${cfg.smtp_host}:${port}. Verify your host and port (try port 587 or 465).`;
  } else if (rawMsg.includes("ECONNREFUSED")) {
    userFriendlyMsg = `SMTP Connection Refused: Could not connect to ${cfg.smtp_host}:${port}. Please verify the host name and port.`;
  }

  log(`[FAILURE] ${userFriendlyMsg}`);

  await recordEmailEvent({
    recipient: to,
    subject,
    purpose: effectivePurpose,
    status: "failed",
    durationMs: Date.now() - startTime,
    error: userFriendlyMsg,
    provider: isBrevo ? "Brevo" : isGmail ? "Gmail" : "SMTP",
  });

  const errToThrow = new Error(userFriendlyMsg);
  (errToThrow as any).logs = logs;
  (errToThrow as any).rawError = rawMsg;
  throw errToThrow;
}

// ─── Shared email base template ───────────────────────────────────────────────
function emailBase(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SteamFamily</title>
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
                     <span style="font-size:20px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Steam<span style="color:#2dd4bf;">Family</span></span>
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
                This email was sent by SteamFamily. If you didn't request it, you can safely ignore it.
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
