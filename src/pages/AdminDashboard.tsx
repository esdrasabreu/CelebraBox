import React, { useState } from 'react';
import { toast } from 'sonner';
import { Users, Gift, Settings, LogOut, Download, DollarSign, CreditCard, QrCode, Plus, Edit, Trash2, LayoutDashboard, Image as ImageIcon, Clock, Receipt } from 'lucide-react';
import { useAppContext } from '../lib/AppContext';
import { useAuth } from '../lib/AuthContext';
import { Gift as GiftType, Guest, GalleryImage, ScheduleItem, ExpenseItem } from '../types';

export default function AdminDashboard() {
  const { host, logout } = useAuth();
  const { 
    eventDetails, setEventDetails,
    paymentSettings, setPaymentSettings,
    guests, addGuest, updateGuest, deleteGuest,
    gifts, addGift, updateGift, deleteGift,
    transactions,
    gallery, addGalleryImage, updateGalleryImage, deleteGalleryImage,
    schedule, addScheduleItem, updateScheduleItem, deleteScheduleItem,
    expenses, addExpense, updateExpense, deleteExpense
  } = useAppContext();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'rsvp' | 'gifts-catalog' | 'finance' | 'payments-config' | 'settings' | 'gallery' | 'schedule' | 'expenses'>('overview');

  // Financial calculations
  const totalArrecadado = transactions.reduce((acc, curr) => acc + curr.amount, 0);
  const totalPix = transactions.filter(t => t.method === 'PIX').reduce((acc, curr) => acc + curr.amount, 0);
  const totalCartao = transactions.filter(t => t.method === 'Cartão de Crédito').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  // GUESTS STATE
  const [guestForm, setGuestForm] = useState({ id: '', name: '', status: 'Pendente' as Guest['status'] });
  const [isEditingGuest, setIsEditingGuest] = useState(false);

  // GIFTS STATE
  const [giftForm, setGiftForm] = useState({ id: '', title: '', description: '', price: '', imageUrl: '', category: '', quantity: '' });
  const [isEditingGift, setIsEditingGift] = useState(false);

  // GALLERY STATE
  const [galleryForm, setGalleryForm] = useState({ id: '', url: '', caption: '', order: 0 });
  const [isEditingGallery, setIsEditingGallery] = useState(false);

  // SCHEDULE STATE
  const [scheduleForm, setScheduleForm] = useState({ id: '', time: '', title: '', description: '' });
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);

  // EXPENSES STATE
  const [expenseForm, setExpenseForm] = useState({ id: '', title: '', amount: '', date: '', status: 'Pendente' as ExpenseItem['status'] });
  const [isEditingExpense, setIsEditingExpense] = useState(false);

  // SETTINGS WIZARD STATE
  const [settingsStep, setSettingsStep] = useState(1);
  const [showAdvancedAddress, setShowAdvancedAddress] = useState(false);
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [showManualSlug, setShowManualSlug] = useState(false);
  const [showAdvancedMaps, setShowAdvancedMaps] = useState(false);

  // SETTINGS STATE
  const [settingsForm, setSettingsForm] = useState({
    eventType: eventDetails.eventType,
    title: eventDetails.title,
    date: eventDetails.date,
    locationName: eventDetails.location.name,
    locationAddress: eventDetails.location.address,
    locationCity: eventDetails.location.city,
    locationState: eventDetails.location.state,
    locationMapsLink: eventDetails.location.mapsLink,
    slug: eventDetails.slug || '',
    coverMediaType: eventDetails.coverMediaType || 'image',
    coverVideoUrl: eventDetails.coverVideoUrl || '',
    story: eventDetails.story,
    coverImage: eventDetails.coverImage,
  });

  // PAYMENT SETTINGS STATE
  const [paymentForm, setPaymentForm] = useState({
    pixKeyType: paymentSettings.pixKeyType,
    pixKey: paymentSettings.pixKey,
    receiverName: paymentSettings.receiverName,
    city: paymentSettings.city,
    gatewayProvider: paymentSettings.gatewayProvider,
    gatewayPublicKey: paymentSettings.gatewayPublicKey,
    gatewayAccessToken: paymentSettings.gatewayAccessToken || '',
    gatewayEnvironment: paymentSettings.gatewayEnvironment,
    gatewayWebhookUrl: paymentSettings.gatewayWebhookUrl || '',
  });

  React.useEffect(() => {
    setSettingsForm({
      eventType: eventDetails.eventType,
      title: eventDetails.title,
      date: eventDetails.date,
      locationName: eventDetails.location.name,
      locationAddress: eventDetails.location.address,
      locationCity: eventDetails.location.city,
      locationState: eventDetails.location.state,
      locationMapsLink: eventDetails.location.mapsLink,
      slug: eventDetails.slug || '',
    coverMediaType: eventDetails.coverMediaType || 'image',
    coverVideoUrl: eventDetails.coverVideoUrl || '',
      story: eventDetails.story,
      coverImage: eventDetails.coverImage,
    });
  }, [eventDetails]);

  React.useEffect(() => {
    setPaymentForm({
      pixKeyType: paymentSettings.pixKeyType,
      pixKey: paymentSettings.pixKey,
      receiverName: paymentSettings.receiverName,
      city: paymentSettings.city,
      gatewayProvider: paymentSettings.gatewayProvider,
      gatewayPublicKey: paymentSettings.gatewayPublicKey,
      gatewayAccessToken: paymentSettings.gatewayAccessToken || '',
      gatewayEnvironment: paymentSettings.gatewayEnvironment,
      gatewayWebhookUrl: paymentSettings.gatewayWebhookUrl || '',
    });
  }, [paymentSettings]);

  const handleExportCSV = () => {
    const headers = ['Nome', 'Status'];
    const csvContent = [
      headers.join(','),
      ...guests.map(g => `"${g.name}",${g.status}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'lista_convidados.csv';
    link.click();
  };

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestForm.name.trim()) return;

    if (isEditingGuest) {
      updateGuest(guestForm.id, { name: guestForm.name, status: guestForm.status });
    } else {
      addGuest({ name: guestForm.name, status: guestForm.status });
    }
    
    setGuestForm({ id: '', name: '', status: 'Pendente' });
    setIsEditingGuest(false);
  };

  const handleEditGuest = (guest: Guest) => {
    setGuestForm({ id: guest.id, name: guest.name, status: guest.status });
    setIsEditingGuest(true);
  };

  const handleGiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftForm.title || !giftForm.price || !giftForm.imageUrl) return;

    const payload = {
      title: giftForm.title,
      description: giftForm.description,
      price: parseFloat(giftForm.price),
      imageUrl: giftForm.imageUrl,
      category: giftForm.category || undefined,
      quantity: giftForm.quantity ? parseInt(giftForm.quantity) : undefined
    };

    if (isEditingGift) {
      updateGift(giftForm.id, payload);
    } else {
      addGift(payload);
    }
    
    setGiftForm({ id: '', title: '', description: '', price: '', imageUrl: '', category: '', quantity: '' });
    setIsEditingGift(false);
  };

  const handleEditGift = (g: GiftType) => {
    setGiftForm({ id: g.id, title: g.title, description: g.description, price: g.price.toString(), imageUrl: g.imageUrl, category: g.category || '', quantity: g.quantity?.toString() || '' });
    setIsEditingGift(true);
  };

  const handleGallerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryForm.url) return;
    if (isEditingGallery) {
      updateGalleryImage(galleryForm.id, { url: galleryForm.url, caption: galleryForm.caption, order: galleryForm.order });
    } else {
      addGalleryImage({ url: galleryForm.url, caption: galleryForm.caption, order: galleryForm.order });
    }
    setGalleryForm({ id: '', url: '', caption: '', order: 0 });
    setIsEditingGallery(false);
  };

  const handleEditGallery = (i: GalleryImage) => {
    setGalleryForm({ id: i.id, url: i.url, caption: i.caption || '', order: i.order });
    setIsEditingGallery(true);
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.time || !scheduleForm.title) return;
    if (isEditingSchedule) {
      updateScheduleItem(scheduleForm.id, { time: scheduleForm.time, title: scheduleForm.title, description: scheduleForm.description });
    } else {
      addScheduleItem({ time: scheduleForm.time, title: scheduleForm.title, description: scheduleForm.description });
    }
    setScheduleForm({ id: '', time: '', title: '', description: '' });
    setIsEditingSchedule(false);
  };

  const handleEditSchedule = (s: ScheduleItem) => {
    setScheduleForm({ id: s.id, time: s.time, title: s.title, description: s.description || '' });
    setIsEditingSchedule(true);
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount || !expenseForm.date) return;
    const payload = {
      title: expenseForm.title,
      amount: parseFloat(expenseForm.amount),
      date: expenseForm.date,
      status: expenseForm.status
    };
    if (isEditingExpense) {
      updateExpense(expenseForm.id, payload);
    } else {
      addExpense(payload);
    }
    setExpenseForm({ id: '', title: '', amount: '', date: '', status: 'Pendente' });
    setIsEditingExpense(false);
  };

  const handleEditExpense = (e: ExpenseItem) => {
    setExpenseForm({ id: e.id, title: e.title, amount: e.amount.toString(), date: e.date, status: e.status });
    setIsEditingExpense(true);
  };

  const handleSettingsSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log("Saving settings...");
    const updatedDetails = {
      ...eventDetails,
      eventType: settingsForm.eventType,
      title: settingsForm.title,
      date: settingsForm.date,
      slug: settingsForm.slug,
      coverMediaType: settingsForm.coverMediaType,
      coverVideoUrl: settingsForm.coverVideoUrl,
      location: {
        name: settingsForm.locationName,
        address: settingsForm.locationAddress,
        city: settingsForm.locationCity,
        state: settingsForm.locationState,
        mapsLink: settingsForm.locationMapsLink,
      },
      story: settingsForm.story,
      coverImage: settingsForm.coverImage,
    };
    try { 
      await setEventDetails(updatedDetails); 
      toast.success('Configurações salvas com sucesso!'); 
    } catch(err) { 
      toast.error('Erro: ' + err); 
    }
  };

  const handlePaymentSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSettings = {
      ...paymentSettings,
      pixKeyType: paymentForm.pixKeyType as any,
      pixKey: paymentForm.pixKey,
      receiverName: paymentForm.receiverName,
      city: paymentForm.city,
      gatewayProvider: paymentForm.gatewayProvider as any,
      gatewayPublicKey: paymentForm.gatewayPublicKey,
      gatewayAccessToken: paymentForm.gatewayAccessToken,
      gatewayEnvironment: paymentForm.gatewayEnvironment as any,
      gatewayWebhookUrl: paymentForm.gatewayWebhookUrl,
    };
    
    await setPaymentSettings(newSettings);
    toast.success('Configurações de pagamento salvas com sucesso!');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-white mb-1">Painel do Evento</h1>
          <p className="text-xs text-slate-500 truncate">{eventDetails.title}</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto pb-4">
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-teal-600/20 text-teal-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Visão Geral</span>
          </button>
          <button onClick={() => setActiveTab('rsvp')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'rsvp' ? 'bg-teal-600/20 text-teal-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Users className="w-5 h-5" />
            <span className="font-medium">Convidados</span>
          </button>
          <button onClick={() => setActiveTab('gifts-catalog')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'gifts-catalog' ? 'bg-teal-600/20 text-teal-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Gift className="w-5 h-5" />
            <span className="font-medium">Lista de Presentes</span>
          </button>
          <button onClick={() => setActiveTab('gallery')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'gallery' ? 'bg-teal-600/20 text-teal-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <ImageIcon className="w-5 h-5" />
            <span className="font-medium">Galeria de Fotos</span>
          </button>
          <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'schedule' ? 'bg-teal-600/20 text-teal-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Clock className="w-5 h-5" />
            <span className="font-medium">Cronograma</span>
          </button>
          <button onClick={() => setActiveTab('finance')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'finance' ? 'bg-teal-600/20 text-teal-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <DollarSign className="w-5 h-5" />
            <span className="font-medium">Arrecadação</span>
          </button>
          <button onClick={() => setActiveTab('expenses')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'expenses' ? 'bg-teal-600/20 text-teal-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Receipt className="w-5 h-5" />
            <span className="font-medium">Gastos</span>
          </button>
          <button onClick={() => setActiveTab('payments-config')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'payments-config' ? 'bg-teal-600/20 text-teal-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <QrCode className="w-5 h-5" />
            <span className="font-medium">Recebimentos</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-teal-600/20 text-teal-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Settings className="w-5 h-5" />
            <span className="font-medium">Configurações</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 mt-auto">
          <div className="mb-2 text-xs text-slate-500 px-4">
            Logado como: <span className="text-slate-300 font-medium">{host?.name}</span>
          </div>
          <a href={`/e/${eventDetails.slug || host?.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <LayoutDashboard className="w-4 h-4" />
            <span className="font-medium text-sm">Ver Site Público</span>
          </a>
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors mt-1">
            <LogOut className="w-4 h-4" />
            <span className="font-medium text-sm">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Visão Geral do Evento</h2>
              <p className="text-slate-500 text-sm">Resumo das principais métricas e status do seu evento.</p>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 text-slate-500 mb-2">
                  <Users className="w-5 h-5 text-teal-600" />
                  <span className="font-medium text-sm">Convidados Confirmados</span>
                </div>
                <div className="text-3xl font-bold text-slate-800">{guests.filter(g => g.status === 'Confirmado').length} <span className="text-sm font-normal text-slate-500">/ {guests.length}</span></div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 text-slate-500 mb-2">
                  <DollarSign className="w-5 h-5 text-teal-600" />
                  <span className="font-medium text-sm">Arrecadação Total</span>
                </div>
                <div className="text-3xl font-bold text-slate-800">R$ {totalArrecadado.toFixed(2)}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 text-slate-500 mb-2">
                  <Receipt className="w-5 h-5 text-red-500" />
                  <span className="font-medium text-sm">Gastos Previstos</span>
                </div>
                <div className="text-3xl font-bold text-slate-800">R$ {totalExpenses.toFixed(2)}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 text-slate-500 mb-2">
                  <Gift className="w-5 h-5 text-teal-600" />
                  <span className="font-medium text-sm">Presentes Recebidos</span>
                </div>
                <div className="text-3xl font-bold text-slate-800">{transactions.length}</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-semibold text-lg text-slate-800 mb-4">Próximos Pagamentos (Gastos)</h3>
                <div className="space-y-3">
                  {expenses.filter(e => e.status === 'Pendente').length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum gasto pendente.</p>
                  ) : expenses.filter(e => e.status === 'Pendente').map(e => (
                    <div key={e.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-800">{e.title}</p>
                        <p className="text-xs text-slate-500">{new Date(e.date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <span className="font-bold text-slate-700">R$ {e.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-semibold text-lg text-slate-800 mb-4">Status de Confirmações (RSVP)</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Confirmados</span>
                      <span className="font-medium">{guests.filter(g => g.status === 'Confirmado').length}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-teal-500 h-2 rounded-full" style={{ width: `${guests.length ? (guests.filter(g => g.status === 'Confirmado').length / guests.length) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Pendentes</span>
                      <span className="font-medium">{guests.filter(g => g.status === 'Pendente').length}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${guests.length ? (guests.filter(g => g.status === 'Pendente').length / guests.length) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Não irão</span>
                      <span className="font-medium">{guests.filter(g => g.status === 'Não vai').length}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-red-400 h-2 rounded-full" style={{ width: `${guests.length ? (guests.filter(g => g.status === 'Não vai').length / guests.length) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GALLERY TAB */}
        {activeTab === 'gallery' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Galeria de Fotos</h2>
              <p className="text-slate-500 text-sm">Gerencie as fotos exibidas na página pública do evento.</p>
            </div>
            <form onSubmit={handleGallerySubmit} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-slate-500 mb-1">URL da Imagem</label>
                <input required type="url" value={galleryForm.url} onChange={e => setGalleryForm({...galleryForm, url: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" placeholder="https://..." />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-slate-500 mb-1">Legenda (Opcional)</label>
                <input type="text" value={galleryForm.caption} onChange={e => setGalleryForm({...galleryForm, caption: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" placeholder="Ex: Nosso primeiro encontro" />
              </div>
              <div className="w-full md:w-32">
                <label className="block text-xs font-medium text-slate-500 mb-1">Ordem</label>
                <input type="number" value={galleryForm.order} onChange={e => setGalleryForm({...galleryForm, order: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" />
              </div>
              <button type="submit" className="w-full md:w-auto bg-slate-800 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors">
                {isEditingGallery ? 'Salvar Edição' : 'Adicionar'}
              </button>
              {isEditingGallery && (
                <button type="button" onClick={() => { setIsEditingGallery(false); setGalleryForm({ id: '', url: '', caption: '', order: 0 }) }} className="w-full md:w-auto bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors">Cancelar</button>
              )}
            </form>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {gallery.sort((a,b) => a.order - b.order).map(img => (
                <div key={img.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative group">
                  <img src={img.url} alt={img.caption || 'Foto da galeria'} className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => handleEditGallery(img)} className="p-1.5 bg-white text-slate-800 rounded-md hover:bg-teal-50 hover:text-teal-600"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => { toast('Confirmar exclusão?', { action: { label: 'Sim, Excluir', onClick: () => deleteGalleryImage(img.id) } }) }} className="p-1.5 bg-white text-slate-800 rounded-md hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    {img.caption && <p className="text-white text-xs truncate drop-shadow-md">{img.caption}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Cronograma do Evento</h2>
              <p className="text-slate-500 text-sm">Defina os horários e atividades para os convidados.</p>
            </div>
            <form onSubmit={handleScheduleSubmit} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:w-32">
                <label className="block text-xs font-medium text-slate-500 mb-1">Horário</label>
                <input required type="time" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-slate-500 mb-1">Título</label>
                <input required type="text" value={scheduleForm.title} onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" placeholder="Ex: Cerimônia" />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-slate-500 mb-1">Descrição</label>
                <input type="text" value={scheduleForm.description} onChange={e => setScheduleForm({...scheduleForm, description: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" placeholder="Opcional" />
              </div>
              <button type="submit" className="w-full md:w-auto bg-slate-800 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors">
                {isEditingSchedule ? 'Salvar Edição' : 'Adicionar'}
              </button>
              {isEditingSchedule && (
                <button type="button" onClick={() => { setIsEditingSchedule(false); setScheduleForm({ id: '', time: '', title: '', description: '' }) }} className="w-full md:w-auto bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors">Cancelar</button>
              )}
            </form>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Horário</th>
                    <th className="px-6 py-4 font-semibold">Atividade</th>
                    <th className="px-6 py-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedule.sort((a,b) => a.time.localeCompare(b.time)).map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-800">{item.time}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{item.title}</div>
                        {item.description && <div className="text-slate-500 text-xs mt-0.5">{item.description}</div>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleEditSchedule(item)} className="p-1 text-slate-400 hover:text-teal-600 transition-colors mx-1"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => { toast('Confirmar exclusão?', { action: { label: 'Sim, Excluir', onClick: () => deleteScheduleItem(item.id) } }) }} className="p-1 text-slate-400 hover:text-red-600 transition-colors mx-1"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EXPENSES TAB */}
        {activeTab === 'expenses' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Controle de Gastos</h2>
                <p className="text-slate-500 text-sm">Registre e acompanhe os pagamentos dos fornecedores.</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-500">Total</div>
                <div className="text-xl font-bold text-slate-800">R$ {totalExpenses.toFixed(2)}</div>
              </div>
            </div>
            <form onSubmit={handleExpenseSubmit} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-slate-500 mb-1">Fornecedor / Item</label>
                <input required type="text" value={expenseForm.title} onChange={e => setExpenseForm({...expenseForm, title: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" placeholder="Ex: Fotógrafo" />
              </div>
              <div className="w-full md:w-32">
                <label className="block text-xs font-medium text-slate-500 mb-1">Valor (R$)</label>
                <input required type="number" step="0.01" min="0" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" placeholder="0.00" />
              </div>
              <div className="w-full md:w-40">
                <label className="block text-xs font-medium text-slate-500 mb-1">Vencimento</label>
                <input required type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" />
              </div>
              <div className="w-full md:w-32">
                <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                <select value={expenseForm.status} onChange={e => setExpenseForm({...expenseForm, status: e.target.value as ExpenseItem['status']})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm bg-white">
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                </select>
              </div>
              <button type="submit" className="w-full md:w-auto bg-slate-800 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors">
                {isEditingExpense ? 'Salvar Edição' : 'Adicionar'}
              </button>
              {isEditingExpense && (
                <button type="button" onClick={() => { setIsEditingExpense(false); setExpenseForm({ id: '', title: '', amount: '', date: '', status: 'Pendente' }) }} className="w-full md:w-auto bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors">Cancelar</button>
              )}
            </form>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Fornecedor / Item</th>
                    <th className="px-6 py-4 font-semibold">Valor</th>
                    <th className="px-6 py-4 font-semibold">Vencimento</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-800">{exp.title}</td>
                      <td className="px-6 py-4 font-bold text-slate-700">R$ {exp.amount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-slate-500">{new Date(exp.date).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${exp.status === 'Pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {exp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleEditExpense(exp)} className="p-1 text-slate-400 hover:text-teal-600 transition-colors mx-1"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => deleteExpense(exp.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors mx-1"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RSVP TAB */}
        {activeTab === 'rsvp' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Gestão de Convidados</h2>
                <p className="text-slate-500 text-sm">Adicione convidados para que eles possam confirmar presença pelo site.</p>
              </div>
              <button onClick={handleExportCSV} className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
                <Download className="w-4 h-4" /> Exportar CSV
              </button>
            </div>

            <form onSubmit={handleGuestSubmit} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-slate-500 mb-1">Nome Completo</label>
                <input required type="text" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" placeholder="Ex: Maria da Silva" />
              </div>
              <div className="w-full md:w-48">
                <label className="block text-xs font-medium text-slate-500 mb-1">Status (Manual)</label>
                <select value={guestForm.status} onChange={e => setGuestForm({...guestForm, status: e.target.value as Guest['status']})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm bg-white">
                  <option value="Pendente">Pendente</option>
                  <option value="Confirmado">Confirmado</option>
                  <option value="Não vai">Não vai</option>
                </select>
              </div>
              <button type="submit" className="w-full md:w-auto bg-slate-800 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors">
                {isEditingGuest ? 'Salvar Edição' : 'Adicionar'}
              </button>
              {isEditingGuest && (
                <button type="button" onClick={() => { setIsEditingGuest(false); setGuestForm({ id: '', name: '', status: 'Pendente' }) }} className="w-full md:w-auto bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors">Cancelar</button>
              )}
            </form>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Nome</th>
                      <th className="px-6 py-4 font-semibold">Status de Presença</th>
                      <th className="px-6 py-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {guests.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">Nenhum convidado cadastrado.</td></tr>
                    ) : guests.map(guest => (
                      <tr key={guest.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-800">
    {guest.name}
    {guest.confirmationCode && (
      <div className="text-xs text-slate-400 mt-1">Código: {guest.confirmationCode}</div>
    )}
  </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            guest.status === 'Confirmado' ? 'bg-green-100 text-green-800' : 
                            guest.status === 'Não vai' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {guest.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => {
    const slugOrId = eventDetails.slug || host?.id;
    const url = `${window.location.origin}/e/${slugOrId}?code=${guest.confirmationCode || ''}#rsvp`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  }} className="p-1 text-slate-400 hover:text-teal-600 transition-colors mx-1" title="Copiar Link RSVP"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></button>
  <button onClick={() => handleEditGuest(guest)} className="p-1 text-slate-400 hover:text-teal-600 transition-colors mx-1"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => { toast('Confirmar exclusão?', { action: { label: 'Sim, Excluir', onClick: () => deleteGuest(guest.id) } }) }} className="p-1 text-slate-400 hover:text-red-600 transition-colors mx-1"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* GIFTS CATALOG TAB */}
        {activeTab === 'gifts-catalog' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Catálogo de Presentes</h2>
              <p className="text-slate-500 text-sm">Gerencie os presentes virtuais exibidos na página pública.</p>
            </div>

            <form onSubmit={handleGiftSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{isEditingGift ? 'Editar Presente' : 'Adicionar Novo Presente'}</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Título</label>
                  <input required type="text" value={giftForm.title} onChange={e => setGiftForm({...giftForm, title: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" placeholder="Ex: Cota da Lua de Mel" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Valor Sugerido (R$)</label>
                  <input required type="number" step="0.01" min="0" value={giftForm.price} onChange={e => setGiftForm({...giftForm, price: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" placeholder="150.00" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Descrição</label>
                  <input required type="text" value={giftForm.description} onChange={e => setGiftForm({...giftForm, description: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" placeholder="Mensagem para convencer o convidado..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">URL da Imagem</label>
                  <input required type="url" value={giftForm.imageUrl} onChange={e => setGiftForm({...giftForm, imageUrl: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Categoria (Opcional)</label>
                  <input type="text" value={giftForm.category} onChange={e => setGiftForm({...giftForm, category: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" placeholder="Ex: Viagem, Casa" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Quantidade (Opcional)</label>
                  <input type="number" min="1" value={giftForm.quantity} onChange={e => setGiftForm({...giftForm, quantity: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm" placeholder="Ex: 5" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                {isEditingGift && (
                  <button type="button" onClick={() => { setIsEditingGift(false); setGiftForm({ id: '', title: '', description: '', price: '', imageUrl: '', category: '', quantity: '' }) }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300">Cancelar</button>
                )}
                <button type="submit" className="px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 shadow-sm">
                  {isEditingGift ? 'Salvar Alterações' : 'Criar Presente'}
                </button>
              </div>
            </form>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {gifts.length === 0 ? (
                <div className="col-span-full text-center py-8 text-slate-500">Nenhum presente cadastrado.</div>
              ) : gifts.map(g => (
                <div key={g.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <img src={g.imageUrl} alt={g.title} className="w-full h-32 object-cover" />
                  <div className="p-4 flex flex-col flex-1">
                    {g.category && <span className="text-xs text-teal-600 font-semibold uppercase mb-1">{g.category}</span>}
                    <h4 className="font-semibold text-slate-800">{g.title} {g.quantity !== undefined ? <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full ml-2">Qtd: {g.quantity}</span> : null}</h4>
                    <p className="text-sm text-slate-500 truncate mb-2">{g.description}</p>
                    <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="font-bold text-slate-700">R$ {g.price.toFixed(2)}</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditGift(g)} className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => deleteGift(g.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FINANCE TAB */}
        {activeTab === 'finance' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Financeiro</h2>
              <p className="text-slate-500 text-sm">Resumo de arrecadação da sua lista de presentes virtual.</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 text-slate-500 mb-2">
                  <DollarSign className="w-5 h-5 text-teal-600" />
                  <span className="font-medium text-sm">Total Arrecadado</span>
                </div>
                <div className="text-3xl font-bold text-slate-800">R$ {totalArrecadado.toFixed(2)}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 text-slate-500 mb-2">
                  <QrCode className="w-5 h-5 text-teal-600" />
                  <span className="font-medium text-sm">Via PIX</span>
                </div>
                <div className="text-3xl font-bold text-slate-800">R$ {totalPix.toFixed(2)}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 text-slate-500 mb-2">
                  <CreditCard className="w-5 h-5 text-teal-600" />
                  <span className="font-medium text-sm">Via Cartão</span>
                </div>
                <div className="text-3xl font-bold text-slate-800">R$ {totalCartao.toFixed(2)}</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-lg text-slate-800">Transações Recentes</h3>
              </div>
              
              <div className="space-y-4">
                {transactions.length === 0 ? (
                  <p className="text-center text-slate-500 py-4">Nenhuma transação recebida ainda.</p>
                ) : transactions.map(tx => (
                  <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 gap-4">
                    <div>
                      <p className="font-medium text-slate-800">{tx.donorName}</p>
                      <p className="text-sm text-slate-500">Presenteou: {tx.giftTitle}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(tx.date))}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-teal-700">R$ {tx.amount.toFixed(2)}</span>
                        <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-0.5 rounded mt-1">{tx.method}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PAYMENTS CONFIG TAB */}
        {activeTab === 'payments-config' && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Meios de Pagamento</h2>
              <p className="text-slate-500 text-sm">Configure como você receberá os presentes via Pix e Cartão.</p>
            </div>

            <form onSubmit={handlePaymentSave} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
              
              <div className="border-b border-slate-100 pb-4 mb-4">
                <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2 mb-4">
                  <QrCode className="w-5 h-5 text-teal-600" /> Configuração Pix
                </h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Chave</label>
                    <select 
                      value={paymentForm.pixKeyType}
                      onChange={e => setPaymentForm({...paymentForm, pixKeyType: e.target.value as any})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white" 
                    >
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="email">E-mail</option>
                      <option value="phone">Celular</option>
                      <option value="random">Chave Aleatória</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Chave Pix</label>
                    <input 
                      type="text" 
                      required
                      value={paymentForm.pixKey}
                      onChange={e => setPaymentForm({...paymentForm, pixKey: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                      placeholder="Sua chave pix"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo do Recebedor</label>
                    <input 
                      type="text" 
                      required
                      value={paymentForm.receiverName}
                      onChange={e => setPaymentForm({...paymentForm, receiverName: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                      placeholder="Como aparece no banco"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cidade (Opcional)</label>
                    <input 
                      type="text" 
                      value={paymentForm.city}
                      onChange={e => setPaymentForm({...paymentForm, city: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                      placeholder="Ex: São Paulo"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2 mb-4">
                  <CreditCard className="w-5 h-5 text-teal-600" /> Integração de Cartão de Crédito
                </h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gateway de Pagamento</label>
                    <select 
                      value={paymentForm.gatewayProvider}
                      onChange={e => setPaymentForm({...paymentForm, gatewayProvider: e.target.value as any})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white" 
                    >
                      <option value="simulated">Simulado (Apenas testes)</option>
                      <option value="stripe">Stripe</option>
                      <option value="mercadopago">Mercado Pago</option>
                      <option value="asaas">Asaas</option>
                    </select>
                  </div>
                  
                  {paymentForm.gatewayProvider !== 'simulated' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Chave Pública (Public Key)</label>
                        <input 
                          type="text" 
                          value={paymentForm.gatewayPublicKey}
                          onChange={e => setPaymentForm({...paymentForm, gatewayPublicKey: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono text-sm" 
                          placeholder="pk_test_..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Access Token (Token de Acesso)</label>
                        <input 
                          type="password" 
                          value={paymentForm.gatewayAccessToken}
                          onChange={e => setPaymentForm({...paymentForm, gatewayAccessToken: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono text-sm" 
                          placeholder="APP_USR-..."
                        />
                      </div>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  No modo <strong>Simulado</strong>, os pagamentos aparecerão no extrato como "Concluído" instantaneamente sem cobrar um cartão real.
                </p>
              </div>

              <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors">
                Salvar Configurações de Pagamento
              </button>
            </form>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Configurações</h2>
              <p className="text-slate-500 text-sm">Altere as informações públicas do seu evento.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Stepper */}
              <div className="bg-slate-50 border-b border-slate-200 p-4">
                <div className="flex items-center justify-between max-w-md mx-auto relative">
                  <div className="absolute left-0 top-1/2 w-full h-0.5 bg-slate-200 -z-10 -translate-y-1/2" />
                  <div className="absolute left-0 top-1/2 h-0.5 bg-teal-600 -z-10 -translate-y-1/2 transition-all duration-300" style={{ width: settingsStep === 1 ? '0%' : settingsStep === 2 ? '50%' : '100%' }} />
                  {[1, 2, 3].map((step) => (
                    <button 
                      key={step} 
                      type="button"
                      onClick={() => setSettingsStep(step)}
                      className={`flex flex-col items-center gap-1 bg-slate-50 px-2 cursor-pointer focus:outline-none ${settingsStep >= step ? 'text-teal-600' : 'text-slate-400'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium border-2 transition-colors ${settingsStep >= step ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-300 hover:border-teal-400 hover:text-teal-500'}`}>
                        {step}
                      </div>
                      <span className={`text-xs font-medium hidden sm:block transition-colors ${settingsStep >= step ? 'text-teal-600' : 'hover:text-teal-500'}`}>
                        {step === 1 ? 'Evento' : step === 2 ? 'Local' : 'Aparência'}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="text-center mt-2 sm:hidden text-sm font-medium text-slate-700">
                  Etapa {settingsStep} de 3 — {settingsStep === 1 ? 'Informações do evento' : settingsStep === 2 ? 'Local do evento' : 'Aparência e Conteúdo'}
                </div>
              </div>

              <form onSubmit={handleSettingsSave} className="p-6">
                {settingsStep === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Evento</label>
                        <select 
                          value={settingsForm.eventType}
                          onChange={e => setSettingsForm({...settingsForm, eventType: e.target.value as 'casamento' | 'aniversário'})}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white" 
                        >
                          <option value="casamento">Casamento</option>
                          <option value="aniversário">Aniversário</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Título do Evento</label>
                        <input 
                          type="text" 
                          required
                          value={settingsForm.title}
                          onChange={e => {
                            const newTitle = e.target.value;
                            if (!isSlugManual) {
                              setSettingsForm({...settingsForm, title: newTitle, slug: newTitle.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-')});
                            } else {
                              setSettingsForm({...settingsForm, title: newTitle});
                            }
                          }}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                          placeholder={`Ex: ${settingsForm.eventType === 'casamento' ? 'Casamento de João e Maria' : 'Aniversário de Giullia'}`}
                        />
                      </div>

                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="overflow-hidden">
                            <span className="block text-sm text-slate-500 mb-1">URL da página</span>
                            <span className="text-sm font-medium text-slate-900 truncate block">
                              /e/{settingsForm.slug || 'seu-evento'}
                            </span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setShowManualSlug(!showManualSlug)} 
                            className="text-sm text-teal-600 font-medium hover:text-teal-700 whitespace-nowrap self-start sm:self-auto"
                          >
                            {showManualSlug ? 'Ocultar' : 'Editar URL'}
                          </button>
                        </div>
                        
                        {showManualSlug && (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Personalizar URL (Slug)</label>
                            <div className="flex">
                              <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-slate-500 sm:text-sm">
                                /e/
                              </span>
                              <input 
                                type="text" 
                                value={settingsForm.slug} 
                                onChange={e => {
                                  setIsSlugManual(true);
                                  setSettingsForm({...settingsForm, slug: e.target.value.replace(/[^a-z0-9-]/gi, '-').toLowerCase()})
                                }} 
                                className="flex-1 px-4 py-2 border border-slate-300 rounded-none rounded-r-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                                placeholder="meu-evento" 
                              />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Apenas letras, números e hifens.</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Data e Hora do Evento</label>
                        <input 
                          type="datetime-local" 
                          required
                          value={settingsForm.date ? settingsForm.date.slice(0, 16) : ''}
                          onChange={e => setSettingsForm({...settingsForm, date: new Date(e.target.value).toISOString()})}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                        />
                      </div>
                    </div>
                  </div>
                )}

                {settingsStep === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Onde será o evento?</label>
                      <input 
                        type="text" 
                        value={settingsForm.locationName}
                        onChange={e => {
                          setSettingsForm({...settingsForm, locationName: e.target.value, locationMapsLink: ''});
                        }}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                        placeholder="Digite o nome do local ou endereço"
                      />
                      <p className="text-xs text-slate-500 mt-2">Ex.: Salão Jardim, Igreja Central ou Rua Almerim, 115</p>
                    </div>

                    {!showAdvancedAddress && (
                      <button 
                        type="button" 
                        onClick={() => setShowAdvancedAddress(true)}
                        className="text-sm font-medium text-teal-600 flex items-center gap-1 hover:text-teal-700"
                      >
                        <Plus className="w-4 h-4" /> Adicionar detalhes do endereço
                      </button>
                    )}

                    {showAdvancedAddress && (
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Endereço / Rua (e Número)</label>
                          <input 
                            type="text" 
                            value={settingsForm.locationAddress}
                            onChange={e => setSettingsForm({...settingsForm, locationAddress: e.target.value})}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                          />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                            <input 
                              type="text" 
                              value={settingsForm.locationCity}
                              onChange={e => setSettingsForm({...settingsForm, locationCity: e.target.value})}
                              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Estado (UF)</label>
                            <input 
                              type="text" 
                              maxLength={2}
                              value={settingsForm.locationState}
                              onChange={e => setSettingsForm({...settingsForm, locationState: e.target.value.toUpperCase()})}
                              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                            />
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setShowAdvancedAddress(false)}
                          className="text-sm font-medium text-slate-500 hover:text-slate-700"
                        >
                          Ocultar detalhes
                        </button>
                      </div>
                    )}

                    {/* Google Maps Actions */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                      {(settingsForm.locationName || settingsForm.locationAddress) && (
                        <a 
                          href={settingsForm.locationMapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([settingsForm.locationName, settingsForm.locationAddress, settingsForm.locationCity, settingsForm.locationState].filter(Boolean).join(', '))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition-colors sm:self-start w-full sm:w-auto"
                        >
                          <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                          </svg>
                          Ver no Google Maps
                        </a>
                      )}

                      <div>
                        <button 
                          type="button"
                          onClick={() => setShowAdvancedMaps(!showAdvancedMaps)}
                          className="text-sm text-slate-500 hover:text-slate-700 font-medium"
                        >
                          Opções avançadas
                        </button>
                        
                        {showAdvancedMaps && (
                          <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Usar um link personalizado do Google Maps</label>
                            <input 
                              type="text" 
                              value={settingsForm.locationMapsLink}
                              onChange={e => setSettingsForm({...settingsForm, locationMapsLink: e.target.value})}
                              placeholder="https://maps.app.goo.gl/..."
                              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                            />
                            <p className="text-xs text-slate-500 mt-1">Se preenchido, ignoramos a pesquisa automática e usamos este link.</p>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}

                {settingsStep === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Capa</label>
                      <select 
                        value={settingsForm.coverMediaType} 
                        onChange={e => setSettingsForm({...settingsForm, coverMediaType: e.target.value as any})} 
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                      >
                        <option value="image">Imagem</option>
                        <option value="video">Vídeo</option>
                      </select>
                    </div>

                    {settingsForm.coverMediaType === 'video' ? (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">URL do Vídeo (MP4)</label>
                        <input 
                          type="url" 
                          value={settingsForm.coverVideoUrl} 
                          onChange={e => setSettingsForm({...settingsForm, coverVideoUrl: e.target.value})} 
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                          placeholder="https://exemplo.com/video.mp4"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">URL da Foto de Capa (Hero)</label>
                        <input 
                          type="url" 
                          value={settingsForm.coverImage}
                          onChange={e => setSettingsForm({...settingsForm, coverImage: e.target.value})}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none mb-3" 
                          placeholder="https://exemplo.com/foto.jpg"
                        />
                        {settingsForm.coverImage && (
                          <div className="relative rounded-lg overflow-hidden border border-slate-200">
                            <img src={settingsForm.coverImage} alt="Preview" className="w-full h-40 object-cover" />
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        História ({settingsForm.eventType === 'casamento' ? 'do Casal' : 'do Aniversariante'})
                      </label>
                      <textarea 
                        rows={6}
                        value={settingsForm.story}
                        onChange={e => setSettingsForm({...settingsForm, story: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none resize-y" 
                        placeholder="Conte um pouco da sua história..."
                      />
                    </div>
                  </div>
                )}
              </form>

              {/* Footer Actions */}
              <div className="p-4 sm:p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button 
                  type="button" 
                  onClick={() => setSettingsStep(Math.max(1, settingsStep - 1))}
                  className={`px-4 py-2 font-medium rounded-lg transition-colors ${settingsStep > 1 ? 'text-slate-700 hover:bg-slate-200' : 'invisible'}`}
                >
                  Voltar
                </button>
                
                {settingsStep < 3 ? (
                  <button 
                    type="button" 
                    onClick={() => setSettingsStep(settingsStep + 1)}
                    className="px-6 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
                  >
                    Continuar
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={handleSettingsSave}
                    className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                  >
                    Salvar Alterações
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
