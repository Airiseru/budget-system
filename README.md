# BUDGET Framework Web Application

A Docker-based NextJS web application to interface the preparation and execution phases of the Philippine budget process.

## Overview

This project serves as the main application to house the interaction between government entities and the Department of Budget and Management. Specifically, the application aims to:
- Digitalize the budget forms and specific parts of the process
- Provide the foundation for supporting approval and signatory workflows
- Track and monitor PAP lifecycles from proposal to NEP and GAA, up until the end of the PAP lifecycle


## Features

### Data Schemas and Operations
- Migration files containing data schemas for various forms and other necessary tables (`/db/postgres/migrations`)
- Generalized operations through the use of repositories to ensure consistent database operations even if different database management systems are used (`/db/postgres/repositories`)

### Universal Approval Workflow
- General types and functions to structure all workflows (`src/lib/workflows/index.ts`)
- Separate files to specify a docuemnts' approval workflow (e.g., `src/lib/workflows/proposal-flow.ts`)

### Traceability
- Hashed Audit Chains to maintain traceability within the system
- Strict inputs for audit logs depending on event type (`src/actions/audit.ts`)

### Database Rollback Detection
- Publicized Merkle Roots to keep track of the legitimacy of all the logs within the system
- Automated cron job to automatically create and upload Merkle Roots into appropriate location (`cron.Dockerfile` and `app/api/cron/seal-audit/route.ts`)

## Project Structure

```
.
├── app/                # Route-level code: pages, layouts, and API handlers
│   ├── admin/
│   ├── api/            # API route handlers
│   ├── dbm/
│   ├── forms/
│   ├── home/
│   ├── login/
│   ├── paps/
│   ├── pending-approval/
│   ├── signup/
│   ├── layout.tsx      # Shared root layout inherited by pages
│   └── page.tsx        # Root page route
├── components/         # Reusable UI components
├── src/                # Reusable system and domain logic
│   ├── actions/        # Server-side actions, mutations, auth checks, workflow operations
│   ├── db/             # Database connection, repositories, migrations, and factories
│   ├── lib/            # Shared utilities, validations, workflows, crypto, audit helpers
│   └── types/          # Shared TypeScript type definitions
├── tests/              # Test files and verification scripts
├── Dockerfile          # Container image definition for the application
└── docker-compose.yml  # Local multi-container setup, such as app and database services
```

## Prerequisites

### Installations
- [NodeJS and npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [Docker](https://www.docker.com/get-started/)

### Environment Files

1. Generate a [Better Auth Secret](https://better-auth.com/docs/installation)
2. Create `.env` file with the following:

```ini
DB_USER=admin
DB_PASSWORD=password123
DB_NAME=budget_system_db
```

3. Create an `env.development` file with the following. Adjust the `BETTER_AUTH_SECRET` to the generated one in step 1.

```ini
DATABASE_URL = "postgres://admin:password123@localhost:5432/budget_system_db"
DATABASE_TYPE="postgres"
NODE_ENV="development"
BETTER_AUTH_SECRET=FILL_ME_WITH_GENERATED_SECRET
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_INDEXED_DB_NAME="budget_keys"
NEXT_PUBLIC_INDEXED_STORE_NAME="keys"
NEXT_PUBLIC_INDEXED_KEY_PREFIX="private_key_"
CRON_SECRET="budget_local_dev_cron_secret"
AUDIT_DISABLE_ADVISORY_LOCK=false
```

## Local Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Docker Database

Build and start docker database:

```bash
docker compose up db -d
```

### 3. Database Migrations

Prepare the database with pre-existing tables and constraints:

```bash
npm run migrate
```

### 4. Run Web Application

```bash
npm run dev
```

### 5. Closing

Once done, close docker database using the following:

```bash
# Close without losing data
docker compose down

# Close while removing all the data within it
docker compose down -v
```

## Automatic Generation of Database Entries and Testing

The [Playwright Testing Library](https://playwright.dev/) was used to create partial tests in the application. Configurations were modified to prevent parallel runs as the script requires contains test assertions (seen in `playwright.config.ts`). All tests files are located in the `tests` directory.

To automatically create pre-existing accounts or to run playwright tests use the command `npx playwright test`.

Currently, all **generated accounts use the password `T#st1234T#st1234`**. The following are the emails and their corresponding entity and position:

| Email | Entity | Position |
| --- | --- | --- |
| dbm-test@dbm.com | DBM Office of the Secretary | Agency Head |
| dbm-secretary-test@dbm.com | DBM | Department Secretary |
| dar-personnel-test@dar.com | DAR Regional Office I - Proper | Personnel Officer |
| dar-budget-test@dar.com | DAR Regional Office I - Proper | Budget Officer |
| dar-planning-test@dar.com | DAR Regional Office I - Proper | Planninng Officer |
| dar-ca-test@dar.com | DAR Office of the Secretary | Chief Accountant |
| dar-test@dar.com | DAR Office of the Secretary | Agency Head |
| dar-secretary-test@dar.com | DAR | Department Secretary |
| dpwh-budget-test1@dpwh.com | DPWH Batangas 1st District Engineering Office | Budget Officer |
| dpwh-planning-test1@dpwh.com | DPWH Batangas 1st District Engineering Office | Planning Officer |
| dpwh-budget-test2@dpwh.com | DPWH Batangas 2nd District Engineering Office | Budget Officer |
| dpwh-planning-test2@dpwh.com | DPWH Batangas 2nd District Engineering Office | Planning Officer |
| dpwh-ca-test@dpwh.com | DPWH Office of the Secretary | Chief Accountant |
| dpwh-agency-test@dpwh.com | DPWH Office of the Secretary | Agency Head |
| dpwh-secretary-test@dpwh.com | DPWH | Department Secretary |

## Manual Addition of Database Entries (PostgreSQL)

To manually add rows in the Docker database, do the following:

1. In a new terminal, open the docker database using `docker exec -it budget_db psql -U admin -d budget_system_db`
2. Insert using the command `INSERT INTO <table> (<column_name>) VALUES (<value_to_insert>);`

## Merkle Root Cron Job

To locally run the merkle proof cron job, use the command `nextjs-crons --url http://localhost:3000 --secret budget_local_dev_cron_secret --once --verbose`.

To learn more about how the Cron Job was created, check the [article](https://medium.com/@quentinmousset/testing-next-js-cron-jobs-locally-my-journey-from-frustration-to-solution-6ffb2e774d7a) made by the developer of [`nextjs-crons`](https://www.npmjs.com/package/nextjs-crons).

## Concurrency Test in Audit Logs

To locally test the functionality of audit logs, the framework provides an audit concurrency test script that inserts multiple logs simulatenously in a dummy table (`tests/audit-concurrency.ts`).

The following commands can be used:
- Run concurrency test by default (with lock, 50 concurrent logs): `npm run test:audit-concurrency`
- Run without lock: `AUDIT_DISABLE_ADVISORY_LOCK=true npm run test:audit-concurrency`
- Run with specific configurations: `npm run test:audit-concurrency -- --concurrency=100 --user-id=<user_id> --entity-id=<entity_a> --entity-b-id=<entity_b>`
    - The specific users and their entities, and the number of concurrent logs inserted can be modified
    - Number of concurrent logs should be between 25 and 100, but the limit can be modified in the `getConcurrency` function of the script

## Production Setup Steps

### 1. Environment Configuration

Create an `.env.production` file in the project root with the following:

```ini
DATABASE_URL = "postgres://admin:password123@db:5432/budget_system_db"
DATABASE_TYPE="postgres"
NODE_ENV="production"
```

### 2. Docker Image
Build and compose the docker image:

```bash
docker compose up web --build -d
```

### 3. Run

Open the app using the link (e.g., `localhost:3000`)