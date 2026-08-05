import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export default function PaymentStatus() {
  const { hostId, status } = useParams<{ hostId: string, status: string }>();

  let icon = <Clock className="w-16 h-16 text-slate-400 mx-auto mb-4" />;
  let title = 'Status Desconhecido';
  let message = 'Não foi possível determinar o status do pagamento.';
  let bgColor = 'bg-slate-50';
  let textColor = 'text-slate-800';

  if (status === 'sucesso') {
    icon = <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />;
    title = 'Pagamento Aprovado!';
    message = 'Muito obrigado! Sua contribuição foi recebida com sucesso e já está confirmada.';
    bgColor = 'bg-green-50';
    textColor = 'text-green-800';
  } else if (status === 'falha') {
    icon = <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />;
    title = 'Falha no Pagamento';
    message = 'Ocorreu um problema ao processar seu pagamento. Nenhuma cobrança foi realizada.';
    bgColor = 'bg-red-50';
    textColor = 'text-red-800';
  } else if (status === 'pendente') {
    icon = <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />;
    title = 'Pagamento Pendente';
    message = 'Estamos aguardando a confirmação do seu pagamento. Assim que processado, o presente será confirmado.';
    bgColor = 'bg-amber-50';
    textColor = 'text-amber-800';
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 text-center"
      >
        <div className={`w-24 h-24 ${bgColor} rounded-full flex items-center justify-center mx-auto mb-6`}>
          {icon}
        </div>
        
        <h2 className={`text-2xl font-bold mb-3 ${textColor}`}>
          {title}
        </h2>
        
        <p className="text-slate-600 mb-8">
          {message}
        </p>

        <Link 
          to={`/e/${hostId}`}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors w-full"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para o evento
        </Link>
      </motion.div>
    </div>
  );
}
