import { EventDetails, Gift, Guest, Message, Transaction, PaymentSettings, GalleryImage, ScheduleItem, ExpenseItem } from '../types';

export const initialEventDetails: EventDetails = {
  eventType: 'casamento',
  title: "Casamento de Ana & João",
  date: "2026-12-12T18:00:00",
  location: {
    name: "Fazenda das Flores",
    address: "Estrada do Sol, km 42",
    city: "São Paulo",
    state: "SP",
    mapsLink: "https://maps.google.com/?q=Fazenda+das+Flores"
  },
  story: "Nos conhecemos há 5 anos e desde então construímos uma história linda juntos. Mal podemos esperar para celebrar nosso amor com as pessoas que mais amamos!",
  coverImage: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
  themeColor: "#0f766e" // teal-700
};

export const initialGifts: Gift[] = [
  {
    id: "1",
    title: "Cota da Lua de Mel",
    description: "Ajude-nos a curtir nossa viagem inesquecível para as Maldivas!",
    price: 500,
    imageUrl: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    category: "Viagem"
  },
  {
    id: "2",
    title: "Jogo de Panelas",
    description: "Para prepararmos jantares incríveis para vocês.",
    price: 350,
    imageUrl: "https://images.unsplash.com/photo-1584990347449-a6efa1a20079?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    category: "Casa"
  },
  {
    id: "3",
    title: "Jantar Romântico",
    description: "Um jantar especial durante nossa viagem.",
    price: 200,
    imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    category: "Experiência"
  },
  {
    id: "4",
    title: "Valor Livre",
    description: "Contribua com o valor que desejar para nossa nova vida.",
    price: 100,
    imageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    category: "Geral"
  }
];

export const initialMessages: Message[] = [
  {
    id: "1",
    authorName: "Tia Maria",
    content: "Desejo toda a felicidade do mundo para vocês, meus queridos!",
    createdAt: "2026-08-01T10:00:00"
  },
  {
    id: "2",
    authorName: "Carlos Amigo",
    content: "Que festa incrível vai ser! Estarei lá com certeza.",
    createdAt: "2026-08-02T14:30:00"
  }
];

export const initialGuests: Guest[] = [
  {
    id: "1",
    name: "Tia Maria da Silva",
    status: "Pendente"
  },
  {
    id: "2",
    name: "Carlos Amigo",
    status: "Pendente"
  }
];

export const initialTransactions: Transaction[] = [
  {
    id: "tx1",
    giftTitle: "Cota da Lua de Mel",
    donorName: "Tia Maria da Silva",
    amount: 500,
    method: "PIX",
    date: "2026-08-01T10:05:00",
    status: "Concluído"
  },
  {
    id: "tx2",
    giftTitle: "Jantar Romântico",
    donorName: "Primo João",
    amount: 200,
    method: "Cartão de Crédito",
    date: "2026-08-02T11:20:00",
    status: "Concluído"
  }
];

export const initialPaymentSettings: PaymentSettings = {
  pixKeyType: 'email',
  pixKey: 'contato@exemplo.com',
  receiverName: 'João da Silva',
  city: 'São Paulo',
  gatewayProvider: 'mercadopago',
  gatewayPublicKey: 'APP_USR-e3868214-9c52-4001-bd10-ea0046f39930',
  gatewayEnvironment: 'sandbox',
  gatewayWebhookUrl: ''
};

export const initialGallery: GalleryImage[] = [
  { id: '1', url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', caption: 'Nosso noivado', order: 1 },
  { id: '2', url: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', caption: 'Viagem inesquecível', order: 2 },
  { id: '3', url: 'https://images.unsplash.com/photo-1543886567-96a8eb83df60?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', caption: 'Primeiro dia dos namorados', order: 3 },
];

export const initialSchedule: ScheduleItem[] = [
  { id: '1', time: '16:00', title: 'Cerimônia', description: 'Início da cerimônia religiosa' },
  { id: '2', time: '17:30', title: 'Coquetel', description: 'Recepção dos convidados e fotos' },
  { id: '3', time: '19:00', title: 'Jantar', description: 'Serviço de buffet liberado' },
  { id: '4', time: '21:00', title: 'Festa', description: 'Abertura da pista de dança' },
];

export const initialExpenses: ExpenseItem[] = [
  { id: '1', title: 'Espaço', amount: 8000, date: '2026-05-10', status: 'Pago' },
  { id: '2', title: 'Buffet', amount: 15000, date: '2026-06-15', status: 'Pendente' },
];
