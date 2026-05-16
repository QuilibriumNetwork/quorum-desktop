const buildUserNoteKey = ({ targetAddress }: { targetAddress: string }) => [
  'userNote',
  targetAddress,
];

export { buildUserNoteKey };
