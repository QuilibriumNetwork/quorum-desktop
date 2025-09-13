import { useState, useCallback, useEffect } from 'react';
import React from 'react';
import { Role, Permission } from '../../../api/quorumApi';
import { useConfirmation } from '../../ui/useConfirmation';
import RolePreview from '../../../components/role/RolePreview';
import { t } from '@lingui/core/macro';

export interface UseRoleManagementOptions {
  initialRoles?: Role[];
}

export interface UseRoleManagementReturn {
  roles: Role[];
  setRoles: (roles: Role[]) => void;
  addRole: () => void;
  deleteRole: (e: React.MouseEvent, index: number) => void;
  updateRoleTag: (index: number, roleTag: string) => void;
  updateRoleDisplayName: (index: number, displayName: string) => void;
  toggleRolePermission: (index: number, permission: Permission) => void;
  updateRolePermissions: (index: number, permissions: Permission[]) => void;
  deleteConfirmation: {
    showModal: boolean;
    setShowModal: (show: boolean) => void;
    modalConfig?: any;
  };
}

export const useRoleManagement = (
  options: UseRoleManagementOptions = {}
): UseRoleManagementReturn => {
  const { initialRoles = [] } = options;
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [roleToDelete, setRoleToDelete] = useState<{ role: Role; index: number } | null>(null);

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

  // Confirmation hook for role delete action
  const deleteConfirmation = useConfirmation({
    type: 'modal',
    enableShiftBypass: false, // Disable shift bypass for role deletion
    modalConfig: roleToDelete ? {
      title: t`Delete Role`,
      message: t`Are you sure you want to delete this role?`,
      preview: React.createElement(RolePreview, { role: roleToDelete.role }),
      confirmText: t`Delete`,
      cancelText: t`Cancel`,
      variant: 'danger',
    } : undefined,
  });

  const deleteRole = useCallback((e: React.MouseEvent, index: number) => {
    const role = roles[index];
    setRoleToDelete({ role, index });
    
    const performDelete = () => {
      setRoles((prev) => prev.filter((_, i) => i !== index));
      setRoleToDelete(null);
    };
    
    deleteConfirmation.handleClick(e, performDelete);
  }, [roles, deleteConfirmation]);

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
    deleteConfirmation,
  };
};
