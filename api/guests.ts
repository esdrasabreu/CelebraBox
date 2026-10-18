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

  // Resolve actual host ID if slug was passed
  let resolvedHostId = hostId;
  if (supabase && hostId && hostId !== 'default') {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hostId);
    if (!isUuid) {
      try {
        const { data: eventData } = await supabase.from('event_details').select('host_id').eq('slug', hostId).maybeSingle();
        if (eventData?.host_id) resolvedHostId = eventData.host_id;
      } catch (e) {
        // ignore
      }
    }
  }

  // 1. POST: Register new guest or update RSVP
  if (req.method === 'POST') {
    const { guestId, name, status, confirmationCode, action } = req.body || {};

    if (action === 'update' && guestId && supabase) {
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

    // Insert new guest confirmation
    if (name && supabase) {
      try {
        const code = confirmationCode || Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data, error } = await supabase.from('guests').insert([{
          host_id: resolvedHostId,
          name: name.trim(),
          status: status || 'Confirmado',
          confirmation_code: code
        }]).select().maybeSingle();

        if (error) {
          console.warn("Could not insert guest in Supabase:", error);
          // Return optimistic success so guest isn't blocked
          return res.status(200).json({ 
            success: true, 
            guest: { id: `g_${Date.now()}`, name: name.trim(), status: status || 'Confirmado', confirmationCode: code } 
          });
        }
        return res.status(200).json({ success: true, guest: data });
      } catch (err: any) {
        return res.status(200).json({ 
          success: true, 
          guest: { id: `g_${Date.now()}`, name: name.trim(), status: status || 'Confirmado' } 
        });
      }
    }

    return res.status(400).json({ error: "Missing guest name" });
  }

  // 2. GET: List guests for event
  let guests: any[] = [];
  if (supabase && resolvedHostId && resolvedHostId !== 'default') {
    try {
      const { data } = await supabase
        .from('guests')
        .select('id, name, status, confirmation_code, host_id')
        .or(`host_id.eq.${resolvedHostId},host_id.eq.${hostId}`);

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
