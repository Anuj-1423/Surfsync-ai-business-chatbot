# SurfSync AI Business Chatbot

A responsive business assistant grounded in the published content at [surfsyncinfotech.in](https://surfsyncinfotech.in/). The project includes an optional server-side OpenAI-compatible chat integration, a grounded local response mode that works without an AI key, and consent-based SQLite lead capture.

## Features

- Responsive business-chat interface styled around SurfSync's orange, warm-white, and charcoal website palette.
- Verified company knowledge in [`data/company.json`](data/company.json), including its services, products, contact details, published client story, and explicit unknowns around pricing, timelines, and support policies.
- Optional OpenAI Chat Completions API integration. The API key remains on the server; the model receives a restrictive instruction to use only the included knowledge.
- No-key fallback responses for common company questions, including an explicit fallback when a fact cannot be verified.
- Lead form with field validation and affirmative consent, backed by a local SQLite database.
- Basic HTTP input-size limits, chat rate limiting, security headers, and clear errors.
- Native Node.js implementation; no application dependencies to install.

## Requirements

- Node.js 22.13 or newer (Node 24 LTS is recommended).
- An OpenAI API key only if AI-generated, context-aware conversations are needed. Without it, the deterministic knowledge-base chatbot remains usable. API usage may incur charges; get company approval before setting a paid API key.

## Run locally

```powershell
npm start
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database is created at `data/leads.sqlite`; the `data/` runtime files are git-ignored.

To enable AI responses, set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in your shell or hosting dashboard (for example, `$env:OPENAI_API_KEY="..."` in PowerShell before running the server). `.env.example` documents supported settings; the app does not automatically load `.env` files. Never put keys in frontend files or commit them.

Supported server settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listening port |
| `DATABASE_PATH` | `./data/leads.sqlite` | SQLite database path |
| `OPENAI_API_KEY` | unset | Enables OpenAI-compatible generated responses |
| `OPENAI_MODEL` | `gpt-4o-mini` | Chat completions model |
| `OPENAI_BASE_URL` | OpenAI chat completions URL | Optional compatible API endpoint |

`OPENAI_BASE_URL` and credentials must point to an API provider approved by SurfSync. An empty key is a supported, fully working non-generative mode.

## Lead capture and privacy

The lead form captures name, email, optional phone, requested service, project description, and optional budget and timeline. The form requires explicit consent; the server independently checks consent and validates the submission before inserting it into the `leads` SQLite table. A successful submission returns a reference number.

Leads are stored on the application server; no email or CRM delivery has been configured. The SurfSync team must access the database or configure a later CRM/email integration. Before production, configure a persistent, access-controlled database volume, agree a retention/deletion policy, and verify the company's privacy notice and consent wording. Do not deploy on ephemeral storage if lead records must survive restarts or redeployments. SQLite is suitable for a small single-instance MVP; use a managed database for concurrent multi-instance deployments.

## Testing

Run the server and lead-capture/API checks:

```powershell
npm test
```

Test report (2026-10-14): **8 passed, 0 failed.** Automated checks cover static serving, security headers, health status, verified service and pricing answers, contextual follow-ups and unknown-question fallback, chat validation, lead consent/email validation, and writing a valid lead to SQLite. Manual browser checks confirmed the chat and lead form flow and no horizontal overflow at a 390px viewport. The browser test lead was removed after verification.

## Deployment

This app is a standard Node.js HTTP service. The included [`render.yaml`](render.yaml) prepares it for Render in Singapore with a 1 GB persistent disk for SQLite:

1. Create a **private** Git repository and push the project source.
2. In Render, create a Blueprint instance from that repository and review the plan and region before applying.
3. The blueprint selects Render's `starter` web-service plan and a persistent 1 GB disk. Review the current Render charges and get SurfSync's approval before provisioning; neither service creation nor charges are triggered by this source file.
4. Add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in Render's secret/environment settings only if AI-provider use is approved. Otherwise the knowledge-grounded fallback is available.
5. Deploy and verify `/api/health`, a service question, an unknown question, consent-required lead validation, and a successful test lead.
6. Restrict production database access, arrange lead handover to SurfSync, and delete test data.

The application source and Render blueprint are prepared, but no live URL is included: this workspace has no Git repository, Render-account connection, or approved AI-provider key. Deployment and public URL verification require a private repository connected to Render, access to the Render account, approval of any paid services, and (for generated AI responses) an approved provider key.

## Business content provenance and limits

The source URL and access date are recorded inside `data/company.json`. The information was taken from the official homepage's service, about, products, projects, FAQ, testimonial, and contact content as accessed on 2026-10-14. The site lists React Native and Flutter but does not publish a complete stack list. It does not publish prices, standard timelines, or detailed maintenance/SLA terms; these are stated as unknown rather than invented. The published homepage shows a Drive Tribe Tyres testimonial, not a verifiable project case-study URL.

## Handover checklist

- [ ] Private source repository URL shared with the company.
- [ ] Hosting account and persistent storage configured and approved.
- [ ] Production public URL opened and tested on desktop and mobile.
- [ ] AI-provider key added as a hosting secret, if approved.
- [ ] SQLite/managed database access and lead-processing owner handed over.
- [ ] Retention, deletion, privacy-notice, and CRM/email integration decisions completed.
