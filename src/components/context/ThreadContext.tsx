import React, { createContext, useContext, useRef, useCallback, useReducer, useEffect } from 'react';
import type {
  Message as MessageType,
  Role,
  Channel,
  Sticker,
  Emoji,
  ThreadMeta,
} from '../../api/quorumApi';

export interface ThreadChannelProps {
  spaceId: string;
  channelId: string;
  members: any;
  roles: Role[];
  stickers?: { [key: string]: Sticker };
  customEmoji?: Emoji[];
  mapSenderToUser: (senderId: string) => any;
  isSpaceOwner?: boolean;
  canDeleteMessages: (message: MessageType) => boolean;
  canPinMessages?: (message: MessageType) => boolean;
  channel?: Channel;
  spaceChannels?: Channel[];
  onChannelClick?: (channelId: string) => void;
  onUserClick?: (...args: any[]) => void;
  spaceName?: string;
  isRepudiable?: boolean;
  skipSigning?: boolean;
  onSigningToggle?: () => void;
  users?: Array<{ address: string; displayName?: string; userIcon?: string }>;
  mentionRoles?: Role[];
  spaceGroups?: Array<{ groupName: string; channels: Channel[]; icon?: string; iconColor?: string }>;
  canUseEveryone?: boolean;
  onShowStickers?: () => void;
}

interface ThreadState {
  isOpen: boolean;
  threadId: string | null;
  rootMessage: MessageType | null;
  threadMessages: MessageType[];
  isLoading: boolean;
  targetMessageId: string | null;
}

interface ThreadActions {
  openThread: (message: MessageType) => void;
  closeThread: () => void;
  submitMessage: (message: string | object, inReplyTo?: string) => Promise<void>;
  submitSticker?: (stickerId: string, inReplyTo?: string) => Promise<void>;
  updateTitle: (targetMessageId: string, threadMeta: ThreadMeta | undefined, newTitle: string) => Promise<void>;
}

export interface ThreadContextValue {
  // Getters (read current snapshot)
  getThreadState: () => ThreadState;
  getThreadActions: () => ThreadActions;
  getChannelProps: () => ThreadChannelProps | null;

  // Setters (called by Channel — do NOT trigger provider re-render)
  setThreadState: (state: ThreadState) => void;
  setThreadActions: (actions: ThreadActions) => void;
  setChannelProps: (props: ThreadChannelProps) => void;

  // Subscription for consumers
  subscribe: (listener: () => void) => () => void;
}

const noop = () => {};
const noopAsync = async () => {};

const defaultState: ThreadState = {
  isOpen: false,
  threadId: null,
  rootMessage: null,
  threadMessages: [],
  isLoading: false,
  targetMessageId: null,
};

const defaultActions: ThreadActions = {
  openThread: noop,
  closeThread: noop,
  submitMessage: noopAsync,
  updateTitle: noopAsync,
};

const defaultValue: ThreadContextValue = {
  getThreadState: () => defaultState,
  getThreadActions: () => defaultActions,
  getChannelProps: () => null,
  setThreadState: noop,
  setThreadActions: noop,
  setChannelProps: noop,
  subscribe: () => noop,
};

const ThreadContext = createContext<ThreadContextValue>(defaultValue);

export function ThreadProvider({ children }: { children: React.ReactNode }) {
  const stateRef = useRef<ThreadState>(defaultState);
  const actionsRef = useRef<ThreadActions>(defaultActions);
  const channelPropsRef = useRef<ThreadChannelProps | null>(null);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const notify = useCallback(() => {
    listenersRef.current.forEach((listener) => listener());
  }, []);

  const value = useRef<ThreadContextValue>({
    getThreadState: () => stateRef.current,
    getThreadActions: () => actionsRef.current,
    getChannelProps: () => channelPropsRef.current,
    setThreadState: (state: ThreadState) => {
      stateRef.current = state;
      notify();
    },
    setThreadActions: (actions: ThreadActions) => {
      actionsRef.current = actions;
      notify();
    },
    setChannelProps: (props: ThreadChannelProps) => {
      channelPropsRef.current = props;
      notify();
    },
    subscribe: (listener: () => void) => {
      listenersRef.current.add(listener);
      return () => {
        listenersRef.current.delete(listener);
      };
    },
  }).current;

  return <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>;
}

/**
 * Low-level access to the thread context store.
 * Used by Channel.tsx to push data without re-rendering.
 */
export function useThreadContextStore() {
  return useContext(ThreadContext);
}

/**
 * High-level hook for ThreadPanel — subscribes to changes and re-renders on updates.
 * Channel.tsx should use useThreadContextStore() instead to avoid re-render loops.
 */
export function useThreadContext() {
  const store = useContext(ThreadContext);
  const [, forceRender] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    return store.subscribe(forceRender);
  }, [store]);

  return {
    ...store.getThreadState(),
    ...store.getThreadActions(),
    channelProps: store.getChannelProps(),
  };
}
