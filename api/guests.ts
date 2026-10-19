import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const hostId = (req.query?.hostId || req.body?.hostId || 'default') as string;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

  const authHeader = req.headers.authorization;
  const userJwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
    global: { headers: userJwt ? { Authorization: `Bearer ${userJwt}` } : {} }
  }) : null;

  // Resolve target host UUID and Slug for strict account matching
  let targetUuid = hostId;
  let targetSlug = hostId;
  if (supabase && hostId && hostId !== 'default') {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hostId);
    if (!isUuid) {
      targetSlug = hostId;
      try {
        const { data: eventData } = await supabase.from('event_details').select('host_id').eq('slug', hostId).maybeSingle();
        if (eventData?.host_id) targetUuid = eventData.host_id;
      } catch (e) {
        // ignore
      }
    } else {
      targetUuid = hostId;
      try {
        const { data: eventData } = await supabase.from('event_details').select('slug').eq('host_id', hostId).maybeSingle();
        if (eventData?.slug) targetSlug = eventData.slug;
      } catch (e) {
        // ignore
      }
    }
  }

  // 1. POST: Only update status of pre-registered guest (NO self-invitations!)
  if (req.method === 'POST') {
    const { guestId, name, status } = req.body || {};

    if (guestId && supabase) {
      try {
        const payload: any = { status: status || 'Confirmado' };
        if (name) payload.name = name;
        const { data, error } = await supabase.from('guests').update(payload).eq('id', guestId).select().maybeSingle();
        if (error) {
          console.warn("Could not update guest in Supabase:", error);
        }
        return res.status(200).json({ success: true, guest: data });
      } catch (err: any) {
        return res.status(500).json({ error: "Erro ao atualizar confirmação", details: err?.message });
      }
    }

    return res.status(400).json({ error: "Apenas convidados já cadastrados na lista podem confirmar presença." });
  }

  // 2. GET: List guests for this specific event
  let guests: any[] = [];
  if (supabase && hostId && hostId !== 'default') {
    try {
      const { data } = await supabase
        .from('guests')
        .select('id, name, status, confirmation_code, host_id')
        .or(`host_id.eq.${targetUuid},host_id.eq.${targetSlug}`);

      if (data && data.length > 0) {
        guests = data.map(g => ({
          id: g.id,
          name: g.name,
          status: g.status,
          confirmationCode: g.confirmation_code
        }));
      }
    } catch (e) {
      console.warn("Error querying guests from Supabase:", e);
    }
  }

  return res.status(200).json(guests);
}
