import {
  QuorumApiClient,
  Fetcher,
  OnError,
  OnFetchStart,
  OnSuccess,
  OnTimeout,
} from '../../api/baseTypes';
import React, {
  createContext,
  memo,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { getConfig } from '../../config/config';

export type QuorumApiClientContextValue = {
  apiClient: QuorumApiClient;
  baseUrl: string;
  signMessage: SignMessage;
};

export type SignMessage = (message: string) => Promise<string>;

const QuorumApiClientContext = createContext<QuorumApiClientContextValue>({
  apiClient: new QuorumApiClient({
    baseUrl: getConfig().quorumApiUrl,
    wsUrl: getConfig().quorumWsUrl,
    debug: false,
    timeoutRetryDecayFactor: 0.3,
  }),
  baseUrl: getConfig().quorumApiUrl,
  signMessage: async () => '',
});

export type QuorumApiClientProviderProps = {
  address: string | undefined;
  baseUrl?: string;
  wsUrl?: string;
  children: ReactNode;
  debug?: boolean;
  fetch?: Fetcher;
  mutateTimeout?: number;
  onError?: OnError;
  onFetchStart?: OnFetchStart;
  onSuccess?: OnSuccess;
  onTimeout?: OnTimeout;
  readTimeout?: number;
  signMessage: SignMessage;
  timeoutRetryDecayFactor?: number;
  checkOffline?: () => Promise<boolean>;
};

const QuorumApiClientProvider = memo(
  ({
    baseUrl = getConfig().quorumApiUrl,
    wsUrl,
    children,
    debug = false,
    fetch,
    mutateTimeout,
    onError,
    onFetchStart,
    onSuccess,
    onTimeout,
    readTimeout,
    signMessage,
    timeoutRetryDecayFactor,
    checkOffline,
  }: QuorumApiClientProviderProps) => {
    const options = useMemo(() => {
      return {
        baseUrl,
        wsUrl,
        debug,
        fetch,
        mutateTimeout,
        onError,
        onFetchStart,
        onSuccess,
        onTimeout,
        readTimeout,
        timeoutRetryDecayFactor,
        checkOffline,
      };
    }, [
      baseUrl,
      wsUrl,
      debug,
      fetch,
      mutateTimeout,
      onError,
      onFetchStart,
      onSuccess,
      onTimeout,
      readTimeout,
      timeoutRetryDecayFactor,
      checkOffline,
    ]);

    const apiClient = useRef<QuorumApiClient>(undefined);

    useEffect(() => {
      if (!apiClient.current) {
        apiClient.current = new QuorumApiClient(options);
      }

      apiClient.current?.updateOptions(options);
    }, [apiClient, options]);

    const derivedApiClient = useMemo(() => {
      if (apiClient.current) {
        return apiClient.current;
      }

      return new QuorumApiClient(
        options || {
          baseUrl: getConfig().quorumApiUrl,
          meta: {},
        }
      );
    }, [apiClient, options]);

    const contextValue = useMemo(
      () => ({
        apiClient: derivedApiClient,
        baseUrl,
        signMessage,
      }),
      [baseUrl, derivedApiClient, signMessage]
    );

    return useMemo(
      () => (
        <QuorumApiClientContext.Provider value={contextValue}>
          {children}
        </QuorumApiClientContext.Provider>
      ),
      [children, contextValue]
    );
  }
);

QuorumApiClientProvider.displayName = 'QuorumApiClientProvider';

const useQuorumApiClient = () => useContext(QuorumApiClientContext);

export { QuorumApiClientProvider, useQuorumApiClient };
