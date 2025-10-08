type Deps = {
  spaceService: any;
  queryClient: any;
};

export function createKickUserHandler(deps: Deps) {
  const { spaceService, queryClient } = deps;

  return async function handleKickUser(context: {
    spaceId: string;
    userAddress: string;
    userKeyset: any;
    deviceKeyset: any;
    registration: any;
  }) {
    await spaceService.kickUser(
      context.spaceId,
      context.userAddress,
      context.userKeyset,
      context.deviceKeyset,
      context.registration,
      queryClient
    );
  };
}


