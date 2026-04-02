import { Resend } from 'resend';
import { Buffer } from 'node:buffer';

const resend = new Resend(process.env.RESEND_API_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

// Parse multipart form data manually (lightweight, no external deps)
async function parseMultipart(req) {
  const chunks = [];
  for await (const chunk of req) {
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
      // Re-extract binary data from the original buffer
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fields, fileData, fileName, fileMime } = await parseMultipart(req);
    const { email, phone, role } = fields;

    if (!email || !phone) {
      return res.status(400).json({ error: 'Email and phone are required.' });
    }

    const roleTitle = role || 'Unknown Role';

    const html = `
      <h2>New Job Application: ${roleTitle}</h2>
      <table style="border-collapse:collapse;width:100%;max-width:500px;font-family:sans-serif;">
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Role</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${roleTitle}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Email</td><td style="padding:8px 12px;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${phone}</td></tr>
      </table>
      <p style="margin-top:16px;font-size:12px;color:#999;">Sent from grgindia.in Careers application form</p>
    `;

    const attachments = [];
    if (fileData && fileName) {
      attachments.push({
        filename: fileName,
        content: fileData,
        contentType: fileMime,
      });
    }

    await resend.emails.send({
      from: 'GRG India Careers <noreply@grgindia.in>',
      to: 'GRI-Hr@grgindia.in',
      replyTo: email,
      subject: `Job Application: ${roleTitle} — ${email}`,
      html,
      attachments,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Application email error:', error);
    return res.status(500).json({ error: 'Failed to send application. Please try again.' });
  }
}
