'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { AuthContext, useAuthProvider } from '@/hooks/use-auth';
import { Toaster } from '@/components/ui/toast';
import { AiCopilot } from '@/components/ai-copilot/ai-copilot';
import { useState, useEffect } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const auth = useAuthProvider();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <AuthContext.Provider value={auth}>
          {children}
          {mounted && auth.user && <AiCopilot />}
          <Toaster />
        </AuthContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
