import React, { useState, useRef, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  MessageSquare, 
  Heart, 
  Gift as GiftIcon, 
  Cake, 
  Menu, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Maximize2,
  Sparkles,
  Share2,
  Check
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '../lib/AppContext';
import CountdownTimer from '../components/CountdownTimer';
import PaymentModal from '../components/PaymentModal';
import { Gift } from '../types';

export default function PublicPage() {
  const { eventDetails, gifts, messages, addMessage, guests, updateGuest, gallery, isLoading, isNotFound } = useAppContext();
  
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  
  // Message Form State
  const [msgName, setMsgName] = useState('');
  const [msgContent, setMsgContent] = useState('');

  // RSVP Form State
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  const [rsvpName, setRsvpName] = useState(initialCode);
  const [rsvpStatus, setRsvpStatus] = useState<'idle' | 'success' | 'not_found'>('idle');

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeNavSection, setActiveNavSection] = useState('home');
  const [navNotification, setNavNotification] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // Gallery Showcase State
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const isWedding = eventDetails.eventType === 'casamento';

  // Refs for carousels
  const giftsRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);

  const sortedGallery = React.useMemo(() => {
    if (!gallery || gallery.length === 0) return [];
    return [...gallery].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [gallery]);

  // Keep active index in bounds
  const currentPhoto = sortedGallery.length > 0 
    ? sortedGallery[((activePhotoIndex % sortedGallery.length) + sortedGallery.length) % sortedGallery.length] 
    : null;

  const nextPhoto = () => {
    if (sortedGallery.length > 0) {
      setActivePhotoIndex(prev => (prev + 1) % sortedGallery.length);
    }
  };

  const prevPhoto = () => {
    if (sortedGallery.length > 0) {
      setActivePhotoIndex(prev => (prev - 1 + sortedGallery.length) % sortedGallery.length);
    }
  };

  // Keyboard controls for gallery lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'Escape') setIsLightboxOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedGallery.length]);

  // Scroll spy for active navbar section
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 200;
      for (const link of navLinks) {
        const el = document.getElementById(link.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveNavSection(link.id);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollCarousel = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = ref.current.clientWidth * 0.8;
      ref.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgName.trim() || !msgContent.trim()) return;
    await addMessage({ authorName: msgName, content: msgContent });
    setMsgName('');
    setMsgContent('');
  };

  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const searchInput = rsvpName.trim();
    if (!searchInput) return;
    
    // First try by confirmation code (case insensitive)
    let guest = guests.find(g => g.confirmationCode?.toLowerCase() === searchInput.toLowerCase());
    
    // If not found by code, try by normalized name
    if (!guest) {
      const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const searchName = normalizeStr(searchInput);
      
      // Exact match after normalization
      guest = guests.find(g => normalizeStr(g.name) === searchName);
      
      if (!guest) {
         const possibleMatches = guests.filter(g => normalizeStr(g.name).includes(searchName) || searchName.includes(normalizeStr(g.name)));
         if (possibleMatches.length === 1) {
             guest = possibleMatches[0];
         } else if (possibleMatches.length > 1) {
             setRsvpStatus('not_found');
         }
      }
    }

    if (guest) {
      await updateGuest(guest.id, { status: 'Confirmado' });
      setRsvpStatus('success');
    } else {
      setRsvpStatus('not_found');
    }

    setTimeout(() => {
      setRsvpStatus('idle');
      if (guest) setRsvpName('');
    }, 4000);
  };

  const scrollToSection = (id: string, label?: string) => {
    setIsMobileMenuOpen(false);
    setActiveNavSection(id);
    if (label) {
      setNavNotification(label);
      setTimeout(() => setNavNotification(null), 2500);
    }
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
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };

  useEffect(() => {
    if (eventDetails.title) {
      document.title = `${eventDetails.title} | CelebraBox`;
      
      const setMeta = (name: string, content: string, isProperty = false) => {
        const attr = isProperty ? 'property' : 'name';
        let el = document.querySelector(`meta[${attr}="${name}"]`);
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute(attr, name);
          document.head.appendChild(el);
        }
        el.setAttribute('content', content);
      };
      
      const desc = eventDetails.story ? eventDetails.story.substring(0, 150) + '...' : 'Venha celebrar conosco!';
      
      setMeta('description', desc);
      setMeta('og:title', eventDetails.title, true);
      setMeta('og:description', desc, true);
      setMeta('og:image', eventDetails.coverImage, true);
      setMeta('twitter:card', 'summary_large_image');
      setMeta('twitter:title', eventDetails.title);
      setMeta('twitter:description', desc);
      setMeta('twitter:image', eventDetails.coverImage);
      
      // JSON-LD
      let script = document.querySelector('#jsonld-event') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script') as HTMLScriptElement;
        script.id = 'jsonld-event';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": eventDetails.title,
        "description": desc,
        "startDate": eventDetails.date,
        "location": {
          "@type": "Place",
          "name": eventDetails.location.name,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": eventDetails.location.address,
            "addressLocality": eventDetails.location.city,
            "addressRegion": eventDetails.location.state
          }
        },
        "image": eventDetails.coverImage,
        "url": window.location.href
      };
      script.textContent = JSON.stringify(jsonLd);
    }
  }, [eventDetails]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#ef007e] animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Carregando evento...</p>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-4xl font-serif text-slate-800 mb-4">Evento não encontrado</h1>
        <p className="text-lg text-slate-600 mb-8 max-w-md">Não conseguimos encontrar a página deste evento. Verifique se o link está correto.</p>
        <a href="/" className="px-8 py-3 bg-[#ef007e] text-white font-medium rounded-full shadow-lg hover:bg-[#d9006f] transition-colors hover:-translate-y-1">
          Crie seu próprio site de evento
        </a>
      </div>
    );
  }

  if (!eventDetails.title) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-3xl font-serif text-slate-800 mb-4">Página em construção</h1>
        <p className="text-lg text-slate-600 max-w-md">O anfitrião ainda está configurando os detalhes deste evento. Volte em breve!</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* Toast notification when changing section */}
      <AnimatePresence>
        {navNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#ef007e] text-white px-5 py-2.5 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 pointer-events-none"
          >
            <Sparkles className="w-4 h-4" />
            <span>Navegando para: {navNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md z-50 shadow-xs border-b border-pink-100 transition-all duration-300">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            type="button"
            className="font-serif text-2xl font-bold text-[#ef007e] hover:text-[#d9006f] transition-colors tracking-wide text-left truncate max-w-[240px] sm:max-w-xs"
            onClick={() => scrollToSection('home', 'Início')}
          >
            {eventDetails.title}
          </button>
          
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(link => {
              const isActive = activeNavSection === link.id;
              return (
                <button 
                  key={link.id} 
                  onClick={() => scrollToSection(link.id, link.label)}
                  className={`relative text-sm font-medium transition-colors py-1 ${
                    isActive 
                      ? 'text-[#ef007e] font-semibold' 
                      : 'text-slate-600 hover:text-[#ef007e]'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.div 
                      layoutId="nav-active-pill" 
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#ef007e] rounded-full" 
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {/* Active section indicator badge on mobile */}
            <span className="text-xs px-2.5 py-1 rounded-full bg-pink-50 text-[#ef007e] font-medium border border-pink-100 capitalize">
              {navLinks.find(l => l.id === activeNavSection)?.label || 'Início'}
            </span>

            <button 
              className="p-2 text-slate-700 hover:text-[#ef007e] rounded-lg transition-colors" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Abrir menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6 text-[#ef007e]" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        
        {/* Retractable Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="md:hidden bg-white/98 backdrop-blur-lg border-b border-pink-100 shadow-xl overflow-hidden"
            >
              <div className="flex flex-col px-4 py-3 gap-1">
                {navLinks.map(link => {
                  const isActive = activeNavSection === link.id;
                  return (
                    <button 
                      key={link.id} 
                      onClick={() => scrollToSection(link.id, link.label)}
                      className={`flex items-center justify-between text-left text-sm py-3 px-3 rounded-xl font-medium transition-all ${
                        isActive 
                          ? 'bg-[#ef007e] text-white shadow-sm' 
                          : 'text-slate-700 hover:bg-pink-50 hover:text-[#ef007e]'
                      }`}
                    >
                      <span>{link.label}</span>
                      {isActive && <Check className="w-4 h-4 text-white" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden pt-16 scroll-mt-16">
        <div className="absolute inset-0 z-0">
          {eventDetails.coverMediaType === 'video' && eventDetails.coverVideoUrl ? (
            <video 
              src={eventDetails.coverVideoUrl} 
              poster={eventDetails.coverImage}
              className="w-full h-full object-cover object-center"
              autoPlay muted loop playsInline
            />
          ) : (
            <img 
              src={eventDetails.coverImage} 
              alt="Hero cover" 
              className="w-full h-full object-cover object-center"
            />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-slate-950/80 via-slate-950/40 to-slate-950/40" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <p className="text-pink-200 uppercase tracking-[0.35em] mb-4 text-xs md:text-sm font-semibold drop-shadow-md">
            Você está convidado
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif text-white mb-6 drop-shadow-2xl tracking-wide leading-tight">
            {eventDetails.title}
          </h1>
          <div className="h-0.5 w-32 bg-[#ef007e] mx-auto mb-6 rounded-full shadow-lg shadow-pink-500/50" />
          <p className="text-xl md:text-2xl text-white/95 mb-8 font-light drop-shadow-md">
            {eventDetails.date ? new Intl.DateTimeFormat('pt-BR', { 
              day: '2-digit', month: 'long', year: 'numeric' 
            }).format(new Date(eventDetails.date)) : 'Data a definir'}
          </p>
          
          <CountdownTimer targetDate={eventDetails.date} />

          <div className="mt-8 flex justify-center gap-4">
            <button 
              onClick={() => scrollToSection('rsvp', 'Confirmação de Presença')}
              className="px-8 py-3.5 bg-[#ef007e] text-white font-medium rounded-full shadow-xl hover:bg-[#d9006f] hover:shadow-pink-500/30 transition-all transform hover:-translate-y-0.5 cursor-pointer text-sm md:text-base"
            >
              Confirmar Presença
            </button>
            <button 
              onClick={() => scrollToSection('gifts', 'Lista de Presentes')}
              className="px-8 py-3.5 bg-white/20 hover:bg-white/30 text-white backdrop-blur-md font-medium rounded-full transition-all border border-white/30 cursor-pointer text-sm md:text-base"
            >
              Lista de Presentes
            </button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <motion.section 
        id="about" 
        className="py-24 px-4 bg-white scroll-mt-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={fadeUpVariant}
      >
        <div className="max-w-3xl mx-auto text-center">
          {isWedding ? (
            <Heart className="w-10 h-10 mx-auto text-[#ef007e] mb-6 drop-shadow-sm" />
          ) : (
            <Cake className="w-10 h-10 mx-auto text-[#ef007e] mb-6 drop-shadow-sm" />
          )}
          <h2 className="text-4xl md:text-5xl font-serif mb-6 text-slate-800 tracking-wide">
            {isWedding ? 'Nossa História' : 'Minha História'}
          </h2>
          <div className="h-1 w-16 bg-[#ef007e] mx-auto mb-8 rounded-full" />
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed mb-12 font-light">
            {eventDetails.story || 'Sejam muito bem-vindos ao nosso evento! Preparamos tudo com muito amor para compartilharmos momentos inesquecíveis juntos.'}
          </p>
        </div>
      </motion.section>

      {/* Grand Photo Gallery Section (Cover-dimension prominence, no cropped photos) */}
      {sortedGallery.length > 0 && (
        <motion.section 
          id="gallery" 
          className="py-24 px-4 bg-slate-50 border-t border-pink-50 scroll-mt-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUpVariant}
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-serif mb-4 text-slate-800 tracking-wide">Galeria de Fotos</h2>
              <div className="h-1 w-16 bg-[#ef007e] mx-auto mb-4 rounded-full" />
              <p className="text-slate-600 max-w-lg mx-auto text-sm md:text-base">
                Momentos especiais registrados para celebrar com quem amamos.
              </p>
            </div>
            
            {/* Grand Showcase Stage (Close to cover dimension, photos uncropped) */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-slate-950 border border-slate-800/80 mb-6 group">
              {/* Cinematic ambient reflection in background */}
              {currentPhoto && (
                <div 
                  className="absolute inset-0 bg-cover bg-center blur-3xl opacity-35 scale-110 pointer-events-none transition-all duration-700"
                  style={{ backgroundImage: `url(${currentPhoto.url})` }}
                />
              )}

              {/* Foreground Showcase Box with generous height matching cover level */}
              <div className="relative z-10 w-full min-h-[460px] sm:min-h-[560px] md:min-h-[660px] lg:min-h-[720px] max-h-[82vh] flex items-center justify-center p-4 sm:p-8">
                {currentPhoto && (
                  <img 
                    src={currentPhoto.url} 
                    alt={currentPhoto.caption || 'Foto em destaque'} 
                    className="max-h-[60vh] sm:max-h-[70vh] md:max-h-[74vh] max-w-full w-auto object-contain rounded-2xl drop-shadow-2xl transition-all duration-500 cursor-zoom-in"
                    onClick={() => setIsLightboxOpen(true)}
                  />
                )}

                {/* Left Arrow */}
                {sortedGallery.length > 1 && (
                  <button 
                    onClick={prevPhoto} 
                    aria-label="Foto anterior"
                    className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 p-3 bg-white/90 hover:bg-[#ef007e] text-slate-800 hover:text-white rounded-full shadow-xl transition-all duration-300 backdrop-blur-md cursor-pointer hover:scale-110"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}

                {/* Right Arrow */}
                {sortedGallery.length > 1 && (
                  <button 
                    onClick={nextPhoto} 
                    aria-label="Próxima foto"
                    className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 p-3 bg-white/90 hover:bg-[#ef007e] text-slate-800 hover:text-white rounded-full shadow-xl transition-all duration-300 backdrop-blur-md cursor-pointer hover:scale-110"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}

                {/* Top overlay controls */}
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                  <span className="bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/10">
                    {activePhotoIndex + 1} / {sortedGallery.length}
                  </span>
                  <button
                    onClick={() => setIsLightboxOpen(true)}
                    className="p-2 bg-black/60 hover:bg-[#ef007e] text-white rounded-full backdrop-blur-md transition-colors border border-white/10 cursor-pointer"
                    title="Ver em tela cheia"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Bottom caption bar */}
                {currentPhoto?.caption && (
                  <div className="absolute bottom-4 inset-x-4 md:inset-x-12 z-20 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl px-5 py-3 text-center">
                    <p className="text-white text-sm md:text-base font-medium">{currentPhoto.caption}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Navigation Strip */}
            {sortedGallery.length > 1 && (
              <div 
                ref={thumbnailsRef} 
                className="flex items-center gap-3 overflow-x-auto py-3 px-2 no-scrollbar scroll-smooth"
              >
                {sortedGallery.map((img, idx) => {
                  const isCurrent = idx === activePhotoIndex;
                  return (
                    <button
                      key={img.id}
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`relative shrink-0 rounded-xl overflow-hidden h-20 w-24 sm:h-24 sm:w-32 transition-all duration-300 cursor-pointer bg-slate-900 ${
                        isCurrent 
                          ? 'ring-3 ring-[#ef007e] scale-105 shadow-lg shadow-pink-500/25 opacity-100' 
                          : 'opacity-60 hover:opacity-100 hover:scale-102'
                      }`}
                    >
                      <img 
                        src={img.url} 
                        alt={img.caption || `Miniatura ${idx + 1}`} 
                        className="w-full h-full object-contain p-1"
                      />
                      {isCurrent && (
                        <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-[#ef007e] ring-2 ring-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.section>
      )}

      {/* Fullscreen Lightbox Modal (Uncropped, Maximum resolution) */}
      <AnimatePresence>
        {isLightboxOpen && currentPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between p-4 md:p-8"
          >
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between text-white z-10">
              <span className="text-sm font-medium text-white/80">
                {currentPhoto.caption || 'Foto em destaque'} ({activePhotoIndex + 1} de {sortedGallery.length})
              </span>
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="p-2.5 bg-white/10 hover:bg-[#ef007e] text-white rounded-full transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Center uncropped photo */}
            <div className="relative flex-1 w-full flex items-center justify-center my-4">
              <img 
                src={currentPhoto.url} 
                alt={currentPhoto.caption || 'Foto em tela cheia'} 
                className="max-h-[82vh] max-w-[95vw] w-auto h-auto object-contain drop-shadow-2xl rounded-lg"
              />

              {sortedGallery.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 p-3 bg-white/20 hover:bg-[#ef007e] text-white rounded-full transition-colors backdrop-blur-md cursor-pointer"
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 p-3 bg-white/20 hover:bg-[#ef007e] text-white rounded-full transition-colors backdrop-blur-md cursor-pointer"
                  >
                    <ChevronRight className="w-8 h-8" />
                  </button>
                </>
              )}
            </div>

            {/* Bottom thumbnail selector */}
            <div className="flex gap-2 max-w-full overflow-x-auto py-2 no-scrollbar">
              {sortedGallery.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`h-14 w-18 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                    idx === activePhotoIndex ? 'border-[#ef007e] scale-105' : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-contain bg-slate-900" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Section */}
      <motion.section 
        id="location" 
        className="py-24 px-4 bg-white scroll-mt-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={fadeUpVariant}
      >
        <div className="max-w-4xl mx-auto text-center">
          <MapPin className="w-10 h-10 mx-auto text-[#ef007e] mb-6 drop-shadow-sm" />
          <h2 className="text-4xl md:text-5xl font-serif mb-4 text-slate-800 tracking-wide">Localização</h2>
          <div className="h-1 w-16 bg-[#ef007e] mx-auto mb-6 rounded-full" />
          <div className="text-xl text-slate-700 mb-2 font-medium">{eventDetails.location.name}</div>
          <p className="text-slate-600 mb-8 max-w-xl mx-auto font-light">
            {eventDetails.location.address}, {eventDetails.location.city} - {eventDetails.location.state}
          </p>
          
          <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-lg mb-8 bg-slate-200 border border-slate-100">
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
              className="inline-flex items-center gap-2 bg-[#ef007e] text-white px-8 py-3.5 rounded-full font-medium hover:bg-[#d9006f] transition-all shadow-md shadow-pink-500/20 hover:-translate-y-0.5"
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
        className="py-24 px-4 bg-slate-50 border-y border-pink-100 scroll-mt-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={fadeUpVariant}
      >
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl md:text-5xl font-serif mb-4 text-slate-800 tracking-wide">Confirme sua Presença</h2>
            <div className="h-1 w-16 bg-[#ef007e] mx-auto mb-4 rounded-full" />
            <p className="text-slate-600 font-light">
              Por favor, digite seu nome completo ou código de confirmação abaixo para confirmar.
            </p>
          </div>

          <form onSubmit={handleRsvpSubmit} className="bg-white p-6 md:p-8 rounded-3xl shadow-md border border-pink-100">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome ou Código de Confirmação</label>
              <input 
                type="text" 
                required 
                value={rsvpName} 
                onChange={e => setRsvpName(e.target.value)} 
                className="w-full px-4 py-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#ef007e] focus:border-[#ef007e] focus:outline-none text-slate-800" 
                placeholder="Ex: João da Silva ou ABC123" 
              />
            </div>
            
            {rsvpStatus === 'success' && (
              <div className="mb-4 text-emerald-800 text-sm font-medium bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Presença confirmada com sucesso! Mal podemos esperar para celebrar juntos! 🎉</span>
              </div>
            )}
            
            {rsvpStatus === 'not_found' && (
              <div className="mb-4 text-rose-800 text-sm font-medium bg-rose-50 p-3.5 rounded-xl border border-rose-200">
                Nome ou código não encontrado na lista. Verifique a digitação ou entre em contato com o anfitrião.
              </div>
            )}

            <button 
              type="submit" 
              className="w-full bg-[#ef007e] text-white py-3.5 rounded-xl font-medium hover:bg-[#d9006f] transition-all shadow-md shadow-pink-500/20 hover:-translate-y-0.5 cursor-pointer"
            >
              Confirmar Agora
            </button>
          </form>
        </div>
      </motion.section>

      {/* Gifts Section */}
      <motion.section 
        id="gifts" 
        className="py-24 px-4 bg-white scroll-mt-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={fadeUpVariant}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <GiftIcon className="w-10 h-10 mx-auto text-[#ef007e] mb-6 drop-shadow-sm" />
            <h2 className="text-4xl md:text-5xl font-serif mb-4 text-slate-800 tracking-wide">Lista de Presentes</h2>
            <div className="h-1 w-16 bg-[#ef007e] mx-auto mb-4 rounded-full" />
            <p className="text-slate-600 max-w-2xl mx-auto font-light">
              A sua presença é o {isWedding ? 'nosso' : 'meu'} maior presente! Mas se desejar presentear, criamos esta lista com muito carinho.
            </p>
          </div>

          {gifts.length === 0 ? (
            <div className="text-center text-slate-500 py-12 bg-pink-50/50 rounded-2xl border border-pink-100">
              Nenhum presente cadastrado no momento.
            </div>
          ) : (
            <div className="relative group/carousel">
              {gifts.length > 3 && (
                <>
                  <button onClick={() => scrollCarousel(giftsRef, 'left')} className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/90 hover:bg-[#ef007e] hover:text-white backdrop-blur rounded-full shadow-lg text-slate-800 transition-all cursor-pointer hidden md:flex items-center justify-center">
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button onClick={() => scrollCarousel(giftsRef, 'right')} className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/90 hover:bg-[#ef007e] hover:text-white backdrop-blur rounded-full shadow-lg text-slate-800 transition-all cursor-pointer hidden md:flex items-center justify-center">
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              <div ref={giftsRef} className="flex overflow-x-auto snap-x snap-mandatory gap-6 py-4 no-scrollbar scroll-smooth">
                {gifts.map((gift) => {
                  const isDisabled = gift.quantity !== undefined && gift.quantity <= 0;
                  return (
                    <div 
                      key={gift.id} 
                      className={`bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl border border-pink-100/80 flex flex-col transition-all duration-300 w-72 md:w-80 shrink-0 snap-start ${
                        isDisabled ? 'opacity-50 grayscale' : ''
                      }`}
                    >
                      <div className="h-52 w-full bg-slate-100 overflow-hidden relative">
                        <img 
                          src={gift.imageUrl} 
                          alt={gift.title} 
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
                        />
                      </div>
                      <div className="p-6 flex flex-col flex-1">
                        {gift.category && (
                          <span className="text-xs font-semibold text-[#ef007e] uppercase tracking-wider mb-2">
                            {gift.category}
                          </span>
                        )}
                        <h3 className="font-semibold text-lg text-slate-800 mb-2 line-clamp-1">
                          {gift.title}
                          {gift.quantity !== undefined && (
                             <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full ml-2">Qtd: {gift.quantity}</span>
                          )}
                        </h3>
                        <p className="text-slate-500 text-sm mb-4 flex-1 line-clamp-2">{gift.description}</p>
                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                          <span className="font-bold text-lg text-[#ef007e]">R$ {gift.price.toFixed(2)}</span>
                          <button 
                            disabled={isDisabled}
                            onClick={() => setSelectedGift(gift)}
                            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                              isDisabled 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                : 'bg-pink-50 text-[#ef007e] hover:bg-[#ef007e] hover:text-white shadow-xs'
                            }`}
                          >
                            {isDisabled ? 'Esgotado' : 'Presentear'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {/* Message Board Section */}
      <motion.section 
        id="messages" 
        className="py-24 px-4 bg-slate-50 border-t border-pink-100 scroll-mt-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={fadeUpVariant}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <MessageSquare className="w-10 h-10 mx-auto text-[#ef007e] mb-6 drop-shadow-sm" />
            <h2 className="text-4xl md:text-5xl font-serif mb-4 text-slate-800 tracking-wide">Mural de Recados</h2>
            <div className="h-1 w-16 bg-[#ef007e] mx-auto mb-4 rounded-full" />
            <p className="text-slate-600 font-light">Deixe uma mensagem carinhosa para {isWedding ? 'nós' : 'mim'}!</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Form */}
            <form onSubmit={handleMessageSubmit} className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-pink-100">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Seu Nome</label>
                <input 
                  type="text" 
                  required 
                  value={msgName}
                  onChange={e => setMsgName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#ef007e] focus:border-[#ef007e] focus:outline-none" 
                  placeholder="Nome e Sobrenome" 
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Mensagem</label>
                <textarea 
                  required 
                  rows={4} 
                  value={msgContent}
                  onChange={e => setMsgContent(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#ef007e] focus:border-[#ef007e] focus:outline-none resize-none" 
                  placeholder="Escreva sua mensagem com carinho..." 
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-[#ef007e] text-white py-3.5 rounded-xl font-medium hover:bg-[#d9006f] transition-all shadow-md shadow-pink-500/20 hover:-translate-y-0.5 cursor-pointer"
              >
                Enviar Mensagem
              </button>
            </form>

            {/* Messages List */}
            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="text-center text-slate-500 py-12 bg-white rounded-3xl border border-pink-100">
                  Seja o primeiro a deixar um recado!
                </div>
              ) : messages.map(msg => (
                <div key={msg.id} className="bg-white p-5 rounded-2xl border border-pink-100/60 shadow-xs">
                  <p className="text-slate-700 mb-3 italic">"{msg.content}"</p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-[#ef007e]">{msg.authorName}</span>
                    <span>
                      {msg.createdAt ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(msg.createdAt)) : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 text-center text-sm flex flex-col items-center gap-3">
        <p className="font-serif text-xl text-white tracking-wide">{eventDetails.title}</p>
        <p>&copy; {new Date().getFullYear()} CelebraBox. Feito com amor.</p>
        <a href="/admin" className="text-slate-400 hover:text-[#ef007e] transition-colors underline underline-offset-4 text-xs">
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
