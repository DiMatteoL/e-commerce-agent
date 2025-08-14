### Spec 06 – Error Handling and OAuth Prompt Contract

- **Status**: Proposed
- **Owner**: Platform/AI
- **Last Updated**: 2025-08-14
- **Scope**: Error model and propagation

### Summary
Define a structured error contract to indicate that the user must connect Google. This enables the chat stream to emit an actionable SSE event and the UI to render a CTA.

### Error Contract
- Shape:
```json
{
  "code": "NEEDS_GOOGLE_OAUTH",
  "message": "Connect Google to use GA4 tools.",
  "authorizeUrl": "/api/auth/signin?provider=google&callbackUrl=/"
}
```
- Origin: Thrown by Spec 04 helpers or rethrown by Spec 05 tools when no Google account exists for the user.
- Propagation: Caught in Spec 07 agent loop to emit an SSE `action` event.

### Implementation Notes
- Define a small TypeScript error class or a tagged error object.
- Include a user-friendly message and an `authorizeUrl` computed with a sensible `callbackUrl`.

### Acceptance Criteria
- Tools/helpers throw this exact structure when authorization is missing.
- Chat route/agent loop recognizes the error and emits a single SSE action event.

### Tests
- **Shape validation**: Unit test ensures error includes `code`, `message`, `authorizeUrl`.
- **Upstream propagation**: A tool that calls the helper without a Google account propagates the same error object.
- **Downstream handling**: In the agent loop (Spec 07), receiving this error results in an SSE event `{ type: 'action', action: 'connect_google', url }` and a brief assistant message prompting connection.
