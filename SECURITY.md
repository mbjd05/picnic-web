# Security Policy

Picnic Web is an unofficial client. Do not include Picnic account credentials,
auth tokens, cookies, raw account payloads, order data, addresses, or payment
details in public issues, pull requests, screenshots, or logs.

## Reporting Security Issues

Please report security-sensitive issues privately to the repository owner through
GitHub's private vulnerability reporting when available. If that is not
available, open a minimal public issue that says a private security report is
needed, without including exploit details or private account data.

## Local Secrets

The following files are intentionally ignored and must stay local:

- `.env`
- `.dev.vars`
- `apps/api/.dev.vars`
- local logs
- Playwright artifacts
- build output

`.env.example` must remain placeholder-only.

## Authentication Handling

The application stores Picnic auth tokens in HTTP-only cookies. Production code
must not log tokens, passwords, email addresses, request bodies, cookies, or raw
Picnic payloads.
