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
  grossAmount?: number;
  netAmount?: number;
  feeAmount?: number;
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

export interface StoredPublicPaymentConfig {
  hostId: string;
  gatewayProvider: string;
  receiverName: string;
  passFeesToBuyer: boolean;
  pixFeePercent: number;
  cardFeePercent: number;
  enableManualPix: boolean;
  pixKeyType?: string;
  pixKey?: string;
  city?: string;
  updatedAt: string;
}

interface AppStoreData {
  reservations: GiftReservation[];
  transactions: StoredTransaction[];
  stockDeductions: Record<string, number>; // giftId -> count of deducted units
  guests?: StoredGuest[];
  paymentConfigs?: Record<string, StoredPublicPaymentConfig>;
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
        guests: [],
        paymentConfigs: {}
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
      guests: parsed.guests || [],
      paymentConfigs: parsed.paymentConfigs || {}
    };
  } catch (err) {
    console.error("Error accessing app store:", err);
    return { reservations: [], transactions: [], stockDeductions: {}, guests: [], paymentConfigs: {} };
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
  grossAmount?: number;
  netAmount?: number;
  feeAmount?: number;
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
    if (params.grossAmount !== undefined) tx.grossAmount = params.grossAmount;
    if (params.netAmount !== undefined) tx.netAmount = params.netAmount;
    if (params.feeAmount !== undefined) tx.feeAmount = params.feeAmount;
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
      grossAmount: params.grossAmount,
      netAmount: params.netAmount,
      feeAmount: params.feeAmount,
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
    
    // Also update transaction if still waiting for payment
    const tx = store.transactions.find(t => t.external_reference === reservationId);
    if (tx && (tx.status === 'checkout_started' || tx.status === 'pending')) {
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

    // Must be a wedding gift transaction or manual Pix Direto entry
    const isGift = Boolean(t.gift_id && t.gift_id.trim() !== '') ||
                   (extRef.includes(':') && extRef.split(':').length >= 2) ||
                   t.method === 'Pix Direto';
    if (!isGift) return false;

    if (hostId === 'all') return true;
    return (
      t.host_id === hostId ||
      (alternateId && t.host_id === alternateId) ||
      (extRef.startsWith(`${hostId}:`)) ||
      (alternateId && extRef.startsWith(`${alternateId}:`))
    );
  });

  // Track approved external_references, payment_ids, and manual Pix signatures
  const approvedRefs = new Set<string>();
  const approvedPaymentIds = new Set<string>();
  const approvedManualSigs = new Set<string>();

  matched.forEach(t => {
    if (t.status === 'approved' || t.status === 'Concluído') {
      if (t.external_reference) approvedRefs.add(t.external_reference);
      if (t.payment_id) approvedPaymentIds.add(t.payment_id);
      if (t.method === 'Pix Direto') {
        approvedManualSigs.add(`${(t.donorName || '').trim().toLowerCase()}_${(t.giftTitle || '').trim().toLowerCase()}_${Number(t.amount).toFixed(2)}`);
      }
    }
  });

  // Filter out pending/checkout_started clones if an approved version exists
  const deduplicated: StoredTransaction[] = [];
  const seenKeys = new Set<string>();

  const sorted = [...matched].sort((a, b) => {
    const aApp = a.status === 'approved' || a.status === 'Concluído' ? 1 : 0;
    const bApp = b.status === 'approved' || b.status === 'Concluído' ? 1 : 0;
    if (aApp !== bApp) return bApp - aApp;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  for (const t of sorted) {
    if (t.status !== 'approved' && t.status !== 'Concluído') {
      if (t.external_reference && approvedRefs.has(t.external_reference)) {
        continue;
      }
      if (t.payment_id && approvedPaymentIds.has(t.payment_id)) {
        continue;
      }
      if (t.method === 'Pix Direto') {
        const sig = `${(t.donorName || '').trim().toLowerCase()}_${(t.giftTitle || '').trim().toLowerCase()}_${Number(t.amount).toFixed(2)}`;
        if (approvedManualSigs.has(sig)) continue;
      }
    }

    const key = t.payment_id
      ? `pid_${t.payment_id}`
      : (t.external_reference
          ? `ref_${t.external_reference}`
          : (t.method === 'Pix Direto'
              ? `manual_${(t.donorName || '').trim().toLowerCase()}_${(t.giftTitle || '').trim().toLowerCase()}_${Number(t.amount).toFixed(2)}`
              : `id_${t.id}`));
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

export function saveStoredPaymentConfig(hostId: string, config: Omit<StoredPublicPaymentConfig, 'hostId' | 'updatedAt'>, alternateId?: string): StoredPublicPaymentConfig {
  const store = ensureStoreExists();
  if (!store.paymentConfigs) store.paymentConfigs = {};

  const record: StoredPublicPaymentConfig = {
    ...config,
    hostId,
    updatedAt: new Date().toISOString()
  };

  store.paymentConfigs[hostId] = record;
  if (alternateId && alternateId !== hostId) {
    store.paymentConfigs[alternateId] = { ...record, hostId: alternateId };
  }

  saveStore(store);
  return record;
}

export function getStoredPaymentConfig(hostId: string, alternateId?: string): StoredPublicPaymentConfig | null {
  const store = ensureStoreExists();
  const configs = store.paymentConfigs || {};
  return configs[hostId] || (alternateId ? configs[alternateId] : null) || null;
}

export function createManualPixPendingTransaction(params: {
  hostId: string;
  giftId: string;
  giftTitle: string;
  donorName: string;
  amount: number;
  externalReference: string;
}): StoredTransaction {
  const store = ensureStoreExists();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const existingRes = store.reservations.find(r => r.id === params.externalReference);
  if (!existingRes) {
    store.reservations.push({
      id: params.externalReference,
      hostId: params.hostId,
      giftId: params.giftId,
      giftTitle: params.giftTitle,
      donorName: params.donorName,
      amount: params.amount,
      createdAt: now.toISOString(),
      expiresAt,
      status: 'reserved'
    });
  }

  let tx = store.transactions.find(t => t.external_reference === params.externalReference);
  if (!tx) {
    tx = {
      id: `tx_manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      host_id: params.hostId,
      gift_id: params.giftId,
      giftTitle: params.giftTitle,
      donorName: params.donorName,
      amount: params.amount,
      grossAmount: params.amount,
      netAmount: params.amount,
      feeAmount: 0,
      method: 'Pix Direto',
      status: 'pending',
      date: now.toISOString(),
      external_reference: params.externalReference
    };
    store.transactions.unshift(tx);
  }

  saveStore(store);
  return tx;
}

export interface ManualApproveParams {
  transactionId?: string;
  externalReference?: string;
  hostId?: string;
  alternateHostId?: string;
  giftId?: string;
  giftTitle?: string;
  donorName?: string;
  amount?: number;
  method?: string;
  date?: string;
}

export function approveManualTransactionInStore(txIdOrParams: string | ManualApproveParams): StoredTransaction | null {
  const params: ManualApproveParams = typeof txIdOrParams === 'string'
    ? { transactionId: txIdOrParams, externalReference: txIdOrParams }
    : txIdOrParams;

  const store = ensureStoreExists();
  const {
    transactionId,
    externalReference,
    hostId,
    alternateHostId,
    giftId,
    giftTitle,
    donorName,
    amount,
    method,
    date
  } = params;

  let tx = store.transactions.find(t =>
    (transactionId && t.id === transactionId) ||
    (externalReference && t.external_reference === externalReference) ||
    (transactionId && t.external_reference === transactionId)
  );

  // Fallback match by host + donor + gift + amount for rows originating from Supabase without external_reference
  if (!tx && hostId && donorName && giftTitle) {
    tx = store.transactions.find(t =>
      (t.host_id === hostId || (alternateHostId && t.host_id === alternateHostId)) &&
      t.donorName?.trim().toLowerCase() === donorName.trim().toLowerCase() &&
      t.giftTitle?.trim().toLowerCase() === giftTitle.trim().toLowerCase() &&
      (amount === undefined || Math.abs(Number(t.amount) - Number(amount)) < 0.05)
    );
  }

  const wasAlreadyApproved = tx?.status === 'approved';

  if (tx) {
    tx.status = 'approved';
    if (giftId && !tx.gift_id) tx.gift_id = giftId;
    if (externalReference && !tx.external_reference) tx.external_reference = externalReference;
  } else if (hostId && (giftTitle || donorName)) {
    const cleanAmount = Number(amount || 0);
    tx = {
      id: transactionId || `tx_manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      host_id: hostId,
      gift_id: giftId,
      giftTitle: giftTitle || 'Presente',
      donorName: donorName || 'Convidado',
      amount: cleanAmount,
      grossAmount: cleanAmount,
      netAmount: cleanAmount,
      feeAmount: 0,
      method: method || 'Pix Direto',
      status: 'approved',
      date: date || new Date().toISOString(),
      external_reference: externalReference
    };
    store.transactions.unshift(tx);
  } else {
    return null;
  }

  // Mark matching reservation as paid
  const targetRef = tx.external_reference || externalReference;
  if (targetRef) {
    const res = store.reservations.find(r => r.id === targetRef);
    if (res) res.status = 'paid';
  } else if (tx.gift_id || giftId) {
    const targetGiftId = tx.gift_id || giftId;
    const res = store.reservations.find(r =>
      r.status === 'reserved' &&
      r.giftId === targetGiftId &&
      (!tx!.donorName || r.donorName?.trim().toLowerCase() === tx!.donorName.trim().toLowerCase())
    );
    if (res) res.status = 'paid';
  }

  // Track stock deduction once when transitioning to approved
  const effectiveGiftId = tx.gift_id || giftId;
  if (!wasAlreadyApproved && effectiveGiftId) {
    store.stockDeductions[effectiveGiftId] = (store.stockDeductions[effectiveGiftId] || 0) + 1;
  }

  // Remove obsolete pending duplicates for the same transaction
  store.transactions = store.transactions.filter(t => {
    if (t === tx) return true;
    if (t.status === 'approved') return true;
    if (tx!.external_reference && t.external_reference === tx!.external_reference) return false;
    if (
      t.method === 'Pix Direto' &&
      t.donorName?.trim().toLowerCase() === tx!.donorName?.trim().toLowerCase() &&
      t.giftTitle?.trim().toLowerCase() === tx!.giftTitle?.trim().toLowerCase() &&
      Math.abs(Number(t.amount) - Number(tx!.amount)) < 0.05
    ) {
      return false;
    }
    return true;
  });

  saveStore(store);
  return tx;
}
