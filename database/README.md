# MongoDB setup and data model

Tracewise defines its schemas with Mongoose in `backend/src/models/`. This folder documents the database; it intentionally does not duplicate those schema definitions or contain live database data, dumps, or seed scripts.

## Local development

1. Install and start MongoDB Community Server, or use a MongoDB Atlas URI.
2. Set `MONGODB_URI` in `backend/.env`. The local default is:

   ```text
   mongodb://127.0.0.1:27017/requirement_traceability
   ```

   Keep the database name `requirement_traceability` when using the existing local project data. Atlas credentials belong only in `backend/.env`.
3. Start the backend from `backend/` with `npm run dev`. Mongoose connects to the configured database and creates collections/indexes as models are used.

The application does not automatically reset or seed the database. Registering the first account assigns existing unowned project records to its workspace. Back up data before any manual database maintenance.

## Collections

| Collection (Mongoose model) | Purpose and relationships |
| --- | --- |
| `users` (`User`) | Accounts, password and OTP hashes, workspace membership, and owner/member role. References `workspaces` by `workspaceId`. |
| `workspaces` (`Workspace`) | Project name, owner, preferences, invite code, and encrypted AI provider settings. `ownerId` refers to a `User`. |
| `requirements` (`Requirement`) | Workspace-scoped requirements with stable `requirementId` values such as `REQ-001`. |
| `traceabilityrelationships` (`TraceabilityRelationship`) | Directed requirement-to-requirement links, scoped to a workspace by `workspaceId`. |
| `testcases` (`TestCase`) | Workspace-scoped test cases with stable `testCaseId` values and an array of linked requirement IDs. Removing the last link does not delete the test case. |
| `impactanalyses` (`ImpactAnalysis`) | Saved snapshots of requirement changes, affected requirements/tests, and graph data. Workspace and requirement identifiers are stored in each snapshot. |
| `sessions` (`Session`) | Hashed session tokens referencing users. Expired records are removed by a TTL index on `expiresAt`. |
| `counters` (`Counter`) | Atomic sequence values used to generate requirement and test case IDs. |

Requirement and test-case relationships use stable string IDs inside a workspace rather than MongoDB references. Workspace scope on the records prevents IDs from crossing projects.

## Indexes

Mongoose declares and creates these indexes from the model definitions:

- Unique `{ workspaceId, requirementId }` for requirements.
- Unique `{ workspaceId, testCaseId }` for test cases.
- Unique `{ workspaceId, fromRequirementId, toRequirementId }` for directed relationships.
- Workspace lookup indexes on project data and sessions/users where declared.
- Unique email, session-token hash, and workspace invite code/key indexes.
- TTL index on session `expiresAt`.

No production migration or destructive seed command is included. If changing a unique index for an existing database, inspect and back up existing records before applying that change.
