/**
 * PS Consult – UNTH: Authentication Context
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ps_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('ps_token'));
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!token && !!user;

  // Verify token on mount
  useEffect(() => {
    if (token) {
      authAPI
        .me()
        .then((res) => {
          setUser(res.data);
          localStorage.setItem('ps_user', JSON.stringify(res.data));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (username, password) => {
    const res = await authAPI.login({ username, password });
    const { access_token, user: userData } = res.data;
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('ps_token', access_token);
    localStorage.setItem('ps_user', JSON.stringify(userData));
    return userData;
  }, []);

  const codeLogin = useCallback(async (code) => {
    const res = await authAPI.codeLogin(code);
    const { access_token, user: userData } = res.data;
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('ps_token', access_token);
    localStorage.setItem('ps_user', JSON.stringify(userData));
    return userData;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('ps_token');
    localStorage.removeItem('ps_user');
  }, []);

  const hasRole = useCallback(
    (...roles) => {
      return user && roles.includes(user.role);
    },
    [user]
  );

  const isPlasticSurgeryTeam = useCallback(() => {
    return hasRole('registrar', 'senior_registrar', 'consultant');
  }, [hasRole]);

  if (loading) {
    return (
      <div className="pwa-splash">
        <div className="text-2xl font-bold mb-2">PS Consult</div>
        <div className="text-blue-200 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        login,
        codeLogin,
        logout,
        hasRole,
        isPlasticSurgeryTeam,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
