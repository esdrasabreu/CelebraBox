import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, ArrowLeft, RefreshCw, Sparkles, Heart } from 'lucide-react';
import { motion } from 'motion/react';

export default function PaymentStatus() {
  const { hostId, status } = useParams<{ hostId: string, status: string }>();
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('payment_id') || searchParams.get('id');
  const collectionStatus = searchParams.get('collection_status') || searchParams.get('status') || status;
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  useEffect(() => {
    async function verify() {
      if (!paymentId) return;
      setIsVerifying(true);
      try {
        const res = await fetch(`/api/verify-payment?payment_id=${paymentId}&hostId=${hostId || 'default'}`);
        const data = await res.json();
        if (data.success) {
          setLiveStatus(data.status);
          setPaymentDetails(data);
        }
      } catch (e) {
        console.warn("Could not verify payment automatically:", e);
      } finally {
        setIsVerifying(false);
      }
    }

    verify();
  }, [paymentId, hostId]);

  const effectiveStatus = liveStatus || collectionStatus || status;

  let icon = <Clock className="w-16 h-16 text-slate-400 mx-auto mb-4" />;
  let title = 'Status do Pagamento';
  let message = 'Estamos processando os detalhes da transação.';
  let bgColor = 'bg-slate-50';
  let textColor = 'text-slate-800';

  if (effectiveStatus === 'approved' || effectiveStatus === 'sucesso') {
    icon = <CheckCircle2 className="w-16 h-16 text-[#ef007e] mx-auto mb-4" />;
    title = 'Pagamento Confirmado com Sucesso!';
    message = 'Muito obrigado pelo carinho! Seu pagamento foi aprovado pelo Mercado Pago e seu presente foi registrado com sucesso para o anfitrião.';
    bgColor = 'bg-pink-50';
    textColor = 'text-[#b8005b]';
  } else if (effectiveStatus === 'rejected' || effectiveStatus === 'falha') {
    icon = <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />;
    title = 'Falha no Pagamento';
    message = 'Ocorreu um problema ao processar seu pagamento no Mercado Pago. O presente continua liberado na lista para nova tentativa.';
    bgColor = 'bg-red-50';
    textColor = 'text-red-800';
  } else if (effectiveStatus === 'pending' || effectiveStatus === 'in_process' || effectiveStatus === 'pendente') {
    icon = <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />;
    title = 'Pagamento em Processamento';
    message = 'Estamos aguardando a compensação do Pix ou análise do cartão. O presente está reservado por 24 horas e será confirmado assim que compensar!';
    bgColor = 'bg-amber-50';
    textColor = 'text-amber-800';
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 text-center relative overflow-hidden"
      >
        <div className={`w-24 h-24 ${bgColor} rounded-full flex items-center justify-center mx-auto mb-6 shadow-xs`}>
          {icon}
        </div>
        
        <h2 className={`text-2xl font-bold mb-3 ${textColor}`}>
          {title}
        </h2>
        
        <p className="text-slate-600 mb-6 text-sm leading-relaxed">
          {message}
        </p>

        {paymentDetails && (
          <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left text-xs space-y-2">
            <div className="flex justify-between text-slate-500">
              <span>Método:</span>
              <span className="font-semibold text-slate-800 uppercase">{paymentDetails.method || 'PIX / Cartão'}</span>
            </div>
            {paymentDetails.amount && (
              <div className="flex justify-between text-slate-500">
                <span>Valor:</span>
                <span className="font-bold text-[#ef007e]">R$ {Number(paymentDetails.amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Identificador:</span>
              <span className="font-mono text-slate-600">#{paymentId}</span>
            </div>
          </div>
        )}

        {isVerifying && (
          <div className="mb-4 flex items-center justify-center gap-2 text-xs text-slate-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#ef007e]" />
            <span>Verificando confirmação com Mercado Pago...</span>
          </div>
        )}

        <div className="space-y-3">
          <Link 
            to={`/e/${hostId}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#ef007e] text-white rounded-xl font-semibold hover:bg-[#d9006f] transition-all shadow-md shadow-pink-200 w-full text-sm"
          >
            <Heart className="w-4 h-4 fill-current" />
            Voltar para a página do evento
          </Link>
          
          <Link 
            to={`/e/${hostId}#gifts`}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors w-full text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Ver lista de presentes
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
