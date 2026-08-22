import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: nodemailer.Transporter | null = null;
let etherealAccount: { user: string; pass: string } | null = null;

export async function initEmailTransporter(): Promise<void> {
  if (env.SMTP_USER && env.SMTP_PASS) {
    etherealAccount = { user: env.SMTP_USER, pass: env.SMTP_PASS };
    console.log(`Using provided Ethereal account: ${env.SMTP_USER}`);
  } else {
    const testAccount = await nodemailer.createTestAccount();
    etherealAccount = { user: testAccount.user, pass: testAccount.pass };
    console.log(`Created Ethereal test account: ${testAccount.user}`);
    console.log(`   Password: ${testAccount.pass}`);
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: {
      user: etherealAccount.user,
      pass: etherealAccount.pass,
    },
  });

  try {
    await transporter.verify();
    console.log('SMTP transporter verified');
  } catch (err) {
    console.error(' SMTP verification failed (will retry on send):', (err as Error).message);
  }
}

export async function sendEmail(
  to: string,
  from: string,
  subject: string,
  body: string
): Promise<{ messageId: string; previewUrl: string | null }> {
  if (!transporter) {
    await initEmailTransporter();
  }

  const info = await transporter!.sendMail({
    from: `"ReachInbox" <${from}>`,
    to,
    subject,
    html: body,
    text: body.replace(/<[^>]*>/g, ''),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;

  console.log(`Email sent to ${to} | MessageID: ${info.messageId} | Preview: ${previewUrl}`);

  return {
    messageId: info.messageId,
    previewUrl: typeof previewUrl === 'string' ? previewUrl : null,
  };
}

export function getEtherealCredentials() {
  return etherealAccount;
}
