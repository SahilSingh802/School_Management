# EduSphere School Management

A local-first school management system built with React, TypeScript, Vite, Tailwind CSS, Express, MongoDB, and Mongoose. The project includes JWT authentication with role-based access for administrators, teachers, and guardians.

> **Deployment status:** This project is not deployed. There is no hosted application URL or built-in demo account. Admin credentials are created locally from environment variables.

## Requirements

- Node.js 22 or later
- npm
- MongoDB Atlas (recommended) or a local MongoDB replica set

MongoDB transactions are used when creating teacher accounts and recording fee payments. A standalone local MongoDB process does not support transactions; use Atlas or configure a local replica set.

## Setup

Open two PowerShell terminals in the repository root.

### 1. Configure the backend

```powershell
if (-not (Test-Path 'server\.env')) {
  Copy-Item 'server\.env.example' 'server\.env'
}
```

Edit `server\.env` with your own MongoDB connection string and a strong JWT secret. Do not replace an existing `.env` file.

```powershell
Set-Location 'server'
npm ci
```

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `ADMIN_NAME` in `server\.env`, then create the administrator:

```powershell
npm run seed:admin
```

The seed command creates only the configured admin user if it does not already exist. It does not create sample data or overwrite an existing account.

Start the API:

```powershell
npm run dev
```

The API listens on `http://localhost:5000` by default. Check `http://localhost:5000/api/health`.

### 2. Configure and run the frontend

In the second terminal:

```powershell
if (-not (Test-Path 'client\.env')) {
  Copy-Item 'client\.env.example' 'client\.env'
}
Set-Location 'client'
npm ci
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Vite proxies `/api` requests to the local backend. For a different API origin, set `VITE_API_URL` to the full API base URL, including `/api`.

## Roles and data access

- **Admin:** lands on a live school-wide dashboard and manages student and teacher records, classes, subjects, examinations, attendance, results, and fees.
- **Teacher:** lands on a dashboard containing only assigned classes/subjects, assigned-class attendance activity, and upcoming examinations for assigned class/subject pairs. Teachers also read students in assigned classes, record and edit attendance for assigned classes, and manage results only for assigned class/subject pairs.
- **Guardian:** lands on a dashboard for active linked students only, with their attendance summaries, recent examination results, and fee balances. Guardians can also read linked-student attendance, results, and fee/payment information.

Access restrictions are enforced by the API in addition to the role-aware frontend navigation. Student removal is an archive (soft delete) so related academic and financial records remain intact. Class, subject, and examination deletion is rejected when historical records depend on the target.

After login, administrators open the Admin Dashboard, teachers open the Teacher Dashboard, and guardians open the Guardian Dashboard. The teacher and guardian dashboard APIs derive ownership from the authenticated account and do not accept client-supplied student or class IDs.

Admins can create guardian accounts in the Students page, then link one or more accounts while creating or editing a student. The Results page provides printable report cards. Attendance can be filtered and downloaded as CSV. Fee pages include due-date/status/year/category filters, collection totals and breakdowns, outstanding invoices, and filtered payment history.

## Tests and checks

```powershell
Set-Location 'server'
npm test

Set-Location '..\client'
npm run lint
npm run build
```

The server tests use mocked model calls for API authorization, report ownership, CSV output, fee reports, and selected validation/data-integrity scenarios; they do not replace integration testing against a disposable MongoDB database. The repository does not currently include Playwright or Cypress, so browser end-to-end tests are not configured.

## Documentation

- [API reference](docs/API.md)
- [Database schema and ER diagram](docs/SCHEMA.md)
- [Technical report and known limitations](docs/TECHNICAL_REPORT.md)
- [Demo walkthrough script](docs/DEMO_SCRIPT.md)

## Environment variables

Backend variables are documented in [server/.env.example](server/.env.example); the optional frontend API URL is documented in [client/.env.example](client/.env.example). Never commit real environment files, credentials, JWT secrets, or production connection strings.
