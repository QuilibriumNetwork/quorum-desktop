/**
 * Delivery & Read Receipt Types
 *
 * DeliveryAckMessage and ReadAckMessage are CONTROL messages — NOT part of the
 * MessageContent union. Intercepted at the decrypt layer before
 * saveMessage/addMessage pipeline.
 * Lives here locally; migrates to quorum-shared once stable.
 */

export type DeliveryAckMessage = {
  senderId: string;
  type: 'delivery-ack';
  messageIds: string[];
};

export type ReadAckMessage = {
  senderId: string;
  type: 'read-ack';
  upToMessageId: string;
  upToTimestamp: number;
};

/**
 * Extended message fields for delivery and read receipts.
 * ackMessageIds: envelope-level piggybacked delivery ack data (stripped before persistence)
 * readAckUpTo: envelope-level piggybacked read ack data (stripped before persistence)
 * deliveredAt: timestamp when sender processed the incoming delivery ack (persisted)
 * readAt: timestamp when sender processed the incoming read ack (persisted)
 */
export type DeliveryReceiptMessageExtensions = {
  ackMessageIds?: string[];
  deliveredAt?: number;
  readAckUpTo?: { messageId: string; timestamp: number };
  readAt?: number;
};

import type { Message } from '@quilibrium/quorum-shared';
export type MessageWithDelivery = Message & DeliveryReceiptMessageExtensions;
