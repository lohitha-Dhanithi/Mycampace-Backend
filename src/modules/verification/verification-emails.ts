import { escapeHtml, type MailMessage } from '@/common/mail/mail.service'

interface DecisionMailInput {
  to: string
  recipientName?: string | null
  applicationId: string
  institutionName: string
  signInUrl?: string
}

const greeting = (name?: string | null) => (name?.trim() ? `Dear ${name.trim()},` : 'Dear Administrator,')

const wrap = (bodyHtml: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#0f172a">${bodyHtml}<p style="margin-top:24px">Regards,<br/>MyCampace Verification Team</p></div>`

export function approvalMail(i: DecisionMailInput): MailMessage {
  const name = escapeHtml(i.institutionName)
  const id = escapeHtml(i.applicationId)
  const link = i.signInUrl ? ` You can sign in at ${i.signInUrl}.` : ''
  return {
    to: i.to,
    subject: `Your institution has been verified – Application ${i.applicationId}`,
    text: `${greeting(i.recipientName)}\n\nWe are pleased to confirm that ${i.institutionName} has been successfully verified.\n\nApplication ID: ${i.applicationId}\nInstitution: ${i.institutionName}\n\nYour administrator account can now sign in and access MyCampace.${link}\n\nRegards,\nMyCampace Verification Team`,
    html: wrap(
      `<p>${escapeHtml(greeting(i.recipientName))}</p>` +
        `<p>We are pleased to confirm that <strong>${name}</strong> has been successfully verified.</p>` +
        `<p>Application ID: <strong>${id}</strong><br/>Institution: <strong>${name}</strong></p>` +
        `<p>Your administrator account can now sign in and access MyCampace.${i.signInUrl ? ` <a href="${escapeHtml(i.signInUrl)}">Sign in</a>` : ''}</p>`,
    ),
  }
}

export function declineMail(i: DecisionMailInput & { reason: string }): MailMessage {
  const name = escapeHtml(i.institutionName)
  const id = escapeHtml(i.applicationId)
  return {
    to: i.to,
    subject: `Update on your institution application – ${i.applicationId}`,
    text: `${greeting(i.recipientName)}\n\nWe were unable to verify ${i.institutionName} at this time.\n\nApplication ID: ${i.applicationId}\n\nReason provided by the verification team:\n${i.reason}\n\nYour access remains restricted. You can correct the points above, replace the documents and submit the application again.\n\nRegards,\nMyCampace Verification Team`,
    html: wrap(
      `<p>${escapeHtml(greeting(i.recipientName))}</p>` +
        `<p>We were unable to verify <strong>${name}</strong> at this time.</p>` +
        `<p>Application ID: <strong>${id}</strong></p>` +
        `<p>Reason provided by the verification team:</p>` +
        `<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #e11d48;background:#fff1f2;white-space:pre-wrap">${escapeHtml(i.reason)}</blockquote>` +
        `<p>Your access remains restricted. You can correct the points above, replace the documents and submit the application again.</p>`,
    ),
  }
}
