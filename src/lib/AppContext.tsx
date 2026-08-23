import React, { createContext, useContext, useState, useEffect } from 'react';
import { EventDetails, Gift, Guest, Message, Transaction, PaymentSettings, GalleryImage, ScheduleItem, ExpenseItem } from '../types';
import { initialEventDetails, initialGifts, initialGuests, initialMessages, initialTransactions, initialPaymentSettings, initialGallery, initialSchedule, initialExpenses } from './data';
import { supabase } from './supabase';

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
  addTransaction: (transaction: Omit<Transaction, 'id' | 'date' | 'status'>) => void;

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
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode, hostId?: string }> = ({ children, hostId = 'default' }) => {
  const [isLoading, setIsLoading] = useState(true);

  // Try to load from localStorage, fallback to initial data
  const loadState = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(`wedding_tech_${hostId}_${key}`);
      return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  const [eventDetails, setEventDetailsState] = useState<EventDetails>(() => loadState('event', initialEventDetails));
  const [gifts, setGifts] = useState<Gift[]>(() => loadState('gifts', initialGifts));
  const [messages, setMessages] = useState<Message[]>(() => loadState('messages', initialMessages));
  const [guests, setGuests] = useState<Guest[]>(() => loadState('guests', initialGuests));
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadState('transactions', initialTransactions));
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
          supabase.from('event_details').select('*').eq('host_id', hostId).single(),
          supabase.from('payment_settings').select('*').eq('host_id', hostId).single(),
          supabase.from('gifts').select('*').eq('host_id', hostId),
          supabase.from('messages').select('*').eq('host_id', hostId),
          supabase.from('guests').select('*').eq('host_id', hostId),
          supabase.from('transactions').select('*').eq('host_id', hostId),
          supabase.from('gallery').select('*').eq('host_id', hostId),
          supabase.from('schedule').select('*').eq('host_id', hostId),
          supabase.from('expenses').select('*').eq('host_id', hostId)
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
              mapsLink: eventData.location_maps_link || '',
              latitude: eventData.location_latitude || '',
              longitude: eventData.location_longitude || ''
            },
            story: eventData.story || '',
            coverImage: eventData.cover_image || '',
            themeColor: eventData.theme_color || 'teal'
          });
        } else {
          setEventDetailsState({
            eventType: 'casamento', title: '', date: '', story: '', coverImage: '', themeColor: '#0f766e',
            location: { name: '', address: '', city: '', state: '', mapsLink: '', latitude: '', longitude: '' }
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
        
        setGuests(guestsData && guestsData.length > 0 ? guestsData.map(g => ({
          id: g.id,
          name: g.name,
          status: g.status as any
        })) : []);
        
        setTransactions(txData && txData.length > 0 ? txData.map(t => ({
          id: t.id,
          giftTitle: t.gift_title,
          donorName: t.donor_name,
          amount: t.amount,
          method: t.method as any,
          date: t.date,
          status: t.status as any
        })) : []);
        
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
    setEventDetailsState(details);
    if (supabase && hostId !== 'default') {
      const { error } = await supabase.from('event_details').upsert({
        host_id: hostId,
        event_type: details.eventType,
        title: details.title,
        date: details.date,
        location_name: details.location.name,
        location_address: details.location.address,
        location_city: details.location.city,
        location_state: details.location.state,
        location_maps_link: details.location.mapsLink,
        location_latitude: details.location.latitude,
        location_longitude: details.location.longitude,
        story: details.story,
        cover_image: details.coverImage,
        theme_color: details.themeColor
      });
      if (error) {
        console.error("Upsert event_details error:", error);
        throw new Error(error.message || JSON.stringify(error));
      }
    }
  };
  
  const setPaymentSettings = async (settings: PaymentSettings) => {
    setPaymentSettingsState(settings);
    if (supabase && hostId !== 'default') {
      await supabase.from('payment_settings').upsert({
        host_id: hostId,
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
    
    if (supabase && hostId !== 'default') {
      const { data } = await supabase.from('gifts').insert([{
        host_id: hostId,
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
    if (supabase && hostId !== 'default' && id.length > 10) {
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
    if (supabase && hostId !== 'default' && id.length > 10) {
      await supabase.from('gifts').delete().eq('id', id);
    }
  };

  const addMessage = async (message: Omit<Message, 'id' | 'createdAt'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    const newMessage = { ...message, id: tempId, createdAt: new Date().toISOString() };
    setMessages(prev => [newMessage, ...prev]);
    
    if (supabase && hostId !== 'default') {
      const { data } = await supabase.from('messages').insert([{
        host_id: hostId,
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
    const newGuest = { ...guest, id: tempId };
    setGuests(prev => [...prev, newGuest]);
    
    if (supabase && hostId !== 'default') {
      const { data } = await supabase.from('guests').insert([{
        host_id: hostId,
        name: guest.name,
        status: guest.status
      }]).select().single();
      
      if (data) {
        setGuests(prev => prev.map(g => g.id === tempId ? { ...g, id: data.id } : g));
      }
    }
  };
  
  const updateGuest = async (id: string, updates: Partial<Guest>) => {
    setGuests(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    if (supabase && hostId !== 'default' && id.length > 10) {
      await supabase.from('guests').update({
        name: updates.name,
        status: updates.status
      }).eq('id', id);
    }
  };
  
  const deleteGuest = async (id: string) => {
    setGuests(prev => prev.filter(g => g.id !== id));
    if (supabase && hostId !== 'default' && id.length > 10) {
      await supabase.from('guests').delete().eq('id', id);
    }
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'date' | 'status'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    const newTx: Transaction = {
      ...transaction,
      id: tempId,
      date: new Date().toISOString(),
      status: 'Concluído',
    };
    setTransactions(prev => [newTx, ...prev]);
    
    if (supabase && hostId !== 'default') {
      const { data } = await supabase.from('transactions').insert([{
        host_id: hostId,
        gift_title: transaction.giftTitle,
        donor_name: transaction.donorName,
        amount: transaction.amount,
        method: transaction.method,
        status: 'Concluído'
      }]).select().single();
      
      if (data) {
        setTransactions(prev => prev.map(t => t.id === tempId ? { ...t, id: data.id, date: data.date } : t));
      }
    }
  };

  const addGalleryImage = async (image: Omit<GalleryImage, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    setGallery(prev => [...prev, { ...image, id: tempId }]);
    
    if (supabase && hostId !== 'default') {
      const { data } = await supabase.from('gallery').insert([{
        host_id: hostId,
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
    if (supabase && hostId !== 'default' && id.length > 10) {
      await supabase.from('gallery').update({
        url: updates.url,
        caption: updates.caption,
        display_order: updates.order
      }).eq('id', id);
    }
  };
  const deleteGalleryImage = async (id: string) => {
    setGallery(prev => prev.filter(i => i.id !== id));
    if (supabase && hostId !== 'default' && id.length > 10) {
      await supabase.from('gallery').delete().eq('id', id);
    }
  };

  const addScheduleItem = async (item: Omit<ScheduleItem, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    setSchedule(prev => [...prev, { ...item, id: tempId }]);
    
    if (supabase && hostId !== 'default') {
      const { data } = await supabase.from('schedule').insert([{
        host_id: hostId,
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
    if (supabase && hostId !== 'default' && id.length > 10) {
      await supabase.from('schedule').update({
        time: updates.time,
        title: updates.title,
        description: updates.description
      }).eq('id', id);
    }
  };
  const deleteScheduleItem = async (id: string) => {
    setSchedule(prev => prev.filter(s => s.id !== id));
    if (supabase && hostId !== 'default' && id.length > 10) {
      await supabase.from('schedule').delete().eq('id', id);
    }
  };

  const addExpense = async (expense: Omit<ExpenseItem, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    setExpenses(prev => [...prev, { ...expense, id: tempId }]);
    
    if (supabase && hostId !== 'default') {
      const { data } = await supabase.from('expenses').insert([{
        host_id: hostId,
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
    if (supabase && hostId !== 'default' && id.length > 10) {
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
    if (supabase && hostId !== 'default' && id.length > 10) {
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
      transactions, addTransaction,
      gallery, addGalleryImage, updateGalleryImage, deleteGalleryImage,
      schedule, addScheduleItem, updateScheduleItem, deleteScheduleItem,
      expenses, addExpense, updateExpense, deleteExpense,
      isLoading
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
