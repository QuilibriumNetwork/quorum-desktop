type Deps = {
  configService: any;
};

export function createSaveUserConfigHandler(deps: Deps) {
  const { configService } = deps;

  return async function handleSaveUserConfig(context: {
    config: any;
    keyset: any;
  }) {
    await configService.saveConfig(context);
  };
}


