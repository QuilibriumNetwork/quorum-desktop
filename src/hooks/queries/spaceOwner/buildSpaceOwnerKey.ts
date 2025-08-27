const buildSpaceOwnerKey = ({ spaceId }: { spaceId: string }) => [
  'SpaceOwner',
  spaceId,
];

export { buildSpaceOwnerKey };
