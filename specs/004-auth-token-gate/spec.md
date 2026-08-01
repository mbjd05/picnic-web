# Feature Specification: Auth Token And Credential Gate

**Feature Branch**: `004-auth-token-gate`
**Created**: 2026-03-30
**Status**: Draft
**Input**: User description: "Let's add authentication. We will stop using the .env file. This means that the PICNIC_AUTH_TOKEN will not be used anymore and has to be entered by the user themselves before they can do anything on the website. Not a single page nor future pages should be accessible without having entered a picnic auth token first."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Enter Auth Token Or Credentials to Access the Application (Priority: P1) 🎯 MVP

A user visits the website for the first time (or after their session has been cleared). Instead of seeing the search page or any other content, they are presented with a login screen that supports Picnic auth token login and credential login. If the submitted token or credential flow is accepted, they are taken to the main search page and can use the application normally. The resulting session is remembered for subsequent visits so the user does not need to re-enter it every time.

**Why this priority**: This is the core gating mechanism. Without it, the application either shows nothing (no .env token) or is completely open. Every other feature depends on a valid token being present.

**Independent Test**: Visit the application with no stored session. Verify the login screen appears. Enter a valid token or valid credentials. Verify the application becomes fully accessible.

**Acceptance Scenarios**:

1. **Given** the user has no stored session, **When** they visit any page on the website, **Then** they see only the login screen with no access to any other content.
2. **Given** the user is on the login screen, **When** they enter a valid Picnic auth token or valid credentials and complete any required 2FA verification, **Then** they are redirected to the main search page and can use the application normally.
3. **Given** the user has previously entered a valid token, **When** they revisit the website in a new browser session, **Then** they are taken directly to the application without being asked for a token again.
4. **Given** the user is on the login screen, **When** they submit an empty token or incomplete credentials, **Then** they see a validation message and are not granted access.

---

### User Story 2 — Token Validation Feedback (Priority: P1)

A user enters an invalid or expired token, or credentials that Picnic rejects. The system attempts to authenticate and determines the submission is not working. The user is shown a clear error message explaining that authentication failed or could not be verified, and they remain on the login screen to try again.

**Why this priority**: Without validation feedback, users would enter a bad token and encounter broken behavior throughout the app. Clear feedback is essential for usability.

**Independent Test**: Enter a clearly invalid token string (e.g., "abc123") or invalid credentials. Verify an error message is displayed and the user remains on the login screen.

**Acceptance Scenarios**:

1. **Given** the user is on the login screen, **When** they enter an invalid token or invalid credentials and submit, **Then** they see an error message indicating authentication failed and remain on the login screen.
2. **Given** the user is on the login screen, **When** they enter a malformed token (random text, incomplete token), **Then** they see the same clear error message without the application crashing or showing a blank page.

---

### User Story 3 — Sign Out / Change Token (Priority: P2)

A user who is currently authenticated wants to sign out or switch to a different token/account (e.g., they have multiple Picnic accounts or the token has expired). They click a sign-out action, which clears the stored session for the active region and returns them to the login screen.

**Why this priority**: Important for token management but not required for basic access. Users need a way to recover if their token expires or if they need to switch accounts.

**Independent Test**: Log in with a valid token or credentials. Click the sign-out action. Verify the login screen is shown and the previously stored session for that region is no longer used.

**Acceptance Scenarios**:

1. **Given** the user is authenticated and using the application, **When** they click the sign-out action, **Then** their stored session for the active region is cleared and they are returned to the login screen.
2. **Given** the user has signed out, **When** they enter a different valid token, **Then** they can access the application using the new token.

---

### Edge Cases

- What happens when the user's stored session expires while they are actively using the application? The application should detect the failure on the next server request and redirect the user back to the login screen with a message that their session has expired.
- What happens if the user directly navigates to a deep URL (e.g., a future page like `/settings`) without a session? They should be redirected to the login screen, and after completing login, be taken to their originally requested page.
- What happens if the user clears their browser storage manually? The application treats this the same as having no valid session — the login screen is shown on next visit.
- What happens if the Picnic API is unreachable during token validation? The user should see an appropriate error message distinguishing between "invalid token" and "unable to verify token at this time."

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST NOT read auth tokens from environment variables or server-side configuration files. The `.env` file MUST NOT be used for the `PICNIC_AUTH_TOKEN`.
- **FR-002**: The system MUST present a login screen when no valid authenticated Picnic session is stored for the current user and selected region.
- **FR-003**: The system MUST block access to all pages and application functionality until a valid authenticated Picnic session has been established.
- **FR-004**: The system MUST persist the user's auth token in the browser as an HTTP-only cookie so it survives page reloads and new browser sessions and is automatically sent with every request to the server.
- **FR-005**: The system MUST validate the submitted token by making a test request to the Picnic API before granting access.
- **FR-006**: The system MUST display a clear, user-friendly error message when a submitted token is invalid, expired, or cannot be verified.
- **FR-007**: The system MUST provide a sign-out button in the site header, visible on every page, that clears the stored session for the active region and returns the user to the login screen.
- **FR-008**: The system MUST read the user-provided token from the HTTP-only cookie on the server side and pass it to all Picnic API requests instead of using a server-side environment variable.
- **FR-009**: The system MUST redirect unauthenticated users attempting to access any page to the login screen.
- **FR-010**: The login screen MUST include clear mode-specific labels for auth token and credential login, masked secret fields with show/hide toggles, and submit buttons. If Picnic requires 2FA, the flow MUST request and verify the 2FA code before completing login.
- **FR-011**: The system MUST handle API request failures caused by an expired or revoked token/session by redirecting the user back to the login screen with an appropriate message.

### Key Entities

- **Auth Token**: A Picnic API authentication token provided by the user or produced by a credential login flow. Key attributes: the token string itself, its HTTP-only storage location, associated region, and validity state (valid, invalid, expired, unknown, requires 2FA).
- **Auth State**: The current authentication state of the user session. Possible values: unauthenticated (no token stored), validating (token submitted, verification in progress), authenticated (valid token confirmed), error (validation failed).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pages and application features are inaccessible without a valid auth token — no content leaks through to unauthenticated users.
- **SC-002**: Users can enter their token and gain access to the application in under 30 seconds.
- **SC-003**: When an invalid token is submitted, the user sees a clear error message within 5 seconds.
- **SC-004**: A returning user with a previously stored valid token can access the application immediately without re-entering their token.
- **SC-005**: After signing out, the user's token is fully cleared and they cannot access any application content without entering a new token.
- **SC-006**: The application no longer depends on any server-side environment variable for the Picnic auth token.

## Clarifications

### Session 2026-03-30

- Q: How should the browser send the stored auth token to the server on each request? → A: HTTP-only cookie — token stored as a cookie, auto-sent with every request. Server reads it directly. Enables middleware-level gating.
- Q: Should the auth token input field mask the token text or show it as plaintext? → A: Masked by default with a show/hide toggle button so users can verify their paste.
- Q: Where should the sign-out action be placed in the UI? → A: In the site header, visible on every page.

## Assumptions

- Users may possess a valid Picnic auth token obtained through external means, or may use the supported email/password flow to create a session through Picnic's authentication API.
- A pasted token is a single opaque string from the user's perspective. Credential login may produce a partial token that requires 2FA before it becomes a full authenticated session.
- Token validation can be performed by making a lightweight test request to the Picnic API (e.g., a search query or catalog call) and checking for a successful response.
- Full auth tokens are stored as HTTP-only cookies, automatically sent with every request to the server. Browser-visible storage MUST NOT contain full auth tokens, passwords, or email addresses. The app may keep separate sessions per Picnic region so switching region and switching back does not unnecessarily discard a still-valid session.
- There is only one user role — any valid token grants full access to all application features.
- The `.env` file may continue to exist in the repository for other non-auth environment variables in the future, but `PICNIC_AUTH_TOKEN` will be removed from it.
