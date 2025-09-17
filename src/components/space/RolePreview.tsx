import React from 'react';
import { Role } from '../../api/quorumApi';
import { Container, Text, Icon, FlexRow, FlexColumn, Spacer } from '../primitives';
import { t } from '@lingui/core/macro';

interface RolePreviewProps {
  role: Role;
}

export const RolePreview: React.FC<RolePreviewProps> = ({ role }) => {
  return (
    <Container padding="sm" backgroundColor="var(--color-bg-chat)">
      <FlexColumn gap="sm">
        {/* Role name with icon */}
        <FlexRow align="center" gap="xs">
          <Icon name="star" size="xs" />
          <Text variant="main" size="sm">
            {role.displayName}
          </Text>
        </FlexRow>
        
        {/* Member count */}
        <FlexRow align="center" gap="xs">
          <Icon name="users" size="xs" />
          <Text variant="main" size="sm">
            {role.members?.length || 0} member{role.members?.length !== 1 ? 's' : ''}
          </Text>
        </FlexRow>

        {/* Permissions */}
        <FlexRow align="start" gap="xs">
          <Icon name="shield" size="xs" style={{ marginTop: 2 }} />
          <Text variant="main" size="sm">
            {t`Permissions:`}{' '}
            {role.permissions && role.permissions.length > 0 ?
              role.permissions.map(permission =>
                permission.replace('_', ' ').toLowerCase()
              ).join(', ')
              : t`None`
            }
          </Text>
        </FlexRow>
      </FlexColumn>
    </Container>
  );
};

export default RolePreview;