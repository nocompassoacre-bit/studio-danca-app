export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { to, subject, text, html } = req.body || {};
  if (!to || !subject || (!text && !html)) {
    return res
      .status(400)
      .json({ error: 'Campos obrigatórios ausentes (to, subject, text/html).' });
  }

  const brevoApiKey = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY;
  const senderEmail =
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_REMETENTE ||
    'nocompasso.acre@gmail.com';
  const senderName =
    process.env.BREVO_SENDER_NAME || 'No Compasso Studio de Dança';

  if (!brevoApiKey) {
    return res.status(500).json({
      error:
        'Chave BREVO_API_KEY não encontrada nas variáveis de ambiente da Vercel.',
    });
  }

  try {
    const destinatarios = (Array.isArray(to) ? to : [to]).map((email) =>
      typeof email === 'string' ? { email: email.trim() } : email
    );

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: destinatarios,
        subject,
        textContent: text || '',
        htmlContent:
          html ||
          `<div style="font-family: Arial, sans-serif; color: #18181b; line-height: 1.6; white-space: pre-line;">${text}</div>`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.message || 'Erro ao enviar e-mail via Brevo',
        detalhes: data,
      });
    }

    return res.status(200).json({ ok: true, messageId: data.messageId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
