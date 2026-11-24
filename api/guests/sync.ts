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
    const { hostId, guests } = req.body || {};
    if (!hostId || !Array.isArray(guests)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    let targetUuid = hostId;
    let targetSlug = hostId;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    if (supabaseUrl && supabaseKey && hostId !== 'default') {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        if (!isUuid(hostId)) {
          targetSlug = hostId;
          const { data } = await supabase.from('event_details').select('host_id').eq('slug', hostId).maybeSingle();
          if (data?.host_id) targetUuid = data.host_id;
        } else {
          targetUuid = hostId;
          const { data } = await supabase.from('event_details').select('slug').eq('host_id', hostId).maybeSingle();
          if (data?.slug) targetSlug = data.slug;
        }
      } catch {}
    }

    try {
      const { saveStoredGuests } = await import('../../server_store');
      saveStoredGuests(targetUuid, guests);
      if (targetSlug && targetSlug !== targetUuid) {
        saveStoredGuests(targetSlug, guests);
      }
    } catch {
      // Read-only fallback
    }

    return res.status(200).json({ success: true, count: guests.length });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Sync error' });
  }
}
