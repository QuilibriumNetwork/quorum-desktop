const buildLocalizationKey = ({ langId }: { langId: string }) => [
  'localization',
  langId,
];

export { buildLocalizationKey };
