# Requirement Traceability and Change Impact Analysis System

A workspace-based TraceWise application built with React, Vite, Tailwind CSS, Express, and MongoDB. It includes secure sign-in, requirements management, a traceability matrix, impact and AI analysis, team invites, and persistent workspace settings.

## Project structure

```text
.
|-- frontend/
|   |-- src/components/     # Shared navigation, tables, forms, dialogs, and chart
|   |-- src/data/           # Requirement filter and form options
|   |-- src/pages/          # Dashboard, requirements, traceability, impact, assistant, settings, and auth
|   |-- src/services/       # Frontend API clients
|   |-- src/styles/         # API loading and error styles
|   |-- App.jsx             # Navigation, API data, and shared state
|   `-- vite.config.js      # Local /api proxy to Express
|-- backend/
|   |-- src/config/         # MongoDB connection setup
|   |-- src/controllers/    # REST request handlers
|   |-- src/middleware/     # Database readiness and shared error handling
|   |-- src/models/         # Workspace-scoped project data, users, sessions, and counters
|   |-- src/routes/         # API route definitions
|   |-- src/services/       # Requirement, traceability, impact, and assistant operations
|   `-- .env.example        # Backend environment template
`-- database/
    `-- README.md           # MongoDB collections, relationships, and local setup
```

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- MongoDB Community Server running locally, or a MongoDB Atlas connection string

## Run locally

1. Create `backend/.env` from the example before starting the backend:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```

   Update values as needed. The default MongoDB URI is `mongodb://127.0.0.1:27017/requirement_traceability`; start MongoDB before using data-backed features. The first account registered claims the existing unassigned project records as the workspace owner. Existing records are retained.

2. Open two PowerShell terminals in the repository root. In Terminal 1, install and start the backend:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

   If `backend/node_modules` already exists, skip `npm install`.

3. In Terminal 2, install and start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

   If `frontend/node_modules` already exists, skip `npm install`.

4. Open the frontend and API health endpoint:

   ```powershell
   Start-Process http://localhost:5173
   Start-Process http://localhost:5000/api/health
   ```

The frontend proxies `/api` requests to Express during Vite development. If port 5000 is occupied, stop the other backend process before starting this one, or change `PORT` and the proxy target in `frontend/vite.config.js` together. For a separately hosted frontend, set `VITE_API_URL` to the backend API base URL (for example, `https://your-api.example.com/api`) before building, and set the backend `CLIENT_URL` to the frontend origin.

## Environment variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `PORT` | Express server port | `5000` |
| `NODE_ENV` | Enables production cookie security behavior | `development` locally; `production` when deployed |
| `CLIENT_URL` | Allowed browser origin for CORS | `http://localhost:5173` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/requirement_traceability` |
| `OPENAI_API_KEY` | Optional backend-only key for OpenAI explanations | Leave empty to use local analysis |
| `OPENAI_MODEL` | Optional model name used with the Responses API | `gpt-6-astra` |
| `SETTINGS_ENCRYPTION_KEY` | Secret used to encrypt per-workspace AI keys at rest | Generate a private random value of at least 32 characters |
| `RESEND_API_KEY` | Resend API key for email verification and password reset codes | Leave empty for local development |
| `RESEND_FROM_EMAIL` | Verified sender address used by Resend | `Tracewise <security@example.com>` |
| `SESSION_COOKIE_SAME_SITE` | Session cookie policy (`strict`, `lax`, or `none`) | `strict` for same-site hosting |
| `VITE_API_URL` | Optional frontend API base URL | `/api` in development via the Vite proxy |

Keep private MongoDB, AI, email, and encryption credentials in `backend/.env`, which is ignored by Git. Do not commit secrets. Configure a strong `SETTINGS_ENCRYPTION_KEY` before storing an AI key from Settings. In production, set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to deliver verification and password reset codes. For cross-site frontend/API hosting, use HTTPS, set `SESSION_COOKIE_SAME_SITE=none`, and configure `CLIENT_URL` to the exact frontend origin. See `database/README.md` for the existing Mongoose collections, relationships, and safe local MongoDB setup.

## Authentication and workspace access

All dashboard, requirement, traceability, impact, and assistant API routes require a valid session. Sign-in first verifies the password, then emails a six-digit one-time code; a session is created only after the code is verified. Sessions use an HTTP-only, same-site cookie backed by a random server-side token, passwords are hashed with scrypt, and remembered sessions expire after seven days. Sessions are revoked on logout, password reset, or password change. Authentication requests are rate-limited.

The first account registered to a database becomes owner of the existing project workspace and receives its existing unassigned requirements, relationships, test cases, and analysis history. Additional sign-ups create isolated workspaces. Owners can share an invite code from **Settings → Team management**; a new user can enter that code during registration to join as a member. Members can read project data and update their own profiles; only owners can change workspace settings or rotate the invite code.

New accounts must verify their email with a six-digit code before sign-in. Sign-in and password reset also use six-digit email codes. Codes expire after 10 minutes and can be resent; OTP values are never returned by the API or logged. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `backend/.env` in every environment. If email delivery is unavailable, the API returns a clear configuration or delivery error and does not reveal the code.

Authentication endpoints are under `/api/auth`:

| Method | Path | Action |
| --- | --- | --- |
| `POST` | `/register` | Create an account and workspace, or join with an invite code |
| `POST` | `/verify-email` | Verify an email with a six-digit code and start a session |
| `POST` | `/resend-verification` | Resend an email verification code |
| `POST` | `/login` | Validate the password and send a one-time sign-in code |
| `POST` | `/verify-login` | Verify the sign-in code and start a session |
| `POST` | `/resend-login-code` | Resend a one-time sign-in code |
| `POST` | `/logout` | Revoke the current session |
| `GET` | `/me` | Read the current user and workspace |
| `POST` | `/forgot-password` | Request a password reset code |
| `POST` | `/reset-password` | Set a new password with a valid reset code |
| `PUT` | `/profile` | Update profile; current password is required to change email |
| `PUT` | `/password` | Change password and revoke other sessions |
| `GET`, `PATCH` | `/workspace` | Read or update workspace settings (owner writes) |
| `POST` | `/workspace/invite-code` | Rotate the owner invite code |

## Requirement API

All requirement routes are under `/api/requirements`:

| Method | Path | Action |
| --- | --- | --- |
| `GET` | `/` | List requirements, newest updates first |
| `POST` | `/` | Create a requirement with a server-generated ID |
| `GET` | `/:id` | Read a requirement by ID such as `REQ-001` |
| `PUT` | `/:id` | Replace editable requirement fields |
| `DELETE` | `/:id` | Delete a requirement |

Creation and updates require `title`, `description`, `type`, `priority`, and `status`. Types are `Functional` or `Non-functional`; priorities are `Low`, `Medium`, `High`, or `Critical`; statuses are `Draft`, `Approved`, `In Progress`, or `Completed`.

The dashboard shows total, approved, in-progress, and completed counts calculated from the signed-in workspace. Its status chart, recent requirements, and recent update menu use those same project records.

## Traceability Matrix

Open **Traceability Matrix** from the sidebar to review requirement relationships and test coverage. Search by requirement ID or title, then filter by type and priority. The summary counts a requirement as linked when it has at least one requirement relationship or test case. Rows separately show missing requirement links and missing test coverage.

From the matrix, create, edit, or remove requirement relationships. Supported relationship types are `Depends On`, `Related To`, and `Implements`. Create test cases with a title, description, and one or more linked requirement IDs; test case IDs are generated by the API. Removing a requirement link, including when deleting a requirement, retains the test case even when no links remain. Delete a test case explicitly to remove it.

Traceability endpoints are available under `/api/traceability`, `/api/relationships`, and `/api/test-cases`:

| Method | Path | Action |
| --- | --- | --- |
| `GET` | `/api/traceability` | Load requirements, relationships, and test cases for the matrix |
| `GET`, `POST` | `/api/relationships` | List or create a requirement relationship |
| `GET`, `PUT`, `DELETE` | `/api/relationships/:id` | Read, update, or remove a relationship |
| `GET`, `POST` | `/api/test-cases` | List or create a test case |
| `GET`, `PUT`, `DELETE` | `/api/test-cases/:id` | Read, update, or delete a test case |
| `DELETE` | `/api/test-cases/:id/requirements/:requirementId` | Remove one requirement link while retaining the test case |

Relationship creation rejects self-links, duplicate directed requirement pairs, unsupported relationship types, and IDs that do not exist. Creating a test case requires at least one existing requirement; an existing test case may remain after all its requirement links are removed.

## Change Impact Analysis

Open **Impact Analysis** from the sidebar, choose a requirement, enter a proposed change, and select **Analyze impact**. The page shows the selected requirement's current title and description, direct impacts, indirect impacts, related test cases, totals, and a dependency graph. Analysis uses saved relationships and test case links; it does not update the original requirement. Select **Save analysis** to store a snapshot, which can later be opened from Saved analyses.

Impact traversal follows these relationship meanings: a change to the `toRequirementId` affects the `fromRequirementId` for `Depends On` and `Implements`; `Related To` is traversed in both directions. Direct results are one relationship away. Indirect results are reached through further relationships. A visited set prevents circular dependencies from duplicating results or looping. Test cases linked to the selected or affected requirements are included once.

Impact analysis endpoints are under `/api/impact-analyses`:

| Method | Path | Action |
| --- | --- | --- |
| `POST` | `/analyze` | Calculate an impact result without saving it |
| `GET` | `/` | List the 30 most recent saved analyses; optionally filter with `?requirementId=REQ-001` |
| `POST` | `/` | Recalculate and save an analysis snapshot |
| `GET` | `/:id` | Retrieve a saved analysis |
| `DELETE` | `/:id` | Delete a saved impact analysis |

To try direct and indirect impacts, create three requirements, add a `Depends On` link from the second requirement to the first and another from the third to the second, then analyze a proposed change to the first. The second requirement appears as a direct impact and the third as an indirect impact. Link test cases to those requirements to see affected tests in the result. Add a link that closes a cycle to verify traversal remains finite; an unlinked requirement should return zero affected requirements and test cases.

## AI Assistant

Open **AI Assistant** from the sidebar, select an existing requirement, and enter the proposed change. The page shows current requirement details, local TF-IDF text matches with similarity scores, and direct/indirect impacts and affected tests calculated from the same traceability records as Change Impact Analysis. Recommendations cover affected requirements, linked tests, test coverage gaps, missing links, possible overlap, and testable wording. You can edit, accept, or reject recommendations, then save the analysis to history and reopen it later. Review actions change only the saved analysis; they never update requirements or test cases.

Without `OPENAI_API_KEY`, similarity and explanations run locally and the page labels the result as a fallback. When the key is configured, the backend optionally sends the selected requirement, proposed change, matched requirements, calculated impact paths, and affected test cases to OpenAI using the Responses API. The key stays in `backend/.env`; do not add it to frontend variables or commit it. Calls time out after 15 seconds. Provider errors, refusals, incomplete output, malformed output, or invented record IDs use the local fallback. Configure the optional provider by adding the key to `backend/.env` and restarting the backend; leave it blank for local-only use.

Assistant endpoints are under `/api/ai-assistant`:

| Method | Path | Action |
| --- | --- | --- |
| `POST` | `/analyze` | Analyze without saving; uses real graph and test records |
| `POST` | `/analyses` | Save an assistant analysis snapshot |
| `GET` | `/analyses` | List up to 30 recent assistant analyses |
| `GET` | `/analyses/:id` | Reopen a saved analysis |
| `PATCH` | `/analyses/:id/recommendations/:recommendationId` | Edit or record a recommendation review status |

## Settings

Open **Settings** to edit your name, email, profile image URL, and password; configure project details, theme, notifications, and compact layout; and view workspace members. Email changes require the current password. Owners can rotate team invite codes. The AI model is workspace-configurable; a provider key entered here is encrypted at rest with AES-256-GCM and is never returned by the API. Set `SETTINGS_ENCRYPTION_KEY` first. If you prefer a server-wide AI key, configure `OPENAI_API_KEY` in `backend/.env` instead. Workspace data is scoped by the authenticated workspace ID across all project APIs.
