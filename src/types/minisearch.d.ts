declare module 'minisearch' {
  export interface SearchOptions {
    fields?: string[];
    prefix?: boolean;
    fuzzy?: boolean | number;
    combineWith?: 'AND' | 'OR';
    boost?: Record<string, number>;
    weights?: Record<string, number>;
  }

  export interface SearchResult {
    id: string;
    score: number;
    terms: string[];
    match: Record<string, string[]>;
    spaceId: string;
    channelId: string;
  }

  export interface AutoSuggestOptions {
    fields?: string[];
    prefix?: boolean;
    fuzzy?: boolean | number;
  }

  export interface Suggestion {
    suggestion: string;
    terms: string[];
    score: number;
  }

  export default class MiniSearch<T = Record<string, any>> {
    constructor(options: {
      fields: string[];
      idField?: string;
      storeFields?: string[];
      searchOptions?: SearchOptions;
      extractField?: (document: T, fieldName: string) => string;
      tokenize?: (text: string) => string[];
      processTerm?: (term: string) => string | null | undefined | false;
    });

    add(document: T): void;
    addAll(documents: T[]): void;
    addAllAsync(
      documents: T[],
      options?: { chunkSize?: number }
    ): Promise<void>;
    remove(document: T): void;
    removeById(id: string): void;
    removeAll(documents: T[]): void;
    search(query: string, options?: SearchOptions): SearchResult[];
    autoSuggest(query: string, options?: AutoSuggestOptions): Suggestion[];
    has(id: string): boolean;
    getStoredFields(id: string): Record<string, any> | undefined;
    discard(id: string): void;
    replace(document: T): void;
    toJSON(): string;
    static loadJSON(json: string, options: any): MiniSearch;
  }
}
