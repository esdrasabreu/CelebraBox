import { MercadoPagoConfig, Preference } from 'mercadopago';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { title, price, quantity, giftId, donorName, hostId, externalReference } = req.body;
    
    // Utilize token de plataforma em vez de buscar token do anfitrião
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "APP_USR-5302990072214596-080318-1c8251db5cc695db84a123841599bc20-3587153803";

    if (!accessToken) {
      return res.status(400).json({ error: "Access token is required" });
    }

    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
    const preference = new Preference(client);

    let baseUrl = req.headers.origin;
    if (!baseUrl) {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      let host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      if (typeof host === 'string' && host.includes('0.0.0.0')) host = host.replace('0.0.0.0', 'localhost');
      baseUrl = `${protocol}://${host}`;
    }

    const result = await preference.create({
      body: {
        items: [
          {
            id: giftId || "gift",
            title: title,
            quantity: quantity || 1,
            unit_price: Number(price)
          }
        ],
        payer: {
          name: donorName || "Convidado",
          email: "convidado_" + Date.now() + "@testuser.com"
        },
        back_urls: {
          success: `${baseUrl}/e/${hostId}/pagamento/sucesso`,
          failure: `${baseUrl}/e/${hostId}/pagamento/falha`,
          pending: `${baseUrl}/e/${hostId}/pagamento/pendente`
        },
        payment_methods: {
          installments: 12,
          excluded_payment_types: [],
          excluded_payment_methods: []
        },
        auto_return: "approved",
        statement_descriptor: "PRESENTE",
        external_reference: externalReference,
        notification_url: `${baseUrl}/api/webhook/mercadopago`,
        metadata: {
          host_id: hostId,
          gift_id: giftId
        }
      }
    });

    res.json({ init_point: result.init_point, preference_id: result.id });
  } catch (error) {
    console.error("Error creating preference:", error);
    res.status(500).json({ error: "Failed to create preference" });
  }
}
