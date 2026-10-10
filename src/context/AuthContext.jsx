'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getDefaultRoute } from '@/lib/permissions';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [role, setRole] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // Read from cookies natively on client side
    const getCookie = (name) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    };
    setRole(getCookie('user_role'));
  }, []);

  const login = (newRole) => {
    document.cookie = `user_role=${newRole}; path=/; max-age=86400`;
    setRole(newRole);
    router.push(getDefaultRoute(newRole));
  };

  const logout = () => {
    document.cookie = `user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    setRole(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
