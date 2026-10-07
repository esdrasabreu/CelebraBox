import React, { useState } from 'react';
import { X, User, ShieldCheck } from 'lucide-react';
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
            donorName: donorName,
            hostId: hostId || 'default',
            externalReference: externalRef
          }),
        });

        const data = await response.json();
        
        if (data.init_point) {
          // Add preliminary transaction
          addTransaction({
            host_id: hostId,
            gift_id: gift.id,
            preference_id: data.preference_id,
            external_reference: externalRef,
            giftTitle: gift.title,
            donorName,
            amount: gift.price,
            method: 'Aguardando',
            status: 'checkout_started'
          });

          // Redirect to checkout
          window.location.href = data.init_point;
        } else {
          throw new Error('Falha ao gerar link de pagamento.');
        }
      } else {
        // Simulated flow
        setTimeout(() => {
          const externalRef = `${hostId || 'default'}:${gift.id}:${crypto.randomUUID()}`;
          addTransaction({
            host_id: hostId,
            gift_id: gift.id,
            external_reference: externalRef,
            giftTitle: gift.title,
            donorName,
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
              quantity: gift.quantity - 1 
            });
          }

          setIsProcessing(false);
          alert('Pagamento simulado com sucesso!');
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.warn("Payment error:", err);
      setErrorMsg('Ocorreu um erro ao processar. Tente novamente.');
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
            <h3 className="text-lg font-bold text-slate-800">Presentear</h3>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSimulatePayment} className="flex flex-col flex-1 overflow-hidden">
            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6">
                <p className="text-slate-500 text-sm mb-1">Item escolhido:</p>
                <p className="text-lg font-semibold text-slate-800">{gift.title}</p>
                <p className="text-[#ef007e] font-bold">R$ {gift.price.toFixed(2)}</p>
              </div>

              <div className="mb-6 bg-pink-50 border border-pink-100 rounded-lg p-3 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#ef007e] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-pink-900 font-medium mb-1">Pagamento seguro destinado a:</p>
                  <p className="text-sm font-bold text-[#b8005b]">{paymentSettings.receiverName}</p>
                  {paymentSettings.gatewayProvider === 'mercadopago' && (
                    <p className="text-xs text-pink-700 opacity-90 mt-1">Processado em ambiente seguro pelo Mercado Pago</p>
                  )}
                </div>
              </div>

              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                  {errorMsg}
                </div>
              )}

              <div className="mb-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Deixe seu nome para o anfitrião</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    className="w-full pl-9 pr-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ef007e] text-sm"
                    placeholder="Nome completo"
                  />
                </div>
              </div>
              
              <div className="mt-4 text-xs text-slate-500 text-center">
                Você será redirecionado para a página de pagamento seguro.
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0">
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 bg-[#ef007e] text-white rounded-lg font-medium hover:bg-[#d9006f] transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-70 shadow-pink-200"
              >
                {isProcessing ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>Ir para Pagamento de R$ {gift.price.toFixed(2)}</>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

