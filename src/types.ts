export type GalleryImage = {
  id: string;
  url: string;
  caption?: string;
  order: number;
};

export type ScheduleItem = {
  id: string;
  time: string;
  title: string;
  description?: string;
};

export type ExpenseItem = {
  id: string;
  title: string;
  amount: number;
  date: string;
  status: 'Pago' | 'Pendente';
};

export type Gift = {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  category?: string;
  quantity?: number;
};

export type Message = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export type Guest = {
  id: string;
  name: string;
  status: 'Confirmado' | 'Pendente' | 'Não vai';
};

export type Transaction = {
  id: string;
  giftTitle: string;
  donorName: string;
  amount: number;
  method: 'PIX' | 'Cartão de Crédito';
  date: string;
  status: 'Concluído' | 'Pendente';
};

export type PaymentSettings = {
  pixKeyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  pixKey: string;
  receiverName: string;
  city: string;
  gatewayProvider: 'stripe' | 'mercadopago' | 'asaas' | 'simulated';
  gatewayPublicKey: string;
  gatewayAccessToken?: string;
  gatewayEnvironment: 'sandbox' | 'production';
  gatewayWebhookUrl?: string;
};

export type LocationDetails = {
  name: string;
  address: string;
  city: string;
  state: string;
  mapsLink: string;
  latitude: string;
  longitude: string;
};

export type Host = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
};

export type EventDetails = {
  eventType: 'casamento' | 'aniversário';
  title: string;
  date: string;
  location: LocationDetails;
  story: string;
  coverImage: string;
  themeColor: string;
};
