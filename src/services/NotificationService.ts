import { logger } from '@quilibrium/quorum-shared';
import { t } from '@lingui/core/macro';
/**
 * Desktop Notification Service for Quorum
 * Handles browser notifications with proper permission management
 * and Safari compatibility (no icon support)
 */

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
}

export class NotificationService {
  private static instance: NotificationService;
  private isSupported: boolean;
  private permission: NotificationPermission;
  private readonly quorumIcon = '/quorumicon-blue.png';

  private constructor() {
    this.isSupported = 'Notification' in window;
    this.permission = this.isSupported ? Notification.permission : 'denied';
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Check if notifications are supported by the browser
   */
  public isNotificationSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Get current notification permission status
   */
  public getPermissionStatus(): NotificationPermission {
    return this.permission;
  }

  /**
   * Request notification permission from the user
   * Should only be called in response to user interaction
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      logger.warn(t`Notifications are not supported in this browser`);
      return 'denied';
    }

    try {
      // Use promise-based version with fallback to callback for older browsers
      const permission = await new Promise<NotificationPermission>(
        (resolve) => {
          const result = Notification.requestPermission((result) => {
            resolve(result);
          });

          // Handle promise-based version
          if (result && typeof result.then === 'function') {
            result.then(resolve);
          }
        }
      );

      this.permission = permission;
      return permission;
    } catch (error) {
      console.error(t`Error requesting notification permission:`, error);
      return 'denied';
    }
  }

  /**
   * Check if Safari browser (which doesn't support notification icons)
   */
  private isSafari(): boolean {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }

  /**
   * Show a notification for unread messages
   */
  public showUnreadMessagesNotification(
    unreadCount: number
  ): Notification | null {
    if (!this.canShowNotifications()) {
      return null;
    }

    const title = 'Quorum';
    const body =
      unreadCount === 1
        ? t`You have a new unread message`
        : t`You have new unread messages`;

    const options: any = {
      body,
      tag: 'quorum-unread-messages', // Replace existing notifications with same tag
      requireInteraction: false,
      silent: false,
    };

    // Only add icon if not Safari (Safari doesn't support notification icons)
    if (!this.isSafari()) {
      options.icon = this.quorumIcon;
    }

    try {
      const notification = new Notification(title, options);

      // Auto-close notification after 5 seconds if browser doesn't do it automatically
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Add click handler to focus the app
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error(t`Error showing notification:`, error);
      return null;
    }
  }

  /**
   * Show a custom notification
   */
  public showNotification(options: NotificationOptions): Notification | null {
    if (!this.canShowNotifications()) {
      return null;
    }

    const notificationOptions: any = {
      body: options.body,
      tag: options.tag,
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false,
      icon: options.icon,
    };

    try {
      const notification = new Notification(options.title, notificationOptions);

      // Auto-close notification after 5 seconds if browser doesn't do it automatically
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Add click handler to focus the app
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error(t`Error showing notification:`, error);
      return null;
    }
  }

  /**
   * Check if we can show notifications
   */
  private canShowNotifications(): boolean {
    if (!this.isSupported) {
      logger.warn(t`Notifications are not supported in this browser`);
      return false;
    }

    if (this.permission !== 'granted') {
      logger.warn(t`Notification permission not granted`);
      return false;
    }

    // Check if page is visible - don't show notifications if user is actively using the app
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      return false;
    }

    return true;
  }

  /**
   * Clear all notifications with a specific tag
   */
  public clearNotifications(tag: string): void {
    // Note: There's no direct way to clear notifications by tag in the Web API
    // This is a placeholder for potential future functionality or service worker integration
    logger.log(t`Clearing notifications with tag: ${tag}`);
  }

  /**
   * Check if permission needs to be requested (not granted and not denied)
   */
  public shouldRequestPermission(): boolean {
    return this.isSupported && this.permission === 'default';
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();
