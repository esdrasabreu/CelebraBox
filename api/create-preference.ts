import { MercadoPagoConfig, Preference } from 'mercadopago';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { 
      title, 
      price, 
      quantity = 1, 
      giftId, 
      donorName = "Convidado", 
      donorMessage = "",
      hostId = "default", 
      externalReference, 
      gatewayAccessToken 
    } = req.body;
    
    const accessToken = gatewayAccessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "APP_USR-5302990072214596-080318-1c8251db5cc695db84a123841599bc20-3587153803";

    if (!accessToken) {
      return res.status(400).json({ error: "Access token is required" });
    }

    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
    const preference = new Preference(client);

    let baseUrl = req.headers.origin;
    if (!baseUrl) {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      let host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      if (typeof host === 'string' && host.includes('0.0.0.0')) host = host.replace('0.0.0.0', 'localhost');
      baseUrl = `${protocol}://${host}`;
    }

    const payerObj: any = {
      name: (donorName && String(donorName).trim()) || "Convidado"
    };

    const isPublicUrl = typeof baseUrl === 'string' && baseUrl.startsWith('https://') && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1');
    const extRef = externalReference || `${hostId}:${giftId || 'gift'}:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const result = await preference.create({
      body: {
        items: [
          {
            id: String(giftId || "gift"),
            title: title || "Presente de Casamento",
            quantity: Number(quantity) || 1,
            unit_price: Number(price)
          }
        ],
        payer: payerObj,
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
        external_reference: extRef,
        ...(isPublicUrl ? { notification_url: `${baseUrl}/api/webhook/mercadopago` } : {}),
        metadata: {
          host_id: hostId,
          gift_id: giftId,
          donor_name: donorName,
          donor_message: donorMessage
        }
      }
    });

    res.json({ init_point: result.init_point, preference_id: result.id, external_reference: extRef });
  } catch (error: any) {
    console.error("Error creating preference:", error?.message || error);
    res.status(500).json({ error: "Failed to create preference", details: error?.message || error });
  }
}
