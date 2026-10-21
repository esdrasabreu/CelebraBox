import React, { createContext, useContext, useState, useEffect } from 'react';
import { EventDetails, Gift, Guest, Message, Transaction, PaymentSettings, GalleryImage, ScheduleItem, ExpenseItem } from '../types';
import { initialEventDetails, initialGifts, initialGuests, initialMessages, initialTransactions, initialPaymentSettings, initialGallery, initialSchedule, initialExpenses } from './data';
import { supabase } from './supabase';
import { cleanStoryText } from './textUtils';

type AppContextType = {
  eventDetails: EventDetails;
  setEventDetails: (details: EventDetails) => void;
  
  paymentSettings: PaymentSettings;
  setPaymentSettings: (settings: PaymentSettings) => void;
  
  gifts: Gift[];
  addGift: (gift: Omit<Gift, 'id'>) => void;
  updateGift: (id: string, gift: Omit<Gift, 'id'>) => void;
  deleteGift: (id: string) => void;
  
  messages: Message[];
  addMessage: (message: Omit<Message, 'id' | 'createdAt'>) => void;
  
  guests: Guest[];
  addGuest: (guest: Omit<Guest, 'id'>) => void;
  updateGuest: (id: string, updates: Partial<Guest>) => void;
  deleteGuest: (id: string) => void;
  
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id' | 'date'>) => Promise<void>;
  refreshTransactions: (freshTxs?: Transaction[]) => Promise<void>;

  reservations: any[];
  refreshReservations: () => Promise<void>;
  releaseReservation: (id: string) => Promise<boolean>;

  gallery: GalleryImage[];
  addGalleryImage: (image: Omit<GalleryImage, 'id'>) => void;
  updateGalleryImage: (id: string, updates: Partial<GalleryImage>) => void;
  deleteGalleryImage: (id: string) => void;

  schedule: ScheduleItem[];
  addScheduleItem: (item: Omit<ScheduleItem, 'id'>) => void;
  updateScheduleItem: (id: string, updates: Partial<ScheduleItem>) => void;
  deleteScheduleItem: (id: string) => void;

  expenses: ExpenseItem[];
  addExpense: (expense: Omit<ExpenseItem, 'id'>) => void;
  updateExpense: (id: string, updates: Partial<ExpenseItem>) => void;
  deleteExpense: (id: string) => void;
  
  isLoading: boolean;
  isNotFound: boolean;
  resolvedHostId: string;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function reconcileTransactions(
  txs: Transaction[],
  targetHostId: string,
  targetSlug?: string
): Transaction[] {
  // 1. Exclude Mercado Livre, personal bank transfers, POTS, etc.
  const valid = txs.filter(t => {
    const extRef = (t.external_reference || '').trim();
    if (extRef.startsWith('20000') || extRef.startsWith('POTS') || extRef.startsWith('11081') || extRef.startsWith('ML')) return false;

    // STRICT: Must be a wedding gift from the event! Personal transfers have no gift_id and no event reference
    const hasGift = Boolean(t.gift_id && t.gift_id.trim() !== '') || (extRef.includes(':') && extRef.split(':').length >= 2);
    if (!hasGift && t.id !== 'tx1' && t.id !== 'tx2') return false;
    
    if (targetHostId !== 'default') {
      if (t.id === 'tx1' || t.id === 'tx2') return false;
      
      // STRICT ACCOUNT ISOLATION: Must belong to targetHostId (UUID) or targetSlug
      const belongs = (
        (Boolean(t.host_id) && (t.host_id === targetHostId || (Boolean(targetSlug) && t.host_id === targetSlug))) ||
        (Boolean(extRef) && (extRef.startsWith(`${targetHostId}:`) || (Boolean(targetSlug) && extRef.startsWith(`${targetSlug}:`))))
      );
      if (!belongs) return false;
    }
    return true;
  });

  // 2. Identify all approved transactions and their matching keys
  const approvedRefs = new Set<string>();
  const approvedPids = new Set<string>();
  const approvedGiftSignatures = new Map<string, { method: string, payment_id?: string }>();

  valid.forEach(t => {
    if (t.status === 'approved' || t.status === 'Concluído') {
      if (t.payment_id) approvedPids.add(t.payment_id);
      if (t.external_reference) approvedRefs.add(t.external_reference);
      const sig = `${(t.giftTitle || '').trim().toLowerCase()}_${Number(t.amount).toFixed(2)}`;
      approvedGiftSignatures.set(sig, {
        method: t.method === 'Aguardando' ? 'PIX' : t.method,
        payment_id: t.payment_id
      });
    }
  });

  // 3. Upgrade any pending transaction that has an approved match
  const upgraded = valid.map(t => {
    if (t.status !== 'approved' && t.status !== 'Concluído') {
      const sig = `${(t.giftTitle || '').trim().toLowerCase()}_${Number(t.amount).toFixed(2)}`;
      const hasRefMatch = t.external_reference && approvedRefs.has(t.external_reference);
      const hasPidMatch = t.payment_id && approvedPids.has(t.payment_id);
      const hasSigMatch = approvedGiftSignatures.has(sig);

      if (hasRefMatch || hasPidMatch || hasSigMatch) {
        const matchInfo = approvedGiftSignatures.get(sig);
        return {
          ...t,
          status: 'approved' as const,
          method: (t.method === 'Aguardando' || !t.method ? (matchInfo?.method || 'PIX') : t.method) as any,
          payment_id: t.payment_id || matchInfo?.payment_id
        };
      }
    }
    return t;
  });

  // 4. Deduplicate: only 1 entry per payment_id or external_reference, approved taking priority
  const deduplicated: Transaction[] = [];
  const seenKeys = new Set<string>();

  // Sort approved first so they take priority
  const sorted = [...upgraded].sort((a, b) => {
    const aApp = a.status === 'approved' || a.status === 'Concluído' ? 1 : 0;
    const bApp = b.status === 'approved' || b.status === 'Concluído' ? 1 : 0;
    if (aApp !== bApp) return bApp - aApp;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  for (const t of sorted) {
    // If pending and an approved version with same external_reference or payment_id exists, drop pending copy
    if (t.status !== 'approved' && t.status !== 'Concluído') {
      if (t.external_reference && approvedRefs.has(t.external_reference)) continue;
      if (t.payment_id && approvedPids.has(t.payment_id)) continue;
    }

    const key = t.payment_id ? `pid_${t.payment_id}` : (t.external_reference ? `ref_${t.external_reference}` : `id_${t.id}`);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduplicated.push(t);
    }
  }

  return deduplicated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export const AppProvider: React.FC<{ children: React.ReactNode, hostId?: string }> = ({ children, hostId = 'default' }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [resolvedHostId, setResolvedHostId] = useState<string>(hostId);

  // Try to load from localStorage, fallback to initial data
  const loadState = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(`wedding_tech_${hostId}_${key}`);
      return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  const [eventDetails, setEventDetailsState] = useState<EventDetails>(() => {
    const loaded = loadState<EventDetails>('event', initialEventDetails);
    return { ...loaded, story: cleanStoryText(loaded.story || '') };
  });
  const [gifts, setGifts] = useState<Gift[]>(() => loadState('gifts', initialGifts));
  const [messages, setMessages] = useState<Message[]>(() => loadState('messages', initialMessages));
  const [guests, setGuests] = useState<Guest[]>(() => loadState('guests', initialGuests));
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadState('transactions', hostId === 'default' ? initialTransactions : []));
  const [reservations, setReservations] = useState<any[]>([]);
  const [paymentSettings, setPaymentSettingsState] = useState<PaymentSettings>(() => loadState('payment_settings', initialPaymentSettings));
  const [gallery, setGallery] = useState<GalleryImage[]>(() => loadState('gallery', initialGallery));
  const [schedule, setSchedule] = useState<ScheduleItem[]>(() => loadState('schedule', initialSchedule));
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => loadState('expenses', initialExpenses));

  
  // Load from Supabase on mount if available
  useEffect(() => {
    const fetchData = async () => {
      if (!supabase || hostId === 'default') {
        setIsLoading(false);
        return;
      }
      
      try {
        let actualHostId = hostId;
        
        // Check if hostId is actually a slug
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hostId);
        
        if (!isUuid) {
           const { data: slugData } = await supabase.from('event_details').select('host_id').eq('slug', hostId).single();
           if (slugData) {
              actualHostId = slugData.host_id;
              setResolvedHostId(actualHostId);
           } else {
              setIsNotFound(true);
              setIsLoading(false);
              return;
           }
        }

        const [
          { data: eventData },
          { data: paymentData },
          { data: giftsData },
          { data: messagesData },
          { data: guestsData },
          { data: txData },
          { data: galleryData },
          { data: scheduleData },
          { data: expData }
        ] = await Promise.all([
          supabase.from('event_details').select('*').eq('host_id', actualHostId).single(),
          supabase.from('payment_settings').select('*').eq('host_id', actualHostId).single(),
          supabase.from('gifts').select('*').eq('host_id', actualHostId),
          supabase.from('messages').select('*').eq('host_id', actualHostId),
          supabase.from('guests').select('*').eq('host_id', actualHostId),
          supabase.from('transactions').select('*').eq('host_id', actualHostId),
          supabase.from('gallery').select('*').eq('host_id', actualHostId),
          supabase.from('schedule').select('*').eq('host_id', actualHostId),
          supabase.from('expenses').select('*').eq('host_id', actualHostId)
        ]);

        if (eventData) {
          setEventDetailsState({
            eventType: eventData.event_type,
            title: eventData.title,
            date: eventData.date,
            location: {
              name: eventData.location_name || '',
              address: eventData.location_address || '',
              city: eventData.location_city || '',
              state: eventData.location_state || '',
              mapsLink: eventData.location_maps_link || ''
            },
            story: cleanStoryText(eventData.story || ''),
            coverImage: eventData.cover_image || '',
            coverMediaType: eventData.cover_media_type || 'image',
            coverVideoUrl: eventData.cover_video_url || '',
            themeColor: eventData.theme_color || '#ef007e',
            slug: eventData.slug || ''
          });
        } else {
          setEventDetailsState({
            eventType: 'casamento', title: '', date: '', story: '', coverImage: '', coverMediaType: 'image', coverVideoUrl: '', themeColor: '#ef007e', slug: '',
            location: { name: '', address: '', city: '', state: '', mapsLink: '' }
          });
        }
        
        if (paymentData) {
          setPaymentSettingsState({
            pixKeyType: paymentData.pix_key_type as any,
            pixKey: paymentData.pix_key,
            receiverName: paymentData.receiver_name,
            city: paymentData.city,
            gatewayProvider: paymentData.gateway_provider as any,
            gatewayPublicKey: paymentData.gateway_public_key || '',
            gatewayAccessToken: paymentData.gateway_access_token || '',
            gatewayEnvironment: paymentData.gateway_environment as any,
            gatewayWebhookUrl: paymentData.gateway_webhook_url || ''
          });
        } else {
          setPaymentSettingsState({
            pixKeyType: 'email', pixKey: '', receiverName: '', city: '',
            gatewayProvider: 'mercadopago', gatewayPublicKey: '', gatewayAccessToken: '', gatewayEnvironment: 'sandbox', gatewayWebhookUrl: ''
          });
        }
        
        setGifts(giftsData && giftsData.length > 0 ? giftsData.map(g => ({
          id: g.id,
          title: g.title,
          description: g.description,
          price: g.price,
          imageUrl: g.image_url,
          category: g.category,
          quantity: g.quantity
        })) : []);
        
        setMessages(messagesData && messagesData.length > 0 ? messagesData.map(m => ({
          id: m.id,
          authorName: m.author_name,
          content: m.content,
          createdAt: m.created_at
        })) : []);
        
        let loadedGuests: Guest[] = guestsData && guestsData.length > 0 ? guestsData.map(g => ({
          id: g.id,
          name: g.name,
          status: g.status as any,
          confirmationCode: g.confirmation_code
        })) : [];

        // If Supabase returned empty (e.g. Due to RLS for public visitors), try /api/guests
        if (loadedGuests.length === 0) {
          try {
            const guestsRes = await fetch(`/api/guests?hostId=${actualHostId}`);
            if (guestsRes.ok) {
              const apiGuests = await guestsRes.json();
              if (Array.isArray(apiGuests) && apiGuests.length > 0) {
                loadedGuests = apiGuests.map((g: any) => ({
                  id: g.id,
                  name: g.name,
                  status: g.status as any,
                  confirmationCode: g.confirmationCode || g.confirmation_code
                }));
              }
            }
          } catch (gErr) {
            console.warn("Could not fetch guests from /api/guests:", gErr);
          }
        }

        // Retain cached guests from localStorage if API and DB had none
        if (loadedGuests.length === 0) {
          const cachedGuests = loadState<Guest[]>('guests', []);
          if (cachedGuests && cachedGuests.length > 0) {
            loadedGuests = cachedGuests;
          }
        }

        setGuests(loadedGuests);
        if (loadedGuests.length > 0) {
          // Sync with server store in background for public page availability across accounts
          fetch('/api/guests/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostId: actualHostId, guests: loadedGuests })
          }).catch(() => {});
        }
        
        let txList: Transaction[] = txData && txData.length > 0 ? txData.map(t => ({
          id: t.id,
          giftTitle: t.gift_title,
          donorName: t.donor_name,
          amount: t.amount,
          method: t.method as any,
          date: t.date,
          status: t.status as any,
          payment_id: t.payment_id || undefined,
          external_reference: t.external_reference || undefined
        })) : [];

        // Fetch from persistent server store (captures webhooks, Pix payments, reservations)
        try {
          const [txServerRes, resRes] = await Promise.all([
            fetch(`/api/transactions?hostId=${actualHostId}`),
            fetch(`/api/reservations?hostId=${actualHostId}`)
          ]);

          if (txServerRes.ok) {
            const serverTxs: any[] = await txServerRes.json();
            if (Array.isArray(serverTxs)) {
              txList.push(...serverTxs);
            }
          }

          if (resRes.ok) {
            const resData = await resRes.json();
            setReservations(resData.reservations || []);
          }
        } catch (fetchServerErr) {
          console.warn("Could not fetch server transactions/reservations:", fetchServerErr);
        }

        // Include locally cached transactions
        const cachedTxs = loadState<Transaction[]>('transactions', []);
        if (cachedTxs && cachedTxs.length > 0) {
          txList.push(...cachedTxs);
        }

        // Reconcile and deduplicate: upgrade pending to approved if paid, eliminate clones
        const finalTxs = reconcileTransactions(txList, actualHostId, eventData?.slug);

        setTransactions(finalTxs);
        try {
          localStorage.setItem(`wedding_tech_${actualHostId}_transactions`, JSON.stringify(finalTxs));
          if (eventData?.slug) {
            localStorage.setItem(`wedding_tech_${eventData.slug}_transactions`, JSON.stringify(finalTxs));
          }
        } catch {}
        
        setGallery(galleryData && galleryData.length > 0 ? galleryData.map(g => ({
          id: g.id,
          url: g.url,
          caption: g.caption,
          order: g.display_order
        })).sort((a, b) => (a.order || 0) - (b.order || 0)) : []);
        
        setSchedule(scheduleData && scheduleData.length > 0 ? scheduleData.map(s => ({
          id: s.id,
          time: s.time,
          title: s.title,
          description: s.description
        })) : []);
        
        setExpenses(expData && expData.length > 0 ? expData.map(e => ({
          id: e.id,
          title: e.title,
          amount: e.amount,
          date: e.date,
          status: e.status as any
        })) : []);
        
      } catch (err) {
        console.warn("Error fetching from Supabase", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [hostId]);

  // Save to localStorage whenever state changes
  useEffect(() => localStorage.setItem(`wedding_tech_${hostId}_event`, JSON.stringify(eventDetails)), [hostId, eventDetails]);
  useEffect(() => localStorage.setItem(`wedding_tech_${hostId}_payment_settings`, JSON.stringify(paymentSettings)), [hostId, paymentSettings]);
  useEffect(() => localStorage.setItem(`wedding_tech_${hostId}_gifts`, JSON.stringify(gifts)), [hostId, gifts]);
  useEffect(() => localStorage.setItem(`wedding_tech_${hostId}_messages`, JSON.stringify(messages)), [hostId, messages]);
  useEffect(() => localStorage.setItem(`wedding_tech_${hostId}_guests`, JSON.stringify(guests)), [hostId, guests]);
  useEffect(() => localStorage.setItem(`wedding_tech_${hostId}_transactions`, JSON.stringify(transactions)), [hostId, transactions]);
  useEffect(() => localStorage.setItem(`wedding_tech_${hostId}_gallery`, JSON.stringify(gallery)), [hostId, gallery]);
  useEffect(() => localStorage.setItem(`wedding_tech_${hostId}_schedule`, JSON.stringify(schedule)), [hostId, schedule]);
  useEffect(() => localStorage.setItem(`wedding_tech_${hostId}_expenses`, JSON.stringify(expenses)), [hostId, expenses]);

  const setEventDetails = async (details: EventDetails) => {
    const sanitizedDetails: EventDetails = {
      ...details,
      story: cleanStoryText(details.story || '')
    };
    setEventDetailsState(sanitizedDetails);
    if (supabase && resolvedHostId !== 'default') {
      const { error } = await supabase.from('event_details').upsert({
        host_id: resolvedHostId,
        event_type: sanitizedDetails.eventType,
        title: sanitizedDetails.title,
        date: sanitizedDetails.date,
        location_name: sanitizedDetails.location.name,
        location_address: sanitizedDetails.location.address,
        location_city: sanitizedDetails.location.city,
        location_state: sanitizedDetails.location.state,
        location_maps_link: sanitizedDetails.location.mapsLink,
        story: sanitizedDetails.story,
        cover_image: sanitizedDetails.coverImage,
        cover_media_type: sanitizedDetails.coverMediaType || 'image',
        cover_video_url: sanitizedDetails.coverVideoUrl || '',
        theme_color: sanitizedDetails.themeColor,
        slug: sanitizedDetails.slug || null // use null instead of empty string for UNIQUE constraint
      });
      if (error) {
        console.error("Upsert event_details error:", error);
        throw new Error(error.message || JSON.stringify(error));
      }
    }
  };
  
  const setPaymentSettings = async (settings: PaymentSettings) => {
    setPaymentSettingsState(settings);
    if (supabase && resolvedHostId !== 'default') {
      await supabase.from('payment_settings').upsert({
        host_id: resolvedHostId,
        pix_key_type: settings.pixKeyType,
        pix_key: settings.pixKey,
        receiver_name: settings.receiverName,
        city: settings.city,
        gateway_provider: settings.gatewayProvider,
        gateway_public_key: settings.gatewayPublicKey,
        gateway_access_token: settings.gatewayAccessToken,
        gateway_environment: settings.gatewayEnvironment,
        gateway_webhook_url: settings.gatewayWebhookUrl
      });
    }
  };

  const addGift = async (gift: Omit<Gift, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    const newGift = { ...gift, id: tempId };
    setGifts(prev => [...prev, newGift]);
    
    if (supabase && resolvedHostId !== 'default') {
      const { data } = await supabase.from('gifts').insert([{
        host_id: resolvedHostId,
        title: gift.title,
        description: gift.description,
        price: gift.price,
        image_url: gift.imageUrl,
        category: gift.category,
        quantity: gift.quantity
      }]).select().single();
      
      if (data) {
        setGifts(prev => prev.map(g => g.id === tempId ? { ...g, id: data.id } : g));
      }
    }
  };
  
  const updateGift = async (id: string, updatedGift: Omit<Gift, 'id'>) => {
    setGifts(prev => prev.map(g => g.id === id ? { ...updatedGift, id } : g));
    if (supabase && resolvedHostId !== 'default' && id.length > 10) {
      await supabase.from('gifts').update({
        title: updatedGift.title,
        description: updatedGift.description,
        price: updatedGift.price,
        image_url: updatedGift.imageUrl,
        category: updatedGift.category,
        quantity: updatedGift.quantity
      }).eq('id', id);
    }
  };
  
  const deleteGift = async (id: string) => {
    setGifts(prev => prev.filter(g => g.id !== id));
    if (supabase && resolvedHostId !== 'default' && id.length > 10) {
      await supabase.from('gifts').delete().eq('id', id);
    }
  };

  const addMessage = async (message: Omit<Message, 'id' | 'createdAt'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    const newMessage = { ...message, id: tempId, createdAt: new Date().toISOString() };
    setMessages(prev => [newMessage, ...prev]);
    
    if (supabase && resolvedHostId !== 'default') {
      const { data } = await supabase.from('messages').insert([{
        host_id: resolvedHostId,
        author_name: message.authorName,
        content: message.content
      }]).select().single();
      
      if (data) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, createdAt: data.created_at } : m));
      }
    }
  };

  const addGuest = async (guest: Omit<Guest, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    const confirmationCode = guest.confirmationCode || Math.random().toString(36).substring(2, 8).toUpperCase();
    const newGuest = { ...guest, id: tempId, confirmationCode };
    setGuests(prev => [...prev, newGuest]);
    
    if (supabase && resolvedHostId !== 'default') {
      try {
        const { data } = await supabase.from('guests').insert([{
          host_id: resolvedHostId,
          name: guest.name,
          status: guest.status || 'Confirmado',
          confirmation_code: confirmationCode
        }]).select().single();
        
        if (data) {
          setGuests(prev => prev.map(g => g.id === tempId ? { ...g, id: data.id, confirmationCode: data.confirmation_code } : g));
        }
      } catch (err) {
        console.warn("Could not insert guest in Supabase:", err);
      }
    }

    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          hostId: resolvedHostId,
          guestId: tempId,
          name: guest.name,
          status: guest.status || 'Confirmado',
          confirmationCode
        })
      });
      if (res.ok) {
        const d = await res.json();
        if (d.guest?.id) {
          setGuests(prev => prev.map(g => g.id === tempId ? { ...g, id: d.guest.id } : g));
        }
      }
    } catch {
      // ignore
    }
  };
  
  const updateGuest = async (id: string, updates: Partial<Guest>) => {
    setGuests(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    
    // Only send defined fields to prevent overwriting not-null columns with null
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.confirmationCode !== undefined) payload.confirmation_code = updates.confirmationCode;

    if (supabase && resolvedHostId !== 'default' && id.length > 10) {
      try {
        await supabase.from('guests').update(payload).eq('id', id);
      } catch (err) {
        console.warn("Could not update guest in Supabase:", err);
      }
    }

    try {
      await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          guestId: id,
          status: updates.status,
          name: updates.name,
          hostId: resolvedHostId
        })
      });
    } catch {
      // ignore
    }
  };
  
  const deleteGuest = async (id: string) => {
    setGuests(prev => prev.filter(g => g.id !== id));
    if (supabase && resolvedHostId !== 'default' && id.length > 10) {
      await supabase.from('guests').delete().eq('id', id);
    }
    try {
      await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          guestId: id,
          hostId: resolvedHostId
        })
      });
    } catch {
      // ignore
    }
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'date'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    const newTx: Transaction = {
      ...transaction,
      id: tempId,
      date: new Date().toISOString(),
      status: transaction.status || 'Concluído',
    };
    setTransactions(prev => [newTx, ...prev]);
    
    if (supabase && resolvedHostId !== 'default') {
      try {
        const { data } = await supabase.from('transactions').insert([{
          host_id: resolvedHostId,
          gift_title: transaction.giftTitle,
          donor_name: transaction.donorName,
          amount: transaction.amount,
          method: transaction.method,
          status: transaction.status || 'Concluído'
        }]).select().single();
        
        if (data) {
          setTransactions(prev => prev.map(t => t.id === tempId ? { ...t, id: data.id, date: data.date } : t));
        }
      } catch (err) {
        console.warn("Could not insert transaction in Supabase:", err);
      }
    }
  };

  const refreshTransactions = async (freshTxs?: Transaction[]) => {
    if (!resolvedHostId) return;
    try {
      const currentSlug = eventDetails?.slug || '';
      const [txServerRes, supabaseRes] = await Promise.all([
        freshTxs ? Promise.resolve({ ok: true, json: async () => freshTxs }) : fetch(`/api/transactions?hostId=${resolvedHostId}`),
        supabase && resolvedHostId !== 'default' 
          ? supabase.from('transactions').select('*').or(`host_id.eq.${resolvedHostId},host_id.eq.${currentSlug || resolvedHostId}`)
          : Promise.resolve({ data: null })
      ]);

      const pool: Transaction[] = [...transactions];

      if (supabaseRes.data && supabaseRes.data.length > 0) {
        supabaseRes.data.forEach((t: any) => {
          pool.push({
            id: t.id,
            giftTitle: t.gift_title,
            donorName: t.donor_name,
            amount: t.amount,
            method: t.method as any,
            date: t.date,
            status: t.status as any,
            payment_id: t.payment_id || undefined,
            external_reference: t.external_reference || undefined
          });
        });
      }

      if (txServerRes.ok) {
        const serverTxs: any[] = await txServerRes.json();
        if (Array.isArray(serverTxs)) {
          pool.push(...serverTxs);
        }
      }

      if (freshTxs && Array.isArray(freshTxs)) {
        pool.push(...freshTxs);
      }

      const merged = reconcileTransactions(pool, resolvedHostId, currentSlug);

      setTransactions(merged);
      try {
        localStorage.setItem(`wedding_tech_${resolvedHostId}_transactions`, JSON.stringify(merged));
        if (currentSlug) {
          localStorage.setItem(`wedding_tech_${currentSlug}_transactions`, JSON.stringify(merged));
        }
      } catch {}
    } catch (e) {
      console.warn("Error refreshing transactions:", e);
    }
  };

  const refreshReservations = async () => {
    if (!resolvedHostId) return;
    try {
      const res = await fetch(`/api/reservations?hostId=${resolvedHostId}`);
      if (res.ok) {
        const data = await res.json();
        setReservations(data.reservations || []);
      }
    } catch (e) {
      console.warn("Error refreshing reservations:", e);
    }
  };

  const releaseReservation = async (reservationId: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/reservations/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId, hostId: resolvedHostId })
      });
      const data = await res.json();
      if (data.success) {
        await refreshReservations();
        await refreshTransactions();
        return true;
      }
      return false;
    } catch (e) {
      console.warn("Error releasing reservation:", e);
      return false;
    }
  };

  const addGalleryImage = async (image: Omit<GalleryImage, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    setGallery(prev => [...prev, { ...image, id: tempId }]);
    
    if (supabase && resolvedHostId !== 'default') {
      const { data } = await supabase.from('gallery').insert([{
        host_id: resolvedHostId,
        url: image.url,
        caption: image.caption,
        display_order: image.order || 0
      }]).select().single();
      
      if (data) {
        setGallery(prev => prev.map(g => g.id === tempId ? { ...g, id: data.id } : g));
      }
    }
  };
  const updateGalleryImage = async (id: string, updates: Partial<GalleryImage>) => {
    setGallery(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    if (supabase && resolvedHostId !== 'default' && id.length > 10) {
      await supabase.from('gallery').update({
        url: updates.url,
        caption: updates.caption,
        display_order: updates.order
      }).eq('id', id);
    }
  };
  const deleteGalleryImage = async (id: string) => {
    setGallery(prev => prev.filter(i => i.id !== id));
    if (supabase && resolvedHostId !== 'default' && id.length > 10) {
      await supabase.from('gallery').delete().eq('id', id);
    }
  };

  const addScheduleItem = async (item: Omit<ScheduleItem, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    setSchedule(prev => [...prev, { ...item, id: tempId }]);
    
    if (supabase && resolvedHostId !== 'default') {
      const { data } = await supabase.from('schedule').insert([{
        host_id: resolvedHostId,
        time: item.time,
        title: item.title,
        description: item.description
      }]).select().single();
      
      if (data) {
        setSchedule(prev => prev.map(s => s.id === tempId ? { ...s, id: data.id } : s));
      }
    }
  };
  const updateScheduleItem = async (id: string, updates: Partial<ScheduleItem>) => {
    setSchedule(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    if (supabase && resolvedHostId !== 'default' && id.length > 10) {
      await supabase.from('schedule').update({
        time: updates.time,
        title: updates.title,
        description: updates.description
      }).eq('id', id);
    }
  };
  const deleteScheduleItem = async (id: string) => {
    setSchedule(prev => prev.filter(s => s.id !== id));
    if (supabase && resolvedHostId !== 'default' && id.length > 10) {
      await supabase.from('schedule').delete().eq('id', id);
    }
  };

  const addExpense = async (expense: Omit<ExpenseItem, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    setExpenses(prev => [...prev, { ...expense, id: tempId }]);
    
    if (supabase && resolvedHostId !== 'default') {
      const { data } = await supabase.from('expenses').insert([{
        host_id: resolvedHostId,
        title: expense.title,
        amount: expense.amount,
        date: expense.date,
        status: expense.status
      }]).select().single();
      
      if (data) {
        setExpenses(prev => prev.map(e => e.id === tempId ? { ...e, id: data.id } : e));
      }
    }
  };
  const updateExpense = async (id: string, updates: Partial<ExpenseItem>) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    if (supabase && resolvedHostId !== 'default' && id.length > 10) {
      await supabase.from('expenses').update({
        title: updates.title,
        amount: updates.amount,
        date: updates.date,
        status: updates.status
      }).eq('id', id);
    }
  };
  const deleteExpense = async (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (supabase && resolvedHostId !== 'default' && id.length > 10) {
      await supabase.from('expenses').delete().eq('id', id);
    }
  };

  return (
    <AppContext.Provider value={{
      eventDetails, setEventDetails,
      paymentSettings, setPaymentSettings,
      gifts, addGift, updateGift, deleteGift,
      messages, addMessage,
      guests, addGuest, updateGuest, deleteGuest,
      transactions, addTransaction, refreshTransactions,
      reservations, refreshReservations, releaseReservation,
      gallery, addGalleryImage, updateGalleryImage, deleteGalleryImage,
      schedule, addScheduleItem, updateScheduleItem, deleteScheduleItem,
      expenses, addExpense, updateExpense, deleteExpense,
      isLoading, isNotFound, resolvedHostId
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
