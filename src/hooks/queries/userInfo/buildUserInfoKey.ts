const buildUserInfoKey = ({ address }: { address: string }) => [
  'UserInfo',
  address,
];

export { buildUserInfoKey };
