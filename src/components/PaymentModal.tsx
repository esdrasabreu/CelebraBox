import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  ShieldCheck,
  Heart,
  Clock,
  AlertCircle,
  QrCode,
  CreditCard,
  Copy,
  Check,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Gift } from '../types';
import { useAppContext } from '../lib/AppContext';
import { getCheckoutBreakdown, PaymentChoice } from '../lib/paymentFees';
import { generatePixPayload } from '../lib/pixGenerator';
import { motion, AnimatePresence } from 'motion/react';

type PaymentModalProps = {
  gift: Gift | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function PaymentModal({ gift, isOpen, onClose }: PaymentModalProps) {
  const { hostId } = useParams<{ hostId: string }>();
  const { addTransaction, updateGift, paymentSettings, refreshReservations, refreshTransactions } = useAppContext();

  const [donorName, setDonorName] = useState('');
  const [donorMessage, setDonorMessage] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentChoice>('mp_pix');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Manual Pix step state
  const [manualPixStep, setManualPixStep] = useState<'form' | 'qrcode' | 'done'>('form');
  const [pixPayload, setPixPayload] = useState('');
  const [pixQrDataUrl, setPixQrDataUrl] = useState('');
  const [copiedPix, setCopiedPix] = useState(false);

  const hasManualPix = Boolean(
    paymentSettings.enableManualPix &&
    paymentSettings.pixKey &&
    paymentSettings.pixKey.trim() !== ''
  );

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setIsProcessing(false);
      setManualPixStep('form');
      setPixPayload('');
      setPixQrDataUrl('');
      setCopiedPix(false);
      setSelectedMethod(hasManualPix ? 'manual_pix' : 'mp_pix');
    }
  }, [isOpen, gift?.id, hasManualPix]);

  if (!isOpen || !gift) return null;

  const feeOptions = {
    passFeesToBuyer: paymentSettings.passFeesToBuyer !== false,
    pixFeePercent: paymentSettings.pixFeePercent ?? 0.99,
    cardFeePercent: paymentSettings.cardFeePercent ?? 4.98
  };

  const mpPixBreakdown = getCheckoutBreakdown(gift.price, 'mp_pix', feeOptions);
  const mpCardBreakdown = getCheckoutBreakdown(gift.price, 'mp_card', feeOptions);
  const manualPixBreakdown = getCheckoutBreakdown(gift.price, 'manual_pix', feeOptions);

  const activeBreakdown =
    selectedMethod === 'manual_pix'
      ? manualPixBreakdown
      : selectedMethod === 'mp_card'
        ? mpCardBreakdown
        : mpPixBreakdown;

  const handleCopyPix = async () => {
    if (!pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2500);
    } catch {
      setErrorMsg('Não foi possível copiar automaticamente. Selecione o código abaixo e copie.');
    }
  };

  const handleConfirmManualPixDone = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const externalRef = `${hostId || 'default'}:${gift.id}:manual_${crypto.randomUUID()}`;
      const res = await fetch('/api/manual-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          giftId: gift.id,
          giftTitle: gift.title,
          price: gift.price,
          donorName: donorName.trim(),
          hostId: hostId || 'default',
          externalReference: externalRef
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível registrar o Pix.');
      }

      try {
        await refreshReservations();
        await refreshTransactions(data.transaction ? [data.transaction] : undefined);
      } catch {}

      setManualPixStep('done');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao confirmar pagamento Pix.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorName.trim() || !gift) return;

    setIsProcessing(true);
    setErrorMsg('');

    try {
      if (selectedMethod === 'manual_pix' && hasManualPix) {
        const txid = `PRES${Date.now().toString().slice(-10)}`;
        const payload = generatePixPayload({
          pixKey: paymentSettings.pixKey,
          pixKeyType: paymentSettings.pixKeyType || 'random',
          receiverName: paymentSettings.receiverName || 'Anfitriao',
          city: paymentSettings.city || 'BRASIL',
          amount: gift.price,
          txid
        });
        const qrUrl = await QRCode.toDataURL(payload, {
          width: 260,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' }
        });
        setPixPayload(payload);
        setPixQrDataUrl(qrUrl);
        setManualPixStep('qrcode');
        setIsProcessing(false);
        return;
      }

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
            paymentMethod: selectedMethod
          }),
        });

        const data = await response.json();

        if (data.init_point) {
          try {
            await addTransaction({
              host_id: hostId,
              gift_id: gift.id,
              preference_id: data.preference_id,
              external_reference: externalRef,
              giftTitle: gift.title,
              donorName: donorName.trim(),
              amount: gift.price,
              grossAmount: data.breakdown?.grossAmount ?? activeBreakdown.grossAmount,
              netAmount: data.breakdown?.netAmount ?? gift.price,
              feeAmount: data.breakdown?.feeAmount ?? activeBreakdown.feeAmount,
              method: 'Aguardando',
              status: 'checkout_started'
            });
          } catch (e) {
            console.warn("Could not save local tx before redirect:", e);
          }

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
            method: selectedMethod === 'mp_card' ? 'Cartão de Crédito' : 'PIX',
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
          onClose();
        }, 900);
      }
    } catch (err: any) {
      console.warn("Payment error:", err);
      setErrorMsg(err.message || 'Ocorreu um erro ao processar. Tente novamente.');
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-center gap-2">
              {manualPixStep === 'qrcode' ? (
                <button
                  type="button"
                  onClick={() => setManualPixStep('form')}
                  className="p-2 bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : (
                <span className="p-2 bg-pink-50 text-[#ef007e] rounded-xl">
                  <Heart className="w-5 h-5 fill-current" />
                </span>
              )}
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {manualPixStep === 'qrcode' ? 'Pix Direto (Taxa Zero)' : manualPixStep === 'done' ? 'Presente Registrado!' : 'Presentear com Carinho'}
                </h3>
                <p className="text-xs text-slate-400">
                  {manualPixStep === 'qrcode'
                    ? 'Escaneie o QR Code ou copie o código Pix'
                    : manualPixStep === 'done'
                      ? 'Aguardando conferência do anfitrião'
                      : 'Escolha a forma de pagamento ideal para você'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {manualPixStep === 'done' ? (
            <div className="p-6 text-center space-y-4 overflow-y-auto">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-xl font-bold text-slate-800">Muito obrigado, {donorName}!</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Seu presente <strong>{gift.title}</strong> no valor de <strong>R$ {gift.price.toFixed(2)}</strong> foi reservado. Assim que o anfitrião confirmar o recebimento do Pix no banco, ele será concluído automaticamente!
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-[#ef007e] text-white rounded-xl font-semibold hover:bg-[#d9006f] transition-colors text-sm cursor-pointer"
              >
                Voltar à Lista de Presentes
              </button>
            </div>
          ) : manualPixStep === 'qrcode' ? (
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-center">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900">
                <strong>Taxa Zero:</strong> 100% do valor (<strong>R$ {gift.price.toFixed(2)}</strong>) vai direto para a conta de <strong>{paymentSettings.receiverName || 'Anfitrião'}</strong>.
              </div>

              {pixQrDataUrl && (
                <div className="bg-white p-3 rounded-2xl border border-slate-200 inline-block shadow-xs mx-auto">
                  <img src={pixQrDataUrl} alt="QR Code Pix" className="w-52 h-52 mx-auto" />
                </div>
              )}

              <div className="text-left space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Pix Copia e Cola</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={pixPayload}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {copiedPix ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 text-left">
                  {errorMsg}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleConfirmManualPixDone}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-md cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Já fiz o pagamento Pix</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              {/* Body */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                {/* Chosen Gift Card */}
                <div className="bg-gradient-to-br from-pink-50/70 to-slate-50 border border-pink-100/80 rounded-xl p-3.5 flex items-center gap-3.5">
                  {gift.imageUrl && (
                    <img
                      src={gift.imageUrl}
                      alt={gift.title}
                      className="w-14 h-14 rounded-lg object-cover shrink-0 border border-pink-100 shadow-xs"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-500 font-medium">Item escolhido</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{gift.title}</p>
                    <p className="text-[#ef007e] font-extrabold text-base">R$ {gift.price.toFixed(2)}</p>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Seu nome ou dos presenteadores <span className="text-[#ef007e]">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ef007e] text-sm text-slate-800 placeholder-slate-400 bg-white"
                      placeholder="Ex: Lucas e Marina"
                    />
                  </div>
                </div>

                {/* Payment Method Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Como deseja pagar?
                  </label>

                  {hasManualPix && (
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('manual_pix')}
                      className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        selectedMethod === 'manual_pix'
                          ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500'
                          : 'border-slate-200 hover:border-emerald-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-2 rounded-lg shrink-0 ${selectedMethod === 'manual_pix' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                          <QrCode className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-800">Pix Direto</span>
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full">Taxa 0%</span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">QR Code direto para a conta do anfitrião</p>
                        </div>
                      </div>
                      <span className="font-bold text-sm text-emerald-700 shrink-0">
                        R$ {manualPixBreakdown.grossAmount.toFixed(2)}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('mp_pix')}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      selectedMethod === 'mp_pix'
                        ? 'border-[#ef007e] bg-pink-50/60 ring-1 ring-[#ef007e]'
                        : 'border-slate-200 hover:border-pink-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${selectedMethod === 'mp_pix' ? 'bg-[#ef007e] text-white' : 'bg-pink-50 text-[#ef007e]'}`}>
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-800 block">Pix (Mercado Pago)</span>
                        <p className="text-[11px] text-slate-500 truncate">
                          {mpPixBreakdown.feeAmount > 0
                            ? `Aprovação automática • +R$ ${mpPixBreakdown.feeAmount.toFixed(2)} taxa`
                            : 'Aprovação automática na hora'}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-slate-800 shrink-0">
                      R$ {mpPixBreakdown.grossAmount.toFixed(2)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('mp_card')}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      selectedMethod === 'mp_card'
                        ? 'border-[#ef007e] bg-pink-50/60 ring-1 ring-[#ef007e]'
                        : 'border-slate-200 hover:border-pink-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${selectedMethod === 'mp_card' ? 'bg-[#ef007e] text-white' : 'bg-pink-50 text-[#ef007e]'}`}>
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-800 block">Cartão de Crédito (até 12x)</span>
                        <p className="text-[11px] text-slate-500 truncate">
                          {mpCardBreakdown.feeAmount > 0
                            ? `Mercado Pago • +R$ ${mpCardBreakdown.feeAmount.toFixed(2)} taxa do cartão`
                            : 'Parcele no cartão pelo Mercado Pago'}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-slate-800 shrink-0">
                      R$ {mpCardBreakdown.grossAmount.toFixed(2)}
                    </span>
                  </button>
                </div>

                {/* Transparent Fee Breakdown Summary when fee pass-through applies */}
                {activeBreakdown.feeAmount > 0 && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex justify-between text-slate-600">
                      <span>Valor do presente:</span>
                      <span>R$ {activeBreakdown.netAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Taxa de processamento ({activeBreakdown.feePercent.toFixed(2).replace('.', ',')}%):</span>
                      <span>+ R$ {activeBreakdown.feeAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200">
                      <span>Total a pagar:</span>
                      <span className="text-[#ef007e]">R$ {activeBreakdown.grossAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Optional Message Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mensagem de carinho <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={donorMessage}
                    onChange={(e) => setDonorMessage(e.target.value)}
                    rows={2}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ef007e] text-sm text-slate-800 placeholder-slate-400 bg-white resize-none"
                    placeholder="Deixe uma mensagem especial para o anfitrião..."
                  />
                </div>

                {/* 24h Reservation + Secure Badge */}
                <div className="bg-pink-50/50 border border-pink-100 rounded-xl p-3 flex items-start gap-2.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-[#ef007e] shrink-0 mt-0.5" />
                  <div className="text-pink-900">
                    Destinado a <strong>{paymentSettings.receiverName || 'Anfitrião do Evento'}</strong>. Ao avançar, o presente fica reservado por 24h durante o pagamento.
                  </div>
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
                  ) : selectedMethod === 'manual_pix' ? (
                    <>Gerar QR Code Pix • R$ {activeBreakdown.grossAmount.toFixed(2)}</>
                  ) : (
                    <>Pagar com {selectedMethod === 'mp_card' ? 'Cartão' : 'Pix'} • R$ {activeBreakdown.grossAmount.toFixed(2)}</>
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
