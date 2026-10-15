# Testing report

**Project:** SurfSync AI Business Chatbot
**Review date:** 2026-10-15
**Scope:** Local implementation checks. Deployment checks are excluded.

## Results

| Check | Result |
| --- | --- |
| `npm test` | Passed: 19 tests, 0 failures; includes provider safety-metadata fallback, casual greeting fallback, and a mocked Resend HTTPS send |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed; production build and route generation completed |
| HTTP route smoke checks | Passed: `/`, `/chat`, `/team`, `/projects`, and both project stories returned 200; unknown route returned 404 |
| API guard checks | Passed: unauthenticated customer, handoff, and chat requests were rejected; invalid or unconsented lead requests were rejected |
| Browser smoke checks | Passed: login/registration panels render, registration reveals name field, project cards open their corresponding stories, no horizontal overflow at 390px on the project story page |
| Live Supabase customer/team auth | Passed: authorized team account signed in and matched the active team allowlist; a temporary customer account signed in successfully and was deleted after testing |
| Live AI and query persistence | Passed: an actual provider response was returned and the authenticated question/answer row was saved in Supabase; temporary row/account were cleaned up |
| Live team handoff | Passed through real HTTP APIs: request appeared in team inbox, team accepted and replied, customer read reply, and customer closed chat |
| Closed-chat reload behavior | Initially failed: closed chats were returned by the customer history endpoint. Fixed to return no current chat, rebuilt, and retested successfully (`chat: null` after close) |
| Gmail enquiry notification | Passed at SMTP send: a marked test enquiry returned `emailSent: true`; its Supabase lead row was deleted afterward. Inbox receipt was not independently checked |

The automated suite covers chat and lead request validation, prompt-injection instructions, grounded fallback responses, provider safety-metadata fallback, casual greeting fallback, pricing and unknown-service replies, portfolio links, rate limiting, the unavailable-Supabase response, health configuration disclosure, and consent-checked/idempotent local SQLite lead storage including legacy-schema migration. Existing fallback expectations cover assignment-required services and individual project-story links.

## Limits of this report

- The tests use local SQLite and do not submit a lead to the configured Supabase project.
- Gmail notification delivery and live OpenRouter responses are not exercised by the automated suite.
- The real customer/team handoff was exercised end to end through the production HTTP APIs; the full visual browser flow and mobile team inbox still need a browser walk-through. The earlier mocked browser harness timed out before reaching its expected state.
- Gmail SMTP was accepted in the local integration check (`emailSent: true`); actual inbox placement was not independently verified. Render Free blocks outbound SMTP, so production email should use the Resend HTTPS path after its API key and sending domain are configured.
- The live AI test consumed the configured provider quota, and the marked Gmail test message was sent to the configured recipient. Temporary customer, chat, query, and lead database records were removed after the checks.
- Production deployment is excluded.
- The assignment brief calls for digital marketing, logo design, Shopify, and n8n coverage; the chatbot now explains these enquiry areas and says the team confirms scope and feasibility. The official website does not publish detailed deliverables for these areas.
- SurfSync's reviewed source publishes client stories but no direct per-project URLs. The app now provides individual local story pages that summarize the published details and link to the official projects page; these are not external client websites.

## Business knowledge sources reviewed

- [SurfSync homepage](https://surfsyncinfotech.in/)
- [About SurfSync](https://surfsyncinfotech.in/about)
- [SurfSync projects](https://surfsyncinfotech.in/projects)
- [Magento development](https://surfsyncinfotech.in/services/ecommerce-cms/magento)
- [Angular development](https://surfsyncinfotech.in/services/web/angular)
