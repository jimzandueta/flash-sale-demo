# Flash Sale Platform

Flash Sale Platform is a thin React storefront backed by Fastify handlers, Redis reservation state, DynamoDB persistence hooks, and queue-driven reconciliation workers. The local flow mirrors the intended product journey: landing, product list, product page, checkout, payment confirmation, and final order confirmation.

## Run locally

1. Start the local stack with `docker compose up --build`.
2. Open the frontend at `http://localhost:5173` and the API at `http://localhost:3000`.
3. Run `npm run build` to verify TypeScript compilation.
4. Run `npm run test:unit` for unit coverage.
5. Run `npm run test:ui` for the storefront contract tests.
6. Run `npm run test:integration` if Redis is exposed on the default host port.
7. If Redis is mapped to another host port, run `REDIS_URL=redis://127.0.0.1:<port> npm run test:integration`.
8. Run `npm run stress` to execute the k6 reservation spike harness.

Host ports can be overridden in `.env.example` through `REDIS_HOST_PORT`, `DYNAMODB_HOST_PORT`, `LOCALSTACK_HOST_PORT`, `API_HOST_PORT`, and `FRONTEND_HOST_PORT`.

## Architecture

- React + Vite SPA for the local storefront flow.
- Fastify local API wiring session, sales, reservation, reservation read, and checkout handlers.
- Redis-backed reservation engine for live stock allocation and idempotent holds.
- DynamoDB reservation ledger hooks plus queue-backed worker and expiry sweeper stubs.
- Docker Compose + LocalStack for local infrastructure parity.
- Terraform dev environment under `infra/envs/dev` for AWS infrastructure provisioning.