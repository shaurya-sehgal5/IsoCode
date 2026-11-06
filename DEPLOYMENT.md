# SettleFlow — Deployment Guide

This document explains how to configure and run SettleFlow locally and outlines the production deployment requirements.

## 1. Prerequisites

Install:

- Node.js and npm.
- Docker Desktop.
- Git.
- A PostgreSQL-compatible database.

## 2. Project Structure

```text
IsoCode/
├── backend/
│   ├── prisma/
│   ├── src/
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── sample-data/
├── docs/
├── README.md
└── DEPLOYMENT.md
```

## 3. Environment Variables

Create `backend/.env` locally. Do not commit this file.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign authentication tokens |
| `PORT` | Backend server port |
| `CLIENT_URL` | Frontend origin allowed by CORS |
| `GEMINI_API_KEY` | Optional Gemini API key |
| `GEMINI_MODEL` | Gemini model identifier |

Example local development configuration:

```env
DATABASE_URL="postgresql://settleflow:local_dev_password@127.0.0.1:5434/settleflow?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=5000
CLIENT_URL="http://localhost:5173"
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"
```

Use your actual local database configuration. Never reuse example secrets in production.

## 4. Database Setup

Start the existing SettleFlow PostgreSQL Docker service.

The development database has been configured to use port `5434`.

**Important:** Preserve the existing `settleflow_pgdata` Docker volume. Do not run `docker volume prune`, delete the volume, or reset the database as part of normal setup.

From the backend directory:

```powershell
cd D:\IsoCode\backend
npm install
npx prisma generate
```

If the repository contains Prisma migrations:

```powershell
npx prisma migrate deploy
```

If the existing development database was initialized using `prisma db push`, follow that existing setup instead. Do not reset or drop existing records.

## 5. Start the Backend

```powershell
cd D:\IsoCode\backend
npm run dev
```

Expected local backend URL:

```text
http://localhost:5000
```

Health endpoint:

```text
http://localhost:5000/api/health
```

## 6. Start the Frontend

Open another PowerShell terminal:

```powershell
cd D:\IsoCode\frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## 7. Production Build

Backend:

```powershell
cd D:\IsoCode\backend
npm run build
```

Frontend:

```powershell
cd D:\IsoCode\frontend
npm run build
```

Both commands should complete successfully before packaging the submission.

## 8. Demo Accounts

Development demo accounts:

| Role | Email | Password |
|---|---|---|
| Finance Executive | `finance@settleflow.demo` | `Finance@123` |
| Co-Founder | `founder@settleflow.demo` | `Founder@123` |

Confirm that the seed script has run and these credentials work in the local environment.

These credentials are for assessment demonstration only. Change them before any public deployment.

## 9. Suggested Demonstration

1. Open the frontend.
2. Sign in as Finance Executive.
3. Upload a synthetic CSV payment report.
4. Review the report preview and suggested column mapping.
5. Approve the mapping and import the records.
6. Open reconciliation and inspect matched, partial, and unmatched transactions.
7. Open AI Review.
8. Generate suggestions for payments with missing order references.
9. Review and manually approve or reject a suggestion.
10. Sign in as Co-Founder.
11. View and manage rate cards.

Use synthetic records only. Do not use real customer or payment personal information.

## 10. Production Deployment Checklist

Before deployment:

- Configure a production PostgreSQL database.
- Set `DATABASE_URL` using the hosting provider's secret manager.
- Generate a strong, unique `JWT_SECRET`.
- Configure `CLIENT_URL` to the deployed frontend origin.
- Configure `GEMINI_API_KEY` if AI features are enabled.
- Configure `GEMINI_MODEL`.
- Run Prisma migrations.
- Restrict database access to the backend service.
- Enable HTTPS.
- Verify CORS settings.
- Replace demo credentials.
- Confirm that no secrets are included in the deployment artifact.

## 11. Current Implementation Limitations

- `PaymentRecord` currently does not store a gateway/provider identifier. Reconciliation and AI approval use the first active rate card. Demonstrate with one applicable active rate card; do not assume mixed-gateway rate selection is correct.
- The 100,000-row under-one-minute target has not been benchmarked.
- Local builds and selected workflows were verified; production deployment is not confirmed.

## 12. Submission Packaging

Include:

- `README.md`
- `DEPLOYMENT.md`
- `backend/` source and package files
- `frontend/` source and package files
- `sample-data/`
- Required Prisma schema/migrations
- Lockfiles and configuration files

Exclude:

- `node_modules/`
- `.git/`
- `.env` and `.env.*`
- API keys and secrets
- Generated `dist/`, coverage and cache folders
- Logs and temporary files

The final assessment ZIP must be no larger than 25 MB.
