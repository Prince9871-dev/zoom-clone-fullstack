import { create } from 'zustand';
import { User, TokenResponse } from '../types';
import api from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, full_name: string, password: string) => Promise<boolean>;
  logout: () => void;
  initAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<TokenResponse>('/auth/login', { email, password });
      const { access_token, user } = response.data;
      
      localStorage.setItem('zoom_clone_token', access_token);
      
      set({
        token: access_token,
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      return true;
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Authentication failed. Please check your credentials.';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  register: async (email, full_name, password) => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/auth/register', { email, full_name, password });
      set({ isLoading: false, error: null });
      return true;
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Registration failed. Email might already be taken.';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('zoom_clone_token');
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  initAuth: async () => {
    set({ isLoading: true, error: null });
    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }
    
    const token = localStorage.getItem('zoom_clone_token');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const response = await api.get<User>('/auth/me');
      set({
        token,
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    } catch (err: any) {
      localStorage.removeItem('zoom_clone_token');
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    }
  }
}));
