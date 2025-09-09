import { useState, useCallback, useEffect } from 'react';
import { Role, Permission } from '../../../api/quorumApi';

export interface UseRoleManagementOptions {
  initialRoles?: Role[];
}

export interface UseRoleManagementReturn {
  roles: Role[];
  setRoles: (roles: Role[]) => void;
  addRole: () => void;
  deleteRole: (index: number) => void;
  updateRoleTag: (index: number, roleTag: string) => void;
  updateRoleDisplayName: (index: number, displayName: string) => void;
  toggleRolePermission: (index: number, permission: Permission) => void;
  updateRolePermissions: (index: number, permissions: Permission[]) => void;
}

export const useRoleManagement = (
  options: UseRoleManagementOptions = {}
): UseRoleManagementReturn => {
  const { initialRoles = [] } = options;
  const [roles, setRoles] = useState<Role[]>(initialRoles);

  // Update roles when initialRoles changes (e.g., when space data loads)
  useEffect(() => {
    setRoles(initialRoles);
  }, [initialRoles]);

  const addRole = useCallback(() => {
    const newRole: Role = {
      roleId: crypto.randomUUID(),
      roleTag: 'New Role' + (roles.length + 1),
      displayName: 'New Role',
      color: 'var(--success-hex)',
      members: [],
      permissions: [],
    };

    setRoles((prev) => [...prev, newRole]);
  }, [roles.length]);

  const deleteRole = useCallback((index: number) => {
    setRoles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateRoleTag = useCallback((index: number, roleTag: string) => {
    setRoles((prev) =>
      prev.map((role, i) => (i === index ? { ...role, roleTag } : role))
    );
  }, []);

  const updateRoleDisplayName = useCallback(
    (index: number, displayName: string) => {
      setRoles((prev) =>
        prev.map((role, i) => (i === index ? { ...role, displayName } : role))
      );
    },
    []
  );

  const toggleRolePermission = useCallback(
    (index: number, permission: Permission) => {
      setRoles((prev) =>
        prev.map((role, i) => {
          if (i !== index) return role;

          const hasPermission = role.permissions.includes(permission);
          const newPermissions = hasPermission
            ? role.permissions.filter((p) => p !== permission)
            : [...role.permissions, permission];

          return { ...role, permissions: newPermissions };
        })
      );
    },
    []
  );

  const updateRolePermissions = useCallback(
    (index: number, permissions: Permission[]) => {
      setRoles((prev) =>
        prev.map((role, i) => {
          if (i !== index) return role;
          return { ...role, permissions };
        })
      );
    },
    []
  );

  return {
    roles,
    setRoles,
    addRole,
    deleteRole,
    updateRoleTag,
    updateRoleDisplayName,
    toggleRolePermission,
    updateRolePermissions,
  };
};
