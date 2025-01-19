import qs from 'qs';
import { getConfig } from '../config/config';
import {
  getHubAddUrl,
  getHubDeleteUrl,
  getHubUrl,
  getInboxDeleteUrl,
  getInboxFetchUrl,
  getInboxUrl,
  getSpaceManifestUrl,
  getSpaceUrl,
  getUserRegistrationUrl,
  getUserSettingsUrl,
} from './quorumApi';
import { channel } from '@quilibrium/quilibrium-js-sdk-channels';

abstract class AbstractQuorumApiClient {
  options: QuorumApiClientOptions;
  private defaultHeaders: RequestHeaders;
  private timeoutRetryDecayManager: TimeoutRetryDecayManager | undefined;

  constructor(options: QuorumApiClientOptions = {}) {
    this.options = mergeIntoDefaultOptions<QuorumApiClientOptions>({
      defaults: getDefaultOptions(),
      options,
    });

    this.timeoutRetryDecayManager = options.timeoutRetryDecayFactor
      ? new TimeoutRetryDecayManager(options.timeoutRetryDecayFactor)
      : undefined;

    this.defaultHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
    };

    for (const key in this.defaultHeaders) {
      if (this.defaultHeaders[key] === '') {
        delete this.defaultHeaders[key];
      }
    }
  }

  public get baseUrl() {
    return this.options.baseUrl;
  }

  public get webSocketUrl() {
    return this.options.wsUrl;
  }

  protected async get<T>(url: RequestRelativeUrl, options: GetOptions) {
    return this.fetch<T>(url, { ...options, method: 'GET' });
  }

  protected async patch<T>(
    url: RequestRelativeUrl,
    { headers, ...options }: PatchOptions
  ) {
    return this.fetchWithRetry<T>(0, url, {
      ...options,
      method: 'PATCH',
    });
  }

  protected async post<T>(
    url: RequestRelativeUrl,
    { headers, ...options }: PostOptions
  ) {
    return this.fetchWithRetry<T>(0, url, {
      ...options,
      method: 'POST',
    });
  }

  protected async put<T>(
    url: RequestRelativeUrl,
    { headers, ...options }: PutOptions
  ) {
    return this.fetchWithRetry<T>(0, url, {
      ...options,
      method: 'PUT',
    });
  }

  protected async delete<T>(
    url: RequestRelativeUrl,
    { headers, ...options }: DeleteOptions
  ) {
    return this.fetchWithRetry<T>(0, url, {
      ...options,
      method: 'DELETE',
    });
  }
}

export class QuorumApiClient extends AbstractQuorumApiClient {
  // MAIN API:
  getUser(
    address: string,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.get<channel.UserRegistration>(getUserRegistrationUrl(address), {
      headers,
      timeout,
    });
  }

  getSpace(
    spaceAddress: string,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.get<channel.SpaceRegistration>(getSpaceUrl(spaceAddress), {
      headers,
      timeout,
    });
  }

  getUserSettings(
    address: string,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.get<channel.UserConfig>(getUserSettingsUrl(address), {
      headers,
      timeout,
    });
  }

  postUser(
    address: string,
    userRegistration: channel.UserRegistration,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.post<channel.UserRegistration>(getUserRegistrationUrl(address), {
      headers,
      timeout,
      body: userRegistration,
    });
  }

  getInbox(
    address: string,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.get<(channel.SealedMessage & { timestamp: number })[]>(
      getInboxFetchUrl(address),
      {
        headers,
        timeout,
      }
    );
  }

  postInbox(
    sealedMessage: channel.SealedMessage,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.post<{ status: string }>(getInboxUrl(), {
      headers,
      timeout,
      body: sealedMessage,
    });
  }

  deleteInbox(
    messages: channel.DeleteMessages,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.post<{ status: string }>(getInboxDeleteUrl(), {
      headers,
      timeout,
      body: messages,
    });
  }

  postUserSettings(
    address: string,
    sealedMessage: channel.UserConfig,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.post<{ status: string }>(getUserSettingsUrl(address), {
      headers,
      timeout,
      body: sealedMessage,
    });
  }

  postSpace(
    address: string,
    spaceRegistration: channel.SpaceRegistration,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.post<{ status: string }>(getSpaceUrl(address), {
      headers,
      timeout,
      body: spaceRegistration,
    });
  }

  getSpaceManifest(
    address: string,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.get<channel.SpaceManifest>(getSpaceManifestUrl(address), {
      headers,
      timeout,
    });
  }

  postSpaceManifest(
    address: string,
    manifest: channel.SpaceManifest,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.post<{ status: string }>(getSpaceManifestUrl(address), {
      headers,
      timeout,
      body: manifest,
    });
  }

  postHub(
    hubSealedMessage: channel.HubSealedMessage,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.post<{ status: string }>(getHubUrl(), {
      headers,
      timeout,
      body: hubSealedMessage,
    });
  }

  postHubAdd(
    hubControlMessage: channel.HubControlMessage,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.post<{ status: string }>(getHubAddUrl(), {
      headers,
      timeout,
      body: hubControlMessage,
    });
  }

  postHubDelete(
    hubControlMessage: channel.HubControlMessage,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.post<{ status: string }>(getHubDeleteUrl(), {
      headers,
      timeout,
      body: hubControlMessage,
    });
  }

  // LOCALIZATION API:
  getLocalization(langId: string) {
    function remap(pair: any[]): (vars: any) => string {
      return (vars: any): string => {
        let template = pair[0] as string;

        for (let name of pair[1] as string[]) {
          template = template.replace('${' + name + '}', vars[name]);
        }

        return template;
      };
    }

    return {
      direction: 'ltr',
      langId: langId,
      localizations: {
        ADVANCED_SETTINGS: remap(['Advanced Settings', []]),
        COMMUNITY_GUIDELINES: remap(['Community Guidelines', []]),
        CREATE_SPACE: remap(['Create Space', []]),
        CREATE_SPACE_PROMPT: remap(['Choose a name for your Space', []]),
        CREATE_SPACE_TITLE: remap(['Create a Space', []]),
        JOIN_SPACE: remap(['Join Space', []]),
        JOIN_SPACE_PROMPT: remap([
          'Enter the vanity URL or invite URL to join',
          [],
        ]),
        JOIN_SPACE_TITLE: remap(['Join a Space', []]),
        LOG_OUT: remap(['Log Out', []]),
        NEW_DIRECT_MESSAGE_BUTTON: remap(['Create', []]),
        NEW_DIRECT_MESSAGE_PROMPT: remap([
          'Enter the address of a user to direct message',
          [],
        ]),
        NEW_DIRECT_MESSAGE_TITLE: remap(['New Direct Message', []]),
        SPACE_BANNER_ATTACHMENT: remap([
          'Drag and drop or click to add a Space banner',
          [],
        ]),
        SPACE_ICON_ATTACHMENT: remap([
          'Drag and drop or click to add a Space icon (1MB max)',
          [],
        ]),
        TOOLTIP_ADD_SPACE: remap(['Add a Space', []]),
        TOOLTIP_JOIN_SPACE: remap(['Join an existing Space', []]),
        TOOLTIP_SEARCH_SPACES: remap(['Search for Public Spaces', []]),
      },
    };
  }


  public updateOptions(options: Partial<QuorumApiClientOptions>) {
    this.options = Object.assign({}, this.options, options);
  }

  private async fetchWithRetry<T>(
    count: number = 0,
    relativeUrl: RequestRelativeUrl,
    options: FetchOptions
  ): Promise<FetchResponse<T>> {
    const retryLimit =
      (options as MutateFetchOptions).retryLimit || defaultRetryLimit;

    return await this.fetch<T>(relativeUrl, options).catch(async (error) => {
      const isHandledError =
        isQuorumApiError(error) && error.status?.toString().startsWith('4');

      if (this.options.checkOffline) {
        const isOffline = await this.options.checkOffline();
        if (isOffline) {
          throw new UnhandledFetchError({
            absoluteUrl: relativeUrl,
            body: options.body,
            error: 'Offline',
            hasTimedOut: false,
            isHandled: false,
            message: 'Offline',
            method: options.method,
            relativeUrl,
            resolvedTimeout: options.timeout || defaultReadTimeout,
            response: undefined,
            responseData: undefined,
            status: undefined,
            timeout: options.timeout,
            isOffline,
          });
        }
      }

      if (count < retryLimit && !isHandledError) {
        return await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * (count + 1))
        )
          .then(async () => {
            return await this.fetchWithRetry<T>(
              count + 1,
              relativeUrl,
              options
            );
          })
          .catch((e) => {
            throw e;
          });
      } else {
        throw error;
      }
    });
  }

  private async fetch<T>(
    relativeUrl: RequestRelativeUrl,
    {
      baseUrl,
      body: rawBody,
      headers: partialHeaders,
      method,
      params,
      timeout,
    }: FetchOptions
  ): Promise<FetchResponse<T>> {
    let response: Response | undefined;
    let responseData: T | undefined;

    const stringifiedParams = qs.stringify(params);
    const url = `${baseUrl || this.options.baseUrl}${relativeUrl}${
      stringifiedParams ? `?${stringifiedParams}` : ''
    }`;

    const headers = {
      ...this.defaultHeaders,
      ...partialHeaders,
    };
    const body = rawBody === undefined ? rawBody : JSON.stringify(rawBody);
    let hasTimedOut = false;

    const timeoutDecayFactor = this.timeoutRetryDecayManager
      ? this.timeoutRetryDecayManager.getDecayFactor(url, params)
      : 1;

    const resolvedTimeout =
      (() => {
        if (timeout !== undefined) {
          return timeout;
        }

        if (method === 'GET') {
          return this.options.readTimeout === undefined
            ? defaultReadTimeout
            : this.options.readTimeout;
        }

        return this.options.mutateTimeout === undefined
          ? defaultMutateTimeout
          : this.options.mutateTimeout;
      })() * timeoutDecayFactor;

    function buildErrorParams({
      originalError,
      isHandled,
      isOffline = false,
    }: {
      originalError: unknown;
      isHandled: boolean;
      isOffline?: boolean;
    }): FetchErrorOptions {
      return {
        absoluteUrl: url,
        body: body,
        error: originalError,
        hasTimedOut,
        isHandled,
        message: isError(originalError)
          ? originalError.message
          : originalError
            ? String(originalError)
            : 'Quorum API Client experienced an unexpected error.',
        method,
        relativeUrl,
        resolvedTimeout,
        response,
        responseData,
        status: response?.status,
        timeout,
        isOffline,
      };
    }

    function getRequestInfo(): RequestInfo {
      return {
        absoluteUrl: url,
        body,
        method,
        relativeUrl,
      };
    }

    if (this.options.checkOffline) {
      const isOffline = await this.options.checkOffline();
      if (isOffline) {
        throw new UnhandledFetchError(
          buildErrorParams({
            originalError: 'Offline',
            isHandled: false,
            isOffline,
          })
        );
      }
    }

    const controller = new AbortController();
    const requestStartedAt = Date.now();

    let timeoutId = resolvedTimeout
      ? setTimeout(() => {
          if (this.options.onTimeout) {
            this.options.onTimeout({
              requestInfo: getRequestInfo(),
              timeSinceRequestStart: Date.now() - requestStartedAt,
            });
          }
          hasTimedOut = true;
          controller.abort();
        }, resolvedTimeout)
      : undefined;

    try {
      const resolvedFetch = this.options.fetch || globalFetch;

      if (!resolvedFetch) {
        throw new Error('fetch is undefined');
      }

      if (this.options.onFetchStart) {
        this.options.onFetchStart({
          requestInfo: getRequestInfo(),
        });
      }

      response = await resolvedFetch(url, {
        body,
        headers,
        method,
        signal: controller.signal,
      });

      const contentType = (
        response!.headers.get('content-type') ||
        'application/json; charset=utf-8'
      ).toLowerCase();
      const isJson = contentType.includes('json');
      const responseData: T = isJson
        ? await response!.json()
        : await response!.text();

      if (response!.status >= 400) {
        const body = responseData as any;
        const message = `${relativeUrl} ${response!.status} - ${body.error}`;
        const handledError = new HandledFetchError({
          ...buildErrorParams({ originalError: message, isHandled: true }),
          responseData: body,
          status: response!.status,
        });

        throw handledError;
      }

      if (this.options.onSuccess) {
        this.options.onSuccess({
          requestInfo: getRequestInfo(),
          responseData,
          responseStatus: response!.status,
        });
      }

      return { data: responseData, status: response!.status };
    } catch (e) {
      const unhandledError = isHandledFetchError(e)
        ? e
        : new UnhandledFetchError(
            buildErrorParams({ originalError: e, isHandled: false })
          );

      if (this.options.onError) {
        this.options.onError({
          error: unhandledError,
          requestInfo: getRequestInfo(),
          responseStatus: response?.status,
        });
      }

      throw unhandledError;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export type PagedResponse<T> = {
  data: T[];
  nextPageToken: string | undefined;
};

export type ErrorResponse = {
  code: string;
  message: string;
  details: { [propertyName: string]: string };
};

export const isError = (error: unknown): error is Error =>
  error instanceof Error;

export const isQuorumError = (error: unknown): error is QuorumError =>
  error instanceof QuorumError;

export type QuorumErrorOptions<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends object = object,
> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error?: unknown;
} & T;

export class QuorumError extends Error {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly error?: unknown;
  public hasBeenTracked?: boolean;

  constructor(name: string, { error }: QuorumErrorOptions) {
    super(name);
    this.error = error;
  }
}

type RequestMethod =
  | 'GET'
  | 'POST'
  | 'DELETE'
  | 'PUT'
  | 'PATCH'
  | 'OPTIONS'
  | 'HEAD';

export interface FetchErrorOptions {
  absoluteUrl: string | undefined;
  body: string | undefined;
  hasTimedOut: boolean;
  message: string;
  method: RequestMethod;
  relativeUrl: string;
  resolvedTimeout: number;
  response: Response | undefined;
  responseData: unknown | undefined;
  status?: number;
  timeout: number | undefined;
  error: unknown;
  isHandled: boolean;
  isOffline: boolean;
}

export class UnhandledFetchError extends QuorumError {
  absoluteUrl: string | undefined;
  body: string | undefined;
  hasTimedOut: boolean;
  method: RequestMethod;
  relativeUrl: string;
  resolvedTimeout: number;
  response: Response | undefined;
  responseData: unknown | undefined;
  status: number | undefined;
  timeout: number | undefined;
  isOffline: boolean;

  constructor(options: QuorumErrorOptions<FetchErrorOptions>) {
    // eslint-disable-next-line func-params-args/func-args
    super(options.message, options);
    this.name = 'Quorum API Error';
    this.absoluteUrl = options.absoluteUrl;
    this.body = options.body;
    this.hasTimedOut = options.hasTimedOut;
    this.method = options.method;
    this.relativeUrl = options.relativeUrl;
    this.resolvedTimeout = options.resolvedTimeout;
    this.response = options.response;
    this.responseData = options.responseData;
    this.status = options.status;
    this.timeout = options.timeout;
    this.isOffline = options.isOffline;
  }
}

interface HandledFetchErrorOptions extends FetchErrorOptions {
  responseData: any;
  status: number;
}

export class HandledFetchError extends UnhandledFetchError {
  responseData: any;
  status: number;

  constructor(options: QuorumErrorOptions<HandledFetchErrorOptions>) {
    super(options);
    this.responseData = options.responseData;
    this.status = options.status;
  }
}

export type FetchError = HandledFetchError | UnhandledFetchError;

export function isHandledFetchError(
  error: unknown
): error is HandledFetchError {
  return !!(error && (error as Error).constructor === HandledFetchError);
}

export function isUnhandledFetchError(
  error: unknown
): error is UnhandledFetchError {
  return !!(error && (error as Error).constructor === UnhandledFetchError);
}

export function isQuorumApiError(
  error: unknown
): error is HandledFetchError | UnhandledFetchError {
  return isHandledFetchError(error) || isUnhandledFetchError(error);
}

export type RequestRelativeUrl = `/${string}`;

export type RequestHeaders = Record<string, string>;

export type RequestParams = Record<
  string,
  string | number | boolean | null | undefined | string[] | number[] | boolean[]
>;

const defaultReadTimeout = 240 * 1000;
const defaultMutateTimeout = 22 * 1000;
const defaultRetryLimit = 2;
const retryDelay = 1000;

const globalFetch = globalThis.fetch
  ? globalThis.fetch.bind(globalThis)
  : undefined;

class TimeoutRetryDecayManager {
  private callCounts: Map<string, number> = new Map();
  private lastResetTimes: Map<string, number> = new Map();
  private RESET_INTERVAL_MS = 60000;

  private decayFactor: number;

  constructor(decayFactor: number = 0.3) {
    this.decayFactor = decayFactor;
  }

  getDecayFactor(url: string, params?: RequestParams): number {
    const now = Date.now();
    const key = params ? `${url}?${JSON.stringify(params)}` : url;
    if (!this.lastResetTimes.has(key)) {
      this.lastResetTimes.set(key, now);
    }
    const lastResetTime = this.lastResetTimes.get(key) || now;

    if (now - lastResetTime > this.RESET_INTERVAL_MS) {
      this.callCounts.delete(key);
      this.lastResetTimes.delete(key);
    }

    const currentCount = this.callCounts.get(key) || 0;
    this.callCounts.set(key, currentCount + 1);

    return Math.max(1 - currentCount * this.decayFactor, this.decayFactor);
  }
}

export type Fetcher = typeof fetch;

export interface FetchOptions {
  readonly baseUrl?: string;
  readonly body?: any;
  readonly headers?: RequestHeaders;
  readonly method: RequestMethod;
  readonly params?: RequestParams;
  readonly timeout?: number;
}

export interface FetchResponse<T> {
  readonly data: T;
  readonly status: number;
}

export type OnFetchStart = (params: { requestInfo: RequestInfo }) => void;

export type OnSuccess = (params: {
  requestInfo: RequestInfo;
  responseData: unknown;
  responseStatus: number;
}) => void;

export type OnError = (params: {
  requestInfo: RequestInfo;
  error: FetchError;
  responseStatus: number | undefined;
}) => void;

export type OnTimeout = (params: {
  requestInfo: RequestInfo;
  timeSinceRequestStart: number;
}) => void;

export type FetchOptionsWithoutMethod = Omit<FetchOptions, 'method'>;
export type FetchOptionsWithoutMethodOrBody = Omit<
  FetchOptionsWithoutMethod,
  'body'
>;

export type MutateFetchOptions = FetchOptionsWithoutMethod & {
  retryLimit?: number;
};

export type DeleteOptions = MutateFetchOptions;
export type GetOptions = FetchOptionsWithoutMethodOrBody;
export type PatchOptions = MutateFetchOptions;
export type PostOptions = MutateFetchOptions;
export type PutOptions = MutateFetchOptions;

export interface RequestInfo {
  absoluteUrl: string;
  body: any;
  method: RequestMethod;
  relativeUrl: string;
}

function mergeIntoDefaultOptions<T>({
  defaults,
  options,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaults: Record<any, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: Record<any, any>;
}): T {
  const mergedOptions = { ...defaults };

  for (const key in options) {
    if (options[key] !== undefined) {
      mergedOptions[key] = options[key];
    }
  }

  return mergedOptions as T;
}

const getDefaultOptions = () => ({
  baseUrl: getConfig().quorumApiUrl,
  wsUrl: getConfig().quorumWsUrl,
  fetch: globalFetch,
  readTimeout: defaultReadTimeout,
  mutateTimeout: defaultMutateTimeout,
});

export interface QuorumApiClientOptions {
  readonly baseUrl?: string;
  readonly wsUrl?: string;
  readonly debug?: boolean;
  readonly fetch?: Fetcher;
  readonly getAuthToken?: () => Promise<string>;
  readonly mutateTimeout?: number;
  readonly onError?: OnError;
  readonly onFetchStart?: OnFetchStart;
  readonly onSuccess?: OnSuccess;
  readonly onTimeout?: OnTimeout;
  readonly readTimeout?: number;
  readonly timeoutRetryDecayFactor?: number;
  readonly checkOffline?: () => Promise<boolean>;
}