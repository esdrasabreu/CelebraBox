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

  // Try reading from Supabase
  if (supabase && hostId && hostId !== 'default') {
    try {
      // Determine if hostId is slug or UUID
      let actualHostId = hostId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hostId);
      if (!isUuid) {
        const { data: eventData } = await supabase.from('event_details').select('host_id').eq('slug', hostId).maybeSingle();
        if (eventData?.host_id) actualHostId = eventData.host_id;
      }

      const { data } = await supabase
        .from('transactions')
        .select('*')
        .or(`host_id.eq.${actualHostId},host_id.eq.${hostId}`);

      if (data && data.length > 0) {
        transactions = data.map(t => ({
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

  // Also try local server store fallback if available
  try {
    const { getStoredTransactions } = await import('../server_store');
    const localTxs = getStoredTransactions(hostId);
    localTxs.forEach(lt => {
      const exists = transactions.some(t => 
        (lt.payment_id && t.payment_id === lt.payment_id) || 
        (lt.external_reference && t.external_reference === lt.external_reference)
      );
      if (!exists) transactions.unshift(lt);
    });
  } catch {
    // Read-only serverless environment
  }

  return res.status(200).json(transactions);
}
