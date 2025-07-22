import MiniSearch from 'minisearch';
import { Message, Conversation } from '../api/quorumApi';

export interface SearchableMessage {
  id: string;
  messageId: string;
  spaceId: string;
  channelId: string;
  content: string;
  senderId: string;
  createdDate: number;
  type: string;
}

export interface SearchContext {
  type: 'space' | 'dm';
  spaceId?: string;
  channelId?: string;
  conversationId?: string;
}

export interface SearchResult {
  message: Message;
  score: number;
  highlights: string[];
}

export class SearchDB {
  private searchIndices: Map<string, MiniSearch<SearchableMessage>> = new Map();
  private indexInitialized = false;

  // Dependency injection - these methods will be provided by MessageDB
  private getSpaces: () => Promise<any[]>;
  private getConversations: (params: { type: 'direct' }) => Promise<{ conversations: Conversation[] }>;
  private getAllSpaceMessages: (params: { spaceId: string }) => Promise<Message[]>;
  private getDirectMessages: (conversationId: string) => Promise<Message[]>;
  private getMessage: (params: { spaceId: string; channelId: string; messageId: string }) => Promise<Message | undefined>;

  constructor(dependencies: {
    getSpaces: () => Promise<any[]>;
    getConversations: (params: { type: 'direct' }) => Promise<{ conversations: Conversation[] }>;
    getAllSpaceMessages: (params: { spaceId: string }) => Promise<Message[]>;
    getDirectMessages: (conversationId: string) => Promise<Message[]>;
    getMessage: (params: { spaceId: string; channelId: string; messageId: string }) => Promise<Message | undefined>;
  }) {
    this.getSpaces = dependencies.getSpaces;
    this.getConversations = dependencies.getConversations;
    this.getAllSpaceMessages = dependencies.getAllSpaceMessages;
    this.getDirectMessages = dependencies.getDirectMessages;
    this.getMessage = dependencies.getMessage;
  }

  private extractTextFromMessage(message: Message): string {
    if (message.content.type === 'post') {
      const content = message.content.text;
      return Array.isArray(content) ? content.join(' ') : content;
    }
    if (message.content.type === 'event') {
      return message.content.text;
    }
    return '';
  }

  private messageToSearchable(message: Message): SearchableMessage {
    return {
      id: message.messageId,
      messageId: message.messageId,
      spaceId: message.spaceId,
      channelId: message.channelId,
      content: this.extractTextFromMessage(message),
      senderId: message.content.senderId,
      createdDate: message.createdDate,
      type: message.content.type,
    };
  }

  private createSearchIndex(): MiniSearch<SearchableMessage> {
    return new MiniSearch({
      fields: ['content', 'senderId'],
      storeFields: ['messageId', 'spaceId', 'channelId', 'createdDate', 'type'],
      searchOptions: {
        boost: { content: 2, senderId: 1 },
        prefix: true,
        fuzzy: 0.2,
      },
    });
  }

  private getIndexKey(context: SearchContext): string {
    if (context.type === 'space') {
      return `space:${context.spaceId}`;
    } else {
      return `dm:${context.conversationId}`;
    }
  }

  async initializeSearchIndices(): Promise<void> {
    if (this.indexInitialized) return;

    // Get all spaces and conversations to build indices
    const spaces = await this.getSpaces();
    const dmConversations = await this.getConversations({ type: 'direct' });

    // Initialize space indices
    for (const space of spaces) {
      const indexKey = `space:${space.spaceId}`;
      const messages = await this.getAllSpaceMessages({
        spaceId: space.spaceId,
      });

      const searchIndex = this.createSearchIndex();
      const searchableMessages = messages.map((msg) =>
        this.messageToSearchable(msg)
      );
      searchIndex.addAll(searchableMessages);

      this.searchIndices.set(indexKey, searchIndex);
    }

    // Initialize DM indices
    for (const conversation of dmConversations.conversations) {
      const indexKey = `dm:${conversation.conversationId}`;
      const messages = await this.getDirectMessages(conversation.conversationId);

      const searchIndex = this.createSearchIndex();
      const searchableMessages = messages.map((msg) =>
        this.messageToSearchable(msg)
      );
      searchIndex.addAll(searchableMessages);

      this.searchIndices.set(indexKey, searchIndex);
    }

    this.indexInitialized = true;
  }

  async addMessageToIndex(message: Message): Promise<void> {
    // Add to space index
    const spaceIndexKey = `space:${message.spaceId}`;
    const spaceIndex = this.searchIndices.get(spaceIndexKey);
    if (spaceIndex) {
      spaceIndex.add(this.messageToSearchable(message));
    }

    // If it's a DM, also add to DM index
    const conversationId = `${message.spaceId}/${message.channelId}`;
    const dmIndexKey = `dm:${conversationId}`;
    const dmIndex = this.searchIndices.get(dmIndexKey);
    if (dmIndex) {
      dmIndex.add(this.messageToSearchable(message));
    }
  }

  async removeMessageFromIndex(
    messageId: string,
    spaceId: string,
    channelId: string
  ): Promise<void> {
    // Remove from space index
    const spaceIndexKey = `space:${spaceId}`;
    const spaceIndex = this.searchIndices.get(spaceIndexKey);
    if (spaceIndex) {
      spaceIndex.removeById(messageId);
    }

    // Remove from DM index if applicable
    const conversationId = `${spaceId}/${channelId}`;
    const dmIndexKey = `dm:${conversationId}`;
    const dmIndex = this.searchIndices.get(dmIndexKey);
    if (dmIndex) {
      dmIndex.removeById(messageId);
    }
  }

  async searchMessages(
    query: string,
    context: SearchContext,
    limit: number = 50
  ): Promise<SearchResult[]> {
    if (!this.indexInitialized) {
      await this.initializeSearchIndices();
    }

    const indexKey = this.getIndexKey(context);
    const searchIndex = this.searchIndices.get(indexKey);

    if (!searchIndex) {
      return [];
    }

    const searchResults = searchIndex.search(query, {
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'OR',
    });

    // Get full message objects and create results
    const results: SearchResult[] = [];

    for (const result of searchResults.slice(0, limit)) {
      try {
        const message = await this.getMessage({
          spaceId: result.match?.spaceId?.[0] || (result as any).spaceId || '',
          channelId: result.match?.channelId?.[0] || (result as any).channelId || '',
          messageId: result.id,
        });

        if (message) {
          results.push({
            message,
            score: result.score,
            highlights: result.terms,
          });
        }
      } catch (error) {
        console.warn(
          'Failed to get message for search result:',
          result.id,
          error
        );
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}
