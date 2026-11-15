# Technical Report

## Project status

EduSphere is a local-first MERN school management application. It has not been deployed; no hosted URL or demo credentials are claimed. Admin credentials are supplied by the operator through backend environment variables and the admin seed command.

## Implemented in this pass

- Role-aware navigation and API-backed admin, teacher, and guardian dashboards plus student, teacher, class/subject, attendance, examination, result, and fee pages.
- JWT authentication checks current active-user state against MongoDB. Teacher self-registration is disabled; admin-only guardian registration remains available.
- Server-side role and ownership scopes for teachers and guardians, including linked-student visibility for attendance, results, and fees.
- Student archival instead of destructive deletion; class, subject, and examination deletion is refused while dependent records exist.
- Teacher profile/account creation and fee posting use MongoDB transactions.
- Attendance uniqueness, result uniqueness, duplicate admission/class/subject/exam/invoice safeguards are represented by Mongoose indexes.
- Fee payment amount, balance, method, precision, and optional transaction ID checks; optimistic balance matching protects the invoice update.
- Frontend logout on expired/invalid authentication, success/error feedback for management actions, and Vite API proxy configuration.
- Printable browser report cards with student/class details and examination/subject marks, percentages, grades, and overall totals. Guardian and teacher report-card requests are ownership/assignment checked server-side.
- Attendance CSV export with class/student/date/status filters, role-based data scoping, and spreadsheet-formula escaping.
- Fee invoice filters (student, year, category, status, due-date range), payment-history filters, collection totals and year/category breakdowns, and outstanding invoice report.
- Admin UI for guardian account creation and linking guardians to student records. Passwords are hashed by the existing registration controller.
- Teacher and guardian landing dashboards with role-specific API endpoints. Teacher data is limited to assigned classes/subjects; guardian student, attendance, result, and fee data is derived only from active students linked to the authenticated guardian.
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

Server tests cover login, API authentication and role checks, admin/teacher/guardian dashboard authorization and ownership scopes, teacher class restrictions, guardian student/report/fee/attendance scoping, duplicate student handling, fee overpayment and report totals, report-card response data, CSV output/formula escaping, guardian account password hashing, grade boundaries, and the attendance uniqueness index. They use mocked models for controller/API cases and are not a substitute for live MongoDB integration tests.

## Known gaps and operational considerations

- No live database integration suite is configured. Running `npm start` requires a reachable MongoDB URI in `server/.env`; fee and teacher transactions require a MongoDB replica set (Atlas supports this).
- Report cards use the browser print dialog (including Save as PDF); a server-generated PDF is not implemented. General API pagination and multi-school/tenant isolation are also not implemented.
- The client supports filtered attendance CSV export and day-by-day marking/editing; bulk attendance import is not implemented.
- No Playwright/Cypress dependency or browser test configuration exists in the project, so browser-driven end-to-end tests were not added. UI changes were checked with TypeScript/build/lint; API tests use Supertest with mocked models.
- Existing production databases should be checked for duplicate `payments.transactionId` values before enabling the new unique partial index. MongoDB will refuse to build that index if existing duplicate values are present; resolve them through a deliberate data migration before rollout. No data migration is performed automatically.
- The current system uses school-wide data in the admin dashboard and does not model multiple schools/tenants.

## Security and data integrity notes

- Keep `.env` files out of source control and use a high-entropy `JWT_SECRET`.
- Do not share production credentials in demo recordings or reports.
- Student removal archives the student; historical attendance, exam, result, fee, and payment documents remain available through their existing relationships.
- Fee and teacher creation transactions must be tested against a staging replica set before production use.
