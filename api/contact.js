import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, phone, company, teamSize, message, website, formSource } = req.body;

    // Honeypot check — bots fill this hidden field, real users don't
    if (website) {
      return res.status(200).json({ success: true });
    }

    if (!name || !email || !phone || !company || !teamSize) {
      return res.status(400).json({ error: 'Name, email, phone, company, and team size are required.' });
    }

    // Determine form type from source
    const sourceLabel = {
      'book-a-demo': 'Book a Demo',
      'buzzz-book-a-demo': 'Buzzz Demo',
      'book-a-demo-myincentives': 'My Incentives Demo',
      'contact-us': 'Contact Us',
    }[formSource] || 'Website Form';

    const isDemoForm = formSource !== 'contact-us';

    const subject = isDemoForm
      ? `New Demo Request from ${name} (${company})`
      : `New Contact Enquiry from ${name} (${company})`;

    const html = `
      <h2>${sourceLabel}</h2>
      <table style="border-collapse:collapse;width:100%;max-width:500px;font-family:sans-serif;">
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Name</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${name}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Email</td><td style="padding:8px 12px;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${phone}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Company</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${company}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Team Size</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${teamSize}</td></tr>
        ${message ? `<tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Message</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${message}</td></tr>` : ''}
      </table>
      <p style="margin-top:16px;font-size:12px;color:#999;">Sent from grgindia.in — ${sourceLabel} form</p>
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
