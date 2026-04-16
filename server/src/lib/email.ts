import { Resend } from "resend";
import {
  EMAIL_FROM,
  PUBLIC_APP_ORIGIN,
  PUBLIC_DOWNLOAD_URL,
  PUBLIC_WEBSITE_ORIGIN,
  RESEND_API_KEY,
} from "../config/constants";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const BRAND = "#ef5c35";
const BG = "#f4f4f5";
const TEXT = "#1a1a1a";
const MUTED = "#5c5c5c";

function stripTrailingSlash(u: string): string {
  return u.replace(/\/$/, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared footer: every message links to restify.online, web app, and download. */
function emailFooterHtml(): string {
  const site = stripTrailingSlash(PUBLIC_WEBSITE_ORIGIN);
  const app = stripTrailingSlash(PUBLIC_APP_ORIGIN);
  const get = stripTrailingSlash(PUBLIC_DOWNLOAD_URL);
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;border-top:1px solid #e8e8ea;padding-top:24px;">
      <tr>
        <td style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:${MUTED};line-height:1.6;">
          <strong style="color:${TEXT};">Restify</strong> — API client for macOS &amp; web.
          <br /><br />
          <a href="${escapeHtml(site)}" style="color:${BRAND};font-weight:600;text-decoration:none;">restify.online</a>
          <span style="color:#ccc;"> &nbsp;·&nbsp; </span>
          <a href="${escapeHtml(app)}" style="color:${BRAND};text-decoration:none;">Web app</a>
          <span style="color:#ccc;"> &nbsp;·&nbsp; </span>
          <a href="${escapeHtml(get)}" style="color:${BRAND};text-decoration:none;">Get the app</a>
        </td>
      </tr>
    </table>
  `;
}

function primaryButton(label: string, href: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;">
      <tr>
        <td style="border-radius:8px;background:${BRAND};">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Table-based layout for broad email client support.
 * Includes hidden preheader for inbox preview.
 */
function layoutEmail(opts: {
  preheader: string;
  title: string;
  bodyHtml: string;
}): string {
  const { preheader, title, bodyHtml } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" style="max-width:560px;" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="background:#ffffff;border-radius:12px;padding:32px 28px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid #ececee;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding-bottom:20px;">
                    <span style="display:inline-block;background:${BRAND};color:#fff;font-weight:800;font-size:16px;padding:6px 11px;border-radius:8px;font-family:system-ui,sans-serif;letter-spacing:-0.02em;">R</span>
                    <span style="font-weight:700;font-size:18px;color:${TEXT};margin-left:8px;font-family:system-ui,-apple-system,sans-serif;vertical-align:middle;">Restify</span>
                  </td>
                </tr>
              </table>
              <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:1.55;color:${TEXT};">
                ${bodyHtml}
              </div>
              ${emailFooterHtml()}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;font-family:system-ui,sans-serif;font-size:11px;color:#999;text-align:center;line-height:1.5;">
              You’re receiving this because of your Restify account or an invitation on <a href="${escapeHtml(stripTrailingSlash(PUBLIC_WEBSITE_ORIGIN))}" style="color:${BRAND};text-decoration:none;">restify.online</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendTransactional(opts: {
  to: string;
  subject: string;
  html: string;
  logLabel: string;
}): Promise<void> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping ${opts.logLabel}`);
    return;
  }
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
  });
  if (error) {
    console.error(`[email] ${opts.logLabel} send failed:`, error);
    if (String(error).includes("domain") || JSON.stringify(error).includes("domain")) {
      console.error(
        "[email] Hint: verify your sending domain in Resend and use RESTIFY_EMAIL_FROM with that domain; onboarding@resend.dev may only deliver to your own test address."
      );
    }
  }
}

export async function sendWelcomeEmail(to: string, displayName: string): Promise<void> {
  const name = displayName?.trim() || "there";
  const app = stripTrailingSlash(PUBLIC_APP_ORIGIN);
  const html = layoutEmail({
    title: "Welcome to Restify",
    preheader: "Your Restify account is ready — open the web app or get the desktop build on restify.online.",
    bodyHtml: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">Your account is ready. Sync collections and environments across the <strong>web app</strong> and <strong>desktop client</strong>.</p>
      <p style="margin:0 0 8px;color:${MUTED};font-size:14px;">Open Restify in the browser:</p>
      ${primaryButton("Open Restify", app)}
      <p style="margin:16px 0 0;font-size:14px;color:${MUTED};">
        New here? Visit <a href="${escapeHtml(stripTrailingSlash(PUBLIC_WEBSITE_ORIGIN))}" style="color:${BRAND};font-weight:600;text-decoration:none;">restify.online</a> for the macOS download and more.
      </p>
    `,
  });
  await sendTransactional({ to, subject: "Welcome to Restify", html, logLabel: "welcome" });
}

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<void> {
  const link = `${stripTrailingSlash(PUBLIC_APP_ORIGIN)}/?resetPassword=${encodeURIComponent(resetToken)}`;
  const html = layoutEmail({
    title: "Reset your Restify password",
    preheader: "Reset your password on app.restify.online — link expires in one hour.",
    bodyHtml: `
      <p style="margin:0 0 16px;">We received a request to reset your Restify password.</p>
      ${primaryButton("Choose a new password", link)}
      <p style="margin:16px 0 0;font-size:14px;color:${MUTED};">
        This link expires in <strong>one hour</strong>. If you didn’t ask for this, you can ignore this email.
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:${MUTED};">
        Restify: <a href="${escapeHtml(stripTrailingSlash(PUBLIC_WEBSITE_ORIGIN))}" style="color:${BRAND};text-decoration:none;">restify.online</a>
      </p>
    `,
  });
  await sendTransactional({
    to,
    subject: "Reset your Restify password",
    html,
    logLabel: "password reset",
  });
}

export async function sendSignupOtpEmail(to: string, otpCode: string): Promise<void> {
  const html = layoutEmail({
    title: "Your Restify verification code",
    preheader: "Use this 6-digit code to finish creating your Restify account.",
    bodyHtml: `
      <p style="margin:0 0 16px;">Use this one-time verification code to complete your account creation:</p>
      <div style="margin:16px 0 18px;padding:14px 16px;border:1px solid #e9e9ec;border-radius:10px;background:#fafafb;text-align:center;">
        <span style="font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:30px;letter-spacing:8px;font-weight:700;color:${TEXT};">${escapeHtml(
          otpCode
        )}</span>
      </div>
      <p style="margin:0 0 6px;font-size:14px;color:${MUTED};">
        This code expires in <strong>10 minutes</strong>.
      </p>
      <p style="margin:0;font-size:13px;color:${MUTED};">
        If you did not request this, you can safely ignore this email.
      </p>
    `,
  });
  await sendTransactional({
    to,
    subject: "Restify verification code",
    html,
    logLabel: "signup otp",
  });
}

export async function sendTeamInviteEmail(
  to: string,
  inviterName: string,
  teamName: string,
  inviteToken: string,
  role: string
): Promise<void> {
  const link = `${stripTrailingSlash(PUBLIC_APP_ORIGIN)}/?teamInvite=${encodeURIComponent(inviteToken)}`;
  const html = layoutEmail({
    title: `Invitation: ${teamName}`,
    preheader: `${inviterName} invited you to ${teamName} on Restify — accept on app.restify.online.`,
    bodyHtml: `
      <p style="margin:0 0 16px;"><strong>${escapeHtml(inviterName)}</strong> invited you to join the team <strong>${escapeHtml(teamName)}</strong> as <strong>${escapeHtml(role)}</strong>.</p>
      ${primaryButton("Accept invitation", link)}
      <p style="margin:16px 0 0;font-size:14px;color:${MUTED};">
        This invitation expires in <strong>7 days</strong>. If you don’t have an account yet, sign up at
        <a href="${escapeHtml(stripTrailingSlash(PUBLIC_APP_ORIGIN))}" style="color:${BRAND};font-weight:600;text-decoration:none;">app.restify.online</a>
        using this email address, then open the link again.
      </p>
      <p style="margin:12px 0 0;font-size:13px;color:${MUTED};">
        More at <a href="${escapeHtml(stripTrailingSlash(PUBLIC_WEBSITE_ORIGIN))}" style="color:${BRAND};font-weight:600;text-decoration:none;">restify.online</a>.
      </p>
    `,
  });
  await sendTransactional({
    to,
    subject: `You're invited to "${teamName}" on Restify`,
    html,
    logLabel: "team invite",
  });
}

export async function sendWorkspaceInviteEmail(
  to: string,
  inviterName: string,
  workspaceName: string,
  inviteToken: string,
  role: string
): Promise<void> {
  const link = `${stripTrailingSlash(PUBLIC_APP_ORIGIN)}/?workspaceInvite=${encodeURIComponent(inviteToken)}`;
  const html = layoutEmail({
    title: `Invitation: ${workspaceName}`,
    preheader: `${inviterName} invited you to ${workspaceName} on Restify — accept on app.restify.online.`,
    bodyHtml: `
      <p style="margin:0 0 16px;"><strong>${escapeHtml(inviterName)}</strong> invited you to join the workspace <strong>${escapeHtml(workspaceName)}</strong> as <strong>${escapeHtml(role)}</strong>.</p>
      ${primaryButton("Accept invitation", link)}
      <p style="margin:16px 0 0;font-size:14px;color:${MUTED};">
        This invitation expires in <strong>7 days</strong>. If you don’t have an account yet, sign up at
        <a href="${escapeHtml(stripTrailingSlash(PUBLIC_APP_ORIGIN))}" style="color:${BRAND};font-weight:600;text-decoration:none;">app.restify.online</a>
        using this email address, then open the link again.
      </p>
      <p style="margin:12px 0 0;font-size:13px;color:${MUTED};">
        More at <a href="${escapeHtml(stripTrailingSlash(PUBLIC_WEBSITE_ORIGIN))}" style="color:${BRAND};font-weight:600;text-decoration:none;">restify.online</a>.
      </p>
    `,
  });
  await sendTransactional({
    to,
    subject: `You're invited to "${workspaceName}" on Restify`,
    html,
    logLabel: "workspace invite",
  });
}
