import React from 'react';
import { Container, Text, Button, Icon, Title, Paragraph, FlexRow, FlexColumn } from './primitives';
import {
  AuthScreenWrapper,
  AuthSpacer,
  AUTH_LAYOUT,
} from './onboarding/OnboardingStyles.native';
import { t } from '@lingui/core/macro';

export const Maintenance = () => {
  const handleRefresh = () => {
    // TODO: Add proper refresh logic for React Native
    console.log('Refresh requested');
  };

  return (
    <AuthScreenWrapper>
        <AuthSpacer />
        
        {/* Content Container with reduced gaps */}
        <FlexRow justify="center">
          <Container 
            width="full"
            maxWidth={AUTH_LAYOUT.MAX_CONTENT_WIDTH}
            padding={AUTH_LAYOUT.PADDING}
          >
            <FlexColumn gap="sm" align="center">
              {/* Icon Section - large and above title */}
              <Icon name="tools" size="2xl" color="white" />
              
              {/* Title Section */}
              <Title size="xl" align="center" color="white">
                {t`Maintenance in Progress`}
              </Title>

              {/* Message Section - First Paragraph */}
              <Paragraph color="white" align="center">
                {t`Quorum infrastructure is being deployed at this time. Please try refreshing.`}
              </Paragraph>

              {/* Message Section - Second Paragraph with link */}
              <Paragraph color="white" align="center">
                {t`Check `}
                <Text 
                  href="https://status.quilibrium.com/"
                  linkStyle="simple"
                  color="white"
                  size="base"
                >
                  https://status.quilibrium.com/
                </Text>
                {t` for updates.`}
              </Paragraph>

              {/* Space before button */}
              <Container style={{ height: 16 }} />

              {/* Refresh Button Section */}
              <Button
                type="secondary-white"
                fullWidthWithMargin
                onClick={handleRefresh}
              >
                {t`Refresh`}
              </Button>
            </FlexColumn>
          </Container>
        </FlexRow>

        <AuthSpacer />
      </AuthScreenWrapper>
  );
};
