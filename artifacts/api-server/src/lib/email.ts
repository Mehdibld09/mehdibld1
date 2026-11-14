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
    smtp_host: all.smtp_host || process.env.SMTP_HOST || "",
    smtp_port: all.smtp_port || process.env.SMTP_PORT || "587",
    smtp_user: all.smtp_user || process.env.SMTP_USER || process.env.BREVO_SMTP_USER || process.env.BREVO_LOGIN_EMAIL || "",
    smtp_pass: all.smtp_pass || process.env.SMTP_PASS || process.env.BREVO_SMTP_KEY || process.env.BREVO_API_KEY || "",
    smtp_from: all.smtp_from || process.env.SMTP_FROM || process.env.BREVO_FROM_EMAIL || "",
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
  provider?: string;
  host?: string;
  from?: string;
}

let lastSmtpResult: SendEmailResult | null = null;

export function getLastSmtpResult(): SendEmailResult | null {
  return lastSmtpResult;
}

export function parseSenderParts(rawFrom?: string, fallbackUser?: string): { name: string; email: string } {
  const fromClean = (rawFrom || "").trim();
  const userClean = (fallbackUser || "").trim();
  const usableFallback = userClean && !userClean.toLowerCase().endsWith("@smtp-brevo.com") ? userClean : "";
  const candidate = fromClean || usableFallback;

  if (!candidate) {
    return { name: "SteamFamily", email: "noreply@steamfamily.com" };
  }

  const angleMatch = candidate.match(/^(?:"?([^"<]+)"?\s*)?<([^>]+)>$/);
  if (angleMatch) {
    let displayName = angleMatch[1]?.trim() || "";
    const email = angleMatch[2]?.trim();
    const localPart = email.split("@")[0].toLowerCase();
    if (!displayName || displayName.toLowerCase() === "contact" || displayName.toLowerCase() === localPart) {
      displayName = "SteamFamily";
    }
    return { name: displayName, email };
  }

  return { name: "SteamFamily", email: candidate };
}

export function formatSenderAddress(rawFrom?: string, fallbackUser?: string): string {
  const { name, email } = parseSenderParts(rawFrom, fallbackUser);
  return `"${name}" <${email}>`;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr|td|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#039;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
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
  const rawHost = cfg.smtp_host.trim();
  const rawPass = cfg.smtp_pass.trim();
  const rawUser = cfg.smtp_user.trim();
  const rawFrom = cfg.smtp_from.trim();

  const isBrevoApiKey = rawPass.startsWith("xkeysib-");
  const isBrevoApiHost = rawHost.toLowerCase() === "api.brevo.com";
  const isBrevoApi = isBrevoApiKey || isBrevoApiHost;
  const isBrevoSmtp = !isBrevoApi && (rawHost.toLowerCase().includes("brevo.com") || rawHost.toLowerCase().includes("sendinblue.com") || rawPass.startsWith("xsmtpsib-"));
  const isBrevo = isBrevoApi || isBrevoSmtp;

  if (isBrevoApi) {
    if (!rawPass) {
      const err = new Error("SMTP is not configured. Please set your Brevo API Key (xkeysib-...) in Site Settings → Email (SMTP).");
      log(`[ERROR] Brevo API key is missing.`);
      (err as any).logs = logs;
      await recordEmailEvent({
        recipient: to,
        subject,
        purpose: effectivePurpose,
        status: "failed",
        durationMs: Date.now() - startTime,
        error: "Brevo API key not configured",
        provider: "Brevo API",
      });
      throw err;
    }

    if (isBrevoApiHost && rawPass.startsWith("xsmtpsib-")) {
      const err = new Error("Brevo Config Mismatch: You selected 'api.brevo.com' (Brevo API) but saved an SMTP key (xsmtpsib-...). Either paste a Brevo API Key (xkeysib-...) from Brevo → SMTP & API → API Keys, or switch to 'Brevo SMTP' (smtp-relay.brevo.com).");
      log(`[ERROR] Host is api.brevo.com but key starts with xsmtpsib- (SMTP key).`);
      (err as any).logs = logs;
      await recordEmailEvent({
        recipient: to,
        subject,
        purpose: effectivePurpose,
        status: "failed",
        durationMs: Date.now() - startTime,
        error: err.message,
        provider: "Brevo API",
      });
      throw err;
    }

    const sender = parseSenderParts(rawFrom, rawUser);
    if (!sender.email || !sender.email.includes("@") || sender.email === "noreply@steamfamily.com" || sender.email.toLowerCase().endsWith("@smtp-brevo.com")) {
      const err = new Error("Brevo Sender Error: Please set 'From Address' to a verified sender email from your Brevo account (Senders & IP → Senders).");
      log(`[ERROR] Invalid or missing verified From Address for Brevo API: "${rawFrom || rawUser || 'MISSING'}"`);
      (err as any).logs = logs;
      await recordEmailEvent({
        recipient: to,
        subject,
        purpose: effectivePurpose,
        status: "failed",
        durationMs: Date.now() - startTime,
        error: err.message,
        provider: "Brevo API",
      });
      throw err;
    }

    log(`Provider: Brevo Transactional Email HTTP API (https://api.brevo.com/v3/smtp/email)`);
    log(`Sender: "${sender.name}" <${sender.email}>`);
    const textContent = htmlToPlainText(html);

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": rawPass,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          sender: { name: sender.name, email: sender.email },
          replyTo: { name: sender.name, email: sender.email },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent,
        }),
      });

      const data: any = await response.json().catch(() => ({}));
      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const apiMsg = data?.message || data?.code || `HTTP ${response.status}`;
        let userFriendlyMsg = `Brevo API Error (${response.status}): ${apiMsg}`;
        if (response.status === 401 || String(apiMsg).toLowerCase().includes("unauthorized") || String(apiMsg).toLowerCase().includes("key not found")) {
          userFriendlyMsg = "Brevo API Authentication Failed (401): Invalid Brevo API Key. Go to Brevo → SMTP & API → API Keys and copy or generate an API key (starts with xkeysib-).";
        } else if (String(apiMsg).toLowerCase().includes("sender") || String(apiMsg).toLowerCase().includes("unverified") || String(apiMsg).toLowerCase().includes("not valid")) {
          userFriendlyMsg = `Brevo Sender Error: The 'From' address (${sender.email}) must be a verified sender in your Brevo account under 'Senders & IP' → 'Senders'.`;
        }
        log(`[ERROR] Brevo API returned ${response.status}: ${apiMsg}`);
        log(`[FAILURE] ${userFriendlyMsg}`);
        await recordEmailEvent({
          recipient: to,
          subject,
          purpose: effectivePurpose,
          status: "failed",
          durationMs,
          error: userFriendlyMsg,
          provider: "Brevo API",
        });
        const errToThrow = new Error(userFriendlyMsg);
        (errToThrow as any).logs = logs;
        (errToThrow as any).rawError = apiMsg;
        throw errToThrow;
      }

      const messageId = data?.messageId || "";
      log(`✅ Brevo API accepted email for delivery!`);
      log(`Message-ID: ${messageId || "N/A"}`);
      log(`Completed in ${durationMs}ms`);

      const result: SendEmailResult = {
        success: true,
        messageId,
        response: `201 Created (${messageId || "Brevo API"})`,
        accepted: [to],
        rejected: [],
        durationMs,
        timestamp: new Date().toISOString(),
        logs,
        provider: "Brevo API",
        host: "api.brevo.com",
        from: `"${sender.name}" <${sender.email}>`,
      };

      await recordEmailEvent({
        recipient: to,
        subject,
        purpose: effectivePurpose,
        status: "success",
        durationMs,
        messageId,
        provider: "Brevo API",
      });

      lastSmtpResult = result;
      return result;
    } catch (err: any) {
      if ((err as any)?.logs) throw err;
      const rawMsg = err?.message || String(err);
      const userFriendlyMsg = `Brevo API Network Error: ${rawMsg}`;
      log(`[FAILURE] ${userFriendlyMsg}`);
      await recordEmailEvent({
        recipient: to,
        subject,
        purpose: effectivePurpose,
        status: "failed",
        durationMs: Date.now() - startTime,
        error: userFriendlyMsg,
        provider: "Brevo API",
      });
      const errToThrow = new Error(userFriendlyMsg);
      (errToThrow as any).logs = logs;
      (errToThrow as any).rawError = rawMsg;
      throw errToThrow;
    }
  }

  if (!rawHost || !rawUser || !rawPass) {
    const err = new Error("SMTP is not configured. Please set your SMTP Host, Username, and Password in the admin panel under Site Settings → Email (SMTP).");
    log(`[ERROR] Configuration check failed: Host="${rawHost || 'MISSING'}", User="${rawUser || 'MISSING'}", Pass="${rawPass ? 'PRESENT' : 'MISSING'}"`);
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

  if (isBrevo && rawUser.toLowerCase().endsWith("@smtp-brevo.com") && !rawFrom) {
    const err = new Error(`Brevo Sender Error: When using Brevo SMTP Login (${rawUser}), you must set 'From Address' to your verified sender email in Brevo (Senders & IP → Senders).`);
    log(`[ERROR] Missing verified From Address: Brevo SMTP login (${rawUser}) cannot be used as the From address.`);
    (err as any).logs = logs;
    await recordEmailEvent({
      recipient: to,
      subject,
      purpose: effectivePurpose,
      status: "failed",
      durationMs: Date.now() - startTime,
      error: err.message,
      provider: "Brevo",
    });
    throw err;
  }

  const port = parseInt(cfg.smtp_port, 10) || 587;
  const isGmail = rawHost.toLowerCase().includes("gmail.com") || rawUser.toLowerCase().includes("gmail.com");

  if (isBrevo) {
    log(`Provider: Brevo (Sendinblue) SMTP Relay on port ${port}`);
  } else if (isGmail) {
    log(`Provider: Google Gmail SMTP on port ${port}`);
  }

  // Google App Passwords are 16 letters usually separated by spaces (e.g. "abcd efgh ijkl mnop").
  // Strip middle spaces so SMTP AUTH succeeds.
  let cleanPass = rawPass;
  if (isGmail || /^[a-zA-Z]{4}\s+[a-zA-Z]{4}\s+[a-zA-Z]{4}\s+[a-zA-Z]{4}$/.test(cleanPass)) {
    cleanPass = cleanPass.replace(/\s+/g, "");
    log(`Sanitized Google App Password whitespace (16 chars)`);
  }

  const senderParts = parseSenderParts(rawFrom, rawUser);
  const senderFrom = `"${senderParts.name}" <${senderParts.email}>`;
  const textBody = htmlToPlainText(html);

  log(`Target SMTP server: ${rawHost}:${port} (${port === 465 ? 'SSL direct' : 'STARTTLS'})`);
  log(`Auth user: ${rawUser}`);
  log(`From header: ${senderFrom}`);

  const transporter = nodemailer.createTransport({
    host: rawHost,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: rawUser, pass: cleanPass.trim() },
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
    replyTo: senderFrom,
    to,
    subject,
    text: textBody,
    html,
  };

  let lastError: any = null;
  // Retry once on transient network/socket drops
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      log(`Connecting to ${rawHost}:${port} (Attempt ${attempt}/2)...`);
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
        provider: isBrevo ? "Brevo SMTP" : isGmail ? "Gmail" : "SMTP",
        host: `${rawHost}:${port}`,
        from: senderFrom,
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
      userFriendlyMsg = "Brevo SMTP Authentication Failed (535): Check Brevo → SMTP & API → SMTP tab and copy the exact SMTP Login (often xxxxxx@smtp-brevo.com, NOT your personal email) and SMTP Key (xsmtpsib-...). Or use a Brevo API Key (xkeysib-...) instead.";
    } else if (rawMsg.includes("550") || rawMsg.includes("421") || rawMsg.toLowerCase().includes("sender") || rawMsg.toLowerCase().includes("unauthenticated")) {
      userFriendlyMsg = `Brevo Sender Error: The 'From' address (${rawFrom || rawUser}) must be a verified sender in your Brevo account under 'Senders & IP' → 'Senders'.`;
    } else if (rawMsg.includes("ETIMEDOUT") || rawMsg.includes("ESOCKETTIMEDOUT") || rawMsg.includes("greeting timeout")) {
      userFriendlyMsg = `Brevo Connection Timeout: Could not reach ${rawHost}:${port}. Try port 587 or use a Brevo API Key (xkeysib-...) to send over HTTPS.`;
    }
  } else if (rawMsg.includes("535") || rawMsg.toLowerCase().includes("badcredentials") || rawMsg.toLowerCase().includes("invalid login")) {
    userFriendlyMsg = "SMTP Authentication Failed (535): Invalid username or password. For Gmail, make sure 2-Step Verification is active and you are using a 16-character Google App Password (not your normal Google account password).";
  } else if (rawMsg.includes("ETIMEDOUT") || rawMsg.includes("ESOCKETTIMEDOUT") || rawMsg.includes("greeting timeout")) {
    userFriendlyMsg = `SMTP Connection Timeout: Server did not respond at ${rawHost}:${port}. Verify your host and port (try port 587 or 465).`;
  } else if (rawMsg.includes("ECONNREFUSED")) {
    userFriendlyMsg = `SMTP Connection Refused: Could not connect to ${rawHost}:${port}. Please verify the host name and port.`;
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
