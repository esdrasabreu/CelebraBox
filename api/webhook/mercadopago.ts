import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const body = req.body || {};
    const query = req.query || {};

    const type = body.type || query.type;
    const action = body.action || query.action || query.topic;
    const paymentId = body.data?.id || body.id || query.id || query['data.id'];

    if (paymentId && (type === 'payment' || action === 'payment' || action === 'payment.created' || action === 'payment.updated' || !type)) {
      const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "APP_USR-5302990072214596-080318-1c8251db5cc695db84a123841599bc20-3587153803";
      
      const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
      const paymentClient = new Payment(client);
      
      const paymentInfo = await paymentClient.get({ id: String(paymentId) });

      if (paymentInfo && paymentInfo.status === 'approved') {
        const externalReference = paymentInfo.external_reference || '';
        const paymentMethodId = paymentInfo.payment_method_id;
        const paymentTypeId = paymentInfo.payment_type_id;
        const amount = Number(paymentInfo.transaction_amount || 0);

        let methodFriendly = 'PIX';
        if (paymentMethodId === 'pix') methodFriendly = 'PIX';
        else if (paymentTypeId === 'credit_card') methodFriendly = 'Cartão de Crédito';
        else if (paymentTypeId === 'debit_card') methodFriendly = 'Cartão de Débito';
        else if (paymentTypeId === 'ticket') methodFriendly = 'Boleto';

        let hostId = paymentInfo.metadata?.host_id || '';
        let giftId = paymentInfo.metadata?.gift_id || '';
        let donorName = paymentInfo.metadata?.donor_name || 'Convidado';
        let giftTitle = paymentInfo.additional_info?.items?.[0]?.title || 'Presente';

        if (externalReference && externalReference.includes(':')) {
          const parts = externalReference.split(':');
          if (parts[0] && !hostId) hostId = parts[0];
          if (parts[1] && !giftId) giftId = parts[1];
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
        const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

        if (supabase) {
          // Decrement gift quantity
          if (giftId) {
            try {
              const { data: currentGift } = await supabase.from('gifts').select('id, quantity').eq('id', giftId).maybeSingle();
              if (currentGift && currentGift.quantity !== undefined && currentGift.quantity > 0) {
                await supabase.from('gifts').update({ quantity: Math.max(0, currentGift.quantity - 1) }).eq('id', giftId);
              }
            } catch (gErr) {
              console.warn("Could not decrement gift quantity:", gErr);
            }
          }

          // Insert transaction with standard columns
          if (hostId) {
            try {
              await supabase.from('transactions').insert([{
                host_id: hostId,
                gift_title: giftTitle,
                donor_name: donorName,
                amount: amount,
                method: methodFriendly,
                status: 'approved'
              }]);
            } catch (tErr) {
              console.warn("Could not insert transaction in Supabase:", tErr);
            }
          }
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(200).send('OK');
  }
}