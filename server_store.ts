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

export interface StoredGuest {
  id: string;
  host_id: string;
  name: string;
  status: 'Pendente' | 'Confirmado' | 'Não vai';
  confirmation_code?: string;
}

interface AppStoreData {
  reservations: GiftReservation[];
  transactions: StoredTransaction[];
  stockDeductions: Record<string, number>; // giftId -> count of deducted units
  guests?: StoredGuest[];
}

// In Vercel serverless functions, the root filesystem is read-only; /tmp is writable
const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'celebra_data') : path.join(process.cwd(), 'data');
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
        stockDeductions: {},
        guests: []
      };
      try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
      } catch (writeErr) {
        // Read-only or restricted environment fallback
      }
      return initial;
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      reservations: parsed.reservations || [],
      transactions: parsed.transactions || [],
      stockDeductions: parsed.stockDeductions || {},
      guests: parsed.guests || []
    };
  } catch (err) {
    console.error("Error accessing app store:", err);
    return { reservations: [], transactions: [], stockDeductions: {}, guests: [] };
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
    // Non-fatal warning on read-only environments
    console.warn("Notice: Local store save skipped or unavailable in current environment:", err);
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

  // 3. Update existing transaction or insert new approved transaction
  let tx = store.transactions.find(t => 
    (params.paymentId && t.payment_id === params.paymentId) ||
    (params.externalReference && t.external_reference === params.externalReference)
  );

  if (tx) {
    tx.status = 'approved';
    tx.method = params.method || 'PIX';
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

  // Clean obsolete pending duplicates that matched this external_reference or payment_id
  if (params.externalReference) {
    store.transactions = store.transactions.filter(t => {
      if (t === tx) return true;
      if (t.external_reference === params.externalReference && t.status !== 'approved') {
        return false; // Eliminate obsolete pending clone
      }
      return true;
    });
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
 * Gets all transactions for a host (supporting both UUID and slug),
 * automatically deduplicating and promoting approved payments over stale pending items.
 */
export function getStoredTransactions(hostId: string, alternateId?: string): StoredTransaction[] {
  const store = ensureStoreExists();
  const matched = store.transactions.filter(t => {
    if (!t.host_id || t.host_id.trim() === '') return false;
    const extRef = (t.external_reference || '').trim();
    if (extRef.startsWith('20000') || extRef.startsWith('POTS') || extRef.startsWith('11081') || extRef.startsWith('ML')) return false;

    // STRICT: Must be a wedding gift transaction
    const isGift = Boolean(t.gift_id && t.gift_id.trim() !== '') || (extRef.includes(':') && extRef.split(':').length >= 2);
    if (!isGift) return false;

    if (hostId === 'all') return true;
    return (
      t.host_id === hostId ||
      (alternateId && t.host_id === alternateId) ||
      (extRef.startsWith(`${hostId}:`)) ||
      (alternateId && extRef.startsWith(`${alternateId}:`))
    );
  });

  // Track approved external_references and payment_ids
  const approvedRefs = new Set<string>();
  const approvedPaymentIds = new Set<string>();

  matched.forEach(t => {
    if (t.status === 'approved') {
      if (t.external_reference) approvedRefs.add(t.external_reference);
      if (t.payment_id) approvedPaymentIds.add(t.payment_id);
    }
  });

  // Filter out pending/checkout_started clones if an approved version exists
  const deduplicated: StoredTransaction[] = [];
  const seenKeys = new Set<string>();

  for (const t of matched) {
    if (t.status !== 'approved') {
      if (t.external_reference && approvedRefs.has(t.external_reference)) {
        continue; // Discard obsolete pending clone
      }
      if (t.payment_id && approvedPaymentIds.has(t.payment_id)) {
        continue;
      }
    }

    const key = t.payment_id ? `pid_${t.payment_id}` : (t.external_reference ? `ref_${t.external_reference}` : `id_${t.id}`);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduplicated.push(t);
    }
  }

  return deduplicated;
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

/**
 * Retrieves all stored guests for a host.
 */
export function getStoredGuests(hostId: string, alternateId?: string): StoredGuest[] {
  const store = ensureStoreExists();
  const guests = store.guests || [];
  return guests.filter(g => 
    g.host_id === hostId || (alternateId && g.host_id === alternateId)
  );
}

/**
 * Synchronizes host guests into the server store.
 */
export function saveStoredGuests(hostId: string, guests: StoredGuest[]): void {
  const store = ensureStoreExists();
  if (!store.guests) store.guests = [];

  // Remove existing guests for this host
  store.guests = store.guests.filter(g => g.host_id !== hostId);

  // Add updated guests
  guests.forEach(g => {
    store.guests!.push({
      id: g.id || Math.random().toString(36).substring(2, 9),
      host_id: hostId,
      name: g.name.trim(),
      status: g.status || 'Pendente',
      confirmation_code: g.confirmation_code
    });
  });

  saveStore(store);
}

/**
 * Adds a single guest to the server store.
 */
export function addStoredGuest(hostId: string, guest: StoredGuest): void {
  const store = ensureStoreExists();
  if (!store.guests) store.guests = [];

  const existingIdx = store.guests.findIndex(g => g.id === guest.id);
  if (existingIdx !== -1) {
    store.guests[existingIdx] = { ...store.guests[existingIdx], ...guest, host_id: hostId };
  } else {
    store.guests.push({
      id: guest.id || Math.random().toString(36).substring(2, 9),
      host_id: hostId,
      name: guest.name.trim(),
      status: guest.status || 'Pendente',
      confirmation_code: guest.confirmation_code
    });
  }

  saveStore(store);
}

/**
 * Deletes a guest from the server store.
 */
export function deleteStoredGuest(guestId: string): void {
  const store = ensureStoreExists();
  if (!store.guests) return;
  store.guests = store.guests.filter(g => g.id !== guestId);
  saveStore(store);
}

/**
 * Updates confirmation status of a stored guest.
 */
export function updateStoredGuestStatus(guestId: string, status: 'Pendente' | 'Confirmado' | 'Não vai', name?: string): boolean {
  const store = ensureStoreExists();
  if (!store.guests) return false;

  const guest = store.guests.find(g => g.id === guestId);
  if (guest) {
    guest.status = status;
    if (name) guest.name = name;
    saveStore(store);
    return true;
  }
  return false;
}
