import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PasskeysProvider } from '@quilibrium/quilibrium-js-sdk-channels';
import { QuorumApiClientProvider } from '../src/components/context/QuorumApiContext';
import { MessageDBProvider } from '../src/components/context/MessageDB';
import '../src/index.scss';
import App from '../src/App';
import { WebSocketProvider } from '../src/components/context/WebsocketProvider';
import { ThemeProvider } from '../src/components/primitives/theme';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { dynamicActivate, getUserLocale } from '../src/i18n/i18n';

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
};

createRoot(document.getElementById('root')!).render(<Root />);
