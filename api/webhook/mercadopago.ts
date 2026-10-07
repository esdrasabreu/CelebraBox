import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { type, data } = req.body;
    const action = req.body.action || req.query.topic;

    if (type === 'payment' || action === 'payment') {
      const paymentId = data?.id || req.query.id;
      if (!paymentId) return res.status(400).json({ error: 'Missing payment ID' });

      const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "APP_USR-5302990072214596-080318-1c8251db5cc695db84a123841599bc20-3587153803";
      
      const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
      const paymentClient = new Payment(client);
      
      const paymentInfo = await paymentClient.get({ id: paymentId });

      if (paymentInfo) {
        const status = paymentInfo.status;
        const externalReference = paymentInfo.external_reference;
        const paymentMethodId = paymentInfo.payment_method_id;
        const paymentTypeId = paymentInfo.payment_type_id;
        
        let normalizedStatus = status;
        if (status === 'approved') normalizedStatus = 'approved';
        else if (status === 'rejected') normalizedStatus = 'rejected';
        else if (status === 'pending') normalizedStatus = 'pending';
        else if (status === 'in_process') normalizedStatus = 'in_process';
        else if (status === 'cancelled') normalizedStatus = 'cancelled';
        else if (status === 'refunded') normalizedStatus = 'refunded';

        let methodFriendly = 'Outro';
        if (paymentMethodId === 'pix') methodFriendly = 'PIX';
        else if (paymentTypeId === 'credit_card') methodFriendly = 'Cartão de Crédito';
        else if (paymentTypeId === 'debit_card') methodFriendly = 'Cartão de Débito';
        else if (paymentTypeId === 'ticket') methodFriendly = 'Boleto';

        const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
        const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

        if (supabase && externalReference) {
          // Update transaction in Supabase idempotently
          await supabase.from('transactions')
            .update({ 
              status: normalizedStatus,
              method: methodFriendly,
              payment_id: String(paymentId)
            })
            .eq('external_reference', externalReference);
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}