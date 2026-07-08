// Resend (free tier: 100 emails/day, 3,000/month) via plain fetch — no SDK.
export async function sendEmail(opts: { subject: string; html: string; text: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.DIGEST_FROM,
      to: [process.env.DIGEST_TO],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
