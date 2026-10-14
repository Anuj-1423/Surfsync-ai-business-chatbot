# SurfSync AI Business Chatbot

A responsive, conversational website for SurfSync Infotech grounded in information published at [surfsyncinfotech.in](https://surfsyncinfotech.in/). The implementation follows the project PRD: Next.js App Router with TypeScript, OpenAI server-side chat, Supabase PostgreSQL lead storage, Zod validation, and a Vercel-ready deployment.

## Features

- Next.js/React chat interface with short, contextual replies, follow-up questions, mobile layout, suggested prompts, and project-enquiry handoff.
- Verified company information in [`data/company.json`](data/company.json); unknown prices, delivery times, product details, and policies are not invented.
- OpenAI Chat Completions integration runs exclusively on the server. A knowledge-based response mode keeps local development usable if no API key is configured or the model temporarily fails.
- Validated lead submission with required consent and server-generated timestamps.
- Supabase leads table with Row Level Security, no public read/write policies, server-only service-role use, and an idempotency UUID to prevent repeat submissions.
- SQLite lead storage for local development only; production requires Supabase configuration.
- Zod request validation, request-size limits through field schemas, in-memory endpoint rate limiting, safe responses, response security headers, and prompt-injection instructions.
- Health endpoint reports whether the AI and Supabase are configured without returning secret values.

## Requirements

- Node.js 22.13+.
- OpenAI API key for generated AI responses. Without it, the local, deterministic, knowledge-grounded response path is used. OpenAI usage may incur charges; get SurfSync approval before setting a paid key.
- Supabase project for production lead persistence.
- Vercel project/account for deployment.

## Run locally

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Supabase credentials, leads are saved to local SQLite at `data/leads.sqlite` for development. Do not use that local database as production storage.

Copy `.env.example` to `.env.local` and set the approved values. Next.js loads `.env.local` during development:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-only OpenAI secret; leave empty for local knowledge-based responses |
| `OPENAI_MODEL` | OpenAI chat model; defaults to `gpt-4o-mini` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, used only in server handlers |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Documented for the project setup; not needed by the server-only leads flow and never grants lead access |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged server-only credential; never prefix it with `NEXT_PUBLIC_` |

Never commit `.env.local`, provider keys, or Supabase service-role credentials.

## Supabase setup

1. Create an approved Supabase project.
2. In its SQL editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. Configure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the local `.env.local` file or deployment secrets.
4. Keep Row Level Security enabled. The schema revokes table access from `anon` and `authenticated` and grants it only to `service_role`. The app never exposes a leads read endpoint.
5. Verify the application can create a lead; test that anonymous Supabase clients cannot read, update, or delete rows.

The service-role key bypasses RLS and is used only inside server API routes. Do not put it in browser code or a `NEXT_PUBLIC_` variable.

## API routes

- `POST /api/chat` accepts `{ "message": "...", "history": [{ "role": "user|assistant", "content": "..." }] }` and returns `{ "answer": "...", "status": "success|fallback" }`.
- `POST /api/leads` validates the lead, requires `consent: true`, and returns a server-created reference only after storage succeeds. The `submissionId` UUID makes client retries idempotent.
- `GET /api/health` returns service status and AI/database configuration booleans only.

## Tests and production build

```powershell
npm test
npx tsc --noEmit
npm run build
```

The automated tests cover request/lead validation, grounding and injection instructions, unknown/pricing fallback, rate limiting, chat API responses, health configuration disclosure, SQLite development lead capture, preservation of legacy local leads during schema migration, explicit consent, and duplicate lead retries.

## Deploy to Vercel

1. Push this project to a GitHub repository.
2. Import the repository in Vercel and use the Next.js framework preset.
3. Add `OPENAI_API_KEY`, `OPENAI_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` to the Vercel project’s environment settings. Add the anon key only if needed for later client features; the current app does not use a client Supabase connection.
4. Run [`supabase/schema.sql`](supabase/schema.sql) in the selected production project before deployment.
5. Deploy and verify `/api/health`, grounded service questions, an unknown question, invalid lead rejection, missing-consent rejection, successful lead creation, and duplicate retries. Test the UI at mobile and desktop sizes.
6. Confirm OpenAI and hosting costs with SurfSync before enabling paid usage. Set budget alerts and review provider rate limits.
7. Hand over the private database access procedure, retention/deletion policy, and lead-processing owner to the company.

No public Vercel URL is included yet: the workspace does not have a connected GitHub repository, Vercel project credentials, Supabase project URL/service key, or an approved OpenAI API key. The code and deployment configuration are prepared; deployment and production database/model verification remain dependent on company account setup.

## Verified business content and limitations

The knowledge base records `https://surfsyncinfotech.in/` as its source and was reviewed on 2026-10-14. It includes SurfSync's listed services, products, Noida contact details, ISO 9001:2015 statement, 4+ countries-served statement, published Drive Tribe Tyres testimonial, and listed industries. The website does not publish pricing, standard project timelines, detailed product specifications, or a specific maintenance/SLA policy. The assistant must say when information is unavailable.

The local fallback is intentionally not a substitute for the configured OpenAI integration; the service health endpoint identifies when OpenAI is unavailable. In-memory rate limits are best-effort per server instance and should be replaced with shared rate limiting before substantial production traffic. No email/CRM lead delivery or admin dashboard is included. Supabase lead access remains restricted to server-side service-role operations.
