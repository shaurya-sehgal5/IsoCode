# SettleFlow

**Payment Reconciliation & Claims Management Platform**

SettleFlow is a finance operations application designed to help businesses reconcile payment partner settlements against internal orders, identify discrepancies, manage claims and returns, and use AI-assisted workflows to reduce manual reconciliation effort.

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Application Workflows](#application-workflows)
- [Data Model](#data-model)
- [Settlement Calculation](#settlement-calculation)
- [AI Capabilities](#ai-capabilities)
- [Security and Privacy](#security-and-privacy)
- [Local Development](#local-development)
- [Verification Status](#verification-status)
- [Known Limitations](#known-limitations)
- [Future Improvements](#future-improvements)

## Overview

Payment reconciliation compares transactions reported by payment partners with internal order records and expected settlement amounts.

Differences can arise from gateway fees, fixed processing charges, taxes, refunds, missing order references, or incorrect settlement amounts.

SettleFlow provides a centralized workflow to:

1. Import payment partner reports.
2. Map external report columns to internal fields.
3. Match payment transactions with orders.
4. Calculate expected settlement amounts.
5. Identify matched, partially matched, and unmatched transactions.
6. Manage claims and return/refund records.
7. Use AI to assist with column mapping and missing-order-reference matching.
8. Keep human approval in control of important financial decisions.

## Core Features

### Authentication and roles

- Sign-in using hashed passwords and JWT authentication.
- Finance Executive and Co-Founder roles.
- Protected backend API routes.
- Co-Founder-only rate-card modifications.

### Payment report import

- CSV, XLS, and XLSX report support.
- File upload with validation and configured size restrictions.
- First-20-row preview before import.
- Mapping between partner report columns and internal payment fields.
- Import batch tracking.
- Saved mapping versions and mapping activation/rollback.

### Order-level reconciliation

- Match payment records using order references.
- Compare payment gross amounts with internal order amounts.
- Calculate expected settlement values.
- Identify matched, partial, and unmatched transactions.
- Record settlement differences for investigation.

### Gateway rate cards

Rate cards contain:

- Gateway name.
- Percentage processing fee.
- Fixed processing fee.
- TCS percentage.
- TDS percentage.
- Active/inactive state.

Rate-card management is restricted to the Co-Founder role.

### Claims management

- Create claims against reconciliation discrepancies.
- Track claim status.
- Review unresolved financial differences.
- Maintain links between claims and reconciliation records.

### Returns management

- Record return/refund requests.
- Associate returns with orders.
- Track requested, approved, refunded, and rejected statuses.
- Store refund references and dates where available.

### AI-assisted column mapping

AI assists users in identifying relationships between uploaded report columns and the platform's internal payment fields.

The user reviews and approves the mapping before importing data. Mapping versions are retained so previous configurations can be reactivated.

For privacy, the current column-mapping AI flow sends column headers rather than raw payment/customer rows.

### AI-assisted order matching

When a payment does not contain an order reference:

1. The backend identifies payments requiring review.
2. Candidate orders are filtered using amount and date proximity.
3. Gemini evaluates the candidate information.
4. The system stores a suggested order, confidence score, and explanation.
5. A human reviewer approves or rejects the suggestion.
6. Approved suggestions update the payment and reconciliation records.

AI suggestions do not automatically close or approve financial records.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite, TypeScript |
| Styling | Tailwind CSS |
| Routing | React Router |
| HTTP client | Axios |
| Icons | Lucide React |
| Charts | Recharts |
| Backend | Node.js, Express, TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Authentication | JWT, bcrypt |
| File processing | Multer, XLSX |
| AI | Google Gemini SDK |
| Local database environment | Docker |

## Architecture

```text
                 Finance Team
                      |
                      v
             React Frontend
              (Vite + TS)
                      |
                HTTP / API
                      |
                      v
             Express Backend
                 (Node.js)
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
        Prisma      JWT/Auth    Gemini AI
          |
          v
      PostgreSQL
          |
          +------------------------------+
          |              |               |
          v              v               v
       Orders         Payments        Rate Cards
          |              |               |
          +--------------+---------------+
                         |
                         v
                 Reconciliation
                         |
              +----------+----------+
              |          |          |
              v          v          v
           Matched     Partial   Unmatched
                         |
                         v
                  Claims / Review
```

## Application Workflows

### Payment import

```text
Upload payment report
        |
        v
Validate file
        |
        v
Read headers and rows
        |
        v
Suggest column mapping
        |
        v
Preview first 20 rows
        |
        v
User approves mapping
        |
        v
Create import batch
        |
        v
Store payment records
```

### Reconciliation

```text
Imported Payments + Internal Orders
                  |
                  v
          Match Order Reference
                  |
          +-------+-------+
          |               |
       Found           Not Found
          |               |
          v               v
   Calculate Expected   Mark Unmatched
      Settlement
          |
          v
   Compare Actual Net
          |
     +----+----+
     |         |
  Within     Difference
  Tolerance  Detected
     |         |
     v         v
  Matched    Partial
```

### AI matching

```text
Payment without Order Reference
                  |
                  v
        Candidate Order Search
                  |
                  v
          Gemini Evaluation
                  |
                  v
       Suggestion + Confidence
                  |
                  v
            Human Review
                  |
             +----+----+
             |         |
          Approve    Reject
             |         |
             v         v
       Update Payment  Record
       and Reconcile   Rejection
```

## Data Model

The Prisma data model includes these primary entities:

| Model | Responsibility |
|---|---|
| User | User identity, password hash and role |
| Order | Internal order information |
| ImportBatch | Uploaded report and processing metadata |
| ColumnMapping | Versioned external-to-internal field mapping |
| PaymentRecord | Imported payment transaction |
| RateCard | Gateway fee and tax configuration |
| ReconciliationResult | Matching status and settlement difference |
| Claim | Discrepancy claim lifecycle |
| ReturnRecord | Return and refund lifecycle |
| AiMatchSuggestion | AI-generated candidate and human review state |

Important relationships:

- An import batch contains payment records.
- An order can be associated with payment and reconciliation records.
- A reconciliation result can be associated with a claim.
- An order can have return records.
- AI suggestions reference a payment and a suggested order.
- Users create mappings and review AI suggestions.

## Settlement Calculation

The expected settlement is calculated using configured rate-card values.

**Gateway fee**

```text
Gateway Fee = (Gross Amount × Fee Percentage / 100) + Fixed Fee
```

**TCS**

```text
TCS = Gross Amount × TCS Percentage / 100
```

**TDS**

```text
TDS = Gross Amount × TDS Percentage / 100
```

**Expected settlement**

```text
Expected Net = Gross Amount - Gateway Fee - TCS - TDS
```

**Settlement difference**

```text
Difference = Actual Net Amount - Expected Net
```

TCS and TDS are represented separately in the calculation.

## AI Capabilities

Gemini is used for two assistance workflows:

1. Column-mapping suggestions based on report headers.
2. Candidate order matching for payments missing an order reference.

The backend validates AI-selected column names and candidate order IDs before accepting suggestions.

AI output is treated as a recommendation, not as an authoritative financial decision. Human approval remains necessary.

## Security and Privacy

- Password hashing.
- JWT-based authentication.
- Protected API routes.
- Co-Founder-only rate-card write access.
- Upload file-type and file-size validation.
- AI column mapping uses headers only, not raw customer/payment rows.
- Environment variables are used for secrets and service configuration.

Never commit `.env` files, API keys, database passwords, or production secrets.

## Local Development

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete setup instructions.

Expected local development addresses:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- PostgreSQL: local Docker database on the configured port.

## Verification Status

The following development checks were completed during development:

- Prisma schema validation.
- Prisma client generation.
- Backend TypeScript production build.
- Frontend TypeScript/Vite production build.
- Login and protected application access.
- Payment report preview and mapping approval.
- AI match suggestion generation and manual approval.

The AI approval flow was exercised with synthetic payment/order data.

A complete automated test suite, AI rejection-path verification, and a 100,000-row performance benchmark have not been established as passing. These should not be represented as verified results.

## Known Limitations

1. `PaymentRecord` currently does not store a gateway/provider identifier. Reconciliation and AI approval select the first active rate card. The current implementation should therefore be demonstrated with one applicable active rate card; mixed-gateway rate selection is not verified.
2. The 100,000-row import target has not been benchmarked.
3. Production deployment has not been confirmed.
4. Dashboard demo values should not be represented as live financial metrics unless backed by actual database records.

## Future Improvements

- Associate each payment with its gateway/provider and select the matching rate card.
- Add automated tests for financial calculations and authorization.
- Benchmark and optimize large report imports.
- Improve streaming and batch processing for large datasets.
- Add richer partner-wise tax and settlement reports.
- Add audit history for important financial actions.
- Add production monitoring and deployment automation.

---

**Project:** SettleFlow  
**Category:** FinTech / Payment Reconciliation  
**Purpose:** Finance operations, settlement verification and claims management.
