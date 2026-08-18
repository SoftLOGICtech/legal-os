# Legal OS — System Environment Map & Capabilities

## 1. System Overview & Architecture
Legal OS is an integrated legal practice management platform tailored for Kenyan Advocates and Law Firms.
The system consists of:
- **Backend**: Node.js + Express API server running on port 3001 with SQLite database.
- **Frontend**: React + Vite dashboard with custom dark luxury typography system (`--navy-950`, `--gold-400`, Inter/Outfit/Cinzel fonts).

---

## 2. Platform Navigation Modules

### A. Active Matters & Case Workspaces (`/matters`)
- **Matter Management**: Lists active legal cases, tracking tokens, client names, and milestones.
- **Milestone Timeline**: Tracks case progression (e.g., Pleadings -> Mention -> Hearing -> Judgment).
- **Submissions & Authorities**: Repository of court filings, authorities, and skeleton arguments.
- **Financials**: Invoices, M-Pesa/Bank payments, client trust balances, and reimbursable disbursements.
- **Calendar & Deadlines**: Statutory appeal timelines, mention dates, court appearances, and reminders.

### B. Strategy Workbench (`/strategy`)
- **Document Reviewer (`doc_reviewer`)**: PDF split-view reader with text selection, pincite extraction, and color-coded facts locking.
- **Chronology View (`chronology`)**: Master timeline of case facts with issue color tags, witness roster mappings, and gap detection.
- **Fact Analyzer & Issue Mapper**: Categorize facts into legal issues and link them to witness testimony.

### C. eCitizen Judiciary Portal Integration (`/ecitizen`)
- **PDF Document Ingestion**: Uploads Official Receipts, Notices of Mention, Cause Lists, Decrees, and Pleadings.
- **Auto-Matcher**: Automatically links uploaded court documents to active firm matters via Judiciary Case IDs or Client Names.

### D. SOCA PA — Personal Assistant Command Center (`/soca_pa`)
- Global AI assistant for administrative workflow automation, PDF parsing action determination, schedule tracking, and document summarization.

---

## 3. Database Schema Reference

| Table Name | Primary Purpose | Key Fields |
| :--- | :--- | :--- |
| `case_tracking` | Active Matter Records | `id`, `client_name`, `case_title`, `judiciary_case_id`, `milestones_json`, `current_milestone`, `total_fee`, `outstanding_balance` |
| `extracted_facts` | Locked Case Chronology | `id`, `case_id`, `fact_date`, `description`, `pincite`, `status`, `issues`, `contacts`, `color`, `source_text` |
| `case_issues` | Legal Issues per Matter | `id`, `case_id`, `name`, `color` |
| `witness_roster` | Witnesses & Parties | `id`, `case_id`, `name`, `role`, `contact` |
| `case_invoices` | Billing Invoices | `id`, `case_id`, `invoice_number`, `amount`, `notes`, `due_date`, `disbursement_ids` |
| `case_payments` | Fee & Trust Payments | `id`, `case_id`, `amount`, `payment_method`, `reference`, `destination`, `invoice_id` |
| `case_disbursements` | Case Expenses | `id`, `case_id`, `amount`, `description`, `payment_method`, `date` |

---

## 4. Determined Actions System (PDF Ingestion & PA Engine)

When processing incoming administrative documents (Receipts, Notices of Mention, Orders), SOCA AI evaluates the document and returns **Determined Actions**:

1. `ACTION_LINK_MATTER`: Link document to matching case (`case_id`).
2. `ACTION_CREATE_CALENDAR_EVENT`: Schedule court mention/hearing date on the calendar.
3. `ACTION_RECORD_PAYMENT`: Log M-Pesa / PRN payment into firm financial ledger.
4. `ACTION_LOG_DISBURSEMENT`: Record court filing fee as reimbursable expense.
5. `ACTION_ADD_FACT`: Lock auto-extracted fact directly to case chronology.

The user is presented with a **Determined Actions Review Window** to review, toggle, or proceed with auto-execution.

---

## 5. SOCA PA Executive Tool Integration & REST API Schema Map

SOCA PA is trained with explicit operational knowledge of how to trigger, format, and execute system actions across the platform:

### Tool 1: Calendar & Mention API
- **Endpoint:** `POST /api/calendar`
- **Payload Schema:**
  ```json
  {
    "case_id": "string",
    "event_type": "MENTION" | "HEARING" | "SUBMISSION_DEADLINE",
    "date": "YYYY-MM-DD",
    "time": "HH:MM (e.g. 09:00 AM)",
    "description": "Notice of Mention before Hon. Lady Justice...",
    "virtual_link": "https://teams.microsoft.com/..."
  }
  ```
- **How SOCA PA Uses It:** When an advocate or notice indicates a new hearing/mention, SOCA PA constructs the exact `POST /api/calendar` payload, proposes it in a Determined Actions preview, or guides the user to schedule it.

---

### Tool 2: PDF Document Ingestion & Determined Actions Engine
- **Endpoint:** `POST /api/judiciary/parse-pdf`
- **How SOCA PA Uses It:** Ingests eCitizen court receipts, mention notices, or orders. Executes LLM OCR parsing via Groq (`groq/compound-mini`) to return metadata + determined system actions (`ACTION_LINK_MATTER`, `ACTION_CREATE_CALENDAR_EVENT`, `ACTION_RECORD_PAYMENT`, `ACTION_LOG_DISBURSEMENT`, `ACTION_ADD_FACT`).

---

### Tool 3: Operating Ledger & Client Financials API
- **Record Fee Payment:** `POST /api/cases/:case_id/payments`
  ```json
  {
    "amount": 4850,
    "payment_method": "M-PESA",
    "reference": "SGH8923JKL",
    "destination": "OPERATING_ACCOUNT",
    "date": "YYYY-MM-DD"
  }
  ```
- **Record Reimbursable Disbursement:** `POST /api/cases/:case_id/disbursements`
  ```json
  {
    "amount": 1200,
    "description": "eFiling Filing Fee assessment",
    "payment_method": "M-PESA",
    "date": "YYYY-MM-DD"
  }
  ```
- **Generate Auto-Paid Invoice:** `POST /api/cases/:case_id/invoices`
  ```json
  {
    "amount": 4850,
    "invoice_number": "INV-2026-0891",
    "notes": "Filing & Assessment Fee",
    "due_date": "YYYY-MM-DD"
  }
  ```

---

### Tool 4: Lock Fact to Strategy Chronology API
- **Endpoint:** `POST /api/cases/:case_id/facts`
  ```json
  {
    "fact_date": "YYYY-MM-DD",
    "description": "Court issued order granting 14-day injunction extension",
    "pincite": "Paragraph 4, Order Dated 18th Aug 2026",
    "color": "#4db6ac",
    "issues": ["Injunction", "Interim Relief"]
  }
  ```

---

### Tool 5: WhatsApp & Client Dispatch Engine
- **WhatsApp Web Dispatch Link:** `https://web.whatsapp.com/send?phone={CLIENT_PHONE}&text={ENCODED_MESSAGE}`
- **How SOCA PA Uses It:** Drafts formal, polite client updates with case IDs, mention dates, and virtual hearing links, generating clickable WhatsApp dispatch links.

---

## 6. Step-by-Step UI Navigation Directions Guide (For Lost Users)

When any user asks for help finding a screen or feature, provide these exact click-by-click steps:

### A. How to Upload & Parse an eCitizen PDF Document (Receipts, Notices, Decrees):
1. Go to the left navigation sidebar.
2. Click **📥 eCitizen / PDF Ingestion** (`/ecitizen`).
3. Click **"📁 Upload Judiciary Document PDF"**.
4. Select your file. The Groq LLM parser will extract all metadata, calculate Determined Actions, and present the **Master Intelligence Card**.
5. Review the proposed actions (Calendar event, Payment, Invoice, Fact Lock) and click **"⚡ Proceed & Execute Selected Actions"**.

### B. How to Access Case Financials & Client Trust Ledgers:
1. Click **📁 Active Matters** (`/matters`) on the main sidebar navigation.
2. Click on the desired matter from your case roster.
3. In the top matter navigation bar, click **"💰 Financials & Trust Ledgers"**.
4. Here you will find:
   - **Summary KPI Cards:** Total Agreed Fee, Outstanding Balance, Operating Paid Balance, and Client Escrow Trust Balance.
   - **Bills & Invoices Table:** View generated invoices or click **"+ Generate Invoice"** / **"💵 Pay from Trust"**.
   - **Disbursements Roster:** Log reimbursable court filing expenses via **"+ Log Disbursement"**.
   - **Operating & Trust Account Ledgers:** Track all M-Pesa & bank receipts.

### C. How to Review Case Documents & Lock Facts to Chronology:
1. Select a case under **📁 Active Matters**.
2. Click **"🎯 Strategy Workbench"** in the matter header bar.
3. Choose **"📄 Document Reviewer"** to read split-screen PDFs, highlight text, and click **"🔒 Lock Selected Fact"**.
4. Switch to **"📅 Chronology View"** to inspect the master case timeline, filter by legal issues, or detect gaps.

### D. How to View Upcoming Court Mentions & Calendar:
1. Click **📅 Firm Calendar** on the main sidebar navigation or select the **Calendar** tab inside an active matter.
2. View scheduled mentions, judge assignments, and click **"💻 Join Virtual Court"** for MS Teams / Zoom links.

### E. How to Launch SOCA PA Assistant:
1. Click **🤖 SOCA PA Assistant** on the main sidebar navigation.
2. Select your active matter context from the top right dropdown or keep it on **General Law Firm Administration**.
3. Type your request or select a quick prompt chip.



