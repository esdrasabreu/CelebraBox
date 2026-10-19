import fs from 'fs';
import path from 'path';

export interface GiftReservation {
  id: string; // external reference
  hostId: string;
  giftId: string;
  giftTitle: string;
  donorName: string;
  amount: number;
  createdAt: string;
  expiresAt: string;
  status: 'reserved' | 'paid' | 'expired' | 'released';
  paymentId?: string;
}

export interface StoredTransaction {
  id: string;
  host_id: string;
  gift_id?: string;
  giftTitle: string;
  donorName: string;
  amount: number;
  method: string;
  status: 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled' | 'refunded' | 'expired' | 'checkout_started' | string;
  date: string;
  payment_id?: string;
  external_reference?: string;
}

interface AppStoreData {
  reservations: GiftReservation[];
  transactions: StoredTransaction[];
  stockDeductions: Record<string, number>; // giftId -> count of deducted units
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'app_store.json');

function ensureStoreExists(): AppStoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      const initial: AppStoreData = {
        reservations: [],
        transactions: [],
        stockDeductions: {}
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      reservations: parsed.reservations || [],
      transactions: parsed.transactions || [],
      stockDeductions: parsed.stockDeductions || {}
    };
  } catch (err) {
    console.error("Error accessing app store:", err);
    return { reservations: [], transactions: [], stockDeductions: {} };
  }
}

function saveStore(data: AppStoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${STORE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, STORE_FILE);
  } catch (err) {
    console.error("Error saving app store:", err);
  }
}

/**
 * Automatically marks reservations as expired if their 24h window has elapsed.
 */
export function cleanExpiredReservations(): void {
  const store = ensureStoreExists();
  const now = new Date().toISOString();
  let changed = false;

  store.reservations.forEach(r => {
    if (r.status === 'reserved' && r.expiresAt <= now) {
      r.status = 'expired';
      changed = true;
    }
  });

  if (changed) {
    saveStore(store);
  }
}

/**
 * Returns count of currently active (non-expired, non-released) reservations for a gift.
 */
export function getActiveReservationsCount(giftId: string): number {
  cleanExpiredReservations();
  const store = ensureStoreExists();
  const now = new Date().toISOString();

  return store.reservations.filter(r => 
    r.giftId === giftId && 
    r.status === 'reserved' && 
    r.expiresAt > now
  ).length;
}

/**
 * Creates a 24-hour reservation for a gift lock.
 */
export function createReservation(params: {
  hostId: string;
  giftId: string;
  giftTitle: string;
  donorName: string;
  amount: number;
  externalReference: string;
  durationHours?: number;
}): GiftReservation {
  cleanExpiredReservations();
  const store = ensureStoreExists();
  const now = new Date();
  const durationHours = params.durationHours || 24;
  const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();

  // Check if an existing reservation already matches this externalReference
  let existing = store.reservations.find(r => r.id === params.externalReference);
  if (existing) {
    return existing;
  }

  const reservation: GiftReservation = {
    id: params.externalReference,
    hostId: params.hostId,
    giftId: params.giftId,
    giftTitle: params.giftTitle,
    donorName: params.donorName,
    amount: params.amount,
    createdAt: now.toISOString(),
    expiresAt,
    status: 'reserved'
  };

  store.reservations.push(reservation);

  // Also add preliminary transaction if not already present
  const txExists = store.transactions.some(t => t.external_reference === params.externalReference);
  if (!txExists) {
    store.transactions.unshift({
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      host_id: params.hostId,
      gift_id: params.giftId,
      giftTitle: params.giftTitle,
      donorName: params.donorName,
      amount: params.amount,
      method: 'PIX / Cartão (Aguardando)',
      status: 'checkout_started',
      date: now.toISOString(),
      external_reference: params.externalReference
    });
  }

  saveStore(store);
  return reservation;
}

/**
 * Permanently confirms payment: updates reservation to 'paid', decrements stock, and saves approved transaction.
 */
export function confirmPayment(params: {
  paymentId: string;
  hostId: string;
  giftId?: string;
  externalReference?: string;
  amount: number;
  method: string;
  donorName: string;
  giftTitle: string;
  date?: string;
}): StoredTransaction {
  const store = ensureStoreExists();
  const date = params.date || new Date().toISOString();

  // 1. Mark corresponding reservation as paid
  if (params.externalReference) {
    const res = store.reservations.find(r => r.id === params.externalReference);
    if (res) {
      res.status = 'paid';
      res.paymentId = params.paymentId;
    }
  }

  // 2. Track stock deduction if giftId is known
  if (params.giftId) {
    store.stockDeductions[params.giftId] = (store.stockDeductions[params.giftId] || 0) + 1;
  }

  // 3. Update or insert transaction
  let tx = store.transactions.find(t => 
    (params.paymentId && t.payment_id === params.paymentId) ||
    (params.externalReference && t.external_reference === params.externalReference)
  );

  if (tx) {
    tx.status = 'approved';
    tx.method = params.method;
    tx.amount = params.amount || tx.amount;
    tx.payment_id = params.paymentId;
    tx.date = date;
    if (params.donorName && (!tx.donorName || tx.donorName === 'Convidado')) {
      tx.donorName = params.donorName;
    }
    if (params.giftTitle && (!tx.giftTitle || tx.giftTitle === 'Presente')) {
      tx.giftTitle = params.giftTitle;
    }
  } else {
    tx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      host_id: params.hostId,
      gift_id: params.giftId,
      giftTitle: params.giftTitle || 'Presente',
      donorName: params.donorName || 'Convidado',
      amount: params.amount,
      method: params.method || 'PIX',
      status: 'approved',
      date,
      payment_id: params.paymentId,
      external_reference: params.externalReference
    };
    store.transactions.unshift(tx);
  }

  saveStore(store);
  return tx;
}

/**
 * Releases a reservation (returns quantity back to available).
 */
export function releaseReservation(reservationId: string, hostId?: string): boolean {
  const store = ensureStoreExists();
  const res = store.reservations.find(r => 
    r.id === reservationId && (!hostId || r.hostId === hostId)
  );

  if (res && res.status === 'reserved') {
    res.status = 'released';
    
    // Also update transaction if in checkout_started
    const tx = store.transactions.find(t => t.external_reference === reservationId);
    if (tx && tx.status === 'checkout_started') {
      tx.status = 'cancelled';
    }

    saveStore(store);
    return true;
  }
  return false;
}

/**
 * Gets all transactions for a host (supporting both UUID and slug).
 */
export function getStoredTransactions(hostId: string, alternateId?: string): StoredTransaction[] {
  const store = ensureStoreExists();
  return store.transactions.filter(t => {
    if (!t.host_id || t.host_id.trim() === '') return false;
    const extRef = t.external_reference || '';
    if (extRef.startsWith('20000') || extRef.startsWith('POTS') || extRef.startsWith('11081')) return false;
    if (hostId === 'all') return true;
    return t.host_id === hostId || (alternateId && t.host_id === alternateId);
  });
}

/**
 * Gets all reservations for a host (supporting both UUID and slug).
 */
export function getStoredReservations(hostId: string, alternateId?: string): GiftReservation[] {
  cleanExpiredReservations();
  const store = ensureStoreExists();
  return store.reservations.filter(r => 
    hostId === 'all' || 
    r.hostId === hostId || 
    (alternateId && r.hostId === alternateId)
  );
}

/**
 * Gets total deductions count for gifts.
 */
export function getStockDeductions(): Record<string, number> {
  const store = ensureStoreExists();
  return store.stockDeductions;
}
