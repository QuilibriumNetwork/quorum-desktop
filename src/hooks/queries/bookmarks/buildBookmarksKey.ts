const buildBookmarksKey = ({ userAddress }: { userAddress: string }) => [
  'bookmarks',
  userAddress,
];

export { buildBookmarksKey };