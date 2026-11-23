import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCheckoutBreakdown, PaymentChoice, roundCurrency } from '../src/lib/paymentFees';

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
      gatewayAccessToken,
      paymentMethod = "any"
    } = req.body;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    let resolvedUuid = hostId;
    if (supabase && hostId && hostId !== 'default') {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hostId);
      if (!isUuid) {
        try {
          const { data } = await supabase.from('event_details').select('host_id').eq('slug', hostId).maybeSingle();
          if (data?.host_id) resolvedUuid = data.host_id;
        } catch {}
      }
    }

    let accessToken = gatewayAccessToken ? String(gatewayAccessToken).trim() : '';
    if (!accessToken && supabase && resolvedUuid && resolvedUuid !== 'default') {
      try {
        const { data: rpcToken } = await supabase.rpc('get_host_access_token', { host_id_param: resolvedUuid });
        if (rpcToken && typeof rpcToken === 'string') accessToken = rpcToken.trim();
      } catch {}
    }
    if (!accessToken) {
      accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "APP_USR-5302990072214596-080318-1c8251db5cc695db84a123841599bc20-3587153803";
    }

    if (!accessToken) {
      return res.status(400).json({ error: "Access token is required" });
    }

    let authoritativeTitle = String(title || "Presente de Casamento");
    let authoritativePrice = Number(price);

    if (supabase && giftId) {
      try {
        const { data: giftData } = await supabase.from('gifts').select('id, title, price').eq('id', giftId).maybeSingle();
        if (giftData) {
          if (giftData.title) authoritativeTitle = giftData.title;
          if (giftData.price !== undefined && giftData.price !== null && Number(giftData.price) > 0) {
            authoritativePrice = Number(giftData.price);
          }
        }
      } catch {}
    }

    if (!Number.isFinite(authoritativePrice) || authoritativePrice <= 0) {
      return res.status(400).json({ error: "Valor do presente inválido." });
    }

    // Read fee settings from RPC if available, defaulting to passFeesToBuyer: true (0.99% Pix / 4.98% Card)
    let passFeesToBuyer = true;
    let pixFeePercent = 0.99;
    let cardFeePercent = 4.98;

    if (supabase && resolvedUuid && resolvedUuid !== 'default') {
      try {
        const { data: rpcConfig } = await supabase.rpc('get_public_payment_config', { host_id_param: resolvedUuid });
        if (rpcConfig && typeof rpcConfig === 'object') {
          passFeesToBuyer = (rpcConfig as any).passFeesToBuyer !== false;
          pixFeePercent = Number((rpcConfig as any).pixFeePercent ?? 0.99);
          cardFeePercent = Number((rpcConfig as any).cardFeePercent ?? 4.98);
        }
      } catch {}
    }

    let normalizedChoice: PaymentChoice | 'any' = 'any';
    if (paymentMethod === 'mp_pix' || paymentMethod === 'pix') normalizedChoice = 'mp_pix';
    else if (paymentMethod === 'mp_card' || paymentMethod === 'card') normalizedChoice = 'mp_card';

    const breakdown = normalizedChoice === 'any'
      ? { netAmount: roundCurrency(authoritativePrice), grossAmount: roundCurrency(authoritativePrice), feeAmount: 0, feePercent: 0 }
      : getCheckoutBreakdown(authoritativePrice, normalizedChoice, {
          passFeesToBuyer,
          pixFeePercent,
          cardFeePercent
        });

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

    const excludedPaymentTypes: Array<{ id: string }> = [];
    let maxInstallments = 12;

    if (normalizedChoice === 'mp_pix') {
      excludedPaymentTypes.push(
        { id: 'credit_card' },
        { id: 'debit_card' },
        { id: 'prepaid_card' },
        { id: 'ticket' },
        { id: 'atm' }
      );
      maxInstallments = 1;
    } else if (normalizedChoice === 'mp_card') {
      excludedPaymentTypes.push(
        { id: 'bank_transfer' },
        { id: 'ticket' },
        { id: 'atm' }
      );
      maxInstallments = 12;
    }

    const itemTitle = breakdown.feeAmount > 0
      ? `${authoritativeTitle} (inclui taxa de processamento)`
      : authoritativeTitle;

    const result = await preference.create({
      body: {
        items: [
          {
            id: String(giftId || "gift"),
            title: itemTitle,
            quantity: Number(quantity) || 1,
            unit_price: breakdown.grossAmount
          }
        ],
        payer: payerObj,
        back_urls: {
          success: `${baseUrl}/e/${hostId}/pagamento/sucesso`,
          failure: `${baseUrl}/e/${hostId}/pagamento/falha`,
          pending: `${baseUrl}/e/${hostId}/pagamento/pendente`
        },
        payment_methods: {
          installments: maxInstallments,
          excluded_payment_types: excludedPaymentTypes,
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
          donor_message: donorMessage,
          payment_choice: normalizedChoice,
          gift_net_price: breakdown.netAmount,
          gross_amount: breakdown.grossAmount,
          fee_amount: breakdown.feeAmount,
          fee_passed_to_buyer: passFeesToBuyer ? 'true' : 'false'
        }
      }
    });

    res.json({ init_point: result.init_point, preference_id: result.id, external_reference: extRef, breakdown });
  } catch (error: any) {
    console.error("Error creating preference:", error?.message || error);
    res.status(500).json({ error: "Failed to create preference", details: error?.message || error });
  }
}
