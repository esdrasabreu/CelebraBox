import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const isUuid = (v?: string) =>
  Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const {
      hostId,
      transactionId,
      externalReference,
      giftId,
      giftTitle,
      donorName,
      amount,
      method,
      date
    } = req.body || {};

    if (!hostId || (!transactionId && !externalReference && !(donorName && giftTitle))) {
      return res.status(400).json({ error: 'Missing hostId or transaction identifier' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    const authHeader = req.headers.authorization;
    const userJwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;

    const supabase = supabaseUrl && supabaseKey
      ? createClient(supabaseUrl, supabaseKey, {
          global: { headers: userJwt ? { Authorization: `Bearer ${userJwt}` } : {} }
        })
      : null;

    let resolvedId = hostId;
    let alternateId: string | undefined;

    if (supabase && hostId !== 'default') {
      if (!userJwt) return res.status(401).json({ error: 'Unauthorized' });
      const { data: { user }, error } = await supabase.auth.getUser(userJwt);
      if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

      try {
        if (isUuid(hostId)) {
          const { data } = await supabase.from('event_details').select('slug').eq('host_id', hostId).maybeSingle();
          if (data?.slug) alternateId = data.slug;
        } else {
          const { data } = await supabase.from('event_details').select('host_id').eq('slug', hostId).maybeSingle();
          if (data?.host_id) {
            alternateId = hostId;
            resolvedId = data.host_id;
          }
        }
      } catch {}

      if (user.id !== hostId && user.id !== resolvedId && user.id !== alternateId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const effectiveUuid = isUuid(resolvedId) ? resolvedId : isUuid(alternateId) ? alternateId! : resolvedId;

    let approvedTx: any = null;
    try {
      const { approveManualTransactionInStore } = await import('../../server_store');
      approvedTx = approveManualTransactionInStore({
        transactionId,
        externalReference,
        hostId: effectiveUuid,
        alternateHostId: alternateId || hostId,
        giftId,
        giftTitle,
        donorName,
        amount: amount !== undefined ? Number(amount) : undefined,
        method: method || 'Pix Direto',
        date
      });
    } catch {}

    let updatedInDb = false;
    if (supabase && hostId !== 'default') {
      try {
        if (externalReference) {
          const { data: extData, error: extErr } = await supabase
            .from('transactions')
            .update({ status: 'approved' })
            .eq('external_reference', externalReference)
            .select();
          if (!extErr && extData && extData.length > 0) updatedInDb = true;
        }

        if (!updatedInDb && transactionId && isUuid(transactionId)) {
          const { data: idData, error: idErr } = await supabase
            .from('transactions')
            .update({ status: 'approved' })
            .eq('id', transactionId)
            .select();
          if (!idErr && idData && idData.length > 0) updatedInDb = true;
        }

        if (!updatedInDb && isUuid(effectiveUuid) && donorName && giftTitle) {
          const { data: matchRows } = await supabase
            .from('transactions')
            .select('id')
            .eq('host_id', effectiveUuid)
            .eq('donor_name', String(donorName).trim())
            .eq('gift_title', String(giftTitle).trim())
            .in('status', ['pending', 'Pendente']);

          if (matchRows && matchRows.length > 0) {
            const { data: updData, error: updErr } = await supabase
              .from('transactions')
              .update({ status: 'approved' })
              .eq('id', matchRows[0].id)
              .select();
            if (!updErr && updData && updData.length > 0) updatedInDb = true;
          }
        }

        const effectiveGiftId = approvedTx?.gift_id || giftId;
        if (effectiveGiftId && isUuid(effectiveGiftId)) {
          const { data: currentGift } = await supabase
            .from('gifts')
            .select('id, quantity')
            .eq('id', effectiveGiftId)
            .maybeSingle();
          if (currentGift && currentGift.quantity !== undefined && currentGift.quantity !== null && currentGift.quantity > 0) {
            await supabase
              .from('gifts')
              .update({ quantity: Math.max(0, currentGift.quantity - 1) })
              .eq('id', effectiveGiftId);
          }
        }
      } catch (supErr) {
        console.warn('Could not approve manual transaction in Supabase:', supErr);
      }
    }

    if (!approvedTx && !updatedInDb) {
      return res.status(404).json({ success: false, error: 'Transação não encontrada para confirmação.' });
    }

    return res.status(200).json({ success: true, transaction: approvedTx, updatedInDb });
  } catch {
    return res.status(500).json({ error: 'Failed to approve manual transaction' });
  }
}
