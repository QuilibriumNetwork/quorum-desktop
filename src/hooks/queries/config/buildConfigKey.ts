const buildConfigKey = ({ userAddress }: { userAddress: string }) => [
  'Config',
  userAddress,
];

export { buildConfigKey };
