import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Simple in-memory rate limiter (per Vercel cold start — resets on new instance)
const submissions = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 submissions per IP per minute

function isRateLimited(ip) {
  const now = Date.now();
  const entry = submissions.get(ip);
  if (!entry || now - entry.firstRequest > RATE_LIMIT_WINDOW) {
    submissions.set(ip, { firstRequest: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Sanitize user input to prevent XSS in email HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  // CORS — only allow requests from your own domain
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://www.grgindia.in',
    'https://grgindia.in',
    'https://grgindia-website.vercel.app',
  ];
  if (origin && !allowedOrigins.some((o) => origin.startsWith(o))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  try {
    const { name, email, phone, company, teamSize, message, website, formSource } = req.body;

    // Honeypot check
    if (website) {
      return res.status(200).json({ success: true });
    }

    if (!name || !email || !phone || !company || !teamSize) {
      return res.status(400).json({ error: 'Name, email, phone, company, and team size are required.' });
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    // Sanitize all inputs
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);
    const safeCompany = escapeHtml(company);
    const safeTeamSize = escapeHtml(teamSize);
    const safeMessage = escapeHtml(message);

    const sourceLabel = {
      'book-a-demo': 'Book a Demo',
      'buzzz-book-a-demo': 'Buzzz Demo',
      'book-a-demo-myincentives': 'My Incentives Demo',
      'contact-us': 'Contact Us',
    }[formSource] || 'Website Form';

    const isDemoForm = formSource !== 'contact-us';

    const subject = isDemoForm
      ? `New Demo Request from ${safeName} (${safeCompany})`
      : `New Contact Enquiry from ${safeName} (${safeCompany})`;

    const html = `
      <h2>${sourceLabel}</h2>
      <table style="border-collapse:collapse;width:100%;max-width:500px;font-family:sans-serif;">
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Name</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${safeName}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Email</td><td style="padding:8px 12px;border-bottom:1px solid #eee;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${safePhone}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Company</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${safeCompany}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Team Size</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${safeTeamSize}</td></tr>
        ${safeMessage ? `<tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Message</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${safeMessage}</td></tr>` : ''}
      </table>
      <p style="margin-top:16px;font-size:12px;color:#999;">Sent from grgindia.in &mdash; ${sourceLabel} form</p>
    `;

    await resend.emails.send({
      from: 'GRG India Website <noreply@grgindia.in>',
      to: 'contactus@grgindia.in',
      replyTo: email,
      subject,
      html,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({ error: 'Failed to send email. Please try again.' });
  }
}
