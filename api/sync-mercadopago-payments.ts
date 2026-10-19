import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const hostId = (req.body?.hostId || req.query?.hostId || 'default') as string;
    const clientProvidedToken = (req.body?.gatewayAccessToken || '') as string;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    
    // Check for user session auth header from request
    const authHeader = req.headers.authorization;
    const userJwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: userJwt ? { Authorization: `Bearer ${userJwt}` } : {}
      }
    }) : null;

    // Resolve Mercado Pago Access Token
    let accessToken = clientProvidedToken.trim();

    if (!accessToken && supabase && hostId && hostId !== 'default') {
      try {
        const { data: pSettings } = await supabase
          .from('payment_settings')
          .select('gateway_access_token')
          .eq('host_id', hostId)
          .maybeSingle();

        if (pSettings?.gateway_access_token) {
          accessToken = pSettings.gateway_access_token.trim();
        }
      } catch (dbErr) {
        console.warn("Could not fetch payment_settings for host:", dbErr);
      }
    }

    if (!accessToken) {
      accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || 
                    process.env.MP_ACCESS_TOKEN || 
                    "APP_USR-5302990072214596-080318-1c8251db5cc695db84a123841599bc20-3587153803";
    }

    if (!accessToken) {
      return res.status(400).json({ error: "Nenhum token do Mercado Pago configurado." });
    }

    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 15000 } });
    const paymentClient = new Payment(client);

    const searchResult = await paymentClient.search({
      options: {
        sort: 'date_created',
        criteria: 'desc',
        limit: 50,
        begin_date: 'NOW-30DAYS',
        end_date: 'NOW'
      }
    });

    const results = searchResult.results || [];
    let importedCount = 0;

    // Resolve target host UUID and Slug for strict account isolation
    let targetUuid = hostId;
    let targetSlug = hostId;
    if (supabase && hostId && hostId !== 'default') {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hostId);
      if (!isUuid) {
        targetSlug = hostId;
        try {
          const { data: eventData } = await supabase.from('event_details').select('host_id').eq('slug', hostId).maybeSingle();
          if (eventData?.host_id) targetUuid = eventData.host_id;
        } catch (e) {}
      } else {
        targetUuid = hostId;
        try {
          const { data: eventData } = await supabase.from('event_details').select('slug').eq('host_id', hostId).maybeSingle();
          if (eventData?.slug) targetSlug = eventData.slug;
        } catch (e) {}
      }
    }

    for (const p of results) {
      if (p.status === 'approved') {
        const paymentId = String(p.id);
        const externalReference = (p.external_reference || '').trim();
        const amount = Number(p.transaction_amount || 0);

        let methodFriendly = 'PIX';
        if (p.payment_method_id === 'pix') methodFriendly = 'PIX';
        else if (p.payment_type_id === 'credit_card') methodFriendly = 'Cartão de Crédito';
        else if (p.payment_type_id === 'debit_card') methodFriendly = 'Cartão de Débito';
        else if (p.payment_type_id === 'ticket') methodFriendly = 'Boleto';

        let itemHostId = p.metadata?.host_id || '';
        let giftId = p.metadata?.gift_id || '';
        let donorName = p.metadata?.donor_name || (p.payer as any)?.first_name || p.payer?.email || 'Convidado';
        let giftTitle = p.additional_info?.items?.[0]?.title || p.description || 'Presente';

        if (externalReference && externalReference.includes(':')) {
          const parts = externalReference.split(':');
          if (parts.length >= 2) {
            if (!itemHostId) itemHostId = parts[0];
            if (!giftId) giftId = parts[1];
          }
        }

        // STRICT VALIDATION: A transaction MUST be a wedding gift from our app!
        // Ignore personal purchases (Mercado Livre, personal Pix, bank transfers, etc.)
        if (!giftId || !itemHostId) {
          continue; // Discard: not a wedding gift!
        }
        if (externalReference.startsWith('20000') || externalReference.startsWith('POTS') || externalReference.startsWith('11081')) {
          continue; // Discard Mercado Livre and Cofrinho transfers
        }

        // STRICT ACCOUNT ISOLATION: Each account ONLY sees gifts sold on ITS OWN list!
        const matchesThisHost = (
          itemHostId === hostId ||
          (targetSlug && itemHostId === targetSlug) ||
          (targetUuid && itemHostId === targetUuid) ||
          externalReference.startsWith(`${hostId}:`) ||
          (targetSlug && externalReference.startsWith(`${targetSlug}:`)) ||
          (targetUuid && externalReference.startsWith(`${targetUuid}:`))
        );

        if (!matchesThisHost) {
          continue; // Discard: belongs to another event/host!
        }

        const effectiveHostId = targetUuid || targetSlug || hostId;

        // 1. Sync to Supabase
        if (supabase) {
          try {
            // Check if already recorded
            const { data: existingTx } = await supabase
              .from('transactions')
              .select('id, status')
              .eq('payment_id', paymentId)
              .maybeSingle();

            if (!existingTx) {
              await supabase.from('transactions').insert([{
                host_id: effectiveHostId,
                gift_title: giftTitle,
                gift_id: giftId || null,
                donor_name: donorName,
                amount: amount,
                method: methodFriendly,
                status: 'approved',
                payment_id: paymentId,
                external_reference: externalReference || null,
                date: p.date_approved || p.date_created || new Date().toISOString()
              }]);
              importedCount++;
            } else if (existingTx.status !== 'approved' && existingTx.status !== 'Concluído') {
              await supabase.from('transactions')
                .update({ status: 'approved', method: methodFriendly, amount: amount })
                .eq('payment_id', paymentId);
              importedCount++;
            }

            // Decrement gift quantity if applicable
            if (giftId) {
              try {
                const { data: giftData } = await supabase
                  .from('gifts')
                  .select('id, quantity')
                  .eq('id', giftId)
                  .maybeSingle();

                if (giftData && giftData.quantity !== undefined && giftData.quantity > 0) {
                  await supabase
                    .from('gifts')
                    .update({ quantity: Math.max(0, giftData.quantity - 1) })
                    .eq('id', giftId);
                }
              } catch (gErr) {
                console.warn("Could not decrement gift in Supabase:", gErr);
              }
            }
          } catch (supErr) {
            console.warn("Supabase sync warning:", supErr);
          }
        }

        // 2. Also try updating server store if local filesystem is available
        try {
          const { confirmPayment } = await import('../server_store');
          confirmPayment({
            paymentId,
            hostId: effectiveHostId,
            giftId,
            externalReference,
            amount,
            method: methodFriendly,
            donorName,
            giftTitle,
            date: p.date_approved || p.date_created
          });
        } catch {
          // Expected on read-only environments like Vercel Lambda
        }
      }
    }

    // Retrieve transactions for response
    let transactions: any[] = [];
    if (supabase && hostId && hostId !== 'default') {
      try {
        const { data: txList } = await supabase
          .from('transactions')
          .select('*')
          .eq('host_id', hostId);

        if (txList && txList.length > 0) {
          transactions = txList.map(t => ({
            id: t.id,
            host_id: t.host_id,
            gift_id: t.gift_id,
            giftTitle: t.gift_title,
            donorName: t.donor_name,
            amount: t.amount,
            method: t.method,
            status: t.status,
            date: t.date,
            payment_id: t.payment_id,
            external_reference: t.external_reference
          }));
        }
      } catch (err) {
        console.warn("Could not query updated transactions from Supabase:", err);
      }
    }

    return res.status(200).json({
      success: true,
      importedCount,
      transactions
    });
  } catch (error: any) {
    console.error("Error in /api/sync-mercadopago-payments:", error?.message || error);
    return res.status(500).json({
      error: "Falha ao sincronizar pagamentos do Mercado Pago.",
      details: error?.message || String(error)
    });
  }
}
