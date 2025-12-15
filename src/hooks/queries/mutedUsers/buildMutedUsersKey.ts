const buildMutedUsersKey = ({ spaceId }: { spaceId: string }) => [
  'mutedUsers',
  spaceId,
];

export { buildMutedUsersKey };
