# Database Schema

MongoDB collections are defined by the Mongoose models in `server/src/models`. Mongoose creates the declared indexes when automatic index creation is enabled in the deployment environment. Existing records are not deleted by application setup.

## Collections

| Collection | Main fields | Important constraints |
|---|---|---|
| `users` | `name`, `email`, `password`, `role`, `isActive` | Unique normalized email; password is excluded from normal queries |
| `teachers` | `userId`, `employeeId`, `assignedClasses[]`, `subjects[]` | Unique user and employee IDs; references `users`, `classes`, and `subjects` |
| `students` | `admissionNo`, `name`, `dateOfBirth`, `classId`, `guardianIds[]`, `isActive` | Unique admission number; `isActive=false` archives the record |
| `classes` | `name`, `section`, `academicYear` | Unique name/section/year combination |
| `subjects` | `name`, `code`, `classes[]` | Unique subject code |
| `attendance` | `studentId`, `classId`, `markedBy`, `date`, `session`, `status` | Unique student/date/session |
| `exams` | `title`, `classId`, `subjectId`, `date`, `maxMarks`, `passMarks` | Unique class/subject/title combination |
| `results` | `examId`, `studentId`, `marksObtained`, `percentage`, `grade`, `remarks` | Unique exam/student pair |
| `fees` | `studentId`, `academicYear`, `feeType`, `totalAmount`, `paidAmount`, `dueDate`, `status` | Unique student/year/type; total and paid amounts are non-negative and paid cannot exceed total |
| `payments` | `feeId`, `studentId`, `amount`, `paymentMethod`, `transactionId`, `receivedBy`, `paymentDate` | Optional transaction ID is unique; indexes support invoice history |

`GUARDIAN` accounts link to students through `students.guardianIds`. Teacher class and subject assignments are stored as references on the teacher profile. Monetary values are stored as numeric amounts with two-decimal precision enforced by the payment API.

## Entity relationship diagram

```mermaid
erDiagram
    USER ||--o| TEACHER : profile
    USER }o--o{ STUDENT : guardianIds
    USER ||--o{ ATTENDANCE : marks
    USER ||--o{ PAYMENT : receives
    CLASS ||--o{ STUDENT : enrolls
    CLASS }o--o{ TEACHER : assignedClasses
    SUBJECT }o--o{ TEACHER : teaches
    CLASS }o--o{ SUBJECT : curriculum
    CLASS ||--o{ EXAM : schedules
    SUBJECT ||--o{ EXAM : assesses
    EXAM ||--o{ RESULT : has
    STUDENT ||--o{ RESULT : earns
    STUDENT ||--o{ ATTENDANCE : records
    CLASS ||--o{ ATTENDANCE : records
    STUDENT ||--o{ FEE : billed
    FEE ||--o{ PAYMENT : settled_by
    STUDENT ||--o{ PAYMENT : pays

    USER {
        ObjectId _id
        string name
        string email
        string password
        string role
        boolean isActive
    }
    TEACHER {
        ObjectId userId
        string employeeId
        ObjectId[] assignedClasses
        ObjectId[] subjects
    }
    STUDENT {
        ObjectId _id
        string admissionNo
        string name
        ObjectId classId
        ObjectId[] guardianIds
        boolean isActive
    }
    CLASS {
        ObjectId _id
        string name
        string section
        string academicYear
    }
    SUBJECT {
        ObjectId _id
        string code
        string name
        ObjectId[] classes
    }
    ATTENDANCE {
        ObjectId studentId
        ObjectId classId
        ObjectId markedBy
        date date
        string session
        string status
    }
    EXAM {
        ObjectId classId
        ObjectId subjectId
        number maxMarks
        number passMarks
    }
    RESULT {
        ObjectId examId
        ObjectId studentId
        number marksObtained
        number percentage
        string grade
    }
    FEE {
        ObjectId studentId
        number totalAmount
        number paidAmount
        string status
    }
    PAYMENT {
        ObjectId feeId
        ObjectId studentId
        number amount
        string paymentMethod
        string transactionId
    }
```

MongoDB represents these relationships with ObjectId references and arrays rather than relational join tables.
