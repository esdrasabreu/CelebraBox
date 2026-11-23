import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const isUuid = (v?: string) =>
  Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const authHeader = req.headers.authorization;
  const userJwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;

  const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        global: { headers: userJwt ? { Authorization: `Bearer ${userJwt}` } : {} }
      })
    : null;

  async function resolveIds(hostId: string): Promise<{ id: string; alternate?: string }> {
    if (!hostId || hostId === 'default' || hostId === 'all' || !supabase) return { id: hostId };
    try {
      if (isUuid(hostId)) {
        const { data } = await supabase.from('event_details').select('slug').eq('host_id', hostId).maybeSingle();
        if (data?.slug) return { id: hostId, alternate: data.slug };
      } else {
        const { data } = await supabase.from('event_details').select('host_id').eq('slug', hostId).maybeSingle();
        if (data?.host_id) return { id: hostId, alternate: data.host_id };
      }
    } catch {}
    return { id: hostId };
  }

  if (req.method === 'GET') {
    const hostId = (req.query.hostId as string) || 'default';
    const defaultConfig = {
      gatewayProvider: 'mercadopago',
      receiverName: '',
      passFeesToBuyer: true,
      pixFeePercent: 0.99,
      cardFeePercent: 4.98,
      enableManualPix: false
    };

    if (!hostId || hostId === 'default') {
      return res.status(200).json(defaultConfig);
    }

    const { id, alternate } = await resolveIds(hostId);

    try {
      const { getStoredPaymentConfig } = await import('../server_store');
      const stored = getStoredPaymentConfig(id, alternate);
      if (stored) {
        return res.status(200).json({
          gatewayProvider: stored.gatewayProvider,
          receiverName: stored.receiverName,
          passFeesToBuyer: stored.passFeesToBuyer,
          pixFeePercent: stored.pixFeePercent,
          cardFeePercent: stored.cardFeePercent,
          enableManualPix: stored.enableManualPix,
          ...(stored.enableManualPix
            ? {
                pixKeyType: stored.pixKeyType,
                pixKey: stored.pixKey,
                city: stored.city
              }
            : {})
        });
      }
    } catch {}

    const uuid = isUuid(id) ? id : isUuid(alternate) ? alternate : undefined;
    if (supabase && uuid) {
      try {
        const { data: rpcConfig } = await supabase.rpc('get_public_payment_config', { host_id_param: uuid });
        if (rpcConfig && typeof rpcConfig === 'object') {
          const enableManualPix = Boolean((rpcConfig as any).enableManualPix);
          return res.status(200).json({
            gatewayProvider: (rpcConfig as any).gatewayProvider || 'mercadopago',
            receiverName: (rpcConfig as any).receiverName || '',
            passFeesToBuyer: (rpcConfig as any).passFeesToBuyer !== false,
            pixFeePercent: Number((rpcConfig as any).pixFeePercent ?? 0.99),
            cardFeePercent: Number((rpcConfig as any).cardFeePercent ?? 4.98),
            enableManualPix,
            ...(enableManualPix
              ? {
                  pixKeyType: (rpcConfig as any).pixKeyType || undefined,
                  pixKey: (rpcConfig as any).pixKey || undefined,
                  city: (rpcConfig as any).city || undefined
                }
              : {})
          });
        }
      } catch {}
    }

    return res.status(200).json(defaultConfig);
  }

  if (req.method === 'POST') {
    try {
      const {
        hostId,
        gatewayProvider = 'mercadopago',
        receiverName = '',
        passFeesToBuyer = true,
        pixFeePercent = 0.99,
        cardFeePercent = 4.98,
        enableManualPix = false,
        pixKeyType,
        pixKey,
        city
      } = req.body || {};

      if (!hostId) return res.status(400).json({ error: 'Missing hostId' });

      if (supabase && hostId !== 'default') {
        if (!userJwt) return res.status(401).json({ error: 'Unauthorized' });
        const { data: { user }, error } = await supabase.auth.getUser(userJwt);
        if (error || !user) return res.status(401).json({ error: 'Unauthorized' });
        const { id, alternate } = await resolveIds(hostId);
        if (user.id !== hostId && user.id !== id && user.id !== alternate) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }

      const { id, alternate } = await resolveIds(hostId);
      const cleanPixFee = Math.min(Math.max(Number(pixFeePercent) || 0, 0), 25);
      const cleanCardFee = Math.min(Math.max(Number(cardFeePercent) || 0, 0), 25);

      let saved: any = null;
      try {
        const { saveStoredPaymentConfig } = await import('../server_store');
        saved = saveStoredPaymentConfig(
          id,
          {
            gatewayProvider: String(gatewayProvider || 'mercadopago'),
            receiverName: String(receiverName || '').trim(),
            passFeesToBuyer: Boolean(passFeesToBuyer),
            pixFeePercent: cleanPixFee,
            cardFeePercent: cleanCardFee,
            enableManualPix: Boolean(enableManualPix),
            pixKeyType: pixKeyType ? String(pixKeyType) : undefined,
            pixKey: pixKey ? String(pixKey).trim() : undefined,
            city: city ? String(city).trim() : undefined
          },
          alternate
        );
      } catch {}

      return res.status(200).json({ success: true, config: saved });
    } catch {
      return res.status(500).json({ error: 'Failed to save payment config' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
