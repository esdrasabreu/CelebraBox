import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const hostId = (req.query?.hostId || req.body?.hostId || 'default') as string;

  if (req.method === 'POST') {
    // Release reservation
    const { reservationId } = req.body || {};
    try {
      const { releaseReservation } = await import('../server_store');
      const success = releaseReservation(reservationId, hostId);
      return res.status(200).json({ success });
    } catch {
      return res.status(200).json({ success: true });
    }
  }

  // GET reservations
  try {
    const { getStoredReservations, getStockDeductions, cleanExpiredReservations } = await import('../server_store');
    cleanExpiredReservations();
    const reservations = getStoredReservations(hostId);
    const deductions = getStockDeductions();
    return res.status(200).json({ reservations, deductions });
  } catch {
    return res.status(200).json({ reservations: [], deductions: {} });
  }
}
