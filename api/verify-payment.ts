import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const paymentId = (req.query.payment_id || req.query.id) as string;
  const hostId = (req.query.hostId || 'default') as string;

  if (!paymentId) {
    return res.status(400).json({ error: "Missing payment_id" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  let accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "APP_USR-5302990072214596-080318-1c8251db5cc695db84a123841599bc20-3587153803";

  if (supabase && hostId && hostId !== 'default') {
    try {
      const { data: pSettings } = await supabase.from('payment_settings').select('gateway_access_token').eq('host_id', hostId).maybeSingle();
      if (pSettings?.gateway_access_token) {
        accessToken = pSettings.gateway_access_token;
      }
    } catch (e) {
      // ignore
    }
  }

  try {
    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
    const paymentClient = new Payment(client);
    const paymentInfo = await paymentClient.get({ id: String(paymentId) });

    if (paymentInfo) {
      const status = paymentInfo.status;
      const externalReference = paymentInfo.external_reference || '';
      const amount = Number(paymentInfo.transaction_amount || 0);

      let methodFriendly = 'PIX';
      if (paymentInfo.payment_method_id === 'pix') methodFriendly = 'PIX';
      else if (paymentInfo.payment_type_id === 'credit_card') methodFriendly = 'Cartão de Crédito';
      else if (paymentInfo.payment_type_id === 'debit_card') methodFriendly = 'Cartão de Débito';
      else if (paymentInfo.payment_type_id === 'ticket') methodFriendly = 'Boleto';

      let targetHost = paymentInfo.metadata?.host_id || hostId;
      let giftId = paymentInfo.metadata?.gift_id || '';
      let donorName = paymentInfo.metadata?.donor_name || paymentInfo.payer?.first_name || 'Convidado';
      let giftTitle = paymentInfo.additional_info?.items?.[0]?.title || paymentInfo.description || 'Presente';

      if (externalReference && externalReference.includes(':')) {
        const parts = externalReference.split(':');
        if (parts[0] && !targetHost) targetHost = parts[0];
        if (parts[1] && !giftId) giftId = parts[1];
      }

      if (status === 'approved' && supabase) {
        try {
          let existing: any = null;
          if (paymentId) {
            const { data } = await supabase.from('transactions').select('id').eq('payment_id', String(paymentId)).maybeSingle();
            existing = data;
          }
          if (!existing && externalReference) {
            const { data } = await supabase.from('transactions').select('id').eq('external_reference', externalReference).maybeSingle();
            existing = data;
          }

          if (!existing) {
            await supabase.from('transactions').insert([{
              host_id: targetHost,
              gift_title: giftTitle,
              gift_id: giftId || null,
              donor_name: donorName,
              amount: amount,
              method: methodFriendly,
              status: 'approved',
              payment_id: String(paymentId),
              external_reference: externalReference,
              date: paymentInfo.date_approved || paymentInfo.date_created
            }]);
          } else {
            await supabase.from('transactions').update({
              status: 'approved',
              method: methodFriendly,
              amount,
              payment_id: String(paymentId)
            }).eq('id', existing.id);
          }

          if (giftId) {
            const { data: currentGift } = await supabase.from('gifts').select('id, quantity').eq('id', giftId).maybeSingle();
            if (currentGift && currentGift.quantity !== undefined && currentGift.quantity > 0) {
              await supabase.from('gifts').update({ quantity: Math.max(0, currentGift.quantity - 1) }).eq('id', giftId);
            }
          }
        } catch (dbErr) {
          console.warn("Could not record payment verification to Supabase:", dbErr);
        }
      }

      return res.status(200).json({
        success: true,
        status: paymentInfo.status,
        method: methodFriendly,
        amount: paymentInfo.transaction_amount,
        date: paymentInfo.date_approved || paymentInfo.date_created
      });
    }

    return res.status(404).json({ error: "Payment not found" });
  } catch (err: any) {
    console.error("Error verifying payment in /api/verify-payment:", err);
    return res.status(500).json({ error: "Verification failed", details: err?.message || err });
  }
}
