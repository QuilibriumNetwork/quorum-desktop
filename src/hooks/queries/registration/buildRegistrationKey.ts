const buildRegistrationKey = ({ address }: { address: string }) => [
  'Registration',
  address,
];

export { buildRegistrationKey };
