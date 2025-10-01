import { useState, useEffect } from 'react';
import { notificationService } from '../../../services/NotificationService';

export interface UseNotificationSettingsReturn {
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  handleNotificationToggle: () => Promise<void>;
  isNotificationSupported: boolean;
  permissionStatus: NotificationPermission;
  showRevokeMessage: boolean;
}

export const useNotificationSettings = (): UseNotificationSettingsReturn => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    notificationService.getPermissionStatus() === 'granted'
  );
  const [showRevokeMessage, setShowRevokeMessage] = useState(false);

  const handleNotificationToggle = async () => {
    if (!notificationService.isNotificationSupported()) {
      // Show some feedback that notifications aren't supported
      return;
    }

    const currentStatus = notificationService.getPermissionStatus();

    if (currentStatus === 'granted') {
      // Can't revoke permission programmatically, show message to user
      setShowRevokeMessage(true);
      // Hide the message after 5 seconds
      setTimeout(() => setShowRevokeMessage(false), 5000);
      return;
    }

    // For 'default' or 'denied' status, try to request permission
    // Some browsers allow re-requesting even after denial
    const permission = await notificationService.requestPermission();
    setNotificationsEnabled(permission === 'granted');

    // The error messages will be shown by the conditional rendering below
    // No need for alerts that interrupt the UX
  };

  // Refresh notification permission status when modal opens or focus returns
  useEffect(() => {
    const checkNotificationStatus = () => {
      const currentStatus = notificationService.getPermissionStatus();
      setNotificationsEnabled(currentStatus === 'granted');
    };

    // Check immediately when component mounts
    checkNotificationStatus();

    // Check when focus returns to the page (in case user changed browser settings)
    window.addEventListener('focus', checkNotificationStatus);
    document.addEventListener('visibilitychange', checkNotificationStatus);

    return () => {
      window.removeEventListener('focus', checkNotificationStatus);
      document.removeEventListener('visibilitychange', checkNotificationStatus);
    };
  }, []);

  return {
    notificationsEnabled,
    setNotificationsEnabled,
    handleNotificationToggle,
    isNotificationSupported: notificationService.isNotificationSupported(),
    permissionStatus: notificationService.getPermissionStatus(),
    showRevokeMessage,
  };
};
