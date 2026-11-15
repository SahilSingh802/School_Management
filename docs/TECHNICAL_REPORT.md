# Technical Report

## Project status

EduSphere is a local-first MERN school management application. It has not been deployed; no hosted URL or demo credentials are claimed. Admin credentials are supplied by the operator through backend environment variables and the admin seed command.

## Implemented in this pass

- Role-aware navigation and API-backed dashboard, student, teacher, class/subject, attendance, examination, result, and fee pages.
- JWT authentication checks current active-user state against MongoDB. Teacher self-registration is disabled; admin-only guardian registration remains available.
- Server-side role and ownership scopes for teachers and guardians, including linked-student visibility for attendance, results, and fees.
- Student archival instead of destructive deletion; class, subject, and examination deletion is refused while dependent records exist.
- Teacher profile/account creation and fee posting use MongoDB transactions.
- Attendance uniqueness, result uniqueness, duplicate admission/class/subject/exam/invoice safeguards are represented by Mongoose indexes.
- Fee payment amount, balance, method, precision, and optional transaction ID checks; optimistic balance matching protects the invoice update.
- Frontend logout on expired/invalid authentication, success/error feedback for management actions, and Vite API proxy configuration.
- Environment examples, setup instructions, API reference, schema/ER diagram, technical report, and demo script.

## Verification

Run the commands below from the indicated directories:

```powershell
Set-Location 'server'
npm test

Set-Location '..\client'
npm run lint
npm run build
```

Server tests cover API authentication and role checks, teacher class restrictions, guardian student scoping, duplicate student handling, fee overpayment rejection, grade boundaries, and the attendance uniqueness index. They use mocked models for controller/API cases and are not a substitute for live MongoDB integration tests.

## Known gaps and operational considerations

- No live database integration suite is configured. Running `npm start` requires a reachable MongoDB URI in `server/.env`; fee and teacher transactions require a MongoDB replica set (Atlas supports this).
- A report-card PDF, printable result sheet, attendance export, general API pagination, fee filtering/report screens, and an in-app guardian-account creation form are not implemented.
- The client currently supports day-by-day attendance marking and editing, but does not provide a bulk import/export workflow.
- There is no browser-driven end-to-end test suite. UI verification in this environment is through TypeScript/build/lint and API-focused tests.
- Existing production databases should be checked for duplicate `payments.transactionId` values before enabling the new unique partial index. MongoDB will refuse to build that index if existing duplicate values are present; resolve them through a deliberate data migration before rollout. No data migration is performed automatically.
- The current system uses school-wide data in the admin dashboard and does not model multiple schools/tenants.

## Security and data integrity notes

- Keep `.env` files out of source control and use a high-entropy `JWT_SECRET`.
- Do not share production credentials in demo recordings or reports.
- Student removal archives the student; historical attendance, exam, result, fee, and payment documents remain available through their existing relationships.
- Fee and teacher creation transactions must be tested against a staging replica set before production use.
