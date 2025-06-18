import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PasskeysProvider } from '@quilibrium/quilibrium-js-sdk-channels';
import { QuorumApiClientProvider } from './components/context/QuorumApiContext.tsx';
import { MessageDBProvider } from './components/context/MessageDB.tsx';
import './index.css';
import App from './App.tsx';
import { WebSocketProvider } from './components/context/WebsocketProvider.tsx';
import { ThemeProvider } from './components/context/ThemeProvider.tsx';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { defaultLocale, dynamicActivate } from './i18n/i18n.ts';


const locale = navigator.language.split('-')[0] || defaultLocale;
dynamicActivate(locale);

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

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <PasskeysProvider fqAppPrefix="Quorum">
      <QueryClientProvider client={queryClient}>
        <QuorumApiClientProvider>
          <WebSocketProvider>
            <MessageDBProvider>
              <ThemeProvider>
                <I18nProvider i18n={i18n}>
                  <App />
                </I18nProvider>
              </ThemeProvider>
            </MessageDBProvider>
          </WebSocketProvider>
        </QuorumApiClientProvider>
      </QueryClientProvider>
    </PasskeysProvider>
  </BrowserRouter>
);
