# Security Specification — Al-Pop Martial Arts Academy

## Data Invariants
1. **Privilege Escalation Prevention**: Only verified `bahermuorad2@gmail.com` (`email_verified == true`) is Coach/Admin. Standard users creating `/users/{userId}` can only set `role: "parent"` and `uid == request.auth.uid`.
2. **PII Isolation**: User profiles (`/users/{userId}`) contain phone and email and may only be read by the document owner or the Coach/Admin. Blanket `isSignedIn()` reads are forbidden.
3. **Parent Ownership & Scoped Queries**: Parents can only `get` and `list` athletes, attendance, payments, and notifications where `resource.data.parentUid == request.auth.uid` or `resource.data.parentEmail == request.auth.token.email` (with `email_verified == true`).
4. **Coach Authority on Operational Records**: Only the Coach/Admin can create or modify attendance records, record payments, or send notifications. Parents can only mark `read: true` on their own notifications.
5. **Temporal & Structural Integrity**: All `createdAt` / `updatedAt` timestamps must match `request.time`; all string lengths, numeric ranges, enums, and document IDs are strictly validated.
6. **Catalog Moderation Integrity**: Photos in `/catalogPhotos/{photoId}` submitted by parents are strictly forced to `status: "pending"`, `submittedByRole: "parent"`, and empty `coachNote`. Only the Coach/Admin can publish directly as `"approved"` or approve/reject parent submissions; public homepage reads are strictly limited to `status == "approved"`.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Self-Assigned Coach Role**: Parent creates `/users/{uid}` with `role: "coach"`.
2. **Role Escalation Update**: Parent updates `/users/{uid}` changing `role` from `"parent"` to `"coach"`.
3. **Unverified Email Spoofing**: Token with `email: "bahermuorad2@gmail.com"` and `email_verified: false` tries to list all `/athletes`.
4. **Shadow Field Injection**: Parent creates `/athletes/{id}` with extra field `isVerified: true`.
5. **Cross-Parent PII Scrape**: Parent A calls `get` or `list` on `/users/{parentBUid}`.
6. **Parent Forging Attendance**: Parent creates `/attendance/{id}` marking their child present.
7. **Parent Forging Payment**: Parent creates `/payments/{id}` marking their monthly fee paid.
8. **Parent Forging Notification**: Parent creates `/notifications/{id}` targeting another parent.
9. **Notification Tampering**: Parent updates `message` or `title` on `/notifications/{id}` instead of only `read`.
10. **ID Poisoning**: Creating `/athletes/` with a 500-character invalid document ID containing spaces/slashes.
11. **Client Timestamp Forgery**: Creating `/athletes/{id}` with a backdated `createdAt` instead of `request.time`.
12. **Immutable Owner Tampering**: Updating `/athletes/{id}` to change `parentUid` or `createdAt`.
13. **Parent Self-Approving Catalog Photo**: Parent creates `/catalogPhotos/{id}` with `status: "approved"` or `submittedByRole: "coach"`.
14. **Reading Unapproved Photos of Another Parent**: Anonymous visitor or Parent B lists `/catalogPhotos` without `status == "approved"` or matching `submittedByUid`.

