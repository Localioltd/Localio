# OMOSIS One — Employee App

A separate React Native + Expo Android employee self-service app for OMOSIS, inspired by modern HRMS products such as ZingHR. Uses the OMOSIS purple/white visual identity and the supplied OMOSIS logo assets.

## Included screens
- Home dashboard and announcements
- Attendance check-in/check-out prototype and attendance history
- Leave balance, leave request form, and sample request status
- Salary summary and sample payslip list
- Employee profile and employee services
- GitHub Actions workflow to build a release APK

## Important prototype limitation
This project currently contains **UI and local demo interactions only**. Attendance, leave requests, payroll, profile, and announcements are sample/local data and are not connected to a real HR backend. Do not use the sample salary or employee details as real records. Before production, add secure authentication, role-based access, a database/API, manager approval workflows, audit logs, payroll document permissions, and applicable privacy/security controls. Never place service-role keys or other server secrets in the mobile app.

## Build an APK with GitHub
1. Create a new GitHub repository for the employee app.
2. Upload the *contents* of this folder to the repository root, including `.github/workflows/android-apk.yml`.
3. Open **Actions** → **Build OMOSIS One APK** → **Run workflow**.
4. After the run succeeds, download the `OMOSIS-One-APK` artifact ZIP and extract `app-release.apk`.

## Run locally
Requires Node.js 20 and a compatible Expo environment.

```bash
npm install
npx expo start
```
