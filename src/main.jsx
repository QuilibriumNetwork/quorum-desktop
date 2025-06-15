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
import { I18nProvider } from '@lingui/react';
//import { i18n } from './i18n';

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
        
                  <App />
       
              </ThemeProvider>
            </MessageDBProvider>
          </WebSocketProvider>
        </QuorumApiClientProvider>
      </QueryClientProvider>
    </PasskeysProvider>
  </BrowserRouter>
);
