// api/criar-pagamento-mp.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({
      error: 'MP_ACCESS_TOKEN não configurado nas variáveis de ambiente da Vercel.',
    });
  }

  try {
    const {
      inscricaoId,
      tituloEvento,
      descricaoItem,
      dataSessao,
      qtdInteira,
      valorInteira,
      qtdMeia,
      valorMeia,
      compradorNome,
      compradorEmail,
      originUrl,
      returnPath,
    } = req.body;

    const items = [];

    if (Number(qtdInteira) > 0) {
      items.push({
        id: `${inscricaoId}_inteira`,
        title: descricaoItem || `${tituloEvento} (${dataSessao}) - Ingresso Inteira`,
        quantity: Number(qtdInteira),
        currency_id: 'BRL',
        unit_price: Number(valorInteira),
      });
    }

    if (Number(qtdMeia) > 0) {
      items.push({
        id: `${inscricaoId}_meia`,
        title: `${tituloEvento} (${dataSessao}) - Meia-Entrada`,
        quantity: Number(qtdMeia),
        currency_id: 'BRL',
        unit_price: Number(valorMeia),
      });
    }

    const baseUrl = originUrl || 'https://studio-danca-app.vercel.app';
    const destinoRetorno = returnPath ? `${baseUrl}${returnPath}` : `${baseUrl}/`;
    const separador = destinoRetorno.includes('?') ? '&' : '?';

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items,
        payer: {
          name: compradorNome,
          email: compradorEmail || 'cliente@nocompasso.com.br',
        },
        external_reference: inscricaoId,
        back_urls: {
          success: `${destinoRetorno}${separador}mp_status=approved&ref=${inscricaoId}`,
          failure: `${destinoRetorno}${separador}mp_status=failure&ref=${inscricaoId}`,
          pending: `${destinoRetorno}${separador}mp_status=pending&ref=${inscricaoId}`,
        },
        auto_return: 'approved',
        statement_descriptor: 'NO COMPASSO STUDIO',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: data.message || 'Erro no Mercado Pago', details: data });
    }

    return res.status(200).json({
      id: data.id,
      init_point: data.init_point,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
