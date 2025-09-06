import { useCallback } from 'react';
import { useMessageDB } from '../../../components/context/useMessageDB';

export const useUserRoleManagement = (spaceId?: string) => {
  const { updateSpace, messageDB } = useMessageDB();

  const addRole = useCallback(
    async (userAddress: string, roleId: string) => {
      if (!spaceId) return;

      const space = await messageDB.getSpace(spaceId);
      if (!space) return;

      updateSpace({
        ...space,
        roles: space.roles.map((r) => {
          return r.roleId === roleId
            ? {
                ...r,
                members: [
                  ...r.members.filter((m) => m !== userAddress),
                  userAddress,
                ],
              }
            : r;
        }),
      });
    },
    [messageDB, updateSpace, spaceId]
  );

  const removeRole = useCallback(
    async (userAddress: string, roleId: string) => {
      if (!spaceId) return;

      const space = await messageDB.getSpace(spaceId);
      if (!space) return;

      updateSpace({
        ...space,
        roles: space.roles.map((r) => {
          return r.roleId === roleId
            ? {
                ...r,
                members: [...r.members.filter((m) => m !== userAddress)],
              }
            : r;
        }),
      });
    },
    [messageDB, updateSpace, spaceId]
  );

  return {
    addRole,
    removeRole,
  };
};
