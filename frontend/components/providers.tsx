'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuth } from '../hooks/use-auth';

export function Providers({ children }: { children: React.ReactNode }) {
  // Safe instantiation of QueryClient to avoid server-side sharing
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  const initAuth = useAuth((state) => state.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster 
        theme="dark" 
        position="top-right" 
        richColors 
        closeButton
        toastOptions={{
          style: {
            background: '#1e293b', // slate-800
            border: '1px solid #334155', // slate-700
            color: '#f8fafc', // slate-50
          }
        }} 
      />
    </QueryClientProvider>
  );
}
