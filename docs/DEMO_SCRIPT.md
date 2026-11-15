# Demo Walkthrough (3–5 minutes)

Use a local instance only. Before recording, configure `server/.env`, run the admin seed command, and create a small, authorized set of school records through the UI. Do not display real student, guardian, payment, or credential data. The project does not ship demo accounts or sample records.

## Walkthrough

1. **0:00–0:25 — Sign in**  
   Sign in with the locally seeded admin account. Briefly show the responsive EduSphere shell and admin navigation.
2. **0:25–0:55 — Dashboard**  
   Point out the live student/teacher/class counts, latest seven-day attendance, collected fees, and outstanding balance. Mention that empty databases correctly show empty/zero values.
3. **0:55–1:35 — Academic setup**  
   Create or open a class and subject, then show that duplicate class/year or subject-code records are rejected.
4. **1:35–2:10 — Student and staff records**  
   Add a student, assign a guardian account if available, then create a teacher with class/subject assignments. Show that student removal archives the record rather than deleting history.
5. **2:10–2:50 — Attendance and examinations**  
   Select a class/date/session, mark or edit attendance, and show the examination form with maximum/passing marks.
6. **2:50–3:35 — Results and fees**  
   Enter marks and show the server-calculated percentage/grade. Create an invoice, record a partial payment, and show the updated balance and payment ledger.
7. **3:35–4:20 — Role-based access**  
   Log out, then sign in with test teacher and guardian accounts created for the demonstration. Show teacher class/subject limits and guardian linked-student records. Never use real family or financial data.
8. **4:20–4:40 — Close**  
   Note that the app is local-only and explain setup via the README. Do not imply that it is hosted.

If there is no safe test data, demonstrate the empty states and seeded admin sign-in without inventing records or credentials during the recording.
