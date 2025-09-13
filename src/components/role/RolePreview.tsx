import React from 'react';
import { Role } from '../../api/quorumApi';
import { Text, Icon } from '../primitives';
import { t } from '@lingui/core/macro';

interface RolePreviewProps {
  role: Role;
}

export const RolePreview: React.FC<RolePreviewProps> = ({ role }) => {
  return (
    <div className="space-y-2 p-2">
      {/* Role name with icon */}
      <div className="flex items-center gap-2">
        <Icon name="star" size="xs" className="text-muted flex-shrink-0" />
        <Text variant="main" className="text-sm">
          {role.displayName}
        </Text>
      </div>

      {/* Member count */}
      <div className="flex items-center gap-2">
        <Icon name="users" size="xs" className="text-muted flex-shrink-0" />
        <Text variant="main" className="text-sm">
          {role.members?.length || 0} member{role.members?.length !== 1 ? 's' : ''}
        </Text>
      </div>

      {/* Permissions */}
      <div className="flex items-start gap-2">
        <Icon name="shield" size="xs" className="text-muted flex-shrink-0 mt-0.5" />
        <Text variant="main" className="text-sm">
          {t`Permissions:`}{' '}
          {role.permissions && role.permissions.length > 0 ? 
            role.permissions.map(permission => 
              permission.replace('_', ' ').toLowerCase()
            ).join(', ')
            : t`None`
          }
        </Text>
      </div>
    </div>
  );
};

export default RolePreview;