export type GalleryImage = {
  id: string;
  url: string;
  storagePath?: string;
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
  imageStoragePath?: string;
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
  confirmationCode?: string;
};

export type Transaction = {
  id: string;
  host_id?: string;
  gift_id?: string;
  payment_id?: string;
  preference_id?: string;
  external_reference?: string;
  giftTitle: string;
  donorName: string;
  amount: number;
  method: 'Aguardando' | 'PIX' | 'Cartão de Crédito' | 'Cartão de Débito' | 'Boleto' | 'Outro' | string;
  date: string;
  status: 'checkout_started' | 'pending' | 'in_process' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'expired' | 'Concluído' | 'Pendente';
  created_at?: string;
  updated_at?: string;
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

export type PaymentAccount = {
  platform: string;
  provider: string;
  host_id: string;
  connection_status: 'connected' | 'disconnected';
  provider_user_id?: string;
  access_token_reference?: string;
  refresh_token_reference?: string;
  connected_at?: string;
};

export type LocationDetails = {
  name: string;
  address: string;
  city: string;
  state: string;
  mapsLink: string;
  // Provider-independent extensions
  formattedAddress?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  provider?: string;
  providerPlaceId?: string;
  mapsUrl?: string;
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
  coverStoragePath?: string;
  coverMediaType?: 'image' | 'video';
  coverVideoUrl?: string;
  coverVideoStoragePath?: string;
  coverPosterStoragePath?: string;
  themeColor: string;
  slug?: string;
};
