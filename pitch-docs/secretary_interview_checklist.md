# Secretary Interview & System Audit Checklist

Use this checklist during your meeting to map out the exact environment, workflows, and edge cases for the SoftLogic Legal OS MVP.

## 1. Hardware & IT Environment (The System)
- [x] **Device:** Are you using a desktop or a laptop? (Roughly how old is it? Does it freeze often?)
  - *Response:* The firm has 3 devices, but only 2 of them are working well.
- [x] **OS & Browser:** What operating system (Windows/Mac) and browser (Chrome/Edge) do you primarily use?
  - *Response:* 2 devices running Windows. Favorite browser is Google Chrome.
- [x] **Internet Reliability:** How stable is the office internet? Do you experience frequent downtimes or slow speeds?
  - *Response:* The office has reliable internet.
- [x] **WhatsApp Setup:** Do you have a dedicated firm smartphone for WhatsApp Business?
  - *Response:* Yes, the firm has a dedicated phone for WhatsApp Business.
- [ ] **Connection:** Are you currently using WhatsApp Web on your PC? If so, does the physical phone frequently lose battery or disconnect?
  - *Response:* (Not explicitly specified in notes, but WhatsApp Business is active on a firm-owned device)
- [x] **Legacy Systems:** What software or tools are you currently using? (e.g., Excel spreadsheets, physical ledgers, Google Drive, local folders).
  - *Response:* Excel spreadsheets.

## 2. Daily Workflow & Habits
- [ ] **Morning Routine:** Walk me through the first 30 minutes of your day. What is the very first thing you check?
  - *Response:* (Not specified in interview notes)
- [ ] **Court Dates:** How do you currently track which client has a court date tomorrow or next week?
  - *Response:* (Not specified in interview notes)
- [x] **File Retrieval:** If Sam asks for a specific client's file *right now*, how do you search for it and how long does it take?
  - *Response:* Searches and organizes files using their reference numbers (ref. no.).
- [x] **The Bottleneck:** What is the most repetitive, manual, or annoying task you have to do every single day?
  - *Response:* Manually sending a list of active cases and updates directly to each lawyer.
- [x] **Payments:** How do you currently track if a client has paid their consultation fee or retainer?
  - *Response:* Consultation fees are not used much; they primarily rely on interim fee/deposit requests.

## 3. Client Communication
- [x] **The #1 Question:** What is the single most common question clients call or text you to ask?
  - *Response:* Inquiring about their case status.
- [x] **Verification:** If a client messages from a number you haven't saved, how do you verify their identity? (Do they know their case number, or do you ask for ID/Name?)
  - *Response:* They provide their Case Number, though she noted a need for a new system for leads.
- [x] **Bulk Messaging:** Do you ever need to send the exact same message to 10+ clients at once? (e.g., court closures, office relocations).
  - *Response:* Yes. For succession cases, they update everyone at once through a dedicated WhatsApp group.
- [x] **Emergencies:** How do you distinguish between a routine status check and a client experiencing a legal emergency requiring immediate handoff to Sam?
  - *Response:* Emergency handoff workflow is needed.
- [x] **Shared Phones (Edge Case):** Do you ever have multiple clients using the exact same phone number (e.g., a married couple, or an elderly parent using their child's phone)?
  - *Response:* No.

## 4. Document Handling
- [ ] **Format Quality:** When clients send documents via WhatsApp, what format are they usually in? (Are they sending blurry photos of documents, or proper PDFs?)
  - *Response:* (Not specified in interview notes)
- [ ] **The Pipeline:** Once you receive a document on WhatsApp, what is your exact step-by-step process? (e.g., Download -> Rename file -> Print -> Place in physical folder).
  - *Response:* (Not specified in interview notes)
- [x] **Organization:** How do you name and organize files on your computer? Is there a standard naming convention you use?
  - *Response:* Files are named and organized using the client's reference number (ref. no.).
- [x] **Illegibility:** What happens when a client sends a document that is completely unreadable?
  - *Response:* Tells the client to resend it.

## 5. Security & Edge Cases
- [x] **Sensitivity:** Are there highly sensitive cases (e.g., family law, high-profile clients) where extreme privacy is required over WhatsApp?
  - *Response:* Yes, all cases are treated as highly sensitive and require privacy.
- [x] **Orphan Documents:** What happens if a client drops off a document *before* their case is officially opened and filed in your system?
  - *Response:* They file/send a "Notice of Appearance" to register representation.
- [ ] **Access Control:** Who else has physical access to this computer and the WhatsApp Web interface during the day?
  - *Response:* (Not specified in interview notes; left blank in notes)

## 6. The Wishlist
- [x] **Magic Wand:** If you had a magic wand and could automate ONE thing about your job, what would it be?
  - *Response:* Automating weekly updates, tracking case file activities, and managing the financial/expense tracker.
- [x] **Immediate Relief:** What single feature would make your life significantly easier starting tomorrow?
  - *Response:* Automated reminders, expense tracking, and case file activities tracking.

## 7. Legal OS / CRM Feature Validation
- [ ] **No-Shows:** If a client schedules a consultation (e.g. for KES 3,000) and fails to show up, how long do we wait before marking them as a No-Show? Do we offer a reschedule immediately?
  - *Response:* (Not specified in interview notes)
- [ ] **Conflict Checks:** When a new lead walks in, what is your exact manual process to ensure the firm has no Conflict of Interest with the opposing party?
  - *Response:* (Not specified in interview notes)
- [x] **Fee Isolation:** How strictly do we need to isolate unpaid consultation fees? Should they lock the case creation until verified?
  - *Response:* Unpaid consultation/interim fees should **not** lock case creation. Consultation fees are rarely used; they use interim fee/deposit requests, and payment timing is dynamic (sometimes after, sometimes before, sometimes pro-bono).
- [ ] **Milestone Overrides:** Do you need different workflow steps (milestones) for Conveyancing vs. Litigation vs. Corporate Law? (e.g. Conveyancing requires "Title Transfer", whereas Litigation requires "Court Mentions").
  - *Response:* (Not specified in interview notes)
- [ ] **Direct Case Creation:** Do you occasionally skip the "Lead" phase entirely and immediately create an active case with its tracking token? (e.g. for returning clients).
  - *Response:* (Not specified in interview notes)
