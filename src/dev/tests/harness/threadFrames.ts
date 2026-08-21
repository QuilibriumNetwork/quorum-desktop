// Building blocks for scenarios that send thread frames a well-behaved client
// cannot produce.
//
// Extracted so the two thread scenarios share ONE copy of the sealing helper.
// The fingerprint below has to match what the RECEIVER feeds to
// `buildMessageFingerprint`, exactly; a second copy that drifted out of step
// would produce frames refused for a signature reason having nothing to do with
// the property under test, and the scenario would pass while testing nothing.
// That is the specific trap this area has already sprung twice.
import { channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';
import {
  canonicalize,
  type Message,
  type ThreadMessage,
} from '@quilibrium/quorum-shared';

/** The thread id the app derives from a root message — see Channel.tsx. */
export async function threadIdFor(messageId: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(messageId + ':thread')
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build a space `Message` around a thread payload exactly as the honest send
 * path builds it, then sign it with `signing`.
 *
 * The fingerprint uses `content.senderId` because that is what the RECEIVER
 * feeds to `buildMessageFingerprint`. Keeping them equal is what makes a forged
 * frame internally consistent rather than merely malformed — a malformed frame
 * would be dropped early and would prove nothing.
 *
 * Note there is no space/channel scope in the digest: `thread` is signature-
 * required but NOT one of the frozen `CONTROL_MESSAGE_TYPES`, and only those
 * bind scope. See `messageAuth.ts`.
 */
export async function sealThreadFrame(params: {
  spaceId: string;
  channelId: string;
  thread: ThreadMessage;
  signing: { publicKey: string; privateKey: string };
}): Promise<Message> {
  const { spaceId, channelId, thread, signing } = params;
  const nonce = crypto.randomUUID();
  const digest = await crypto.subtle.digest(
    'SHA-256',
    Buffer.from(
      nonce + 'thread' + thread.senderId + canonicalize(thread as never),
      'utf-8'
    )
  );
  return {
    spaceId,
    channelId,
    messageId: Buffer.from(digest).toString('hex'),
    digestAlgorithm: 'SHA-256',
    nonce,
    createdDate: Date.now(),
    modifiedDate: Date.now(),
    lastModifiedHash: '',
    content: thread,
    publicKey: signing.publicKey,
    signature: Buffer.from(
      JSON.parse(
        ch.js_sign_ed448(
          Buffer.from(signing.privateKey, 'hex').toString('base64'),
          Buffer.from(digest).toString('base64')
        )
      ),
      'base64'
    ).toString('hex'),
    reactions: [],
  } as unknown as Message;
}
