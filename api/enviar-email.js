export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { to, subject, text, html } = req.body || {};
  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes (to, subject, text/html).' });
  }

  try {
    // Usa Resend (gratuito até 3.000 e-mails/mês) se RESEND_API_KEY estiver na Vercel
    if (process.env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_REMETENTE || 'No Compasso Studio <onboarding@resend.dev>',
          to: Array.isArray(to) ? to : [to],
          subject,
          text,
          html: html || `<div style="font-family:sans-serif;white-space:pre-line;line-height:1.6">${text}</div>`,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: data.message || 'Erro no provedor de e-mail' });
      }
      return res.status(200).json({ ok: true, id: data.id });
    }

    return res.status(200).json({
      ok: true,
      modoSimulacao: true,
      aviso: 'Configure RESEND_API_KEY nas variáveis de ambiente da Vercel para disparo real.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
