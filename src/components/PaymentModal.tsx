import React, { useState } from 'react';
import { X, User, ShieldCheck, Heart, Sparkles, Clock, AlertCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Gift } from '../types';
import { useAppContext } from '../lib/AppContext';
import { motion, AnimatePresence } from 'motion/react';

type PaymentModalProps = {
  gift: Gift | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function PaymentModal({ gift, isOpen, onClose }: PaymentModalProps) {
  const { hostId } = useParams<{ hostId: string }>();
  const { addTransaction, updateGift, paymentSettings } = useAppContext();
  const [donorName, setDonorName] = useState('');
  const [donorMessage, setDonorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorName.trim() || !gift) return;

    setIsProcessing(true);
    setErrorMsg('');

    try {
      if (paymentSettings.gatewayProvider === 'mercadopago') {
        const externalRef = `${hostId || 'default'}:${gift.id}:${crypto.randomUUID()}`;

        const response = await fetch('/api/create-preference', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: gift.title,
            price: gift.price,
            quantity: 1,
            giftId: gift.id,
            donorName: donorName.trim(),
            donorMessage: donorMessage.trim(),
            hostId: hostId || 'default',
            externalReference: externalRef,
            gatewayAccessToken: paymentSettings.gatewayAccessToken || ''
          }),
        });

        const data = await response.json();
        
        if (data.init_point) {
          // Add preliminary transaction in context/storage
          try {
            await addTransaction({
              host_id: hostId,
              gift_id: gift.id,
              preference_id: data.preference_id,
              external_reference: externalRef,
              giftTitle: gift.title,
              donorName: donorName.trim(),
              amount: gift.price,
              method: 'Aguardando',
              status: 'checkout_started'
            });
          } catch (e) {
            console.warn("Could not save local tx before redirect:", e);
          }

          // Redirect to Mercado Pago checkout
          window.location.href = data.init_point;
        } else {
          throw new Error(data.error || data.details || 'Falha ao gerar link de pagamento.');
        }
      } else {
        // Simulated flow
        setTimeout(async () => {
          const externalRef = `${hostId || 'default'}:${gift.id}:${crypto.randomUUID()}`;
          await addTransaction({
            host_id: hostId,
            gift_id: gift.id,
            external_reference: externalRef,
            giftTitle: gift.title,
            donorName: donorName.trim(),
            amount: gift.price,
            method: 'PIX',
            status: 'approved'
          });

          if (gift.quantity !== undefined && gift.quantity > 0) {
            updateGift(gift.id, { 
              title: gift.title,
              description: gift.description,
              price: gift.price,
              imageUrl: gift.imageUrl,
              category: gift.category,
              quantity: Math.max(0, gift.quantity - 1)
            });
          }

          setIsProcessing(false);
          alert('Pagamento simulado com sucesso!');
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      console.warn("Payment error:", err);
      setErrorMsg(err.message || 'Ocorreu um erro ao processar. Tente novamente.');
      setIsProcessing(false);
    }
  };

  if (!isOpen || !gift) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-pink-50 text-[#ef007e] rounded-xl">
                <Heart className="w-5 h-5 fill-current" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Presentear com Carinho</h3>
                <p className="text-xs text-slate-400">Escolha pagar via Pix ou Cartão no Mercado Pago</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSimulatePayment} className="flex flex-col flex-1 overflow-hidden">
            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Chosen Gift Card */}
              <div className="bg-gradient-to-br from-pink-50/70 to-slate-50 border border-pink-100/80 rounded-xl p-4 flex items-center gap-4">
                {gift.imageUrl && (
                  <img 
                    src={gift.imageUrl} 
                    alt={gift.title} 
                    className="w-16 h-16 rounded-lg object-cover shrink-0 border border-pink-100 shadow-xs" 
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 font-medium">Item escolhido</p>
                  <p className="text-base font-bold text-slate-800 truncate">{gift.title}</p>
                  <p className="text-[#ef007e] font-extrabold text-lg">R$ {gift.price.toFixed(2)}</p>
                </div>
              </div>

              {/* 24h Reservation Banner */}
              <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-900">Trave temporária de 24 horas:</span>{' '}
                  Ao avançar, este presente ficará reservado para você durante a validade do QR Code Pix. Caso não seja pago em 24h, ele volta a ficar liberado para outros convidados.
                </div>
              </div>

              {/* Secure Destination Badge */}
              <div className="bg-pink-50/50 border border-pink-100 rounded-xl p-3 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#ef007e] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-pink-900 font-medium">Destinado com segurança a:</p>
                  <p className="text-sm font-bold text-[#b8005b]">{paymentSettings.receiverName || 'Anfitrião do Evento'}</p>
                  <p className="text-[11px] text-pink-700 opacity-90 mt-0.5">
                    Processado em ambiente oficial criptografado pelo Mercado Pago.
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Donor Name Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Seu nome ou dos presenteadores <span className="text-[#ef007e]">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ef007e] text-sm text-slate-800 placeholder-slate-400 bg-white"
                    placeholder="Ex: Lucas e Marina"
                  />
                </div>
              </div>

              {/* Optional Message Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Mensagem de carinho <span className="text-xs text-slate-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={donorMessage}
                  onChange={(e) => setDonorMessage(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ef007e] text-sm text-slate-800 placeholder-slate-400 bg-white resize-none"
                  placeholder="Deixe uma mensagem especial para o anfitrião..."
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#ef007e] shrink-0" />
                <span>Na próxima tela você poderá escolher entre <strong>Pix instantâneo</strong> ou <strong>Cartão de Crédito em até 12x</strong>.</span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0">
              <button
                type="submit"
                disabled={isProcessing || !donorName.trim()}
                className="w-full py-3.5 bg-[#ef007e] text-white rounded-xl font-semibold hover:bg-[#d9006f] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 shadow-pink-200 cursor-pointer text-sm"
              >
                {isProcessing ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>Continuar para Pagamento • R$ {gift.price.toFixed(2)}</>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
