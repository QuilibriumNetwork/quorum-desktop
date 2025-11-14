import { useCallback, useState } from 'react';
import { useMessageDB } from '../../../components/context/useMessageDB';

export const useUserRoleManagement = (spaceId?: string) => {
  const { updateSpace, messageDB } = useMessageDB();
  const [loadingRoles, setLoadingRoles] = useState<Set<string>>(new Set());

  const addRole = useCallback(
    async (userAddress: string, roleId: string) => {
      if (!spaceId) return;

      setLoadingRoles((prev) => new Set(prev).add(roleId));
      try {
        const space = await messageDB.getSpace(spaceId);
        if (!space) return;

        await updateSpace({
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
      } finally {
        setLoadingRoles((prev) => {
          const next = new Set(prev);
          next.delete(roleId);
          return next;
        });
      }
    },
    [messageDB, updateSpace, spaceId]
  );

  const removeRole = useCallback(
    async (userAddress: string, roleId: string) => {
      if (!spaceId) return;

      setLoadingRoles((prev) => new Set(prev).add(roleId));
      try {
        const space = await messageDB.getSpace(spaceId);
        if (!space) return;

        await updateSpace({
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
      } finally {
        setLoadingRoles((prev) => {
          const next = new Set(prev);
          next.delete(roleId);
          return next;
        });
      }
    },
    [messageDB, updateSpace, spaceId]
  );

  return {
    addRole,
    removeRole,
    loadingRoles,
  };
};
