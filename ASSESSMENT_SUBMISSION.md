# Assessment Submission

## Project Name

SurfSync AI Business Chatbot

## Live URL

https://surfsync-ai-business-chatbot-nzxwqgmps.vercel.app/

This URL was supplied for the submission. A live HTTP response could not be obtained from the documentation environment, so deployment availability has not been independently verified here.

## Source Code Repository

Not provided. The source code is in the project workspace delivered with this document.

## Technology Stack

- Next.js 16.4.0 App Router and React 19.2 with TypeScript
- Node.js 22.13 or newer
- Zod request validation
- Supabase PostgreSQL and Supabase Auth for configured production use
- SQLite for local development lead storage when Supabase is not configured
- Resend HTTPS API or Gmail SMTP for optional lead notifications
- Vercel is the hosting platform indicated by the supplied `vercel.app` URL

## AI Provider

The application integrates with OpenAI Chat Completions and supports OpenAI-compatible providers through `OPENAI_BASE_URL`. OpenAI is the default provider configuration. Without an API key, or when the provider fails, the application uses its deterministic knowledge-based fallback. The provider and model currently configured on the supplied deployment could not be verified.

## Lead Storage or Delivery

The guided enquiry flow requests consent before collecting personal information. It validates the customer's name, email, optional phone number, service, project description, optional budget, and expected timeline. The server stores the enquiry in Supabase when configured; local development falls back to SQLite. Production returns an error if Supabase storage is not configured. A submission UUID makes retries idempotent. After a successful save, the server can send an email notification through Resend or Gmail. A failed email alert does not discard the saved enquiry.

The live deployment's database and email configuration could not be inspected. The production database must be configured before lead capture can work there.

## Deployment Platform

Vercel (indicated by the supplied URL). Deployment availability and production environment configuration were not independently verified from this environment.

The project is prepared for a Next.js deployment. Before deployment, configure the required environment variables in the hosting provider and run `supabase/schema.sql`. For customer accounts and live team handoff, also run `supabase/live-chat.sql` and provision team accounts as described in `README.md`.

## Testing Report

Checks run on 15 October 2026:

- `npm test`: passed, 19 tests, 0 failures, including regression coverage for provider safety text and casual greetings.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed with Next.js 16.4.0; production routes were generated for the home page, customer chat, team inbox, project list and both project stories, plus the API routes.
- Supplied live URL: not independently verified; HTTP access from the test environment did not return a status code.

The tests cover validation, grounded answers and fallbacks, prompt-injection instructions, provider safety-metadata fallback, casual greetings, lead consent and idempotency, SQLite storage and migration, rate limiting, health configuration disclosure, and a mocked Resend request. `TESTING.md` contains the existing local and integration test report, including its scope and limitations. The automated tests do not verify the supplied deployment or its live database, AI, and email settings.

## Known Limitations

- The live URL was supplied but could not be independently checked from this environment.
- The source repository URL was not supplied.
- The deployed AI provider, model, database, and email environment variables are unknown.
- Production lead capture requires Supabase configuration. SQLite is intended only for local development.
- The company has not published project prices, detailed specifications for all products, or a specific maintenance/SLA policy; the chatbot avoids inventing these details and refers visitors to the team.
- Digital marketing, logo design, Shopify, and n8n enquiries are supported, but specific scope and feasibility are confirmed by the team.
- Rate limiting is in memory and best-effort per server instance; shared rate limiting is advisable for substantial production traffic.
- The full visual browser walkthrough and mobile team-inbox walkthrough remain outstanding in the existing testing report.
- The company should set a retention and deletion policy for saved customer chats, queries, and handoff transcripts.
- Vercel's Node.js major is pinned to `22.x` in `package.json` to avoid automatically moving to a future major version.

## Completion Date

15 October 2026, 12:19 IST (documentation and local verification). The assignment's original commencement time was not provided, so the 48-hour deadline calculation cannot be confirmed.

## Business Knowledge Base

The structured knowledge base is `data/company.json`; response grounding and fallback behavior are implemented in `lib/knowledge-base.ts`. It contains verified company information, service descriptions, products, portfolio stories, process, timelines, maintenance information, FAQs, contact details, and source pages. The official SurfSync site pages recorded as sources are listed in the JSON file. Unsupported prices, policies, specifications, or commitments are answered with a limitation and a route to the team.

## Environment Configuration Guide

Copy `.env.example` to `.env.local` for local development, then enter credentials only in the local environment file or hosting provider's protected environment settings. Do not commit `.env.local` or expose server secrets in browser code.

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-side key for the configured OpenAI-compatible provider. Optional for local fallback mode. |
| `OPENAI_BASE_URL` | Optional API base URL for a compatible provider. |
| `OPENAI_MODEL` | Provider model identifier; defaults to `gpt-4o-mini`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase browser Auth key; the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` name is also accepted. |
| `SUPABASE_SECRET_KEY` | Server-only Supabase privileged key; legacy `SUPABASE_SERVICE_ROLE_KEY` is also accepted. Never use a `NEXT_PUBLIC_` prefix for this secret. |
| `RESEND_API_KEY` | Optional server-side Resend key for HTTPS email delivery. |
| `LEAD_EMAIL_FROM` | Optional verified sender address for Resend. |
| `LEAD_NOTIFICATION_EMAIL` | Enquiry recipient; defaults to the address documented in `.env.example`. |
| `GMAIL_USER` | Optional Gmail SMTP account for local or supported environments. |
| `GMAIL_APP_PASSWORD` | Gmail App Password for SMTP; do not use the normal account password. |

Supabase customer/team features require the publishable key and server secret. Lead storage in production requires the Supabase URL and server secret. Email notification requires either Resend or Gmail configuration.

## Setup Documentation

Requirements: Node.js 22.13 or newer and npm.

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Run the project checks with:

```powershell
npm test
npx tsc --noEmit
npm run build
```

For Supabase setup, run `supabase/schema.sql`. For customer accounts and live human handoff, run `supabase/live-chat.sql`, configure the Supabase URL and keys, create staff users in Supabase Auth, and add their IDs to `public.team_agents`. Detailed setup and operation instructions are in `README.md`.

## Deployment Details

The supplied URL indicates Vercel hosting. To deploy the source, connect the project repository to Vercel, select the Next.js framework, add the production environment variables listed above, apply the required Supabase SQL scripts, and deploy. Verify `/api/health`, customer registration/sign-in, grounded and unknown questions, lead validation and persistence, email notification, team handoff, and the interface on desktop and mobile. Do not treat this checklist as evidence that the live deployment has passed those checks.

The source workspace has no verified repository URL or confirmed production account configuration available in this submission. Access handover must be completed through the company-approved repository, hosting, and Supabase accounts; no credentials belong in this document.
