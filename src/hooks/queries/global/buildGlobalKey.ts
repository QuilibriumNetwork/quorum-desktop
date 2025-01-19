const buildGlobalKey = ({ address }: { address: string }) => [
  'Global',
  address,
];

export { buildGlobalKey };
