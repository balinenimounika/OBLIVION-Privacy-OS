# OBLIVION – Frontend Application

**The Internet's Forget Button – User Interface & Privacy Orchestration Dashboard**

[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-purple.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)

---

## 1. Overview

The OBLIVION frontend is a high-assurance cybersecurity SaaS dashboard that interfaces directly with the OBLIVION PostgreSQL 18.6 + Express 5 backend. It provides an intuitive, cyber-defense styled UI for personal privacy management, exposure scoring, statutory removal request orchestration (GDPR Article 17 / CCPA), deadline reminder tracking, and compliance audit exports.

---

## 2. Technology Stack

- **Framework:** React 18 + Vite 6
- **Language:** TypeScript 5.7
- **Styling:** Tailwind CSS (Dark Navy & Electric Violet theme)
- **Routing:** React Router v6
- **HTTP Client:** Axios with centralized interceptors
- **Icons:** Lucide React
- **Analytics Visualizations:** Recharts (Bar, Pie, and Area analytics)
- **Testing:** Vitest + React Testing Library + JSDOM

---

## 3. Directory Structure

```text
frontend/
├── src/
│   ├── api/                # Centralized Axios client & domain API modules
│   │   ├── client.ts       # Base configuration, token interceptors, 401 handling
│   │   ├── auth.api.ts     # Register, login, profile, logout
│   │   ├── website.api.ts  # Website CRUD & category filtering
│   │   ├── exposure.api.ts # Exposure records & category associations
│   │   ├── category.api.ts # Seeded data categories catalog
│   │   ├── removal.api.ts  # Removal requests, state transitions, history
│   │   ├── reminder.api.ts # Follow-up reminder scheduling
│   │   ├── notification.api.ts # System alerts & read status updates
│   │   ├── dashboard.api.ts# Aggregated metrics, exposure breakdown
│   │   └── audit.api.ts    # Audit logs list, summary, GDPR export
│   ├── components/
│   │   ├── common/         # Button, Input, Select, Card, Badge, Modal, Skeleton
│   │   └── layout/         # AppLayout, Sidebar, Topbar, Navbar, Footer, ProtectedRoute
│   ├── context/            # AuthContext, ThemeContext, ToastContext
│   ├── pages/              # Landing, Auth, Dashboard, Websites, Exposures, Removals, etc.
│   ├── test/               # Vitest test setup and test specifications
│   ├── types/              # Complete TypeScript domain contracts
│   ├── App.tsx             # Master application router
│   ├── index.css           # Tailwind base styles and custom utilities
│   └── main.tsx            # Vite root entrypoint
├── index.html              # HTML shell with typography links
├── package.json            # Frontend dependencies & scripts
├── tailwind.config.js      # Cybersecurity dark navy theme configuration
└── vite.config.ts          # Vite bundler & Vitest configuration
```

---

## 4. Getting Started & Installation

### Prerequisites
- Node.js 24 LTS
- OBLIVION Backend running on `http://localhost:5000`

### Step 1: Install Dependencies
```powershell
cd frontend
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
Ensure `VITE_API_BASE_URL` points to the running backend API:
```ini
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

### Step 3: Run Development Server
```powershell
npm run dev
```
Open `http://localhost:3000` in your web browser.

### Step 4: Production Build
```powershell
npm run build
npm run preview
```

---

## 5. Testing

```powershell
# Run frontend test suite via Vitest:
npm test
```

---

## 6. Known Architectural Considerations

1. **Bearer Token Storage:**
   The backend issues cryptographically signed HS256 Bearer JWTs without cookies. The frontend securely stores the token in memory, synchronized with `localStorage` for development browser session persistence.
2. **Dynamic Risk Calculation:**
   The frontend displays the backend's real-time computed `calculatedRiskScore` and `calculatedRiskRating`. It never calculates a conflicting client-side risk score.
3. **Stateless Logout:**
   Calling logout invokes `POST /api/v1/auth/logout` to record an `AUTH_LOGOUT` audit log in PostgreSQL and immediately purges local session tokens.
