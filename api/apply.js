import { Resend } from 'resend';
import { Buffer } from 'node:buffer';

const resend = new Resend(process.env.RESEND_API_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

// Rate limiter
const submissions = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 3; // max 3 applications per IP per minute

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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Parse multipart form data manually (lightweight, no external deps)
async function parseMultipart(req) {
  const chunks = [];
  let totalSize = 0;
  for await (const chunk of req) {
    totalSize += chunk.length;
    if (totalSize > MAX_FILE_SIZE + 100000) {
      throw new Error('Upload too large');
    }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) throw new Error('No boundary found');

  const boundary = boundaryMatch[1];
  const parts = body.toString('latin1').split(`--${boundary}`).slice(1, -1);

  const fields = {};
  let fileData = null;
  let fileName = null;
  let fileMime = null;

  for (const part of parts) {
    const [rawHeaders, ...rawBodyParts] = part.split('\r\n\r\n');
    const rawBody = rawBodyParts.join('\r\n\r\n').replace(/\r\n$/, '');

    const nameMatch = rawHeaders.match(/name="([^"]+)"/);
    const filenameMatch = rawHeaders.match(/filename="([^"]+)"/);
    const mimeMatch = rawHeaders.match(/Content-Type:\s*(.+)/i);

    if (!nameMatch) continue;

    if (filenameMatch && filenameMatch[1]) {
      fileName = filenameMatch[1];
      fileMime = mimeMatch ? mimeMatch[1].trim() : 'application/octet-stream';
      const headerEnd = body.indexOf('\r\n\r\n', body.indexOf(nameMatch[0]));
      const partStart = headerEnd + 4;
      const partBoundary = Buffer.from(`\r\n--${boundary}`);
      const partEnd = body.indexOf(partBoundary, partStart);
      fileData = body.slice(partStart, partEnd);
    } else {
      fields[nameMatch[1]] = rawBody;
    }
  }

  return { fields, fileData, fileName, fileMime };
}

export default async function handler(req, res) {
  // CORS
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
    const { fields, fileData, fileName, fileMime } = await parseMultipart(req);
    const { email, phone, role } = fields;

    if (!email || !phone) {
      return res.status(400).json({ error: 'Email and phone are required.' });
    }

    // Email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    // File validation
    if (fileData) {
      if (fileData.length > MAX_FILE_SIZE) {
        return res.status(400).json({ error: 'File too large. Maximum 5MB allowed.' });
      }
      if (fileMime && !ALLOWED_MIME_TYPES.includes(fileMime)) {
        return res.status(400).json({ error: 'Invalid file type. Only PDF, DOC, and DOCX are accepted.' });
      }
    }

    const safeRole = escapeHtml(role) || 'Unknown Role';
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);

    const html = `
      <h2>New Job Application: ${safeRole}</h2>
      <table style="border-collapse:collapse;width:100%;max-width:500px;font-family:sans-serif;">
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Role</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${safeRole}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Email</td><td style="padding:8px 12px;border-bottom:1px solid #eee;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${safePhone}</td></tr>
      </table>
      <p style="margin-top:16px;font-size:12px;color:#999;">Sent from grgindia.in Careers application form</p>
    `;

    const attachments = [];
    if (fileData && fileName) {
      // Sanitize filename
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      attachments.push({
        filename: safeFileName,
        content: fileData,
        contentType: fileMime,
      });
    }

    await resend.emails.send({
      from: 'GRG India Careers <noreply@grgindia.in>',
      to: 'GRI-Hr@grgindia.in',
      replyTo: email,
      subject: `Job Application: ${safeRole} — ${safeEmail}`,
      html,
      attachments,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    if (error.message === 'Upload too large') {
      return res.status(400).json({ error: 'File too large. Maximum 5MB allowed.' });
    }
    console.error('Application email error:', error);
    return res.status(500).json({ error: 'Failed to send application. Please try again.' });
  }
}
