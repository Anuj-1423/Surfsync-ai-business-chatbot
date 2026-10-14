# SurfSync AI Business Chatbot

A responsive, conversational website for SurfSync Infotech grounded in information published at [surfsyncinfotech.in](https://surfsyncinfotech.in/). The implementation uses Next.js App Router with TypeScript, a server-side OpenAI-compatible chat provider, Supabase PostgreSQL lead storage, and Zod validation.

## Features

- Next.js/React chat interface with short, contextual replies, follow-up questions, mobile layout, suggested prompts, and project-enquiry handoff.
- Verified company information in [`data/company.json`](data/company.json); unknown prices, delivery times, product details, and policies are not invented.
- OpenAI-compatible Chat Completions integration runs exclusively on the server. It supports OpenAI by default and compatible providers such as OpenRouter through `OPENAI_BASE_URL`. A knowledge-based response mode keeps local development usable if no key is configured or the model temporarily fails.
- Validated lead submission with required consent and server-generated timestamps.
- Consent-confirmed live human handoff: visitors can share their current transcript, join a waiting queue, and continue in the same chat after a team member accepts.
- Authenticated `/team` inbox with agent availability, request acceptance, transcript access, replies, and chat closeout.
- Separate account flows: visitors can register and sign in from the chat panel; staff accounts are provisioned by SurfSync and can sign in only to the team inbox. Staff can review named customer histories and chatbot queries.
- Supabase leads table with Row Level Security, no public read/write policies, server-only service-role use, and an idempotency UUID to prevent repeat submissions.
- SQLite lead storage for local development only; production requires Supabase configuration.
- Zod request validation, request-size limits through field schemas, in-memory endpoint rate limiting, safe responses, response security headers, and prompt-injection instructions.
- Health endpoint reports whether the AI and Supabase are configured without returning secret values.

## Requirements

- Node.js 22.13+.
- An API key from an OpenAI-compatible provider for generated AI responses. Without it, the local, deterministic, knowledge-grounded response path is used. Check provider limits and costs before enabling a key; get SurfSync approval before using a paid account.
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
| `OPENAI_API_KEY` | Server-only provider key; leave empty for local knowledge-based responses |
| `OPENAI_BASE_URL` | Optional OpenAI-compatible API base URL. For OpenRouter, use `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | Provider model identifier. Defaults to `gpt-4o-mini`; for OpenRouter's free router use `openrouter/free` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, used only in server handlers |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public Supabase Auth key used by customer and team sign-in; `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as a legacy fallback |
| `SUPABASE_SECRET_KEY` | Privileged server-only credential; `SUPABASE_SERVICE_ROLE_KEY` is accepted as a legacy fallback. Never prefix either with `NEXT_PUBLIC_` |
| `LEAD_NOTIFICATION_EMAIL` | Enquiry notification recipient; defaults to `anujsingh41086@gmail.com` |
| `GMAIL_USER` | Gmail account used by the server to send lead notifications |
| `GMAIL_APP_PASSWORD` | Gmail App Password; do not use the account's normal password |

Never commit `.env.local`, provider keys, or Supabase service-role credentials.

## Supabase setup

1. Create an approved Supabase project.
2. In its SQL editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. Configure `NEXT_PUBLIC_SUPABASE_URL` and either `SUPABASE_SECRET_KEY` or the legacy `SUPABASE_SERVICE_ROLE_KEY` in the local `.env.local` file or server environment.
4. Keep Row Level Security enabled. The schema revokes table access from `anon` and `authenticated` and grants it only to `service_role`. The app never exposes a leads read endpoint.
5. Verify the application can create a lead; test that anonymous Supabase clients cannot read, update, or delete rows.

The service-role key bypasses RLS and is used only inside server API routes. Do not put it in browser code or a `NEXT_PUBLIC_` variable.

## Customer accounts and team inbox setup

1. Run [`supabase/live-chat.sql`](supabase/live-chat.sql) in the same approved Supabase project after `supabase/schema.sql`. It creates customer profiles, query history, handoff conversations, and the staff allowlist.
2. In Supabase Authentication, create an email/password user for each team member. Add each staff account to `public.team_agents` from the SQL editor, replacing the UUID and display name:

   ```sql
   insert into public.team_agents (user_id, display_name)
   values ('AUTH_USER_UUID', 'Team member name');
   ```

3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` in the app environment. Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` names are also supported. Separate browser storage keys keep team and customer sign-ins independent. Chat, profile, and history data are accessed only through authenticated server routes.
4. Visitors create accounts or sign in in the visitor panel before chatting. Supabase email confirmation settings determine whether new users need to verify their email before first sign-in.
5. Team members sign in in the separate team panel (or at `/team`). The panel marks them online while it is open in a visible tab. Its **Requests** section shows customer names and previous chat context; **User queries** shows saved chatbot questions and answers.
6. Visitors select **Talk to a person** and confirm that their conversation can be shared. The request appears in the common queue. The first online team member to accept opens the same live chat on both sides.

Customer sign-in, query history, and live handoff require Supabase configuration and the SQL setup above. Staff are marked online by keeping the inbox open in a visible browser tab. Handoff transcripts and chatbot queries are retained in Supabase; set a retention/deletion policy with the company before production use.

## API routes

- `GET /api/customer` verifies a signed-in customer account and returns its profile and latest conversation history. `POST /api/chat` requires that customer's bearer token, accepts `{ "message": "...", "history": [...], "conversationId": "..." }`, and saves the question and response for the team history view.
- `POST /api/leads` validates the lead, requires `consent: true`, and returns a server-created reference only after storage succeeds. The `submissionId` UUID makes client retries idempotent.
- Lead notifications are emailed to `LEAD_NOTIFICATION_EMAIL` (defaults to `anujsingh41086@gmail.com`) after storage. Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env.local`; use a Google App Password generated with 2-Step Verification enabled. A mail delivery issue does not discard the saved enquiry.
- `GET /api/health` returns service status and AI/database configuration booleans only.

## Tests and production build

```powershell
npm test
npx tsc --noEmit
npm run build
```

The automated tests cover request/lead validation, grounding and injection instructions, unknown/pricing fallback, rate limiting, chat API responses, health configuration disclosure, SQLite development lead capture, preservation of legacy local leads during schema migration, explicit consent, and duplicate lead retries.

See [`TESTING.md`](TESTING.md) for the latest local test results and what this report does not cover.

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

The knowledge base records the official SurfSync website and the assignment brief as sources. The chatbot covers the assignment's digital-marketing, logo-design, Shopify, and n8n enquiry topics, while explaining that the team confirms exact deliverables and feasibility after discovery. The portfolio includes individual chatbot project-story pages at `/projects/drive-tribe-tyres` and `/projects/infocus-publications`, each summarizing a published client story and linking to SurfSync's official projects page. SurfSync does not publish a separate public detail URL for each story in the reviewed source content. The website does not publish project pricing, detailed product specifications, or a specific maintenance/SLA policy.

Project enquiries can be submitted through a guided chat flow. The chatbot requests explicit consent first, then collects and validates name, email, optional phone, service, project description, optional budget, and timeline before saving and sending the enquiry.

The local fallback is intentionally not a substitute for the configured AI provider; the service health endpoint identifies whether a provider key is present. OpenRouter's free model router may select different models over time, so answers and availability can vary. In-memory rate limits are best-effort per server instance and should be replaced with shared rate limiting before substantial production traffic. Gmail lead notifications are supported; CRM integration is not included. If email delivery fails, the enquiry remains stored in Supabase and the UI tells the customer. Supabase lead access remains restricted to server-side service-role operations.
