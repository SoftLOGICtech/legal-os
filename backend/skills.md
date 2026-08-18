# SocaBot Skills & Flow Execution Guide

This document defines the exact step-by-step operational workflows and tool execution schemas for SocaBot inside Legal OS.

---

## 1. Skill: `CREATE_CASE` (Create New Legal Matter)

### How Users Navigate the UI:
1. Click **📁 Active Matters** (`/matters`) on the main left sidebar.
2. Click the **"+ Create New Case"** button at the top right of the case roster.
3. Fill in the required fields:
   - **Client Name**: Name of client (e.g. *John Kamau*).
   - **Case Title**: Formal case title (e.g. *Kamau v. National Land Commission & Anor*).
   - **Case Type**: Select category (*Litigation, Conveyancing & Land, Civil Disputes, Corporate Law, Family Law, Succession*).
   - **Assigned Advocate**: Advocate on record (*Sam Ogola*).
   - **Agreed Fee (KES)**: Total agreed fee.
4. Click **"Save Case & Initialize Workspace"**.

### Instant Flash Action Schema (SocaBot Auto-Execution):
```json
<!--ACTION:{"type":"CREATE_CASE","client_name":"John Kamau","case_title":"Kamau v. NLC","case_type":"Litigation","assigned_lawyer":"Sam Ogola","total_fee":150000}-->
```

---

## 2. Skill: `CREATE_LEAD` (Record Client CRM Lead)

### How Users Navigate the UI:
1. Click **📥 CRM Intake** (`/leads`) on the main left sidebar.
2. Click **"+ Add Manual Lead"**.
3. Fill in:
   - **Full Name**: Prospective client name.
   - **Phone Number**: Kenyan phone format (e.g. *0712345678*).
   - **Service Category**: *Conveyancing, Litigation, Commercial, Family Law*.
   - **Message / Notes**: Inquiry notes.
4. Click **"Save Lead"**.

### Instant Flash Action Schema (SocaBot Auto-Execution):
```json
<!--ACTION:{"type":"CREATE_LEAD","full_name":"Mary Wambui","phone":"0712345678","service_category":"Conveyancing","message":"Inquiring about land title transfer"}-->
```

---

## 3. Skill: `CREATE_CALENDAR_EVENT` (Schedule Court Mention / Hearing)

### How Users Navigate the UI:
1. Click **📅 Firm Calendar** (`/calendar`) on the main left sidebar.
2. Click **"+ Add Event"**.
3. Select Date, Event Type (*mention, hearing, ruling*), Title, and optional MS Teams Virtual Link.
4. Click **"Save Event"**.

### Instant Flash Action Schema:
```json
<!--ACTION:{"type":"CREATE_CALENDAR_EVENT","date":"YYYY-MM-DD","time":"09:00 AM","description":"Notice of Mention before Hon. Lady Justice...","event_type":"mention","virtual_link":"https://teams.microsoft.com/..."}-->
```

---

## 4. Skill: `RECORD_PAYMENT` (Log Installment / Fee Deposit)

### How Users Navigate the UI:
1. Go to **📁 Active Matters** ➔ Select Case ➔ Click **💰 Financials & Trust Ledgers**.
2. Click **"+ Log Installment"** (Operating) or **"+ Deposit to Trust"** (Escrow).
3. Enter Amount, Payment Method (*M-PESA / Bank Transfer*), Reference, and Notes.

### Instant Flash Action Schema:
```json
<!--ACTION:{"type":"RECORD_PAYMENT","amount":50000,"payment_method":"M-PESA","reference":"SGH8923JKL","destination":"operating","description":"Retainer payment"}-->
```

---

## 6. Skill: `FINANCIALS_GUIDE` (Legal OS Financials & Trust Accounting Master Guide)

### Plain-Language Law Firm Financial Architecture

Law firm accounting in Kenya is governed by the **Advocates (Accounts) Rules**. Legal OS structures financials into two distinct levels:

---

### A. Case-Specific Financials (`💰 Financials & Trust Ledgers` inside Active Matter)

Every matter has 3 distinct financial ledgers:

1. **Trust Escrow Account (`destination: 'trust'`)**:
   - **What it is**: Client money held in trust by your firm (e.g. land transaction purchase price, court security deposits, estate inheritance funds).
   - **Strict Rule**: Money in the Trust Account belongs to the client — it is **NOT** firm income.
   - **UI Action**: Click **"+ Deposit to Trust"** to record client escrow funds.

2. **Operating Income Account (`destination: 'operating'`)**:
   - **What it is**: Professional legal fees paid to your firm (e.g. retainer fees, instruction fees, success fees).
   - **UI Action**: Click **"+ Log Installment"** to record fee payments.

3. **Disbursements Ledger (`case_disbursements`)**:
   - **What it is**: Out-of-pocket expenses paid by your firm on behalf of the client (e.g. *eCitizen court filing fees, stamp duty, search fees, process server fees*).
   - **UI Action**: Click **"+ Add Disbursement"**. Disbursements are automatically added to client Fee Notes/Invoices.

4. **Fee Notes & Invoices (`case_invoices`)**:
   - **What it is**: Formal billing statements sent to the client detailing Professional Fees + Reimbursable Disbursements + VAT (16%).

---

### B. General Firm Finance (`💰 Firm Finance & Bills` on Main Sidebar)

Provides a firm-wide executive overview across all clients and matters:

1. **Firm Operating Revenue**: Aggregate total of all professional fee installments collected across all cases.
2. **Total Trust Liability**: Aggregate total of all client escrow money currently held in firm trust accounts.
3. **Firm Expenses**: Operational overhead costs (e.g. office rent, advocate salaries, LSK practicing certificate fees).
4. **Receivables Aging**: Outstanding unpaid client fee notes categorized by urgency (Current, 30 days, 60 days, 90+ days overdue).

