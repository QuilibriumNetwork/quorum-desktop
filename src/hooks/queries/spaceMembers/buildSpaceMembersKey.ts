const buildSpaceMembersKey = ({ spaceId }: { spaceId: string }) => [
  'SpaceMembers',
  spaceId,
];

export { buildSpaceMembersKey };
