import React, { useState } from 'react';
import { X, Copy, CheckCircle2, CreditCard, QrCode, User, ShieldCheck } from 'lucide-react';
import { Gift } from '../types';
import { useAppContext } from '../lib/AppContext';
import { motion, AnimatePresence } from 'motion/react';

type PaymentModalProps = {
  gift: Gift | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function PaymentModal({ gift, isOpen, onClose }: PaymentModalProps) {
  const { addTransaction, paymentSettings } = useAppContext();
  const [method, setMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [donorName, setDonorName] = useState('');
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Simplified PIX Payload format just for demonstration
  const generatePixPayload = () => {
    return `00020126...${paymentSettings.pixKey}...5204000053039865405${gift?.price.toFixed(2)}5802BR5913${paymentSettings.receiverName}6008${paymentSettings.city || 'BRASIL'}62070503***63041D3D`;
  };

  const pixPayload = generatePixPayload();

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorName.trim() || !gift) return;

    setIsProcessing(true);

    // Na integração real com Mercado Pago:
    // 1. O front-end usa a paymentSettings.gatewayPublicKey para gerar token do cartão (se cartão).
    // 2. O front-end envia um POST para uma API interna (ex: /api/payments) com o token, valor, gift.id.
    // 3. A API interna usa o Access Token (não exposto no front) para criar o pagamento no MP.
    // 4. Se PIX, o backend gera o QRCode do MP e retorna para o front.

    setTimeout(() => {
      addTransaction({
        giftTitle: gift.title,
        donorName,
        amount: gift.price,
        method: method === 'PIX' ? 'PIX' : 'Cartão de Crédito',
      });

      setIsProcessing(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setDonorName('');
        onClose();
      }, 2500);
    }, 1500);
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

          {success ? (
            <div className="p-8 text-center flex-1 flex flex-col justify-center items-center overflow-y-auto">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold text-slate-800 mb-2">Muito Obrigado!</h3>
              <p className="text-slate-600">Sua contribuição para "{gift.title}" foi recebida com sucesso.</p>
            </div>
          ) : (
            <form onSubmit={handleSimulatePayment} className="flex flex-col flex-1 overflow-hidden">
              {/* Body */}
              <div className="p-6 overflow-y-auto flex-1">
                <div className="mb-6">
                  <p className="text-slate-500 text-sm mb-1">Item escolhido:</p>
                  <p className="text-lg font-semibold text-slate-800">{gift.title}</p>
                  <p className="text-teal-600 font-bold">R$ {gift.price.toFixed(2)}</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
                  <button
                    type="button"
                    onClick={() => setMethod('PIX')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors ${
                      method === 'PIX' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    PIX
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('CREDIT_CARD')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors ${
                      method === 'CREDIT_CARD' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Cartão
                  </button>
                </div>

                <div className="mb-6 bg-teal-50 border border-teal-100 rounded-lg p-3 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-teal-800 font-medium mb-1">Pagamento seguro destinado a:</p>
                    <p className="text-sm font-bold text-teal-900">{paymentSettings.receiverName}</p>
                    {paymentSettings.gatewayProvider === 'mercadopago' && (
                      <p className="text-xs text-teal-700 opacity-80 mt-1">Processado por Mercado Pago</p>
                    )}
                  </div>
                </div>

                {method === 'PIX' ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center mb-6">
                    <div className="w-40 h-40 bg-white border-2 border-slate-200 rounded-lg flex items-center justify-center p-2 mb-4 mx-auto relative overflow-hidden">
                      <QrCode className="w-full h-full text-slate-800" strokeWidth={1} />
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent"></div>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">Escaneie o QR Code ou copie a chave PIX abaixo:</p>
                    
                    <div className="flex gap-2 mb-2">
                      <input 
                        type="text" 
                        readOnly 
                        value={pixPayload}
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-500 focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className="flex items-center justify-center gap-2 w-12 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 mb-6">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4">
                      {paymentSettings.gatewayProvider === 'simulated' && (
                        <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                          Modo <strong>Simulado</strong>. O valor não será debitado.
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Número do Cartão</label>
                        <input type="text" placeholder="0000 0000 0000 0000" className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Validade (MM/AA)</label>
                          <input type="text" placeholder="MM/AA" className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-slate-500 mb-1">CVV</label>
                          <input type="text" placeholder="123" className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
                        </div>
                      </div>
                    </div>
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
                      className="w-full pl-9 pr-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      placeholder="Nome completo"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-3.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isProcessing ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>Confirmar Pagamento de R$ {gift.price.toFixed(2)}</>
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

