# Finance Records Service

Finance Records Service is a role-based backend for managing financial records, access permissions, and dashboard summaries. The repository also includes a lightweight operations console served by the same Node.js application, but the backend API is the primary deliverable.

## Overview

The service supports:

- user creation and role assignment
- active and inactive account management
- financial record create, read, update, soft delete, and restore workflows
- record filtering by type, category, date range, and search term
- summary reporting for totals, category breakdowns, recent activity, and time trends
- server-side access control for `viewer`, `analyst`, and `admin`
- validation, structured error responses, token-based sessions, and rate limiting

Public service routes:

- API root: `/`
- operations console: `/app`
- reference page: `/docs`
- OpenAPI document: `/openapi.json`

## Architecture

Runtime stack:

- Node.js 22
- native `node:http` server
- PostgreSQL via `pg`
- in-memory rate limiting
- static HTML/CSS/JavaScript console served by the backend

Application structure:

```text
src/
  app.js
  server.js
  config.js
  database/
  docs/
  lib/
  services/
public/
  index.html
  styles.css
  app.js
  docs.html
tests/
  api.test.js
```

## Data Model

### Users

Core fields:

- `id`
- `name`
- `email`
- `password_hash`
- `role` as `viewer`, `analyst`, or `admin`
- `status` as `active` or `inactive`
- timestamps

### Sessions

Core fields:

- `token`
- `user_id`
- `created_at`
- `expires_at`

### Financial Records

Core fields:

- `id`
- `amount`
- `type` as `income` or `expense`
- `category`
- `entry_date`
- `notes`
- `created_by`
- `updated_by`
- `deleted_at`
- `deleted_by`
- timestamps

## API Summary

### Authentication

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Users

- `GET /users`
- `GET /users/:id`
- `POST /users`
- `PATCH /users/:id`

Admin access only.

### Records

- `GET /records`
- `GET /records/:id`
- `POST /records`
- `PATCH /records/:id`
- `DELETE /records/:id`
- `POST /records/:id/restore`

Supported record filters:

- `page`
- `pageSize`
- `type`
- `category`
- `from`
- `to`
- `search`
- `includeDeleted` for admin requests

### Dashboard

- `GET /dashboard/overview`
- `GET /dashboard/trends`

Supported dashboard filters:

- `from`
- `to`
- `type`
- `category`
- `groupBy` as `month` or `week`
- `limit`

## Local Setup

### 1. Start PostgreSQL

The repository includes a local PostgreSQL service definition:

```bash
docker compose up -d postgres
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and adjust values if needed:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/finance_records
SEED_SAMPLE_DATA=true
GENERAL_RATE_LIMIT_MAX=200
GENERAL_RATE_LIMIT_WINDOW_MS=60000
LOGIN_RATE_LIMIT_MAX=5
LOGIN_RATE_LIMIT_WINDOW_MS=600000
```

Runtime contract:

- `DATABASE_URL` required
- `PORT` optional
- `SEED_SAMPLE_DATA` optional

### 3. Install dependencies and run

```bash
npm install
npm start
```

### 4. Access the application

- API: `http://localhost:3000`
- console: `http://localhost:3000/app`
- reference page: `http://localhost:3000/docs`

### Sample Users

When `SEED_SAMPLE_DATA=true`, the service creates local seed users:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@finance.local` | `Admin@123` |
| Analyst | `analyst@finance.local` | `Analyst@123` |
| Viewer | `viewer@finance.local` | `Viewer@123` |

## Testing

Run the automated suite with:

```bash
npm test
```

The tests cover:

- login, logout, and inactive accounts
- role-based access rules
- record CRUD, filtering, soft delete, and restore
- dashboard summaries and trends
- validation and error status codes
- rate limiting
- `/app`, `/docs`, and `/openapi.json`

## Deployment

The default deployment target is Railway with PostgreSQL.

### Railway setup

1. Create a Railway project.
2. Add a PostgreSQL service.
3. Add this repository as a web service using the included `Dockerfile`.
4. Set `DATABASE_URL` from the Railway PostgreSQL service.
5. Optionally set `SEED_SAMPLE_DATA=false` for hosted environments.
6. Deploy the service.

Deployment files included:

- `Dockerfile`
- `railway.json`
- `docker-compose.yml` for local PostgreSQL

After deployment, the same service can provide:

- API root on `/`
- operations console on `/app`
- reference page on `/docs`

For a submission form, `/docs` is usually the cleanest public link.

## Trade-offs

- Sessions are stored server-side in PostgreSQL instead of using JWTs. This keeps token invalidation straightforward.
- Record deletion is implemented as soft delete to preserve audit context and allow restore flows.
- Rate limiting is in-memory, which is reasonable for a single-instance submission but would need a shared store in a horizontally scaled deployment.
- The operations console is intentionally lightweight and dependency-free so the focus remains on backend behavior and deployability.
