# Legal OS: Outstanding Issues & MVP Checklist

This document logs the minor issues, glitches, and visual refinements requested to prepare Legal OS for the MVP. 

---

## 1. MVP Scope Adjustments
- **Disable Financials for MVP**: 
  - Apply a blur filter overlay to all financial-related tabs and pages (Firm Financials, Case Financials/Ledgers).
  - Place a prominent text card on top of the blurred sections showing: `"Coming Soon"`.

---

## 2. General Bugs & Glitches

### A. Login Dark Screen Glitch
- **Symptom**: Upon entering credentials and logging in, the app screen remains dark/empty. Users must manually refresh the browser for content to render.
- **Goal**: Ensure the dashboard loads immediately upon state transition without requiring a full window reload.

### B. Add Case / Add Lead "Blank Screen of Death"
- **Symptom**: Creating a new case or lead triggers a blank screen, requiring manual navigation or page refresh.
- **Goal**: Auto-navigate the user directly to the Active Matters (or Active Leads) dashboard upon successful creation, and display a subtle success notification toast.

### C. Case Fee Change Fail
- **Symptom**: Editing the "Total Agreed Price" does not apply changes (stays stuck at `0`).
- **Goal**: Fix the backend PUT/patch handler or input bindings to successfully persist the edit.

### D. Milestone WhatsApp Live Sync Restoration
- **Symptom**: The live WhatsApp sync for milestones was removed during the Information Architecture (IA) refactor.
- **Goal**: Restore the Milestone tracker live sync in the Overview sub-tab for each active case.

---

## 3. UI/UX & Styling Polish

### A. Bottom-Left Sidebar Profile Card
- **Symptom**: The bottom-left navigation has broken CSS and occasionally renders the old "Generate Report" button.
- **Goal**: Replace it with a clean account card displaying:
  - Account Profile image (defaulting to the logo @[src/logo.png], with an option to upload a custom one).
  - User details: Username, Display Name, and Role.

### B. Document Template Overhaul
- **Symptom**: The templates contain a hardcoded `localhost` address, lack formal grid ruling, and look unpolished.
- **Goal**:
  - Strip any hardcoded development server addresses.
  - Apply proper page ruling and professional typography styles.
  - Embed the corporate logo (`src/logo.png`) at the header of all printed/saved document templates.


## 4. Forgotten Core Integrations
- **WhatsApp Chatbot Flow Engine**: Currently, the /webhook POST endpoint in server.js only logs incoming events and does not route messages. We must build out the actual message parser to run the questionnaire flow, manage session states (whatsapp_sessions table), and auto-insert qualified leads into the database.


## 5. Architectural Adjustments
- **Local/Desktop Deployment Wrap (Electron / LAN)**: The firm wants a downloadable version of the application that runs locally on their machines rather than a public cloud website. We must plan a wrapper (e.g., Electron) or a localized LAN hosting model so the backend and database run on their office server/device to ensure offline-first speeds and local database security.
