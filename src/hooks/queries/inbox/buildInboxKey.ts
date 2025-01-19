const buildInboxKey = ({ addresses }: { addresses: string[] }) => [
  'Inbox',
  ...addresses,
];

export { buildInboxKey };
