import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const roundCurrency = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

const isUuid = (v?: string) =>
  Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { giftId, giftTitle, price, donorName, hostId = 'default', externalReference } = req.body || {};
    if (!donorName || !String(donorName).trim()) {
      return res.status(400).json({ error: 'Nome do presenteador é obrigatório.' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    let authoritativeTitle = String(giftTitle || 'Presente');
    let authoritativePrice = Number(price);

    if (supabase && giftId) {
      try {
        const { data: giftData } = await supabase
          .from('gifts')
          .select('id, quantity, title, price')
          .eq('id', giftId)
          .maybeSingle();

        if (giftData) {
          if (giftData.title) authoritativeTitle = giftData.title;
          if (giftData.price !== undefined && giftData.price !== null && Number(giftData.price) > 0) {
            authoritativePrice = Number(giftData.price);
          }
          if (giftData.quantity !== undefined && giftData.quantity !== null) {
            try {
              const { getActiveReservationsCount } = await import('../server_store');
              const activeReservations = getActiveReservationsCount(giftId);
              if (giftData.quantity - activeReservations <= 0) {
                return res.status(400).json({ error: 'Este presente já está reservado aguardando confirmação.' });
              }
            } catch {}
          }
        }
      } catch {}
    }

    if (!Number.isFinite(authoritativePrice) || authoritativePrice <= 0) {
      return res.status(400).json({ error: 'Valor do presente inválido.' });
    }

    const extRef = externalReference || `${hostId}:${giftId || 'gift'}:manual_${Date.now()}`;
    const cleanAmount = roundCurrency(authoritativePrice);
    const cleanDonor = String(donorName).trim();

    let tx: any = {
      id: `tx_manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      host_id: hostId,
      gift_id: giftId ? String(giftId) : undefined,
      giftTitle: authoritativeTitle,
      donorName: cleanDonor,
      amount: cleanAmount,
      grossAmount: cleanAmount,
      netAmount: cleanAmount,
      feeAmount: 0,
      method: 'Pix Direto',
      status: 'pending',
      date: new Date().toISOString(),
      external_reference: extRef
    };

    try {
      const { createManualPixPendingTransaction } = await import('../server_store');
      tx = createManualPixPendingTransaction({
        hostId,
        giftId: String(giftId || 'gift'),
        giftTitle: authoritativeTitle,
        donorName: cleanDonor,
        amount: cleanAmount,
        externalReference: extRef
      });
    } catch {}

    if (supabase && hostId && hostId !== 'default') {
      try {
        let effectiveUuid: string | null = isUuid(hostId) ? hostId : null;
        if (!effectiveUuid) {
          const { data: ev } = await supabase.from('event_details').select('host_id').eq('slug', hostId).maybeSingle();
          if (ev?.host_id && isUuid(ev.host_id)) effectiveUuid = ev.host_id;
        }

        if (effectiveUuid) {
          const { data: ins1, error: err1 } = await supabase
            .from('transactions')
            .insert([
              {
                host_id: effectiveUuid,
                gift_title: authoritativeTitle,
                gift_id: giftId || null,
                donor_name: cleanDonor,
                amount: cleanAmount,
                method: 'Pix Direto',
                status: 'pending',
                external_reference: extRef,
                date: new Date().toISOString()
              }
            ])
            .select()
            .maybeSingle();

          if (!err1 && ins1?.id) {
            tx.id = ins1.id;
            tx.host_id = effectiveUuid;
          } else if (err1) {
            const { data: ins2 } = await supabase
              .from('transactions')
              .insert([
                {
                  host_id: effectiveUuid,
                  gift_title: authoritativeTitle,
                  donor_name: cleanDonor,
                  amount: cleanAmount,
                  method: 'Pix Direto',
                  status: 'pending',
                  date: new Date().toISOString()
                }
              ])
              .select()
              .maybeSingle();
            if (ins2?.id) {
              tx.id = ins2.id;
              tx.host_id = effectiveUuid;
            }
          }
        }
      } catch (supErr) {
        console.warn('Could not record manual pix in Supabase:', supErr);
      }
    }

    return res.status(200).json({ success: true, transaction: tx, external_reference: extRef });
  } catch {
    return res.status(500).json({ error: 'Falha ao registrar Pix Direto.' });
  }
}
