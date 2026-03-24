---
type: task
title: "Hierarchical receipt toggle UX — nest read under delivery"
status: open
complexity: low
ai_generated: true
created: 2026-03-24
updated: 2026-03-24
related_docs:
  - .agents/docs/features/messages/dm-receipts.md
  - .agents/docs/features/messages/dm-delivery-receipts-design.md
---

# Hierarchical receipt toggle UX — nest read under delivery

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Files**:
- `src/components/modals/ConversationSettingsModal.tsx` — per-conversation receipt toggles
- `src/components/modals/UserSettingsModal/Privacy.tsx:215-252` — global receipt toggles
- `src/components/direct/DirectMessage.tsx:149-153` — effective value resolution (service-layer guard)

## What & Why

Read receipts logically depend on delivery receipts — a message that has been read was necessarily delivered. Currently the two toggles are independent, allowing a contradictory state: read ON + delivery OFF. This task makes the dependency visually explicit by nesting the read receipts toggle under delivery receipts, disabling it when delivery is off. This prevents user confusion while preserving both privacy controls.

Follows the pattern used by Android sub-settings (e.g., notification categories under a master toggle).

## Design Decisions

### No reverse cascade
The read toggle is disabled when delivery is OFF, so users *must* turn delivery ON before they can interact with read. This makes an auto-cascade (read ON → delivery ON) unnecessary and avoids surprise metadata egress — important for a privacy-first messenger. Two deliberate clicks are safer than one click that silently enables a second feature.

### "Reset to global" cascade rules
When delivery is **"Reset to global"** (`undefined`): also reset read to `undefined`. Both follow global.
When delivery is **explicitly toggled OFF** (`false`): set read to explicit `false`. An explicit override on one requires an explicit override on the other.

### Display clamping when disabled
When the read toggle is disabled (delivery effectively OFF), always display it as OFF regardless of stored value. A dimmed ON toggle would be contradictory — the user would see "on" but the feature is inactive.

### Protocol vs UI distinction
The protocol still tolerates `read ON + delivery OFF` (a read ack backfills `deliveredAt`). Only the settings UI enforces the hierarchy. This distinction matters for future mobile/protocol implementors.

## Implementation

### 1. Service-layer guard in DirectMessage.tsx

Add a normalization guard when computing effective values. This closes the gap for pre-existing data, backup restores, and any code path that writes config without going through the UI:

```typescript
const effectiveDeliveryReceipts = conversation?.conversation?.deliveryReceipts ?? cfg?.deliveryReceipts ?? false;
const effectiveReadReceipts = effectiveDeliveryReceipts
  ? (conversation?.conversation?.readReceipts ?? cfg?.readReceipts ?? false)
  : false;
```

### 2. ConversationSettingsModal — per-conversation toggles

- **Indent the read receipts toggle** under delivery receipts (add left padding/margin, e.g., `ml-6` or `pl-6`)
- **Disable read receipts when delivery is OFF**: add `disabled` state to the read receipts `Switch` when effective delivery value (`convDeliveryReceipts ?? globalDeliveryReceipts`) is `false`
- **Display clamping**: when disabled, show value as `false` regardless of stored state (not `convReadReceipts ?? globalReadReceipts`)
- **Visual dimming**: when disabled, the read receipts row should have reduced opacity (e.g., `opacity-50`)
- **Cascade on delivery OFF**: when delivery is explicitly toggled OFF, set `convReadReceipts` to `false`
- **Cascade on delivery "Reset to global"**: when delivery is reset to `undefined`, also reset `convReadReceipts` to `undefined`
- **No reverse cascade**: read toggle is disabled when delivery is OFF, so no auto-enable of delivery needed

### 3. Privacy.tsx — global toggles

Same pattern:

- **Indent the read receipts toggle** under delivery receipts (`ml-6` or `pl-6`)
- **Disable read receipts `Switch`** when `deliveryReceipts` is `false`
- **Display clamping**: when disabled, show value as `false`
- **Visual dimming**: reduced opacity on the read receipts row when disabled
- **Auto-cascade**: `setDeliveryReceipts(false)` should also call `setReadReceipts(false)`
- **No reverse cascade**: read toggle is already non-interactive when delivery is OFF

### 4. Update dm-receipts.md doc

The Privacy Model section currently states:
> "Toggle independence: readReceipts ON + deliveryReceipts OFF is valid."

Update to clarify: the *protocol* still accepts this combination (a read ack backfills `deliveredAt`), but the *settings UI* now enforces a hierarchy where read requires delivery to be enabled. The service layer also normalizes: if delivery is OFF, read is forced OFF regardless of stored config.

## Verification

✅ **Delivery OFF disables read**
   - Toggle delivery OFF → read toggle becomes disabled + dimmed + shows OFF
   - Cannot interact with read toggle while delivery is OFF

✅ **Turning delivery OFF cascades to read**
   - Set both ON → toggle delivery OFF → read also turns OFF

✅ **Read toggle requires delivery ON first**
   - Both OFF → read toggle is disabled → must turn delivery ON first → then read becomes interactive

✅ **Per-conversation overrides work independently of global**
   - Global: both ON → Conversation: delivery OFF → read is disabled in conversation settings

✅ **Reset to global cascades correctly**
   - Conversation has both overridden → click "Reset to global" on delivery → read also resets to global
   - If global delivery is ON, read toggle re-enables
   - If global delivery is OFF, read toggle stays disabled

✅ **Display clamping prevents contradictory visual**
   - Stored read=true but delivery effectively OFF → toggle displays as OFF (dimmed)

✅ **Service-layer guard catches pre-existing data**
   - User had read ON + delivery OFF from before this change → on next conversation open, effective read resolves to false

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

## Definition of Done
- [x] Service-layer guard in DirectMessage.tsx (read forced OFF when delivery OFF)
- [x] Read toggle nested under delivery in ConversationSettingsModal
- [x] Read toggle nested under delivery in Privacy.tsx
- [x] Disabled + dimmed + display-clamped when delivery is OFF
- [x] Auto-cascade: delivery OFF → read OFF (both explicit and reset-to-global)
- [x] No reverse cascade (read cannot be toggled when delivery is OFF)
- [x] dm-receipts.md updated (protocol vs UI distinction)
- [x] TypeScript passes
- [ ] Manual testing successful

---

*Updated: 2026-03-24*
