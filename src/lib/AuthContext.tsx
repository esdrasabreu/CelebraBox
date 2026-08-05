import React, { createContext, useContext, useState, useEffect } from 'react';
import { Host } from '../types';
import { supabase } from './supabase';

type AuthContextType = {
  host: Host | null;
  login: (email: string, passwordHash: string) => Promise<boolean>;
  register: (name: string, email: string, passwordHash: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [host, setHost] = useState<Host | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data } = await supabase
            .from('hosts')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          if (data) {
            setHost({ id: data.id, name: data.name, email: data.email, passwordHash: '' });
          } else {
            const { data: newHost } = await supabase
              .from('hosts')
              .insert([{ 
                id: session.user.id, 
                name: session.user.user_metadata?.name || 'User', 
                email: session.user.email 
              }])
              .select()
              .single();
              
            if (newHost) {
              setHost({ id: newHost.id, name: newHost.name, email: newHost.email, passwordHash: '' });
            }
          }
        }
        
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
        return () => subscription.unsubscribe();
      } else {
        const savedHost = localStorage.getItem('wedding_tech_current_host');
        if (savedHost) {
          setHost(JSON.parse(savedHost));
        }
        setIsLoading(false);
      }
    };
    
    checkSession();
  }, []);

  useEffect(() => {
    if (!supabase) {
      if (host) {
        localStorage.setItem('wedding_tech_current_host', JSON.stringify(host));
      } else {
        localStorage.removeItem('wedding_tech_current_host');
      }
    }
  }, [host]);

  const login = async (email: string, passwordHash: string) => {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: passwordHash,
      });
        
      if (data?.user && !error) {
        return true;
      }
      return false;
    }
    
    const usersStr = localStorage.getItem('wedding_tech_users');
    const users: Host[] = usersStr ? JSON.parse(usersStr) : [];
    const user = users.find(u => u.email === email && u.passwordHash === passwordHash);
    
    if (user) {
      setHost(user);
      return true;
    }
    return false;
  };

  const register = async (name: string, email: string, passwordHash: string) => {
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: passwordHash,
        options: {
          data: { name }
        }
      });
        
      if (data?.user && !error) {
        const { error: insertError } = await supabase
          .from('hosts')
          .insert([{ 
            id: data.user.id,
            name, 
            email 
          }]);
          
        if (insertError) {
          console.error("Failed to create host profile", insertError);
        }
        return true;
      }
      console.error(error);
      return false;
    }

    const usersStr = localStorage.getItem('wedding_tech_users');
    const users: Host[] = usersStr ? JSON.parse(usersStr) : [];
    
    if (users.some(u => u.email === email)) {
      return false;
    }

    const newUser: Host = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      email,
      passwordHash
    };
    
    users.push(newUser);
    localStorage.setItem('wedding_tech_users', JSON.stringify(users));
    setHost(newUser);
    return true;
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
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

