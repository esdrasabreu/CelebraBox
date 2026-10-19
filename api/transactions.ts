import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const hostId = (req.query.hostId as string) || 'default';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

  const authHeader = req.headers.authorization;
  const userJwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
    global: { headers: userJwt ? { Authorization: `Bearer ${userJwt}` } : {} }
  }) : null;

  let transactions: any[] = [];
  let targetUuid = hostId;
  let targetSlug = hostId;

  // Resolve UUID & Slug for target host
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

  // 1. Try reading from Supabase
  if (supabase && hostId && hostId !== 'default') {
    try {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .or(`host_id.eq.${targetUuid},host_id.eq.${targetSlug}`);

      if (data && data.length > 0) {
        transactions = data
          .filter(t => {
            // Discard any personal / Mercado Livre purchases
            const extRef = t.external_reference || '';
            if (extRef.startsWith('20000') || extRef.startsWith('POTS') || extRef.startsWith('11081')) return false;
            return true;
          })
          .map(t => ({
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
    } catch (e) {
      console.warn("Could not fetch transactions from Supabase:", e);
    }
  }

  // 2. Also try local server store fallback if available
  try {
    const { getStoredTransactions } = await import('../server_store');
    const localTxs = getStoredTransactions(targetUuid, targetSlug);
    localTxs.forEach(lt => {
      if (!lt.host_id || lt.host_id.trim() === '') return;
      if (lt.host_id !== targetUuid && lt.host_id !== targetSlug) return;
      const extRef = lt.external_reference || '';
      if (extRef.startsWith('20000') || extRef.startsWith('POTS') || extRef.startsWith('11081') || extRef.startsWith('ML')) return;

      const matchIdx = transactions.findIndex(t => 
        (lt.payment_id && t.payment_id === lt.payment_id) || 
        (lt.external_reference && t.external_reference === lt.external_reference)
      );
      if (matchIdx === -1) {
        transactions.unshift(lt);
      } else if (lt.status === 'approved' && transactions[matchIdx].status !== 'approved') {
        transactions[matchIdx] = { ...transactions[matchIdx], ...lt };
      }
    });
  } catch {
    // Read-only serverless environment
  }

  return res.status(200).json(transactions);
}
