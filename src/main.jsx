import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PasskeysProvider } from '@quilibrium/quilibrium-js-sdk-channels';
import { QuorumApiClientProvider } from './components/context/QuorumApiContext.tsx';
import { MessageDBProvider } from './components/context/MessageDB.tsx';
import './index.scss';
import App from './App.tsx';
import { WebSocketProvider } from './components/context/WebsocketProvider.tsx';
import { ThemeProvider } from './components/context/ThemeProvider.tsx';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { dynamicActivate, getUserLocale } from './i18n/i18n.ts';
import React from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      staleTime: 100,
      gcTime: 100,
    },
  },
});

const Root = () => {
  React.useEffect(() => {
    //dynamicActivate(getUserLocale());
    //force english until onboarding translations are proofread
    const savedLocale = getUserLocale() || 'en';
    dynamicActivate(savedLocale);
  }, []);

  return (
    <BrowserRouter>
      <PasskeysProvider fqAppPrefix="Quorum">
        <QueryClientProvider client={queryClient}>
          <QuorumApiClientProvider>
            <WebSocketProvider>
              <MessageDBProvider>
                <ThemeProvider>
                  <App />
                </ThemeProvider>
              </MessageDBProvider>
            </WebSocketProvider>
          </QuorumApiClientProvider>
        </QueryClientProvider>
      </PasskeysProvider>
    </BrowserRouter>
  );
};

createRoot(document.getElementById('root')).render(<Root />);
