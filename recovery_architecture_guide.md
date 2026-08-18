# 🏛️ Legal OS — Master Recovery & Architecture Blueprint

> **Notice**: This document serves as the gold-standard architectural recovery blueprint for Legal OS, capturing the exact code contracts, component blueprints, left nav layout, Strategy Workbench sub-tools, and SocaBot AI engine.

---

## 1. 🧭 The New Left Nav Layout (Restored in `App.jsx`)

The left sidebar navigation is persona-aware and groups navigation into distinct desks based on `userRole` / `accountPersona`:

### A. Advocate Desk (`userRole === 'advocate'`)
- **Group 1: 💼 ADVOCATE DESK**
  - 🏠 `Dashboard` (`id: 'home'`)
  - ⚖️ `Active Matters` (`id: 'matters'`)
  - 🎯 `Strategy Workbench` (`id: 'strategy'`)
  - 🤖 `SocaBot AI` (`id: 'soca_pa'`)
  - 💰 `Financials & Trust` (`id: 'finance'`)
  - 📅 `Firm Calendar` (`id: 'calendar'`)
  - 📝 `Document Studio` (`id: 'documents'`)
  - 📋 `Reports & Briefs` (`id: 'report'`)
- **Group 2: 🏢 CRM & INTAKE**
  - 📥 `CRM Intake Queue` (`id: 'leads'`)
  - 🏛️ `Archives Vault` (`id: 'archives'`)

### B. Paralegal & Secretary Desk (`userRole === 'secretary'`)
- **Group 1: 💼 PARALEGAL & SEC DESK**
  - 🏠 `Dashboard` (`id: 'home'`)
  - ⚖️ `Active Matters` (`id: 'matters'`)
  - 🤖 `SocaBot AI` (`id: 'soca_pa'`)
  - 📅 `Court Diarization` (`id: 'calendar'`)
  - 📝 `Document Studio` (`id: 'documents'`)
  - 💰 `Disbursements & Fees` (`id: 'finance'`)
- **Group 2: 🏢 FIRM VAULT & INTAKE**
  - 📥 `CRM Intake Queue` (`id: 'leads'`)
  - 🏛️ `Archives Vault` (`id: 'archives'`)

### C. Managing Partner & Admin Desk (`userRole === 'admin' | 'developer'`)
- **Group 1: 💼 MANAGING PARTNER DESK**
  - 📈 `Partner Dashboard` (`id: 'home'`)
  - ⚖️ `All Active Matters` (`id: 'matters'`)
  - 🎯 `Strategy Workbench` (`id: 'strategy'`)
  - 🤖 `SocaBot AI` (`id: 'soca_pa'`)
  - 💰 `Firm Profitability` (`id: 'finance'`)
  - 📅 `Master Calendar` (`id: 'calendar'`)
  - 📝 `Document Studio` (`id: 'documents'`)
  - 📋 `Advanced Analytics` (`id: 'report'`)
- **Group 2: 🏢 FIRM GOVERNANCE**
  - 📥 `CRM & Client Growth` (`id: 'leads'`)
  - 🏛️ `Archives Vault` (`id: 'archives'`)
  - ⚙️ `Admin & User Roles` (`id: 'settings'`)

---

## 2. 🎯 Strategy Tab & Strategy Workbench (`StrategyWorkbench.jsx`)

The Strategy Workbench is the legal theory and factual synthesis engine of Legal OS. It houses 6 interconnected sub-tools accessible via both top-level navigation (`id: 'strategy'`) and inside matter details (`matterTab === 'strategy'`):

### Sub-Tools Breakdown
1. **🎯 Legal Strategy & Theory Engine** ([`StrategyWorkbench.jsx`](file:///c%3A/Users/Elitebook/OneDrive/Desktop/softlogic%20web%20dev/legal-os/dashboard/src/components/StrategyWorkbench.jsx)):
   - Synthesizes case facts, legal issues, causes of action, and statutory authorities.
   - Connects directly to `Submissions & Authorities` tab to convert strategy into formal court filings.
2. **📄 Document Reviewer & Deep OCR** ([`DocReviewer.jsx`](file:///c%3A/Users/Elitebook/OneDrive/Desktop/softlogic%20web%20dev/legal-os/dashboard/src/components/DocReviewer.jsx)):
   - Analyzes raw court PDFs, contracts, and affidavits with multi-page text extraction.
3. **📅 Chronology & Fact Locking** ([`ChronologyView.jsx`](file:///c%3A/Users/Elitebook/OneDrive/Desktop/softlogic%20web%20dev/legal-os/dashboard/src/components/ChronologyView.jsx)):
   - Builds an immutable timeline of locked case facts (`extracted_facts` table).
4. **📦 E-Bundle Desk & Indexing** ([`EBundleDesk.jsx`](file:///c%3A/Users/Elitebook/OneDrive/Desktop/softlogic%20web%20dev/legal-os/dashboard/src/components/EBundleDesk.jsx)):
   - Compiles automated court bundles with pagination, coversheets, and table of contents.
5. **🎙️ Deposition & Hearing Studio** ([`DepoStudio.jsx`](file:///c%3A/Users/Elitebook/OneDrive/Desktop/softlogic%20web%20dev/legal-os/dashboard/src/components/DepoStudio.jsx)):
   - Manages witness statements, cross-examination checklists, and hearing transcripts.
6. **🤖 Soca AI Research Workbench** ([`SocaAI.jsx`](file:///c%3A/Users/Elitebook/OneDrive/Desktop/softlogic%20web%20dev/legal-os/dashboard/src/components/SocaAI.jsx)):
   - Deep legal research engine queries Kenya Law, statutes, and precedent.

---

## 3. 🤖 SocaTab / SocaBot AI Engine (`SocaPaAssistant.jsx` & `socaAiService.js`)

SocaBot is the executive law firm Personal Assistant.

### Key Capabilities
- **5-Tier Fallback Cascade**: `groq/compound` -> `qwen/qwen3.6-27b` -> `openai/gpt-oss-120b` -> `openai/gpt-oss-20b` -> `allam-2-7b`.
- **Flash Execution Tag Parsing**: Appends `<!--ACTION:{...}-->` at the end of messages to execute real SQLite database operations without manual API calls.
  - `CREATE_CASE`: Registers a new case in `case_tracking`.
  - `CREATE_LEAD`: Inserts a new lead in `leads`.
  - `CREATE_CALENDAR_EVENT`: Adds court date to `court_calendar`.
  - `RECORD_PAYMENT`: Logs payment in `case_payments`.
  - `ADD_FACT`: Locks a fact in `extracted_facts`.
  - `SAVE_MEMORY`: Stores persistent facts in `soca_memory`.
- **Persistent Cross-Chat Memory (`soca_memory`)**:
  - Remembers client preferences, firm rules, and learned facts across chat sessions.
  - Accessible via `/api/soca-pa/memory`.
- **Dynamic Progress Bar & Floating Responses**:
  - Radial dark background (`#0c1424` -> `#03060b`).
  - Animated live stage capsule (`🔍 Analyzing...` -> `🧠 Synthesizing...` -> `⚡ Flash executing...`).
  - Anticipated follow-up chips (`<!--SUGGESTIONS:[...]-->`).
  - Executive error notices with diagnostic badges (`[DIAGNOSTIC BADGE: ERR_...]`).
