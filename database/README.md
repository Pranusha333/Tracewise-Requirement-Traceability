# MongoDB setup and data model

Tracewise defines its schemas with Mongoose in `backend/src/models/`. The centralized [schema reference](schema.json) documents the collections, fields, validation, defaults, indexes, and relationships in one place. The Mongoose models remain authoritative. The JSON file is documentation only: it does not install MongoDB validators, change application behavior, or contain live database data, dumps, or seed scripts.

## View the schema

- Open [`schema.json`](schema.json) in VS Code or another JSON viewer to browse the full collection definitions.
- To view it in a terminal from the project root, run `Get-Content .\database\schema.json` in PowerShell, or `cat database/schema.json` in a Unix-like shell.
- Compare a collection entry's `model` with the matching file in `backend/src/models/` when changing the data model. Update this reference whenever a Mongoose schema or its indexes change.
- `jsonSchema` uses MongoDB BSON types. Its `mongoose` annotations record Mongoose behavior such as trimming, case normalization, and fields hidden from default queries. Defaults are Mongoose defaults; they are not applied by the reference file itself.

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
| `users` (`User`) | Accounts, password and OTP hashes, workspace membership, and owner/member role. `workspaceId` references `workspaces._id`. |
| `workspaces` (`Workspace`) | Project name, owner, preferences, invite code, and encrypted AI provider settings. `ownerId` references `users._id` and may be null. |
| `requirements` (`Requirement`) | Workspace-scoped requirements with stable `requirementId` values such as `REQ-001`. |
| `traceabilityrelationships` (`TraceabilityRelationship`) | Directed requirement-to-requirement links, scoped to a workspace by `workspaceId`. |
| `testcases` (`TestCase`) | Workspace-scoped test cases with stable `testCaseId` values and an array of linked requirement IDs. Removing the last link does not delete the test case. |
| `impactanalyses` (`ImpactAnalysis`) | Saved snapshots of requirement changes, affected requirements/tests, and graph data. Workspace and requirement identifiers are stored in each snapshot. |
| `sessions` (`Session`) | Hashed session tokens referencing users. Expired records are removed by a TTL index on `expiresAt`. |
| `counters` (`Counter`) | Atomic sequence values used to generate requirement and test case IDs. |

Requirement and test-case relationships use stable string IDs inside a workspace rather than MongoDB references. Workspace scope on the records prevents IDs from crossing projects.

`ImpactAnalysis` stores a snapshot with embedded impact, graph, and assistant-result data. Its `workspaceId` is a MongoDB reference; requirement and test-case IDs inside the snapshot remain stable strings. `Session.userId` references `users._id`. Mongoose timestamps (`createdAt`, `updatedAt`) are enabled for all listed models except `Counter`; version keys are disabled.

## Indexes

Mongoose declares and creates these indexes from the model definitions:

- MongoDB's built-in unique `_id` index exists on every collection (the `Counter` model uses a string `_id`; the other models use ObjectIds).
- Unique `{ workspaceId, requirementId }` for requirements.
- Unique `{ workspaceId, testCaseId }` for test cases.
- Unique `{ workspaceId, fromRequirementId, toRequirementId }` for directed relationships.
- Workspace lookup indexes on requirements, relationships, test cases, impact analyses, and users where declared.
- Unique email, session-token hash, and workspace invite code/key indexes.
- TTL index on session `expiresAt`.

No production migration or destructive seed command is included. If changing a unique index for an existing database, inspect and back up existing records before applying that change.

## OTP email provider configuration

The backend selects the OTP email provider with `EMAIL_PROVIDER` in `backend/.env`. Set it to `gmail` to use Gmail SMTP, or `resend` to use the existing Resend integration. If it is omitted, the backend defaults to `resend` for compatibility with existing installations. Restart the backend after changing environment settings.

For Gmail, set `EMAIL_USER` to the Gmail account, `EMAIL_APP_PASSWORD` to its Google App Password, and `EMAIL_FROM` to an authorized sender address (normally the same Gmail address). Gmail uses `smtp.gmail.com` on port `465` with secure TLS. Never put these values in frontend configuration or commit real credentials. Placeholder entries are in `backend/.env.example`.
