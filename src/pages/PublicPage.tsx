import React, { useState } from 'react';
import { MapPin, Navigation, MessageSquare, Heart, Gift as GiftIcon, Cake, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../lib/AppContext';
import CountdownTimer from '../components/CountdownTimer';
import PaymentModal from '../components/PaymentModal';
import { Gift } from '../types';

export default function PublicPage() {
  const { eventDetails, gifts, messages, addMessage, guests, updateGuest, gallery } = useAppContext();
  
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  
  // Message Form State
  const [msgName, setMsgName] = useState('');
  const [msgContent, setMsgContent] = useState('');

  // RSVP Form State
  const [rsvpName, setRsvpName] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<'idle' | 'success' | 'not_found'>('idle');

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isWedding = eventDetails.eventType === 'casamento';

  const handleMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgName.trim() || !msgContent.trim()) return;
    addMessage({ authorName: msgName, content: msgContent });
    setMsgName('');
    setMsgContent('');
  };

  const handleRsvpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const searchName = rsvpName.trim().toLowerCase();
    if (!searchName) return;

    const guest = guests.find(g => g.name.toLowerCase() === searchName);

    if (guest) {
      updateGuest(guest.id, { status: 'Confirmado' });
      setRsvpStatus('success');
    } else {
      setRsvpStatus('not_found');
    }

    setTimeout(() => {
      setRsvpStatus('idle');
      if (guest) setRsvpName('');
    }, 4000);
  };

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navLinks = [
    { id: 'home', label: 'Início' },
    { id: 'about', label: 'Sobre' },
    { id: 'gallery', label: 'Galeria' },
    { id: 'location', label: 'Localização' },
    { id: 'rsvp', label: 'Confirmação' },
    { id: 'gifts', label: 'Presentes' },
    { id: 'messages', label: 'Recados' },
  ];

  const fadeUpVariant = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* Navigation Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-50 shadow-sm border-b border-slate-100 transition-all duration-300">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-serif text-lg font-medium text-teal-800 cursor-pointer" onClick={() => scrollToSection('home')}>
            {eventDetails.title}
          </span>
          
          <div className="hidden md:flex gap-6">
            {navLinks.map(link => (
              <button 
                key={link.id} 
                onClick={() => scrollToSection(link.id)}
                className="text-sm font-medium text-slate-600 hover:text-teal-600 transition-colors"
              >
                {link.label}
              </button>
            ))}
          </div>

          <button className="md:hidden p-2 text-slate-600" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        
        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-white border-b border-slate-100 overflow-hidden"
            >
              <div className="flex flex-col px-4 py-4 gap-4">
                {navLinks.map(link => (
                  <button 
                    key={link.id} 
                    onClick={() => scrollToSection(link.id)}
                    className="text-left text-sm font-medium text-slate-600 hover:text-teal-600"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 z-0">
          <img 
            src={eventDetails.coverImage} 
            alt="Hero cover" 
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <p className="text-white/80 uppercase tracking-[0.3em] mb-4 text-sm font-medium">Você está convidado</p>
          <h1 className="text-5xl md:text-7xl font-serif text-white mb-6 drop-shadow-lg">
            {eventDetails.title}
          </h1>
          <div className="h-px w-24 bg-white/50 mx-auto mb-6" />
          <p className="text-xl md:text-2xl text-white/90 mb-8 font-light">
            {new Intl.DateTimeFormat('pt-BR', { 
              day: '2-digit', month: 'long', year: 'numeric' 
            }).format(new Date(eventDetails.date))}
          </p>
          
          <CountdownTimer targetDate={eventDetails.date} />
        </div>
      </section>

      {/* About Section */}
      <motion.section 
        id="about" 
        className="py-20 px-4 bg-white"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={fadeUpVariant}
      >
        <div className="max-w-3xl mx-auto text-center">
          {isWedding ? (
            <Heart className="w-8 h-8 mx-auto text-teal-600 mb-6" />
          ) : (
            <Cake className="w-8 h-8 mx-auto text-teal-600 mb-6" />
          )}
          <h2 className="text-3xl font-serif mb-6 text-slate-800">
            {isWedding ? 'Nossa História' : 'Minha História'}
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-12">
            {eventDetails.story}
          </p>
        </div>
      </motion.section>

      {/* Gallery Section */}
      {gallery && gallery.length > 0 && (
        <motion.section 
          id="gallery" 
          className="py-20 px-4 bg-slate-50"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUpVariant}
        >
          <div className="max-w-6xl mx-auto overflow-hidden">
            <h2 className="text-3xl font-serif mb-12 text-center text-slate-800">Galeria de Fotos</h2>
            
            <div className="overflow-hidden w-full py-4 relative group/carousel">
              <div className="flex w-max animate-infinite-scroll gap-4">
                {[...gallery, ...gallery, ...gallery, ...gallery].map((img, index) => (
                  <div key={`${img.id}-${index}`} className="relative group rounded-xl overflow-hidden shadow-sm w-64 md:w-80 shrink-0">
                    <img src={img.url} alt={img.caption || 'Galeria'} className="w-full h-48 md:h-64 object-cover transition-transform duration-500 group-hover:scale-105" />
                    {img.caption && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                        <p className="text-white text-sm font-medium">{img.caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Location Section */}
      <motion.section 
        id="location" 
        className="py-20 px-4 bg-white"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={fadeUpVariant}
      >
        <div className="max-w-4xl mx-auto text-center">
          <MapPin className="w-8 h-8 mx-auto text-teal-600 mb-6" />
          <h2 className="text-3xl font-serif mb-6 text-slate-800">Localização</h2>
          <div className="text-lg text-slate-600 mb-2 font-medium">{eventDetails.location.name}</div>
          <p className="text-slate-600 mb-8">{eventDetails.location.address}, {eventDetails.location.city} - {eventDetails.location.state}</p>
          
          <div className="aspect-video w-full rounded-xl overflow-hidden shadow-md mb-8 bg-slate-200">
            {eventDetails.location.mapsLink ? (
              <iframe 
                src={eventDetails.location.mapsLink.includes('iframe') ? 
                  (eventDetails.location.mapsLink.match(/src="([^"]+)"/)?.[1] || eventDetails.location.mapsLink) 
                  : (eventDetails.location.mapsLink.includes('/embed') ? eventDetails.location.mapsLink : `https://maps.google.com/maps?q=${encodeURIComponent(eventDetails.location.name + ' ' + eventDetails.location.address + ' ' + eventDetails.location.city)}&t=&z=15&ie=UTF8&iwloc=&output=embed`)} 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen={false} 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                Mapa não configurado
              </div>
            )}
          </div>
          
          {eventDetails.location.mapsLink && (
            <a 
              href={eventDetails.location.mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-full font-medium hover:bg-teal-700 transition-colors shadow-md"
            >
              <Navigation className="w-4 h-4" />
              Abrir no Waze / Maps
            </a>
          )}
        </div>
      </motion.section>

      {/* RSVP Section */}
      <motion.section 
        id="rsvp" 
        className="py-20 px-4 bg-slate-50 border-y border-slate-100"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={fadeUpVariant}
      >
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-serif mb-4 text-slate-800">Confirme sua Presença</h2>
            <p className="text-slate-600">Por favor, digite seu nome completo abaixo para confirmar.</p>
          </div>

          <form onSubmit={handleRsvpSubmit} className="bg-slate-50 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
              <input 
                type="text" 
                required 
                value={rsvpName} 
                onChange={e => setRsvpName(e.target.value)} 
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                placeholder="Ex: João da Silva" 
              />
            </div>
            
            {rsvpStatus === 'success' && (
              <div className="mb-4 text-green-700 text-sm font-medium bg-green-50 p-3 rounded-lg border border-green-100">
                Presença confirmada com sucesso! 🎉
              </div>
            )}
            
            {rsvpStatus === 'not_found' && (
              <div className="mb-4 text-red-700 text-sm font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                Nome não encontrado na lista. Verifique se digitou corretamente ou contate o anfitrião.
              </div>
            )}

            <button type="submit" className="w-full bg-slate-800 text-white py-3 rounded-lg font-medium hover:bg-slate-900 transition-colors">
              Confirmar Presença
            </button>
          </form>
        </div>
      </motion.section>

      {/* Gift List Section */}
      <motion.section 
        id="gifts" 
        className="py-20 px-4 bg-white"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={fadeUpVariant}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <GiftIcon className="w-8 h-8 mx-auto text-teal-600 mb-6" />
            <h2 className="text-3xl font-serif mb-4 text-slate-800">Lista de Presentes</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              A sua presença é o {isWedding ? 'nosso' : 'meu'} maior presente! Mas se desejar presentear, criamos esta lista com muito carinho.
            </p>
          </div>

          {gifts.length === 0 ? (
            <div className="text-center text-slate-500 py-10 bg-white rounded-2xl border border-slate-100">
              Nenhum presente cadastrado no momento.
            </div>
          ) : (
            <div className="overflow-hidden w-full py-4 relative group/carousel">
              <div className="flex w-max animate-infinite-scroll gap-6">
                {[...gifts, ...gifts, ...gifts, ...gifts].map((gift, index) => (
                  <div key={`${gift.id}-${index}`} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col transition-transform hover:-translate-y-1 duration-300 w-72 md:w-80 shrink-0">
                    <img src={gift.imageUrl} alt={gift.title} className="w-full h-48 object-cover" />
                    <div className="p-5 flex flex-col flex-1">
                      {gift.category && (
                        <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-2">{gift.category}</span>
                      )}
                      <h3 className="font-semibold text-lg text-slate-800 mb-2">{gift.title}</h3>
                      <p className="text-slate-500 text-sm mb-4 flex-1 line-clamp-2">{gift.description}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="font-medium text-teal-700">R$ {gift.price.toFixed(2)}</span>
                        <button 
                          onClick={() => setSelectedGift(gift)}
                          className="bg-teal-50 text-teal-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-100 transition-colors"
                        >
                          Presentear
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {/* Message Board Section */}
      <motion.section 
        id="messages" 
        className="py-20 px-4 bg-slate-50"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={fadeUpVariant}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <MessageSquare className="w-8 h-8 mx-auto text-teal-600 mb-6" />
            <h2 className="text-3xl font-serif mb-4 text-slate-800">Mural de Recados</h2>
            <p className="text-slate-600">Deixe uma mensagem carinhosa para {isWedding ? 'nós' : 'mim'}!</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Form */}
            <form onSubmit={handleMessageSubmit} className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Seu Nome</label>
                <input 
                  type="text" 
                  required 
                  value={msgName}
                  onChange={e => setMsgName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                  placeholder="Nome e Sobrenome" 
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Mensagem</label>
                <textarea 
                  required 
                  rows={4} 
                  value={msgContent}
                  onChange={e => setMsgContent(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none" 
                  placeholder="Escreva sua mensagem aqui..." 
                />
              </div>
              <button type="submit" className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 transition-colors">
                Enviar Mensagem
              </button>
            </form>

            {/* Messages List */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="text-center text-slate-500 py-8 bg-slate-50 rounded-xl border border-slate-100">
                  Seja o primeiro a deixar um recado!
                </div>
              ) : messages.map(msg => (
                <div key={msg.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-slate-700 mb-2 italic">"{msg.content}"</p>
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span className="font-medium">{msg.authorName}</span>
                    <span>
                      {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(msg.createdAt))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm flex flex-col items-center gap-2">
        <p>&copy; {new Date().getFullYear()} {eventDetails.title}. Feito com carinho.</p>
        <a href="/admin" className="text-slate-500 hover:text-teal-400 transition-colors underline underline-offset-2">
          Acessar Painel do Anfitrião
        </a>
      </footer>

      {/* Modals */}
      <PaymentModal 
        gift={selectedGift} 
        isOpen={!!selectedGift} 
        onClose={() => setSelectedGift(null)} 
      />
    </div>
  );
}
