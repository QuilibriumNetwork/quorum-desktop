/**
 * Delivery Receipt Types
 *
 * DeliveryAckMessage is a CONTROL message — NOT part of the MessageContent union.
 * Intercepted at the decrypt layer before saveMessage/addMessage pipeline.
 * Lives here locally; migrates to quorum-shared once stable.
 */

export type DeliveryAckMessage = {
  senderId: string;
  type: 'delivery-ack';
  messageIds: string[];
};

/**
 * Extended message fields for delivery receipts.
 * ackMessageIds: envelope-level piggybacked ack data (stripped before persistence)
 * deliveredAt: timestamp when sender processed the incoming ack (persisted to IndexedDB)
 */
export type DeliveryReceiptMessageExtensions = {
  ackMessageIds?: string[];
  deliveredAt?: number;
};

/**
 * Local extended Message type with delivery receipt fields.
 * quorum-shared's Message is a `type` alias (not an interface), so declaration
 * merging won't work. Instead, we create a local intersection type and use it
 * wherever delivery receipt fields are accessed (DB method, UI component, ack
 * processing). Once stable, these fields migrate into quorum-shared's Message.
 */
import type { Message } from '@quilibrium/quorum-shared';
export type MessageWithDelivery = Message & DeliveryReceiptMessageExtensions;
