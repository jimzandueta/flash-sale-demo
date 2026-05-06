# Flash Sale Platform

A flash sale system I built that handles high-concurrency purchase attempts without crashing.

## Quick Start

```bash
# Just run this and everything starts
docker compose up --build

# Then open your browser
# Frontend: http://localhost:5173
# API: http://localhost:3000
```

That's it. You can create a session, browse sales, click "Reserve Now", and get immediate feedback whether you got it or not.

## What It Does

- **Time-based sales**: Sales have start/end times and automatically transition from "upcoming" to "active" to "ended"
- **Limited inventory**: Each sale has fixed stock - when it's gone, it's gone
- **One per customer**: Each user can only reserve one item (enforced via unique request keys)
- **Handles the load**: Thousands of people clicking at the same time don't bring it down

## How It Works

Here's what actually happens in the system:

### 1. Create a Session

The user enters their name in the frontend. The frontend calls:

```
POST /sessions { displayName: "John" }
```

The API creates a session, generates a unique user token (like `usr_abc123`), and returns it. The frontend stores this token and sends it with every subsequent request via the `x-user-token` header.

### 2. Browse Sales

The frontend calls:

```
GET /sales
```

The API returns all sales. For each sale, the API also checks Redis to get the current stock level, so users see real-time availability.

The response looks like:
```json
[
  {
    "saleId": "sale_sneaker_001",
    "name": "Limited Edition Sneakers",
    "price": 199.99,
    "status": "active",
    "stock": 7,
    "reservationTtlSeconds": 180
  }
]
```

### 3. Click "Reserve Now" (The Critical Path)

This is where everything comes together. When the user clicks Reserve:

**Frontend sends:**
```
POST /sales/sale_sneaker_001/reservations
x-user-token: usr_abc123
idempotency-key: usr_abc123-sale_sneaker_001
```

**Backend (Fastify API) does:**

1. **Validate the request**
   - Check user token exists
   - Check sale exists and is "active"

2. **Reserve in Redis** (the atomic part)
   - Call a Lua script that runs this atomically:
     - Check if this user already has a reservation for this sale (via unique request key)
     - If yes → return "already reserved"
     - If no, check stock count in Redis
     - If stock > 0 → decrement stock, create reservation with TTL (default 180 seconds)
     - If stock = 0 → return "sold out"
   - All of this happens in one Redis operation - no race conditions possible

3. **Publish to SQS**
   - Send a message to the `reservation-events` queue:
   ```json
   {
     "eventType": "reservation-created",
     "eventId": "usr_abc123-sale_sneaker_001",
     "reservationId": "res_xyz789",
     "saleId": "sale_sneaker_001",
     "userToken": "usr_abc123",
     "expiresAt": "2026-05-06T10:33:00Z",
     "occurredAt": "2026-05-06T10:30:00Z"
   }
   ```
   - The API publishes to SQS and immediately returns to the user - doesn't wait for processing

4. **Return to user**
   - If stock was available: `{ reservationId: "res_xyz789", status: "reserved", expiresAt: "..." }`
   - If sold out: `{ status: "SOLD_OUT" }`
   - If already reserved: `{ status: "ALREADY_RESERVED" }`

The whole thing takes about 50ms.

### 4. Worker Picks Up the Event

The worker (a separate process that subscribes to the SQS queue) receives the message:

1. **Receive from SQS** - get the reservation-created event
2. **Write to DynamoDB** - persist the reservation record permanently:
   ```json
   {
     "reservationId": "res_xyz789",
     "saleId": "sale_sneaker_001",
     "userToken": "usr_abc123",
     "status": "RESERVED",
     "expiresAt": "2026-05-06T10:33:00Z",
     "reservationEventId": "usr_abc123-sale_sneaker_001"
   }
   ```
3. **Delete from SQS** - acknowledge the message so it's not retried

The worker runs independently - the user already got their response before any of this happens.

### 5. User Can Check Their Reservations

The frontend can poll:

```
GET /reservations
x-user-token: usr_abc123
```

Returns all active reservations for this user (from Redis).

### 6. Checkout (Complete Purchase)

When the user clicks "Buy Now":

```
POST /reservations/res_xyz789/checkout
x-user-token: usr_abc123
```

Backend:
1. **Verify in Redis** - check reservation exists and belongs to user
2. **Convert to purchase** - run checkout Lua script (atomically marks as purchased, releases no stock)
3. **Publish to SQS** - send `purchase-completed` event
4. **Worker** - receives event, writes purchase to DynamoDB

### 7. Reservation Expires (If Not Checked Out)

Reservations have a TTL (180 seconds by default). Here's what actually happens:

1. **Redis TTL fires** - the reservation key in Redis is automatically deleted (the hold is gone)
2. **Stock is still decremented** - the stock count in Redis is still "used up" at this point
3. **Sweeper runs** - every minute, it queries for expired reservations and:
   - **INCR stock** in Redis (restores the stock count)
   - Delete the user:sale hold key
   - Remove from the expiries sorted set
   - Update DynamoDB to mark status as "EXPIRED"

The key insight is: Redis TTL alone doesn't restore stock. The sweeper must run to increment stock back. This is why there's a reconciliation step in `listReservationsForUser` too - if the user checks their reservations and sees an expired one, it triggers the same release logic.

So the stock only goes back up when sweeper runs (or when the user checks their reservations and the system reconciles on the fly).

## Tools Used

- **Editor**: VS Code
- **Local dev**: Docker + Docker Compose
- **AI assistance**: OpenCode with MiniMax M2.5 for implementation, GPT 4 for brainstorming initial design, Lucid Chart for architecture diagrams
- **Development process**: Requirements analysis → Clarification → Draft solution → AI-assisted implementation with brainstorming, planning, TDD, and design specs

## The Stack

- **Frontend**: React + Vite
- **Backend**: Fastify (Node.js) locally, Lambda in production
- **Redis**: For holding stock and active reservations
- **DynamoDB**: For durable storage (the "source of truth")
- **SQS**: For async event processing
- **Docker Compose**: Local stack simulates AWS
  - **Redis**: Stock and active reservations
  - **DynamoDB Local**: Durable reservation records
  - **LocalStack**: SQS (reservation-events, purchase-events, expiry-events queues)
  - **API container**: Fastify server (port 3000)
  - **Worker container**: Processes SQS events
  - **Expiry-sweeper container**: Runs every 10 seconds, releases expired reservations
  - **Frontend container**: React + Vite (port 5173)
- **Terraform**: AWS deployment

## Design Decisions I Made

### 1. Why Redis for stock?

I initially thought about just using DynamoDB for everything, but the problem is DynamoDB conditional writes are slow under load. With Redis, the stock check and decrement happens in one atomic operation - there's no gap where another request could slip in.

The trade-off is Redis can lose data if it crashes. But I store everything in DynamoDB immediately after reserving, so if Redis dies we can rebuild from there. DynamoDB is the real source of truth.

### 2. Why SQS for async processing?

I didn't want the API to wait for the worker to finish processing - that would make every request take way longer. Instead, the API reserves the item, writes to the queue, and immediately returns success to the user. The worker picks it up later.

This means the happy path is super fast (50ms), and the edge cases (like checking status after a while) just involve polling. It's eventually consistent but feels synchronous for the user.

### 3. Why DynamoDB?

It scales automatically and I only need one access pattern - get by reservationId. No complex joins or queries. PAY_PER_REQUEST means I don't pay when there's no traffic. Also, having point-in-time recovery built-in is nice for peace of mind.

### 4. One-per-user enforcement

We use unique request keys (essentially user token + sale ID) so if someone tries to reserve twice, the second request returns the existing reservation. No race conditions.

### 5. Separate worker process

In production this runs as Lambda, locally it's a separate container. The idea is the API shouldn't care about processing logic - it just writes to the queue and forgets. This makes the API simpler and the worker can scale independently.

### 6. The expiry problem

When a reservation expires, we need to keep track of it. I tried using Redis TTL, but it's unreliable - you can miss notifications when it's under load. So instead, a separate sweeper process runs every minute, finds expired reservations in DynamoDB, and updates their status.

Stock IS restored on expiry - the sweeper increments stock back when it processes expired reservations.

### 7. Frontend choice

React SPA with Vite was the fastest way to build a working demo - minimal setup, hot reload. Static hosting with S3 + CloudFront is the easiest and fastest way to deploy it.

## Timeline

- **Friday May 1**: Started reading requirements, drafted initial solution
- **Sunday May 3**: Resumed full development
- **Monday May 5 - Tuesday May 6**: Full swing development (core features, testing, stress tests, Terraform, README)
- **Tuesday May 6**: Completed

## My Process

1. **Read requirements** - Identify what's being asked, note gaps or ambiguities
2. **Ask clarifying questions** - Before designing, make sure I understand the problem
3. **Draft initial solution** - I thought through Redis + DynamoDB architecture before involving AI
4. **Brainstorm with GPT** - Used GPT 4 to iron out details and validate approach
5. **AI-assisted implementation** - OpenCode with MiniMax M2.5 following superpowers methodology:
   - Brainstorming for design decisions
   - Writing plans with task breakdown
   - Test-driven development (write failing tests first)
   - Design specs saved to docs/
   - Inline execution with verification at each step

## The Code

The implementation lives in a few places:
- `frontend/app/` - React UI
- `services/lambdas/` - All the backend logic (session, sales, reservation, checkout, worker, expiry-sweeper)
- `services/lambdas/shared/` - Common code that everything uses (Redis client, DynamoDB client, etc.)
- `infra/envs/dev/` - Terraform for AWS

## Testing

I wrote tests at three levels:

**Unit tests** - Just the business logic, no external dependencies. Testing the Lua script logic, config parsing, event types.

**Integration tests** - Full flows. Create session → reserve → checkout → confirm. Also testing the edge cases like double-reserve, race conditions, expiry.

**Stress tests** - Using k6 to hammer it with 200 concurrent users. The test creates a sale with 10 items and verifies that we get exactly 10 successful reservations, no overselling, and no crashes.

## Running It Locally

```bash
# Build and check types
npm run build

# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Frontend tests
npm run test:ui

# Run the k6 stress test (need the API running first)
npm run stress
```

## Deploying to AWS

```bash
cd infra/envs/dev
terraform init
terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars
```

This creates the full stack - API Gateway, Lambdas, ElastiCache, DynamoDB, SQS, CloudFront.

## What I Learned

For high-concurrency scenarios, atomicity matters at every step. Database transactions aren't enough - you need either atomic operations (like Redis Lua) or explicit idempotency handling.

Also, separating the hot path (reserve immediately) from the slow path (process events) makes a huge difference. The user gets instant feedback, and the system can handle load spikes without falling over.

Finally, having a durable record (DynamoDB) on top of a fast cache (Redis) gives you the best of both worlds - speed for the happy path, safety for when things go wrong.