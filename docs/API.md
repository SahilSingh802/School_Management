# API Reference

Base URL: `http://localhost:5000/api`

Except for `POST /auth/login` and `GET /health`, requests require a bearer token:

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

Successful endpoints return JSON with `success: true` and a `data`, `user`, or `token` property as applicable. Errors return `success: false` and a user-safe `message`. Validation errors use HTTP 400, unauthenticated requests 401, forbidden roles/ownership 403, missing resources 404, and duplicate/conflicting operations 409.

## Authentication

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public | Sign in |
| GET | `/auth/profile` | Authenticated | Get the current account |
| POST | `/auth/register` | Admin | Create a guardian account; teacher accounts are created through teacher management |

Guardian registration example:

```json
{
  "name": "Guardian Name",
  "email": "guardian@example.test",
  "password": "replace-with-a-strong-password",
  "role": "GUARDIAN"
}
```

Login payload:

```json
{ "email": "guardian@example.test", "password": "replace-me" }
```

## Academic records

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET/POST | `/academic/classes` | All authenticated / Admin | List scoped classes / create a class |
| PUT/DELETE | `/academic/classes/:id` | Admin | Edit or safely remove an unused class |
| GET/POST | `/academic/subjects` | All authenticated / Admin | List scoped subjects / create a subject |
| PUT/DELETE | `/academic/subjects/:id` | Admin | Edit or safely remove an unused subject |
| GET | `/academic/students` | Admin, assigned teacher, linked guardian | List students visible to the caller |
| POST/PUT/DELETE | `/academic/students[/:id]` | Admin | Create, edit, or archive a student |
| GET/POST | `/academic/teachers` | Admin | List or create a teacher account and profile |
| PUT/DELETE | `/academic/teachers/:id` | Admin | Update or deactivate a teacher account |
| GET | `/academic/guardians` | Admin | List active guardian accounts for student assignment |

Student creation example:

```json
{
  "admissionNo": "ADM-2026-001",
  "name": "Student Name",
  "dateOfBirth": "2012-04-15",
  "classId": "507f1f77bcf86cd799439012",
  "guardianIds": []
}
```

Teacher creation example:

```json
{
  "name": "Teacher Name",
  "email": "teacher@example.test",
  "password": "replace-with-a-strong-password",
  "employeeId": "EMP-001",
  "assignedClasses": ["507f1f77bcf86cd799439012"],
  "subjects": ["507f1f77bcf86cd799439013"]
}
```

## Attendance

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/attendance` | Admin, teacher assigned to the class | Mark an attendance session |
| GET | `/attendance` | Admin, assigned teacher, linked guardian | Filter with `classId`, `studentId`, and/or `date` |
| PUT | `/attendance/:id` | Admin, teacher assigned to the record's class | Correct a record |

Mark attendance example:

```json
{
  "studentId": "507f1f77bcf86cd799439013",
  "classId": "507f1f77bcf86cd799439012",
  "date": "2026-11-15",
  "session": "MORNING",
  "status": "PRESENT"
}
```

Sessions are `MORNING` or `AFTERNOON`; status is `PRESENT`, `ABSENT`, or `LATE`. A unique database index prevents duplicate student/date/session entries.

## Examinations and results

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/exams` | Admin, teacher, guardian | List exams visible to the caller |
| POST/PUT | `/exams[/:id]` | Admin, teacher assigned to class and subject | Create or edit an exam |
| DELETE | `/exams/:id` | Admin | Delete only if no results exist |
| GET | `/results` | Admin, assigned teacher, linked guardian | List visible results; optional `examId` or `studentId` filters |
| POST/PUT | `/results[/:id]` | Admin, teacher assigned to class and subject | Record or edit marks |

Exam example:

```json
{
  "title": "Term 1",
  "classId": "507f1f77bcf86cd799439012",
  "subjectId": "507f1f77bcf86cd799439013",
  "date": "2026-11-20",
  "maxMarks": 100,
  "passMarks": 40
}
```

Result example:

```json
{
  "examId": "507f1f77bcf86cd799439014",
  "studentId": "507f1f77bcf86cd799439013",
  "marksObtained": 86,
  "remarks": "Consistent work"
}
```

The API calculates percentage and grade. Marks must be between zero and the exam maximum. Existing results prevent exam edits that would invalidate their class, subject, or maximum-mark basis.

## Fees

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/fees` | Admin, linked guardian | List invoices |
| POST | `/fees` | Admin | Create an invoice |
| GET | `/fees/payments` | Admin, linked guardian | View payment history |
| POST | `/fees/payment` | Admin | Record a payment |

Invoice example:

```json
{
  "studentId": "507f1f77bcf86cd799439013",
  "academicYear": "2026-27",
  "feeType": "Tuition",
  "totalAmount": 12500,
  "dueDate": "2026-12-01"
}
```

Payment example:

```json
{
  "feeId": "507f1f77bcf86cd799439015",
  "amount": 2500,
  "paymentMethod": "UPI",
  "transactionId": "provider-reference"
}
```

Payment methods are `CASH`, `UPI`, `CARD`, and `BANK_TRANSFER`. Amounts must be positive, have at most two decimal places, and not exceed the current balance. If supplied, a transaction ID is unique. Payment and invoice balance updates use a MongoDB transaction.

## Dashboard and health

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/dashboard/stats` | Admin | Live counts, attendance summary, and fee totals |
| GET | `/health` | Public | API health check |

## API gaps

The current API does not expose a generated PDF report card, attendance export, general pagination, or fee collection filters by academic year/date. These are listed as future work in the [technical report](TECHNICAL_REPORT.md).
