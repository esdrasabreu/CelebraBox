import React, { createContext, useContext, useState, useEffect } from 'react';
import { EventDetails, Gift, Guest, Message, Transaction, PaymentSettings, GalleryImage, ScheduleItem, ExpenseItem } from '../types';
import { initialEventDetails, initialGifts, initialGuests, initialMessages, initialTransactions, initialPaymentSettings, initialGallery, initialSchedule, initialExpenses } from './data';

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
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Try to load from localStorage, fallback to initial data
  const loadState = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(`wedding_tech_${key}`);
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

  // Save to localStorage whenever state changes
  useEffect(() => localStorage.setItem('wedding_tech_event', JSON.stringify(eventDetails)), [eventDetails]);
  useEffect(() => localStorage.setItem('wedding_tech_payment_settings', JSON.stringify(paymentSettings)), [paymentSettings]);
  useEffect(() => localStorage.setItem('wedding_tech_gifts', JSON.stringify(gifts)), [gifts]);
  useEffect(() => localStorage.setItem('wedding_tech_messages', JSON.stringify(messages)), [messages]);
  useEffect(() => localStorage.setItem('wedding_tech_guests', JSON.stringify(guests)), [guests]);
  useEffect(() => localStorage.setItem('wedding_tech_transactions', JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem('wedding_tech_gallery', JSON.stringify(gallery)), [gallery]);
  useEffect(() => localStorage.setItem('wedding_tech_schedule', JSON.stringify(schedule)), [schedule]);
  useEffect(() => localStorage.setItem('wedding_tech_expenses', JSON.stringify(expenses)), [expenses]);

  const setEventDetails = (details: EventDetails) => setEventDetailsState(details);
  const setPaymentSettings = (settings: PaymentSettings) => setPaymentSettingsState(settings);

  const addGift = (gift: Omit<Gift, 'id'>) => {
    setGifts(prev => [...prev, { ...gift, id: Math.random().toString(36).substr(2, 9) }]);
  };
  
  const updateGift = (id: string, updatedGift: Omit<Gift, 'id'>) => {
    setGifts(prev => prev.map(g => g.id === id ? { ...updatedGift, id } : g));
  };
  
  const deleteGift = (id: string) => {
    setGifts(prev => prev.filter(g => g.id !== id));
  };

  const addMessage = (message: Omit<Message, 'id' | 'createdAt'>) => {
    setMessages(prev => [{
      ...message,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    }, ...prev]);
  };

  const addGuest = (guest: Omit<Guest, 'id'>) => {
    setGuests(prev => [...prev, { ...guest, id: Math.random().toString(36).substr(2, 9) }]);
  };
  
  const updateGuest = (id: string, updates: Partial<Guest>) => {
    setGuests(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  };
  
  const deleteGuest = (id: string) => {
    setGuests(prev => prev.filter(g => g.id !== id));
  };

  const addTransaction = (transaction: Omit<Transaction, 'id' | 'date' | 'status'>) => {
    setTransactions(prev => [{
      ...transaction,
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      status: 'Concluído',
    }, ...prev]);
  };

  const addGalleryImage = (image: Omit<GalleryImage, 'id'>) => {
    setGallery(prev => [...prev, { ...image, id: Math.random().toString(36).substr(2, 9) }]);
  };
  const updateGalleryImage = (id: string, updates: Partial<GalleryImage>) => {
    setGallery(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };
  const deleteGalleryImage = (id: string) => {
    setGallery(prev => prev.filter(i => i.id !== id));
  };

  const addScheduleItem = (item: Omit<ScheduleItem, 'id'>) => {
    setSchedule(prev => [...prev, { ...item, id: Math.random().toString(36).substr(2, 9) }]);
  };
  const updateScheduleItem = (id: string, updates: Partial<ScheduleItem>) => {
    setSchedule(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };
  const deleteScheduleItem = (id: string) => {
    setSchedule(prev => prev.filter(s => s.id !== id));
  };

  const addExpense = (expense: Omit<ExpenseItem, 'id'>) => {
    setExpenses(prev => [...prev, { ...expense, id: Math.random().toString(36).substr(2, 9) }]);
  };
  const updateExpense = (id: string, updates: Partial<ExpenseItem>) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };
  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
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
      expenses, addExpense, updateExpense, deleteExpense
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
