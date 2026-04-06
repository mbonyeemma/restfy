import { Resend } from "resend";
import {
  EMAIL_FROM,
  PUBLIC_APP_ORIGIN,
  RESEND_API_KEY,
} from "../config/constants";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendWelcomeEmail(to: string, displayName: string): Promise<void> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping welcome email");
    return;
  }
  const name = displayName?.trim() || "there";
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: "Welcome to Restify",
    html: `
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your Restify account is ready. You can sync collections and environments across the web app and desktop client.</p>
      <p><a href="${escapeHtml(PUBLIC_APP_ORIGIN)}">Open Restify</a></p>
      <p style="color:#666;font-size:12px;margin-top:24px">— The Restify team</p>
    `,
  });
  if (error) console.error("[email] welcome send failed:", error);
}

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<void> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping password reset email");
    return;
  }
  const link = `${PUBLIC_APP_ORIGIN.replace(/\/$/, "")}/?resetPassword=${encodeURIComponent(resetToken)}`;
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: "Reset your Restify password",
    html: `
      <p>We received a request to reset your Restify password.</p>
      <p><a href="${escapeHtml(link)}">Choose a new password</a></p>
      <p style="color:#666;font-size:13px">This link expires in one hour. If you didn’t ask for this, you can ignore this email.</p>
      <p style="color:#666;font-size:12px;margin-top:24px">— Restify</p>
    `,
  });
  if (error) console.error("[email] password reset send failed:", error);
}

export async function sendTeamInviteEmail(
  to: string,
  inviterName: string,
  teamName: string,
  inviteToken: string,
  role: string
): Promise<void> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping team invite email");
    return;
  }
  const link = `${PUBLIC_APP_ORIGIN.replace(/\/$/, "")}/?teamInvite=${encodeURIComponent(inviteToken)}`;
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: `You're invited to join "${teamName}" on Restify`,
    html: `
      <p><strong>${escapeHtml(inviterName)}</strong> has invited you to join the team <strong>${escapeHtml(teamName)}</strong> as a <strong>${escapeHtml(role)}</strong> on Restify.</p>
      <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 24px;background:#ef5c35;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Accept Invitation</a></p>
      <p style="color:#666;font-size:13px">This invitation expires in 7 days. If you don't have a Restify account, you'll need to create one first.</p>
      <p style="color:#666;font-size:12px;margin-top:24px">— Restify</p>
    `,
  });
  if (error) console.error("[email] team invite send failed:", error);
}
