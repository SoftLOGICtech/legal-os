# Legal OS — Common Fixes & Architectural Guidelines

> **Purpose**: This living knowledge base documents root causes, diagnostic patterns, and structural solutions for recurring UI and backend integration issues in Legal OS.

---

## 1. Issue: "Unfunctional Buttons / Modals Saving Nothing (Hardcoded UI Appearance)"

### 🔴 Symptom
When submitting a form inside a modal (e.g. *Edit Agreed Fee, Log Installment, Log Disbursement, Generate Invoice, Trust Transfer*), the modal closes and the API succeeds in backend logs, but the UI table or card values **do not change** — giving the impression that the feature is hardcoded or unfunctional.

### 🔍 Root Cause Analysis
- **Missing Dual Re-fetch (`fetchData` + `fetchCaseFiles`)**: Form submit handlers were calling `fetchData()` (which updates main cases list) but missing `fetchCaseFiles()` (which updates case-level `caseInvoices`, `caseDisbursements`, `casePayments`, `caseSubmissions`, `caseFiles`).
- Because `fetchCaseFiles()` was missing post-mutation, child tables remained stale until navigating away and back.

### 🟢 Solution & Mandatory Coding Rule
Every form submission handler in Legal OS that mutates active matter child resources MUST invoke **BOTH** `fetchData()` AND `fetchCaseFiles()`:

```javascript
const handleModalSubmit = async (e) => {
  e.preventDefault();
  
  // 1. Submit mutation to API
  await apiPost(`/api/cases/${activeMatterId}/invoices`, formData);
  
  // 2. Close modal & reset form state
  setShowModal(false);
  
  // 3. MANDATORY: Trigger dual store re-fetch & notify user
  fetchData(); 
  fetchCaseFiles();
  showToast("✅ Invoice generated successfully!", "success");
};
```

---

## 2. Issue: "Sub-tab / Component Blanking Out & Clearing Tables"

### 🔴 Symptom
Generating an invoice or loading the *Financials & Trust Ledgers* sub-tab causes the invoice table and disbursement lists to go completely blank/empty.

### 🔍 Root Cause Analysis
- **Variable Shadowing**: Declaring `const caseInvoices = activeCaseObj.invoices || []` inside render blocks shadowed the top-level React state `caseInvoices`.
- Since `activeCaseObj.invoices` was undefined on the main case row, `caseInvoices` was forcibly overwritten with `[]` on every render.

### 🟢 Solution & Mandatory Coding Rule
Never redeclare or shadow top-level React state variables inside render closures. Use top-level state variables directly (`caseInvoices`, `caseDisbursements`, `casePayments`), which are populated by `fetchCaseFiles()`:

```javascript
{matterTab === 'finance' && (() => {
  const activeCaseObj = cases.find(c => c.id === activeMatterId) || {};
  return (
    <div>
      {/* Use top-level state caseInvoices, caseDisbursements, casePayments */}
    </div>
  );
})()}
```

---

## 3. Issue: "LLM API HTTP 413 / Request Entity Too Large"

### 🔴 Symptom
SocaBot returns a Connection Alert with `HTTP 413` or `Request Entity Too Large`.

### 🔍 Root Cause Analysis
- **Overstuffed RAG Payload**: Injecting full raw documentation files (`SKILLS_MAP`, `ENVIRONMENT_MAP`) into LLM system prompts exceeded single-request token boundaries.

### 🟢 Solution & Mandatory Coding Rule
1. Compact RAG slices (`slice(0, 400)`).
2. Auto-pruning fallback handler in `callGroqApi` when status `413` is encountered.
3. User-facing Executive Error Notices with diagnostic badges (`[DIAGNOSTIC BADGE: ERR_...]`).
