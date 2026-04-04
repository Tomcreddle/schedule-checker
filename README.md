# 🏥 JISCare — Employee Scheduling System

> **AI-Powered Day-Off Request & Schedule Conflict Management**  
> Built by the OJT Development Team · Supervised by Bryan Dadiz

[![Live Demo]](https://schedule-checker-cttb.onrender.com)
[![GitHub]](https://github.com/Tomcreddle/schedule-checker)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Live Demo](#-live-demo)
- [System Architecture](#-system-architecture)
- [Tech Stack & Versions](#-tech-stack--versions)
- [Features](#-features)
- [How to Use the App](#-how-to-use-the-app)
- [n8n Workflows](#-n8n-workflows)
- [Google Sheets Database](#-google-sheets-database)
- [Local Setup & Installation](#-local-setup--installation)
- [Deploying to Render](#-deploying-to-render)
- [Project Structure](#-project-structure)
- [For Future OJT](#-for-future-ojt)
- [Development Reference](#-development-reference-create-react-app)

---

## 🧠 Overview

JISCare is a web-based employee scheduling system that automates two core HR workflows:

1. **Day-Off Request Submission** — Employees submit day-off requests through a web portal. The system validates the request against **7 scheduling rules** and uses an AI model (GLM-4.5) to make an automatic Approve/Reject decision, which is logged to Google Sheets in real time.

2. **Schedule Conflict Checker** — Staff can check whether a proposed shift assignment will cause a conflict (employee double-booking, room double-booking, or consecutive rest days) before committing it.

All automation is handled by **n8n workflows** on the backend. Data is stored in a **Google Sheets** spreadsheet (`JISCare_Employee_Scheduler`). The frontend is a **React app** deployed on **Render.com**.

---

## 🌐 Live Demo

**Portal URL:** [https://schedule-checker-cttb.onrender.com](https://schedule-checker-cttb.onrender.com)

> ⚠️ The site is on Render's free tier. If it hasn't been visited recently, it may take **30–60 seconds** to wake up on first load.

---

## 🏗 System Architecture

```
User (Browser)
     │
     ▼
React Frontend (Render.com Static Site)
     │
     ├── POST /dayoff-submit ──────────► n8n Workflow 1 (Day-Off Submit)
     │                                         │
     │                                         ├── Google Sheets (Read: Employees, Shifts, DayOff_Requests)
     │                                         ├── GLM-4.5 AI Model (ZAI Models API)
     │                                         └── Google Sheets (Write: DayOff_Requests, AI_Log)
     │
     └── POST /schedule-check ─────────► n8n Workflow 2 (Schedule Check)
                                               │
                                               ├── Google Sheets (Read: Employees, Shifts, Rooms)
                                               ├── GLM-4.5 AI Model (ZAI Models API)
                                               └── Google Sheets (Write: Schedule_Checks)
```

---

## 🛠 Tech Stack & Versions

| Component | Technology | Version |
|---|---|---|
| Frontend Framework | React (Create React App) | 18.x |
| Frontend Hosting | Render.com Static Site | — |
| Backend Automation | n8n | 1.x |
| AI Model | GLM-4.5 via ZAI Models (OpenAI-compatible API) | — |
| Database | Google Sheets — JISCare_Employee_Scheduler | API v4 |
| Node.js | Required for local development | 18.x or higher |
| npm | Package manager | 9.x or higher |

> 📝 Update version numbers above if any dependencies are upgraded.

---

## ✨ Features

### Feature 1 — AI-Powered Day-Off Request

**Webhook:** `POST /dayoff-submit`

Employees fill out a form with their Employee ID, name, requested date, and reason. The system:

- Reads the **Employees**, **Shifts**, and **DayOff_Requests** sheets from Google Sheets
- Validates against **7 scheduling rules**:

| # | Rule | Description |
|---|---|---|
| 1 | Duplicate | Employee cannot have two approved day-offs on the same date |
| 2 | Pending Request Exists | Cannot submit if a pending request already exists for that date |
| 3 | Shift Conflict | Cannot request a day off on a date already scheduled to work |
| 4 | Maximum Capacity | Max 2 employees off per day — no slots if already full |
| 5 | No Consecutive Days Off | Cannot have approved day-offs on back-to-back dates |
| 6 | Weekly Limit | Only 1 day off per ISO week per employee |
| 7 | Same Weekday Repeat | Cannot take the same weekday off repeatedly |

- Sends full context to **GLM-4.5 AI** for an **APPROVE** or **REJECTED** decision with a warm message and alternative date suggestions
- Result is logged to `DayOff_Requests` and returned to the portal instantly

**Real examples from the system:**

| Employee | Date | Status | AI Reason |
|---|---|---|---|
| Maria Santos (EMP-002) | 2026-02-01 | ✅ Approved | No conflicts with scheduling or other requests |
| Juan dela Cruz (EMP-001) | 2026-03-25 | ✅ Approved | No conflicts exist for the requested date |
| Maria Santos (EMP-002) | 2026-03-25 | ❌ Rejected | Date reached maximum capacity for employee absences |
| Juan dela Cruz (EMP-001) | 2026-03-26 | ❌ Rejected | Consecutive days off and weekly limit violations |
| Juan dela Cruz (EMP-001) | 2026-04-02 | ✅ Approved | No conflicts found for the requested date |
| Juan dela Cruz (EMP-001) | 2026-04-04 | ❌ Rejected | Exceeded the weekly day-off limit |

---

### Feature 2 — Schedule Conflict Checker

**Webhook:** `POST /schedule-check`

Staff enter an Employee ID, date, shift type, time range, and optional Room ID. The system:

- Reads the **Employees**, **Shifts**, and **Rooms** sheets
- Checks **3 conflict rules**:

| # | Rule | Description |
|---|---|---|
| 1 | No Employee Double-Booking | Same employee cannot have two overlapping shifts on the same date |
| 2 | No Room Double-Booking | Same room cannot be assigned to two overlapping shifts on the same date |
| 3 | No 2+ Consecutive Rest Days | Employee cannot be assigned OFF on two back-to-back dates |

- AI returns **CLEAR** or **CONFLICT** with suggested alternative rooms/dates
- Result is logged to `Schedule_Checks` with a unique Request ID (format: `SC-YYYYMMDD-HHMMSS`)

---

## 📱 How to Use the App

### Submitting a Day-Off Request

1. Go to [https://schedule-checker-cttb.onrender.com](https://schedule-checker-cttb.onrender.com)
2. Fill in your **Employee ID**:
   - `EMP-001` — Juan dela Cruz
   - `EMP-002` — Maria Santos
   - `EMP-003` — Pedro Reyes
3. Enter your **Full Name**
4. Pick your **Request Date** using the date picker
5. Select a **Reason**: Personal / Medical / Emergency / Vacation / Other
6. Add **Notes** (optional)
7. Click **Submit Day-Off Request**
8. Result appears below the form:
   - ✅ **Green banner** = Approved — logged with `Status: Approved`
   - ❌ **Red banner** = Rejected — AI explains why and suggests an alternative date
   - ⚠️ **Orange/error** = Invalid Employee ID, bad date format, or past date

### Checking a Schedule

1. Click **Schedule Checker** in the top navigation
2. Enter the **Employee ID** to check
3. Enter the **Date** in `dd/mm/yyyy` format
4. Select **Shift Type**: Morning / Afternoon / Evening / OFF
   - Morning default: 7:30 AM – 12:30 PM
   - Afternoon default: 12:30 PM – 5:30 PM
5. Optionally enter a **Room ID**:
   - `ROOM-01` — Conference Room A (Capacity: 10, 2nd Floor)
   - `ROOM-02` — Conference Room A (Capacity: 8, 2nd Floor)
   - `ROOM-03` — Training Room (Capacity: 20, 3rd Floor)
6. Click **Check Schedule**
7. Result appears in the **Check History** panel on the right:
   - ✅ **CLEAR** = No conflicts
   - ❌ **CONFLICT** = Details shown with AI suggestions

---

## ⚙️ n8n Workflows

Both workflows are exported as JSON files in the `/workflows/` folder of this repo.

**To import into your own n8n instance:**
1. Open your n8n instance
2. Click **+ New Workflow** → **⋯ menu** → **Import from File**
3. Select the JSON file
4. Update the **Google Sheets credentials** and **AI (ZAI Models) credentials**
5. Toggle the workflow **Active**

### Workflow Files

| File | Workflow | Webhook Path |
|---|---|---|
| `workflows/dayoff-submit.json` | Day-Off Request Processing | `POST /dayoff-submit` |
| `workflows/schedule-check.json` | Schedule Conflict Checking | `POST /schedule-check` |

### Workflow 1 — Day-Off Submit

```
📥 Webhook
  → 👤 Read Employees3   (Employees sheet)
  → 📅 Read Shifts3      (Shifts sheet)
  → 🛑 Read DayOffs      (DayOff_Requests sheet)
  → 🔍 Validate & Check  (JS: 7 rules + build alternatives list)
  → ✅ Valid?
      ├─ [TRUE]  → 🧠 AI Decision  (+ 🤖 GLM-4.5 AI Model)
      │              → 📋 Parse AI Decision
      │              → 🤔 Approved?
      │                  ├─ [TRUE]  → 💾 Save Approved → ✅ Approved Response (HTTP 200)
      │                  └─ [FALSE] → 💾 Save Rejected → ❌ Rejected Response (HTTP 200)
      └─ [FALSE] → ⚠️ Error Response (HTTP 400)
```

### Workflow 2 — Schedule Check

```
📥 Webhook
  → 👤 Read Employees  (Employees sheet)
  → 📅 Read Shifts     (Shifts sheet)
  → 🏠 Read Rooms      (Rooms sheet)
  → 🔍 Validate & Check (JS: 3 conflict rules + alt rooms/dates)
  → ✅ Valid?
      ├─ [TRUE]  → 🧠 AI Decision  (+ 🤖 GLM-4.5 AI Model)
      │              → 📋 Parse AI Decision
      │              → 🤔 Clear?
      │                  ├─ [TRUE]  → 💾 Save to Sheet (Clear)    → ✅ Clear Response (HTTP 200)
      │                  └─ [FALSE] → 💾 Save to Sheet (Conflict) → ❌ Conflict Response (HTTP 200)
      └─ [FALSE] → ⚠️ Error Response (HTTP 400)
```

---

## 🗄 Google Sheets Database

**Spreadsheet name:** `JISCare_Employee_Scheduler`  
6 sheet tabs — all data read and written automatically by the n8n workflows.

### Employees Tab
Columns: `Employee_ID`, `Name`, `Department`, `Position`, `Email`, `Shift_Default`, `Date_Hired`

| Employee_ID | Name | Department | Position |
|---|---|---|---|
| EMP-001 | Juan dela Cruz | Operations | Staff |
| EMP-002 | Maria Santos | Operations | Staff |
| EMP-003 | Pedro Reyes | Operations | Staff |

### Shifts Tab
Columns: `Employee_ID`, `Date`, `Shift_Type`, `Start_Time`, `End_Time`, `Room_ID`, `Notes`

Stores all shift assignments. The n8n Schedule Check workflow reads this to detect double-booking.

### Rooms Tab
Columns: `Room_ID`, `Room_Name`, `Capacity`, `Location`

| Room_ID | Room_Name | Capacity | Location |
|---|---|---|---|
| ROOM-01 | Conference Room A | 10 | 2nd Floor |
| ROOM-02 | Conference Room A | 8 | 2nd Floor |
| ROOM-03 | Training Room | 20 | 3rd Floor |

### DayOff_Requests Tab
Columns: `Employee_ID`, `Employee_Name`, `Date`, `Status`, `Reason`, `Requested_On`, `Manager_Note`

Auto-populated by the Day-Off Submit workflow. `Status` is either `Approved` or `Rejected`. `Manager_Note` is the AI-generated reasoning.

### Schedule_Checks Tab
Columns: `Logged_At`, `Request_ID`, `Employee_ID`, `Employee_Name`, `Date`, `Shift_Type`, `Room_ID`, `Status`, `Conflicts`, `AI_Reasoning`

Auto-populated by the Schedule Check workflow. `Request_ID` format: `SC-YYYYMMDD-HHMMSS`.

### AI_Log Tab
Columns: `Logged_At`, `Type`, `Conflict_ID`, `Employee_ID`, `Employee_Name`, `Request_Date`, `Weekday`, `Severity`, `Issues`, `Resolution`, `Action`, `Alt_Dates`

Detailed AI conflict event log. `Type` is either `Conflict` or `No Action`.

### Weekly_Overview Tab
Columns: `Week_Label`, `Employee_ID`, `Employee_Name`, `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun`, `Rest_Day`

Summary view showing each employee's shift type per day of the week.

---

## 💻 Local Setup & Installation

### Prerequisites

- **Node.js** v18 or higher → [nodejs.org](https://nodejs.org)
- **npm** v9 or higher (bundled with Node.js)
- **Git** → [git-scm.com](https://git-scm.com)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Tomcreddle/schedule-checker.git

# 2. Navigate into the project folder
cd schedule-checker

# 3. Install all dependencies
npm install

# 4. Start the development server
npm start
# App opens at http://localhost:3000
```

> ⚠️ In development mode, the app calls the **live n8n webhook URLs**. To use a local n8n instance, update the API endpoint URLs in `/src/` and restart.

### Build for Production

```bash
npm run build
# Outputs optimized files to the /build folder, ready for deployment
```

---

## 🚀 Deploying to Render

The app auto-deploys whenever changes are pushed to the `master` branch on GitHub.

| Setting | Value |
|---|---|
| Service Type | Static Site |
| Build Command | `npm run build` |
| Publish Directory | `build` |
| Branch | `master` |
| Live URL | https://schedule-checker-cttb.onrender.com |

```bash
# Deploy an update
git add .
git commit -m "describe your change"
git push origin master
# Render detects the push and auto-builds — monitor at dashboard.render.com
```

---

## 📁 Project Structure

```
schedule-checker/
├── public/                        # Static assets (index.html, favicon, etc.)
├── src/                           # React source files
│   ├── App.js                     # Main app component and routing
│   └── ...                        # Portal and checker components
├── workflows/                     # n8n workflow JSON exports
│   ├── dayoff-submit.json         # Day-Off Request workflow
│   └── schedule-check.json        # Schedule Conflict Check workflow
├── .gitignore
├── package.json                   # Node.js project config and dependencies
├── package-lock.json
└── README.md
```

---

## 👥 For Future OJT

### What the Current Batch Built

- React web portal deployed on Render.com as a static site
- Two n8n workflows automating day-off processing and schedule conflict checking
- Google Sheets database with 6 tabs (Employees, Shifts, Rooms, DayOff_Requests, Schedule_Checks, AI_Log, Weekly_Overview)
- AI layer using GLM-4.5 to generate human-friendly decisions and suggest alternatives

### Important Notes Before Making Changes

| Item | Note |
|---|---|
| **Webhook URLs** | Hardcoded in React source. If n8n webhook path changes, update URL in `/src/` and redeploy. |
| **Google Sheets ID** | Hardcoded in both n8n workflows. If spreadsheet is recreated, update the ID in every Google Sheets node. |
| **Google OAuth** | Credential name: `Google Sheets account 8`. Re-authenticate via n8n → Settings → Credentials if expired. |
| **AI Credential** | Credential name: `ZAI Models` (OpenAI-compatible). Update in n8n → Settings → Credentials if API key expires. |
| **Render Free Tier** | Site sleeps after 15 min of inactivity — first load may be slow. Upgrade to paid tier for always-on hosting. |
| **n8n Workflows** | Always duplicate a workflow before editing. Never modify the live production workflow directly. |

### Contacts

| Role | Name |
|---|---|
| OJT Supervisor | Bryan Dadiz |
| Developer (current batch) | Tomcreddle / OJT Team |

---

## 📚 Development Reference (Create React App)

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

### Available Scripts

#### `npm start`
Runs the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in your browser. The page reloads on changes. Lint errors appear in the console.

#### `npm test`
Launches the test runner in interactive watch mode. See [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

#### `npm run build`
Builds the app for production to the `build` folder. React is bundled in production mode and optimized for best performance. The build is minified and filenames include hashes.

#### `npm run eject`
> ⚠️ **One-way operation — cannot be undone.**

Removes the single build dependency and copies all configuration files (webpack, Babel, ESLint) into the project for full control. Not recommended unless necessary.

### Learn More

- [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started)
- [React documentation](https://reactjs.org/)
- [Code Splitting](https://facebook.github.io/create-react-app/docs/code-splitting)
- [Analyzing the Bundle Size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)
- [Making a Progressive Web App](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)
- [Advanced Configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)
- [Deployment](https://facebook.github.io/create-react-app/docs/deployment)
- [npm run build fails to minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

---

## 📄 License

This project was developed as part of an On-the-Job Training (OJT) program for JISCare. For internal use only.

