import React, { createContext, useContext, useState, useEffect } from 'react';
import { Host } from '../types';
import { supabase } from './supabase';

type AuthResponse = { success: boolean; error?: string };

type AuthContextType = {
  host: Host | null;
  login: (email: string, passwordHash: string) => Promise<AuthResponse>;
  register: (name: string, email: string, passwordHash: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [host, setHost] = useState<Host | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      if (supabase) {
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.warn("Supabase session error:", sessionError);
          } else if (session?.user) {
            const { data, error } = await supabase
              .from('hosts')
              .select('*')
              .eq('id', session.user.id)
              .single();
              
            if (data && !error) {
              setHost({ id: data.id, name: data.name, email: data.email, passwordHash: '' });
            } else if (error && error.code === 'PGRST116') {
              // Not found, create it
              const { data: newHost, error: insertError } = await supabase
                .from('hosts')
                .insert([{ 
                  id: session.user.id, 
                  name: session.user.user_metadata?.name || 'User', 
                  email: session.user.email 
                }])
                .select()
                .single();
                
              if (newHost && !insertError) {
                setHost({ id: newHost.id, name: newHost.name, email: newHost.email, passwordHash: '' });
              }
            }
          }
        } catch (err) {
          console.warn("Error checking Supabase session:", err);
        }
        
        try {
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
              setHost(null);
            } else if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
              const { data } = await supabase
                .from('hosts')
                .select('*')
                .eq('id', session.user.id)
                .single();
                
              if (data) {
                setHost({ id: data.id, name: data.name, email: data.email, passwordHash: '' });
              }
            }
          });
          
          setIsLoading(false);
          return () => { subscription.unsubscribe(); };
        } catch (err) {
          console.warn("Error setting up auth listener:", err);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    
    checkSession();
  }, []);

  const login = async (email: string, passwordHash: string): Promise<AuthResponse> => {
    if (!supabase) {
      return { success: false, error: "Supabase não está configurado corretamente." };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: passwordHash,
      });
        
      if (error) {
        console.warn("Supabase login error:", error);
        return { success: false, error: error.message };
      }

      if (data?.user) {
        // Fetch the profile synchronously to avoid redirect loops
        const { data: profile } = await supabase
          .from('hosts')
          .select('*')
          .eq('id', data.user.id)
          .single();
          
        if (profile) {
          setHost({ id: profile.id, name: profile.name, email: profile.email, passwordHash: '' });
        } else {
          setHost({ id: data.user.id, name: data.user.user_metadata?.name || 'User', email: data.user.email, passwordHash: '' });
        }
        return { success: true };
      }
    } catch (err: any) {
      console.warn("Supabase login exception:", err);
      return { success: false, error: err.message || "Erro desconhecido ao fazer login." };
    }
    
    return { success: false, error: "Erro desconhecido ao fazer login." };
  };

  const register = async (name: string, email: string, passwordHash: string): Promise<AuthResponse> => {
    if (!supabase) {
      return { success: false, error: "Supabase não está configurado corretamente." };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: passwordHash,
        options: {
          data: { name }
        }
      });
        
      if (error) {
        console.warn("Supabase register error:", error);
        return { success: false, error: error.message };
      }

      if (data?.user) {
        const { error: insertError } = await supabase
          .from('hosts')
          .insert([{ 
            id: data.user.id,
            name, 
            email 
          }]);
          
        if (insertError) {
          console.warn("Failed to create host profile", insertError);
        }
          
        setHost({ id: data.user.id, name, email, passwordHash: '' });
        return { success: true };
      }
    } catch (err: any) {
      console.warn("Supabase register exception:", err);
      return { success: false, error: err.message || "Erro desconhecido ao registrar." };
    }
    
    return { success: false, error: "Erro desconhecido ao registrar." };
  };

  const logout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("Supabase logout error:", err);
      }
    }
    setHost(null);
  };

  return (
    <AuthContext.Provider value={{ host, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
