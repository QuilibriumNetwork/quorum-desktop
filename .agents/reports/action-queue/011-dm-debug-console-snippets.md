# DM Debug Console Snippets

> **⚠️ AI-Generated**: May contain errors. Verify before use.

A collection of browser console snippets for debugging DM delivery issues.

**Related**: [010-dm-registration-inbox-mismatch-fix.md](010-dm-registration-inbox-mismatch-fix.md) - Main bug report

---

## Quick Reference

| Snippet | Purpose | When to Use |
|---------|---------|-------------|
| [Identity Check](#1-identity-check) | Verify local device matches API | First step - always run this |
| [Sender Diagnostic](#2-sender-diagnostic) | Check encryption states vs API | On sender side before debugging |
| [Receiver Diagnostic](#3-receiver-diagnostic) | Check receiver's encryption state | On receiver side |
| [WebSocket Send Interceptor](#4-websocket-send-interceptor) | Log outgoing messages | Before sending a test message |
| [WebSocket Listen Interceptor](#5-websocket-listen-interceptor) | Log inbox subscriptions | To verify subscription logic |
| [Encryption State Watcher](#6-encryption-state-watcher) | Monitor state save/delete | During message send |
| [Delete Encryption States](#7-delete-encryption-states) | Force fresh session | When states are corrupted |
| [All Encryption States](#8-all-encryption-states) | List all states | For overview |
| [List IndexedDB Stores](#9-list-indexeddb-stores) | Discover DB structure | Initial exploration |
| [Dump Store Contents](#10-dump-store-contents) | Inspect any store | Deep debugging |
| [Search Messages by Address](#11-search-messages-by-address) | Find messages for user | Message investigation |

---

## Snippets

### 1. Identity Check

Verifies local device matches API registration. **Run on any user.**

```javascript
// === IDENTITY CHECK ===
const db = await new Promise(r => { const req = indexedDB.open('quorum_db'); req.onsuccess = () => r(req.result); });
const tx = db.transaction('user_config', 'readonly');
const store = tx.objectStore('user_config');
const config = await new Promise(r => { const req = store.getAll(); req.onsuccess = () => r(req.result); });
const myAddr = config[0]?.address;
const myInbox = window.__keyset?.deviceKeyset?.inbox_keyset?.inbox_address;

console.log('=== IDENTITY CHECK ===');
console.log('My user address:', myAddr);
console.log('My device inbox:', myInbox);

const resp = await fetch(`https://api.quorummessenger.com/users/${myAddr}`);
const data = await resp.json();
console.log('API device inboxes:', data.device_registrations?.map(d => d.inbox_registration?.inbox_address));
console.log('My inbox in API?', data.device_registrations?.some(d => d.inbox_registration?.inbox_address === myInbox) ? '✅ YES' : '❌ NO');
```

---

### 2. Sender Diagnostic

Checks sender's encryption state and compares to receiver's API registration. **Navigate to DM conversation first.**

```javascript
// === SENDER DIAGNOSTIC ===
const otherAddr = location.pathname.split('/messages/')[1]?.split('/')[0]
  || location.pathname.split('/dm/')[1]?.split('/')[0];
console.log('=== Sender Diagnostic for:', otherAddr, '===\n');

// 1. Fresh API data for receiver
const resp = await fetch(`https://api.quorummessenger.com/users/${otherAddr}`);
const apiData = await resp.json();
const apiInboxes = apiData.device_registrations?.map(d => d.inbox_registration?.inbox_address) || [];
console.log('1. Receiver API inboxes:', apiInboxes.length);
apiInboxes.forEach((i, idx) => console.log(`   [${idx}] ${i}`));

// 2. Sender's cached encryption states
const states = await window.__messageDB.getEncryptionStates({
  conversationId: `${otherAddr}/${otherAddr}`
});
console.log('\n2. Sender encryption states:', states.length);
states.forEach((s, i) => {
  const p = JSON.parse(s.state);
  console.log(`   [${i}] tag: ${p.tag}`);
  console.log(`       sending_inbox: ${p.sending_inbox?.inbox_address}`);
  console.log(`       receiving_inbox: ${p.receiving_inbox?.inbox_address}`);
});

// 3. Analysis
if (states.length === 0) {
  console.log('\n⚠️ No encryption states - first message will create session');
} else {
  const p = JSON.parse(states[0].state);
  const tagInApi = apiInboxes.includes(p.tag);
  console.log('\n3. Analysis:');
  console.log(`   tag in API? ${tagInApi ? '✅ YES' : '❌ NO - stale state!'}`);
  console.log(`   Will send to: ${p.sending_inbox?.inbox_address}`);
}
```

---

### 3. Receiver Diagnostic

Checks receiver's encryption state for the sender. **Navigate to DM conversation first.**

```javascript
// === RECEIVER DIAGNOSTIC ===
const otherAddr = location.pathname.split('/messages/')[1]?.split('/')[0]
  || location.pathname.split('/dm/')[1]?.split('/')[0];
const myInbox = window.__keyset?.deviceKeyset?.inbox_keyset?.inbox_address;
console.log('=== Receiver Diagnostic ===');
console.log('My device inbox:', myInbox);
console.log('Conversation with:', otherAddr, '\n');

// Receiver's encryption states for this sender
const states = await window.__messageDB.getEncryptionStates({
  conversationId: `${otherAddr}/${otherAddr}`
});
console.log('My encryption states for sender:', states.length);
states.forEach((s, i) => {
  const p = JSON.parse(s.state);
  console.log(`   [${i}] tag: ${p.tag}`);
  console.log(`       receiving_inbox: ${p.receiving_inbox?.inbox_address}`);
  console.log(`       sending_inbox: ${p.sending_inbox?.inbox_address}`);
});

// What inboxes can I receive on?
console.log('\nInboxes I can receive on:');
console.log('  - Device inbox:', myInbox);
states.forEach((s, i) => {
  const p = JSON.parse(s.state);
  if (p.receiving_inbox?.inbox_address) {
    console.log(`  - Ephemeral[${i}]: ${p.receiving_inbox.inbox_address}`);
  }
});
```

---

### 4. WebSocket Send Interceptor

Logs outgoing DM messages. **Run before sending a test message.**

```javascript
// === WEBSOCKET SEND INTERCEPTOR ===
const origSend = WebSocket.prototype.send;
WebSocket.prototype.send = function(data) {
  try {
    const msg = JSON.parse(data);
    if (msg.type === 'direct') {
      console.log('=== WS SEND DIRECT MESSAGE ===');
      console.log('To inbox:', msg.inbox_address);
      console.log('Payload size:', msg.payload?.length || 0);
      console.log('Has envelope:', !!msg.envelope);
      console.log('Timestamp:', new Date().toISOString());
    }
  } catch(e) {}
  return origSend.call(this, data);
};
console.log('Interceptor ready - send a message to see output');
```

---

### 5. WebSocket Listen Interceptor

Logs inbox subscription commands. **Run to verify what inboxes are being subscribed to.**

```javascript
// === WEBSOCKET LISTEN INTERCEPTOR ===
const origSend = WebSocket.prototype.send;
WebSocket.prototype.send = function(data) {
  try {
    const msg = JSON.parse(data);
    if (msg.type === 'listen') {
      console.log('=== WS LISTEN COMMAND ===');
      console.log('Subscribing to inboxes:', msg.inbox_addresses);
      console.log('Count:', msg.inbox_addresses?.length);
      console.log('Timestamp:', new Date().toISOString());
    }
  } catch(e) {}
  return origSend.call(this, data);
};
console.log('Listen interceptor ready');
```

---

### 6. Encryption State Watcher

Monitors save/delete operations on encryption states. **Run before sending.**

```javascript
// === ENCRYPTION STATE WATCHER ===
const origDelete = window.__messageDB.deleteEncryptionState;
window.__messageDB.deleteEncryptionState = async function(...args) {
  console.log('=== DELETE ENCRYPTION STATE ===', args);
  console.trace();
  return origDelete.apply(this, args);
};

const origSave = window.__messageDB.saveEncryptionState;
window.__messageDB.saveEncryptionState = async function(...args) {
  console.log('=== SAVE ENCRYPTION STATE ===', args[0]?.conversationId);
  return origSave.apply(this, args);
};
console.log('Watching encryption state operations...');
```

---

### 7. Delete Encryption States

Clears encryption states to force fresh session. **Run on BOTH sides, navigate to DM conversation first.**

```javascript
// === DELETE ENCRYPTION STATES (run on BOTH sides) ===
const otherAddr = location.pathname.split('/messages/')[1]?.split('/')[0]
  || location.pathname.split('/dm/')[1]?.split('/')[0];
const states = await window.__messageDB.getEncryptionStates({
  conversationId: `${otherAddr}/${otherAddr}`
});
for (const s of states) {
  await window.__messageDB.deleteEncryptionState(s);
}
console.log(`Deleted ${states.length} states for ${otherAddr}`);
```

---

### 8. All Encryption States

Lists all encryption states in IndexedDB.

```javascript
// === ALL ENCRYPTION STATES ===
const db = await new Promise(r => {
  const req = indexedDB.open('quorum_db');
  req.onsuccess = () => r(req.result);
});
const tx = db.transaction('encryption_states', 'readonly');
const store = tx.objectStore('encryption_states');
const all = await new Promise(r => {
  const req = store.getAll();
  req.onsuccess = () => r(req.result);
});
console.log('Total encryption states:', all.length);
all.forEach((s, i) => {
  console.log(`[${i}] ${s.conversationId}`);
});
```

---

### 9. List IndexedDB Stores

Discover all object stores in the database.

```javascript
// === LIST ALL INDEXEDDB STORES ===
const db = await new Promise(r => {
  const req = indexedDB.open('quorum_db');
  req.onsuccess = () => r(req.result);
});
console.log('=== quorum_db Object Stores ===');
console.log('Store count:', db.objectStoreNames.length);
Array.from(db.objectStoreNames).forEach((name, i) => {
  console.log(`[${i}] ${name}`);
});
```

---

### 10. Dump Store Contents

Dumps all records from a specific store. **Change `STORE_NAME` as needed.**

```javascript
// === DUMP STORE CONTENTS ===
const STORE_NAME = 'messages'; // Change: encryption_states, user_config, conversations, etc.
const db = await new Promise(r => {
  const req = indexedDB.open('quorum_db');
  req.onsuccess = () => r(req.result);
});
const tx = db.transaction(STORE_NAME, 'readonly');
const store = tx.objectStore(STORE_NAME);
const all = await new Promise(r => {
  const req = store.getAll();
  req.onsuccess = () => r(req.result);
});
console.log(`=== ${STORE_NAME} (${all.length} records) ===`);
console.log('First 5 records:', all.slice(0, 5));
console.log('Keys of first record:', all[0] ? Object.keys(all[0]) : 'empty');
```

---

### 11. Search Messages by Address

Find messages containing a specific user address.

```javascript
// === SEARCH MESSAGES BY ADDRESS ===
const SEARCH_ADDR = 'QmXXXXXX...'; // Replace with user address
const db = await new Promise(r => {
  const req = indexedDB.open('quorum_db');
  req.onsuccess = () => r(req.result);
});
const tx = db.transaction('messages', 'readonly');
const store = tx.objectStore('messages');
const all = await new Promise(r => {
  const req = store.getAll();
  req.onsuccess = () => r(req.result);
});
const matches = all.filter(m => JSON.stringify(m).includes(SEARCH_ADDR));
console.log(`Messages containing ${SEARCH_ADDR.slice(0,15)}...: ${matches.length}`);
matches.slice(0, 3).forEach((m, i) => {
  console.log(`[${i}]`, m);
});
```

---

### 12. Double Ratchet Desync Check

Cross-check ephemeral inboxes between sender and receiver. **Run on sender side.**

```javascript
// === DOUBLE RATCHET DESYNC CHECK ===
const otherAddr = location.pathname.split('/messages/')[1]?.split('/')[0]
  || location.pathname.split('/dm/')[1]?.split('/')[0];
const states = await window.__messageDB.getEncryptionStates({
  conversationId: `${otherAddr}/${otherAddr}`
});

console.log('=== DOUBLE RATCHET DESYNC CHECK ===');
console.log('Sender\'s ephemeral sending inboxes:');
states.forEach(s => {
  const parsed = JSON.parse(s.state);
  console.log(`  Device ${parsed.tag.slice(0, 20)}... → sends to ${parsed.sending_inbox?.inbox_address}`);
});

console.log('\n📋 Ask receiver to run this and compare:');
console.log(`window.__messageDB.getEncryptionStates({conversationId: "${otherAddr}/${otherAddr}"})`);
console.log('Check if any of their receiving_inbox matches sender\'s sending_inbox');
```

---

## IndexedDB Structure Reference

**Database name**: `quorum_db`

### Known Stores

| Store Name | Key Structure | Notes |
|------------|---------------|-------|
| `user_config` | `?` | Contains `address` field for current user |
| `encryption_states` | `conversationId` | Format: `{userAddr}/{userAddr}` for DMs |
| `messages` | `{spaceId, channelId, messageId}` | May NOT be where DMs are stored |
| `conversations` | `?` | Needs investigation |

### Encryption State Object Structure

```javascript
{
  conversationId: "QmXXX.../QmXXX...",  // DM format: otherUserAddr/otherUserAddr
  state: JSON.stringify({
    tag: "QmXXX...",                    // Receiver's device inbox (initial target)
    sending_inbox: {
      inbox_address: "QmXXX..."         // Ephemeral inbox for sending
    },
    receiving_inbox: {
      inbox_address: "QmXXX..."         // Ephemeral inbox for receiving replies
    }
  })
}
```

---

_Created: 2025-12-23_
_Updated: 2025-12-23 - Extracted from 011-dm-delivery-test-gattopardo-jennifer.md_
