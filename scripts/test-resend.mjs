
import 'dotenv/config';
import { Resend } from 'resend';

async function testResend() {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is missing from .env');
    process.exitCode = 1;
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    to: ['delivered@resend.dev'],
    subject: 'OBLIVION - Resend Integration Test',
    html: `
      <h2>OBLIVION Privacy OS</h2>
      <p>Resend API integration test.</p>
      <p>If this request is accepted, the Resend test delivery event can be checked in your dashboard.</p>
    `,
  });

  if (error) {
    console.error('Resend test failed:', error);
    process.exitCode = 1;
    return;
  }

  console.log('Resend accepted the test email!');
  console.log('Email ID:', data.id);
}

testResend().catch((error) => {
  console.error('Unexpected error:', error);
  process.exitCode = 1;
});
