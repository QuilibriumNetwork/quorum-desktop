# Public Space Directory Feature

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> Reviewed by feature-analyzer agent.

A technical proposal for implementing a discoverable public space directory in Quorum.

**Created**: 2025-12-30
**Status**: Proposal (Requires Backend API Support)
**Security Review**: 2025-12-30 (Critical issues identified and addressed)

---

## Overview

This document outlines the technical requirements for implementing a **Public Space Directory** - a feature that allows Space owners to list their Spaces publicly, enabling users to discover and join Spaces without needing a direct invite link.

### Current State

- Spaces have an `isPublic: boolean` flag (defined in `src/api/quorumApi.ts:41`)
- This flag currently controls whether invite links are "directly joinable" vs requiring manual approval
- There is **no discovery mechanism** - users must have an invite link to find a Space
- All Space discovery is invite-link based via `JoinSpaceModal`

### Proposed Feature

A browsable directory where:
1. Space owners can **opt-in** to list their Space publicly
2. Users can **browse/search** for public Spaces
3. Users can **join** directly from the directory (using existing invite flow)

---

## Architecture Context

### Quorum's Decentralized vs Coordination Layers

Quorum operates on a **decentralized network**, but uses a **coordination API** for certain operations. Understanding this distinction is important for the directory feature:

| Layer | Purpose | Examples |
|-------|---------|----------|
| **Decentralized (Hubs)** | Message routing, encryption, membership | Space messages, DMs, Triple Ratchet sessions |
| **Coordination API** | Metadata indexing, user registration, discovery | User registration, space manifests, invite evals, config sync |

**The Public Space Directory is a coordination API feature**, not a decentralized protocol. This is intentional:

- Directory listings are **public metadata** that owners opt-in to share
- The coordination API already stores space manifests and handles invite evaluations
- Discovery requires aggregated, searchable data - inherently centralized
- Privacy-sensitive data (messages, keys) remain fully decentralized

> **Reference**: See [Data Management Architecture](../docs/data-management-architecture-guide.md) and [Cryptographic Architecture](../docs/cryptographic-architecture.md) for details on Quorum's architecture.

---

## Technical Architecture

### Current Relevant Systems

#### 1. Space Data Model (`src/api/quorumApi.ts`)

```typescript
export type Space = {
  spaceId: string;
  spaceName: string;
  description?: string;           // Already exists for directory listings
  vanityUrl: string;
  inviteUrl: string;              // Public invite URL when enabled
  iconUrl: string;
  bannerUrl: string;
  defaultChannelId: string;
  hubAddress: string;
  createdDate: number;
  modifiedDate: number;
  isRepudiable: boolean;
  isPublic: boolean;              // Exists but not used for discovery
  // ...
};
```

#### 2. Space Creation (`src/services/SpaceService.ts`)

- `createSpace()` accepts `isPublic: boolean` parameter (line 127)
- Currently only affects invite link behavior, not discoverability

#### 3. Invite System (`src/services/InvitationService.ts`)

- `generateNewInviteLink()` creates public invite links with `configKey`
- Public invite format: `https://qm.one/invite/#spaceId={id}&configKey={key}`
- `configKey` is the X448 private key needed to decrypt the Space manifest

#### 4. API Endpoints (`src/api/baseTypes.ts`)

Current relevant endpoints:
| Endpoint | Purpose |
|----------|---------|
| `GET /space/{address}` | Get space registration |
| `GET /space/{address}/manifest` | Get encrypted space manifest |
| `POST /space/{address}` | Register/update space |
| `POST /invite/evals` | Store public invite evaluations |
| `POST /invite/eval` | Consume one invite evaluation |

#### 5. Authentication Pattern

All API requests use:
- **Signature-based auth**: Owner signs payloads with Ed448 keys
- **Timestamp binding**: Prevents replay attacks
- **Public key verification**: Server verifies signatures

Example from `SpaceService.ts:178-189`:
```typescript
const ownerPayload = Buffer.from(
  new Uint8Array([
    ...hexToSpreadArray(spaceKey.publicKey),
    ...configPair.public_key,
    ...hexToSpreadArray(ownerKey.publicKey),
    ...int64ToBytes(ts),
  ])
).toString('base64');

const ownerSignature = JSON.parse(
  ch.js_sign_ed448(
    Buffer.from(ownerKey.privateKey, 'hex').toString('base64'),
    ownerPayload
  )
);
```

---

## Proposed API Endpoints

> **Authentication**: All directory endpoints require user authentication (signed request with user address). Users must be logged into Quorum to access the directory - there is no anonymous browsing. This enables per-user rate limiting and ensures one rating per user per space.

### 1. List Public Spaces

```
GET /api/spaces/public
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search in name/description |
| `category` | string | Filter by category (e.g., `gaming`, `technology`) |
| `sort` | string | `newest`, `top-rated`, `popular`, `name` |
| `limit` | number | Max results (default 50, max 100) |
| `cursor` | string | Pagination cursor from previous response |

**Sort Options:**
- `newest` - By listedAt descending (default)
- `top-rated` - By averageRating descending (requires min 5 ratings)
- `popular` - By memberCount descending
- `name` - Alphabetical by spaceName

**Response:**
```typescript
{
  spaces: PublicSpaceListing[];
  nextCursor: string | null;  // Cursor-based pagination (encoded timestamp + spaceId)
  total: number;              // Approximate count
}

type PublicSpaceListing = {
  spaceId: string;
  spaceName: string;
  description: string;
  iconUrl: string;
  bannerUrl: string;
  memberCount: number;
  category: SpaceCategory;       // Required category for filtering
  // SECURITY: NO configKey here - keys must never be stored in directory!
  // PRIVACY: NO ownerAddress here - owner identity must never be exposed!
  listedAt: number;
  lastUpdatedAt: number;
  // Rating data (community moderation)
  averageRating: number | null;  // null if no ratings yet
  ratingCount: number;
};

// Predefined categories (v1)
type SpaceCategory =
  | 'gaming'
  | 'technology'
  | 'music'
  | 'art-design'
  | 'education'
  | 'science'
  | 'crypto-web3'
  | 'community'
  | 'business'
  | 'other';
```

> ⚠️ **SECURITY NOTE**: The `configKey` is the X448 **private key** used to decrypt space manifests. It must NEVER be stored in the directory database. See "Secure Join Flow" section below.

### 2. Publish Space to Directory

```
POST /api/spaces/{spaceId}/publish
```

**Request Body:**
```typescript
{
  space_address: string;
  listing_data: {
    name: string;
    description: string;
    icon_url: string;
    banner_url: string;
    category: SpaceCategory;   // Required - owner selects in Space Settings
  };
  timestamp: number;
  owner_public_key: string;    // For signature verification only - NOT stored in listing!
  owner_signature: string;     // Signs: listing_data + timestamp
}
```

> **PRIVACY NOTE**: The `owner_public_key` is used ONLY for signature verification. The API already knows the owner's public key from the original space registration. This key is **NEVER stored in or returned from** the directory listing - see `PublicSpaceListing` type which intentionally excludes owner identity.

**Signature Payload:**
```typescript
// Owner must sign to prove ownership
// SECURITY: Include operation type and spaceId to prevent replay attacks
const payload = Buffer.from(
  'PUBLISH:' + spaceId + ':' + JSON.stringify(listing_data) + ':' + timestamp
).toString('base64');

const signature = ch.js_sign_ed448(ownerPrivateKey, payload);
```

> **Replay Attack Prevention**: The signature binds to:
> - Operation type (`PUBLISH`) - prevents using publish signatures for other operations
> - Space ID - prevents replaying signature for different spaces
> - Timestamp - API should reject requests older than 5 minutes

### 3. Rate Space (User Moderation)

```
POST /api/spaces/{spaceId}/rate
```

Users who have joined a space can rate it.

**Request Body:**
```typescript
{
  user_address: string;
  rating: 1 | 2 | 3 | 4 | 5;
  timestamp: number;
  user_signature: string;      // Proves user identity
}
```

**Rules:**
- One rating per user per space (can update)
- User must have joined the space to rate (verify via hub membership)
- **Minimum 7 days membership required** before rating (prevents join-rate-leave manipulation)
- Rating updates replace previous rating

> **Dependency**: The 7-day membership requirement depends on the `joinedAt` field being stored for space members. See [New Member Badge task](new-member-badge-spaces.md) which adds this field. If that task is not yet implemented, this rule should be deferred or the API should skip this check until `joinedAt` data is available.

### 4. Report Space (Flag for Review)

```
POST /api/spaces/{spaceId}/report
```

**Request Body:**
```typescript
{
  user_address: string;
  reason: 'spam' | 'inappropriate' | 'misleading' | 'inactive' | 'other';
  details?: string;            // Optional additional context
  timestamp: number;
  user_signature: string;
}
```

**Rules:**
- One report per user per space (prevents spam reporting)
- Reports accumulate in the coordination API database
- Auto-hide logic (see "Auto-Moderation Rules" below)

### 5. Update Directory Listing

```
PATCH /api/spaces/{spaceId}/publish
```

Same structure as POST, allows updating listing metadata (name, description, category, etc.).

### 6. Get Directory Invite (Simplified Flow)

```
GET /api/spaces/{spaceId}/directory-invite
```

This endpoint returns the space's **existing public invite URL**. It does NOT create a new invite - it simply provides access to the invite the owner already created.

**Response:**
```typescript
{
  inviteUrl: string;           // The space's existing public invite URL
}
```

**API Logic:**
1. Verify space is published in directory
2. Fetch space manifest to get `space.inviteUrl`
3. Return the existing public invite URL

**Error Responses:**
| Status | Error | Meaning |
|--------|-------|---------|
| 404 | `Space not in directory` | Space not published |
| 404 | `No public invite` | Space has no public invite configured |

> **Note:** This uses the SAME invite pool as manual sharing. When users join via directory, they consume evals from the owner's existing public invite. If evals run out, joining fails until owner regenerates the invite.

---

## Security Considerations

### 1. Ownership Verification

- All publish/unpublish operations require **owner key signature**
- Quorum API verifies signature using registered `owner_public_key` from space registration
- Prevents unauthorized listing of spaces

### 2. Config Key Security (CRITICAL)

> ⚠️ **The `configKey` is the X448 PRIVATE key, not public key!**

Looking at the actual implementation:
```typescript
// InvitationService.ts:434
space!.inviteUrl = `...&configKey=${Buffer.from(new Uint8Array(configPair.private_key)).toString('hex')}`;
```

**Security Requirements:**
- ❌ **NEVER** store `configKey` in the directory database
- ❌ **NEVER** return `configKey` in directory API responses
- ✅ Directory stores only public metadata (name, description, icon, owner)
- ✅ Joining requires fetching a one-time invite (see "Secure Join Flow")
- ✅ Each join consumes one eval, preventing unlimited access

### 3. Rate Limiting

**Required Limits:**
| Operation | Limit | Scope |
|-----------|-------|-------|
| `GET /spaces/public` | 100/minute | Per IP |
| `POST /spaces/{id}/publish` | 5/hour | Per owner |
| `GET /spaces/{id}/directory-invite` | 30/minute | Per IP |
| `POST /spaces/{id}/rate` | 10/minute | Per user |
| `POST /spaces/{id}/report` | 5/hour | Per user |

**Implementation:**
- Response caching: 30-second cache on directory listings
- Return `Retry-After` header when limits exceeded
- Consider CloudFlare/similar for DDoS protection

### 4. Community Moderation (Ratings + Reports)

**Rating System:**
- Users who joined a space can rate 1-5 stars
- One rating per user per space (can update)
- Displayed as average + count on space cards

**Report System:**
- Users can report listings for: spam, inappropriate, misleading, inactive, other
- One report per user per space
- Reports trigger auto-moderation rules

**Auto-Moderation Rules:**
Space is automatically hidden from directory if:
- Average rating < 2.0 AND ratingCount >= 10
- Report count > 20 in rolling 7-day window
- Space is deleted (detected by background job)

**Owner Visibility (No Push Notifications):**
Since Quorum is privacy-first (no email/phone):
- Owner sees listing status in SpaceSettingsModal → Directory tab
- Status shown: "Listed", "Hidden (low ratings)", "Hidden (reports)"
- Owner can see their current rating and report count
- No way to push-notify owners when they're offline

### 5. Spam Prevention

**Minimum Requirements to List:**
- Space must have at least **20 members**
- Space must have at least **100 messages** in any channel
- Space must be at least **7 days old** (createdDate)

These thresholds prevent:
- Spam accounts creating empty spaces just to list
- Low-effort placeholder listings
- Newly created spaces with no real community

### 6. Background Cleanup Job

The Quorum coordination API runs a periodic job (every hour) to:
- Check if listed spaces still exist (fetch manifest from hub)
- Remove listings for deleted spaces
- Update member counts from hub data
- Recalculate average ratings

> **Architecture Note**: This cleanup job runs on the coordination API layer (the same service that currently handles `/space/{address}`, `/invite/evals`, etc. - see `src/api/baseTypes.ts`). It is NOT a decentralized operation - the directory is a coordination service that aggregates publicly-opted-in space metadata.

### 7. Prerequisite: Public Invite Required

A space can only be listed in the directory if it has an active public invite:
- Owner must first "Generate Public Invite Link" in SpaceSettingsModal
- This creates the invite URL and eval pool
- Only then can they "List in Public Directory"
- If owner has never generated a public invite, listing should be blocked with helpful message

---

## Frontend Implementation (This Repo)

Once backend API is available, the following frontend work is needed:

### Space Settings: Directory Tab

Owner configures directory listing in SpaceSettingsModal:

```
┌─────────────────────────────────────────────────────────────────────┐
│  SPACE SETTINGS → Directory Tab                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Public Directory                                                    │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  [Toggle] List this Space in the public directory                   │
│                                                                      │
│  Category *                                                          │
│  ┌─────────────────────────────────────────┐                        │
│  │ Gaming                               ▼  │                        │
│  └─────────────────────────────────────────┘                        │
│                                                                      │
│  Categories:                                                         │
│  • Gaming          • Art & Design      • Crypto & Web3              │
│  • Technology      • Education         • Community                  │
│  • Music           • Science           • Business                   │
│                                        • Other                      │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  ⚠️ Prerequisites:                                                   │
│  • Public invite link must be generated (Invites tab)               │
│  • Space description recommended for better discoverability         │
│                                                                      │
│  ℹ️ Directory listings use your existing public invite link.        │
│     When users join from the directory, they consume invites        │
│     from your invite pool.                                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Category Display Names

```typescript
const CATEGORY_LABELS: Record<SpaceCategory, string> = {
  'gaming': 'Gaming',
  'technology': 'Technology',
  'music': 'Music',
  'art-design': 'Art & Design',
  'education': 'Education',
  'science': 'Science',
  'crypto-web3': 'Crypto & Web3',
  'community': 'Community',
  'business': 'Business',
  'other': 'Other',
};
```

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ExploreSpaces.tsx` | `src/components/pages/` | Main directory browse page |
| `SpaceCard.tsx` | `src/components/directory/` | Space listing card |
| `DirectorySearch.tsx` | `src/components/directory/` | Search/filter UI |
| `DirectoryTab.tsx` | `src/components/modals/SpaceSettingsModal/` | "List in Directory" toggle |

### New Services

| File | Purpose |
|------|---------|
| `DirectoryService.ts` | API calls for directory operations |

### New Hooks

| Hook | Purpose |
|------|---------|
| `usePublicSpaces.ts` | Fetch/cache directory listings |
| `useDirectoryRegistration.ts` | Publish/unpublish space |

### Route Addition

```typescript
// In router config
{
  path: '/explore',
  element: <ExploreSpaces />
}
```

### NavMenu Addition

Add "Explore Spaces" button alongside "Create Space" and "Join Space".

### Explore Page: Category Filtering

```
┌─────────────────────────────────────────────────────────────────────┐
│  EXPLORE SPACES                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🔍 Search spaces...                                        │     
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Categories:                                                        │
│  ┌─────┐ ┌──────────┐ ┌───────┐ ┌──────────── ┐ ┌───────────┐       │
│  │ All │ │ Gaming   │ │ Tech  │ │ Art & Design│ │ Community │ ...   │
│  └─────┘ └──────────┘ └───────┘ └─────────── ─┘ └───────────┘       │
│    ▲                                                                │
│    └─ Selected (highlighted)                                        │
│                                                                     │
│  Sort: [Newest ▼]                                                   │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   [Icon]     │  │   [Icon]     │  │   [Icon]     │               │
│  │  Space Name  │  │  Space Name  │  │  Space Name  │               │
│  │  Description │  │  Description │  │  Description │               │
│  │  👥 123      │  │  👥 456      │  │  👥 78       │              │
│  │  ⭐ 4.2 (47) │  │  ⭐ 3.8 (12) │  │  (no ratings)│              │
│  │  [Join]      │  │  [Join]      │  │  [Join]      │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  [Load More]                                                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Publishing a Space

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PUBLISH FLOW                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Owner opens SpaceSettingsModal → DirectoryTab                    │
│                                                                      │
│  2. Clicks "List in Public Directory"                                │
│       ↓                                                              │
│  3. Frontend prepares listing data:                                  │
│     - Collects name, description, icon, banner                       │
│     - Gets configKey from space_keys (public portion)                │
│     - Generates timestamp                                            │
│       ↓                                                              │
│  4. Signs with owner key:                                            │
│     signature = js_sign_ed448(ownerPrivateKey, payload)              │
│       ↓                                                              │
│  5. POST /api/spaces/{spaceId}/publish                               │
│       ↓                                                              │
│  6. Quorum API validates:                                            │
│     - Verifies owner signature against registered owner key          │
│     - Checks space exists (fetches manifest from hub)                │
│     - Stores listing in directory database                           │
│       ↓                                                              │
│  7. Update local space.isPublic = true (if using for display)        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Browsing and Joining (Simplified Flow)

```
┌──────────────────────────────────────────────────────────────────────┐
│                     BROWSE & JOIN FLOW                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User navigates to /explore                                       │
│       ↓                                                              │
│  2. GET /api/spaces/public → list of PublicSpaceListing              │
│     (NO configKey returned - only public metadata!)                  │
│       ↓                                                              │
│  3. Display cards with: icon, name, description, member count        │
│       ↓                                                              │
│  4. User clicks "Join" on a space card                               │
│       ↓                                                              │
│  5. Show loading state, GET /api/spaces/{id}/directory-invite        │
│       ↓                                                              │
│  6. API returns the EXISTING public invite URL                       │
│     (same URL owner shares manually - fetched from space manifest)   │
│       ↓                                                              │
│  7. Open JoinSpaceModal with invite link                             │
│       ↓                                                              │
│  8. Existing join flow handles:                                      │
│     - Fetch manifest from /space/{id}/manifest                       │
│     - Consume one eval from /invite/eval                             │
│     - Set up encryption session                                      │
│     - Register with hub                                              │
│     - Save space locally                                             │
│                                                                      │
│  KEY POINT: Uses the SAME invite pool as manual sharing.             │
│  Directory is just a discovery layer on top of existing invites.     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Invite Regeneration Behavior

```
┌──────────────────────────────────────────────────────────────────────┐
│                   INVITE REGENERATION                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  When owner regenerates public invite link:                          │
│                                                                       │
│  1. New configKey + new evals created (existing behavior)            │
│  2. space.inviteUrl updated with new URL                             │
│  3. Old invite links stop working                                    │
│                                                                       │
│  Directory behavior:                                                  │
│  - Directory-invite endpoint returns NEW URL automatically           │
│  - No separate action needed by owner                                │
│  - Users who fetch invite AFTER regeneration get new URL             │
│  - Users mid-join with old URL will fail (expected)                  │
│                                                                       │
│  Eval depletion:                                                      │
│  - If all ~200 evals consumed, joins fail with "No invites"          │
│  - Owner must regenerate invite to create new pool                   │
│  - Consider: Show "invite exhausted" state in directory UI           │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Migration Considerations

### Existing `isPublic` Flag

The current `isPublic` flag on Space has a different meaning ("directly joinable by link"). Options:

1. **Rename existing flag**: `isPublic` → `isDirectJoin` (breaking change)
2. **Add new flag**: `isListed` for directory visibility (recommended)
3. **Dual-purpose**: Require `isPublic = true` AND explicit publish action

**Recommendation**: Option 3 - A space must have `isPublic = true` (has public invite) AND be explicitly published to appear in directory. This ensures:
- Only spaces with working public invites are listed
- Owner explicitly consents to directory listing
- Existing behavior unchanged

---

## Estimated Implementation Scope

### Coordination API (Quorum Backend Repo)

| Task | Complexity |
|------|------------|
| Database schema for listings + ratings + reports | Medium |
| GET /spaces/public endpoint | Medium |
| POST /spaces/{id}/publish + PATCH | Medium |
| GET /spaces/{id}/directory-invite | Low |
| POST /spaces/{id}/rate | Low |
| POST /spaces/{id}/report | Low |
| Signature verification | Low (reuse existing) |
| Rate limiting + caching | Medium |
| Background cleanup job (hourly) | Medium |
| Auto-moderation logic | Low |
| **Total** | ~5-6 days |

### Frontend (This Repo)

| Task | Complexity |
|------|------------|
| DirectoryService.ts | Low |
| usePublicSpaces hook | Low |
| ExploreSpaces page | Medium |
| SpaceCard component (with ratings) | Medium |
| DirectoryTab in SpaceSettings | Medium |
| RateSpaceModal component | Low |
| ReportSpaceModal component | Low |
| Route & navigation | Low |
| **Total** | ~4-5 days |

---

## Open Questions

1. ~~**Moderation**: How to handle inappropriate listings?~~ ✅ Resolved: Hybrid rating + report system with auto-moderation

2. ~~**Categories/Tags**: Should we predefine categories or allow freeform tags?~~ ✅ Resolved: Predefined categories (10 options)

3. **Member Count Accuracy**: Real-time count or periodic update?

4. **Listing Expiry**: Should listings auto-expire if space becomes inactive?

5. **Search Algorithm**: Simple text match or weighted relevance?

---

## Next Steps

1. **Share with lead dev** for coordination API approval
2. **Finalize API contract** based on feedback
3. **Coordination API implementation** (Quorum backend repo)
4. **Frontend implementation** (this repo)
5. **Testing & iteration**

---

## Related Documentation

- [Invite System Documentation](../docs/features/invite-system-analysis.md)
- [Data Management Architecture](../docs/data-management-architecture-guide.md)
- [Cryptographic Architecture](../docs/cryptographic-architecture.md)
- [Config Sync System](../docs/config-sync-system.md)

---

## Security Checklist for Lead Dev

Before approving coordination API implementation:

**Privacy (Critical)**
- [ ] Owner address is **NEVER** stored in directory database or returned in listings
- [ ] ConfigKey is **NEVER** stored in directory database
- [ ] Directory-invite endpoint fetches inviteUrl from manifest on-demand (not stored)
- [ ] User addresses from ratings/reports are NOT exposed publicly

**Security**
- [ ] Rate limiting is implemented (per-user-address since IPs are obfuscated on Quilibrium)
- [ ] Signature payload includes operation type + spaceId + timestamp (replay attack prevention)
- [ ] Reject signatures older than 5 minutes (timestamp window validation)
- [ ] Publish validates that space has an active public invite (inviteUrl exists)
- [ ] Publish validates spam prevention thresholds (20+ members, 100+ messages, 7+ days old)

**Moderation**
- [ ] Background job removes listings for deleted spaces
- [ ] Auto-moderation hides spaces with low ratings or high reports
- [ ] Rating endpoint verifies user is member of the space
- [ ] Rating endpoint requires 7+ days membership (when `joinedAt` field available)

---

*Last Updated: 2025-12-30 (Architecture terminology review - fixed server-side reference in Report Space section)*
