import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { LogIn, UserPlus, Gift, Sparkles, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const response = await login(email, password);
        if (response.success) {
          navigate('/admin');
        } else {
          toast.error(response.error || 'E-mail ou senha inválidos.');
        }
      } else {
        if (!name || !email || !password) {
          toast.error('Preencha todos os campos.');
          setLoading(false);
          return;
        }
        
        const response = await register(name, email, password);
        if (response.success) {
          navigate('/admin');
        } else {
          toast.error(response.error || 'Erro ao registrar.');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Left Column - Image/Brand */}
      <div className="md:w-1/2 relative bg-rose-50 overflow-hidden flex flex-col justify-center items-center p-12 lg:p-20">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1519225421980-715cb0215aed?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80" 
            alt="Celebração" 
            className="w-full h-full object-cover opacity-20 mix-blend-multiply"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-rose-100/90 via-rose-50/50 to-transparent"></div>
        </div>
        
        <div className="relative z-10 w-full max-w-md text-center md:text-left">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center md:justify-start gap-3 mb-8"
          >
            <div className="w-12 h-12 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-200">
              <Gift className="w-7 h-7" />
            </div>
            <h1 className="text-4xl font-serif font-bold text-slate-900 tracking-tight">Celebra<span className="text-rose-600">Box</span></h1>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-3xl lg:text-4xl font-serif text-slate-800 mb-6 leading-tight">
              Organize seus momentos inesquecíveis.
            </h2>
            <p className="text-lg text-slate-600 mb-8 max-w-sm mx-auto md:mx-0">
              Crie sites personalizados para casamentos e aniversários, gerencie listas de presentes, cotas de lua de mel e muito mais.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-700">
                <Heart className="w-5 h-5 text-rose-500" />
                <span>Templates elegantes e modernos</span>
              </div>
              <div className="flex items-center gap-3 text-slate-700">
                <Gift className="w-5 h-5 text-rose-500" />
                <span>Lista de presentes e Pix integrados</span>
              </div>
              <div className="flex items-center gap-3 text-slate-700">
                <Sparkles className="w-5 h-5 text-rose-500" />
                <span>Painel completo de convidados e recados</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="md:w-1/2 flex items-center justify-center p-8 lg:p-12 bg-white">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center md:text-left mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              {isLogin ? 'Bem-vindo de volta' : 'Criar sua conta'}
            </h2>
            <p className="text-slate-500">
              {isLogin ? 'Faça login para gerenciar seu evento.' : 'Cadastre-se e comece a organizar sua festa agora.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 focus:outline-none transition-all shadow-sm"
                  placeholder="Seu nome"
                  disabled={loading}
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 focus:outline-none transition-all shadow-sm"
                placeholder="seu@email.com"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 focus:outline-none transition-all shadow-sm"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 bg-rose-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-rose-700 hover:shadow-xl hover:shadow-rose-300 transform hover:-translate-y-0.5'}`}
            >
              {loading ? (
                'Processando...'
              ) : (
                <>
                  {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                  {isLogin ? 'Entrar na conta' : 'Criar minha conta'}
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-600">
              {isLogin ? 'Ainda não tem conta?' : 'Já tem uma conta?'}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setName('');
                  setEmail('');
                  setPassword('');
                }}
                className="ml-2 text-rose-600 font-semibold hover:text-rose-700 transition-colors"
                disabled={loading}
              >
                {isLogin ? 'Criar agora' : 'Fazer login'}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
