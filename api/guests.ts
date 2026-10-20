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

  // 1. Sync or update guest status
  if (req.method === 'POST' || req.method === 'PUT') {
    const { action, guests: incomingGuests, guestId, name, status, confirmationCode, guest } = req.body || {};

    // Sync full list from host dashboard
    if (action === 'sync' || Array.isArray(incomingGuests)) {
      try {
        const { saveStoredGuests } = await import('../server_store');
        saveStoredGuests(targetUuid || hostId, incomingGuests || []);
        if (targetSlug && targetSlug !== targetUuid) {
          saveStoredGuests(targetSlug, incomingGuests || []);
        }
      } catch {
        // read-only fallback
      }
      return res.status(200).json({ success: true, count: (incomingGuests || []).length });
    }

    // Host adding a guest
    if (action === 'add' || (!guestId && name)) {
      const newId = guestId || (guest && guest.id) || `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const guestObj = {
        id: newId,
        host_id: targetUuid || hostId,
        name: (name || guest?.name || '').trim(),
        status: status || guest?.status || 'Pendente',
        confirmation_code: confirmationCode || guest?.confirmationCode || Math.random().toString(36).substring(2, 8).toUpperCase()
      };
      try {
        const { addStoredGuest } = await import('../server_store');
        addStoredGuest(targetUuid || hostId, guestObj);
        if (targetSlug && targetSlug !== targetUuid) {
          addStoredGuest(targetSlug, guestObj);
        }
      } catch {}
      return res.status(200).json({ success: true, guest: guestObj });
    }

    // Host deleting a guest
    if (action === 'delete' && guestId) {
      try {
        const { deleteStoredGuest } = await import('../server_store');
        deleteStoredGuest(guestId);
      } catch {}
      return res.status(200).json({ success: true });
    }

    // Only update status of pre-registered guest (NO self-invitations!)
    if (guestId) {
      const targetStatus = status || 'Confirmado';

      try {
        const { updateStoredGuestStatus } = await import('../server_store');
        updateStoredGuestStatus(guestId, targetStatus, name);
      } catch {
        // ignore
      }

      if (supabase) {
        try {
          const payload: any = { status: targetStatus };
          if (name) payload.name = name;
          const { data, error } = await supabase.from('guests').update(payload).eq('id', guestId).select().maybeSingle();
          if (error) {
            console.warn("Could not update guest in Supabase:", error);
          }
          return res.status(200).json({ success: true, guest: data });
        } catch (err: any) {
          console.warn("Error updating Supabase guest:", err);
        }
      }
      return res.status(200).json({ success: true });
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

  // Fallback to server store if Supabase returned 0 due to public anon restrictions
  try {
    const { getStoredGuests } = await import('../server_store');
    const stored = getStoredGuests(targetUuid || hostId, targetSlug);
    if (stored && stored.length > 0) {
      stored.forEach(sg => {
        const exists = guests.some(g => g.id === sg.id || g.name.toLowerCase() === sg.name.toLowerCase());
        if (!exists) {
          guests.push({
            id: sg.id,
            name: sg.name,
            status: sg.status,
            confirmationCode: sg.confirmation_code
          });
        }
      });
    }
  } catch {
    // ignore
  }

  return res.status(200).json(guests);
}
