import { MessageDB } from '../../../db/messages';

const buildBookmarksFetcher =
  ({ messageDB }: { messageDB: MessageDB }) =>
  async () => {
    const bookmarks = await messageDB.getBookmarks();
    return bookmarks;
  };

export { buildBookmarksFetcher };