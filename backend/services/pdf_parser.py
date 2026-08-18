# pdf_parser.py — Dynamic Relative Spatial Anchor PDF Parser for Kenya Judiciary Documents
import sys
import os
import json
import re

def parse_pdf(file_path):
    if not os.path.exists(file_path):
        return {"success": False, "error": f"File not found: {file_path}"}

    try:
        import pdfplumber
    except ImportError:
        return {"success": False, "error": "pdfplumber library not installed"}

    extracted = {
        "file_name": os.path.basename(file_path),
        "docType": "OTHER",
        "judiciary_case_id": "",
        "payment_ref": "",
        "prn_number": "",
        "amount": "",
        "payment_date": "",
        "fee_type": "",
        "payer_name": "",
        "court_station": "",
        "court_division": "",
        "courtroom_no": "",
        "assigned_judge": "",
        "client_name": "",
        "id_number": "",
        "kra_pin": "",
        "opposing_party": "",
        "opposing_counsel": "",
        "mention_date": "",
        "mention_time": "",
        "reply_deadline": "",
        "virtual_court_link": "",
        "doc_notes": ""
    }

    raw_text = ""
    words = []
    tables = []

    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                raw_text += page_text + "\n"
                
                # Extract words with bounding boxes
                page_words = page.extract_words(use_text_flow=True, keep_blank_chars=False) or []
                words.extend(page_words)

                # Extract table structures
                page_tables = page.extract_tables() or []
                for t in page_tables:
                    if t:
                        tables.append(t)
    except Exception as e:
        return {"success": False, "error": f"pdfplumber execution failed: {str(e)}"}

    text_upper = raw_text.upper()

    # ── Check if scanned OCR fallback is needed ──
    if len(raw_text.strip()) < 20:
        try:
            import pytesseract
            from pdf2image import convert_from_path
            images = convert_from_path(file_path)
            ocr_text = ""
            for img in images:
                ocr_text += pytesseract.image_to_string(img) + "\n"
            if len(ocr_text.strip()) > 20:
                raw_text = ocr_text
                text_upper = raw_text.upper()
        except Exception:
            pass  # Fall back to best-effort parsing on whatever text exists

    # ── 1. Document Classification ──
    if any(k in text_upper for k in ['OFFICIAL RECEIPT', 'PAYBILL 553388', 'CUSTOMER REF / PRN', 'PAYMENT RECEIPT', 'ASSESSMENT FEE']):
        extracted["docType"] = "RECEIPT"
    elif any(k in text_upper for k in ['MICROSOFT TEAMS', 'TEAMS.MICROSOFT.COM', 'ZOOM.US', 'MEET.GOOGLE.COM', 'WEBEX', 'VIRTUAL HEARING', 'VIRTUAL COURT']) and ('OFFICIAL RECEIPT' not in text_upper):
        extracted["docType"] = "VIRTUAL_COURT"
    elif any(k in text_upper for k in ['HEARING NOTICE', 'NOTICE OF MENTION', 'CAUSE LIST', 'SCHEDULED MENTION', 'NOTICE OF HEARING']):
        extracted["docType"] = "MENTION_NOTICE"
    elif any(k in text_upper for k in ['DECREE', 'COURT ORDER', 'GIVEN UNDER MY HAND', 'IT IS HEREBY ORDERED']):
        extracted["docType"] = "DECREE_ORDER"
    elif any(k in text_upper for k in ['IN THE HIGH COURT', 'CHIEF MAGISTRATE', 'ENVIRONMENT AND LAND', 'COURT OF APPEAL', 'PLAINT', 'PETITION', 'NOTICE OF MOTION', 'AFFIDAVIT', 'MEMORANDUM OF APPEAL']):
        extracted["docType"] = "PLEADING"

    # ── 2. Table-Grid Dynamic Extraction ──
    table_kv = {}
    for table in tables:
        for row in table:
            if not row:
                continue
            # Filter None elements
            clean_row = [str(c).strip() for c in row if c is not None and str(c).strip()]
            if len(clean_row) >= 2:
                key = clean_row[0].rstrip(':').strip().upper()
                val = clean_row[1].strip()
                table_kv[key] = val

    # Helper: Lookup table_kv by key substring
    def get_table_val(key_substr):
        for k, v in table_kv.items():
            if key_substr.upper() in k:
                return v
        return ""

    # ── 3. Relative Spatial Anchor Extraction from Bounding Boxes ──
    def find_value_right_of_anchor(anchor_patterns):
        for page_word in words:
            word_text = page_word.get("text", "")
            # Look for anchor matches
            for pat in anchor_patterns:
                if re.search(pat, word_text, re.IGNORECASE):
                    anchor_top = page_word.get("top")
                    anchor_x1 = page_word.get("x1")
                    # Collect all words in the same visual line (y +/- 6px) to the right
                    line_words = [
                        w for w in words
                        if abs(w.get("top") - anchor_top) <= 6 and w.get("x0") > anchor_x1 - 2
                    ]
                    line_words.sort(key=lambda w: w.get("x0"))
                    val = " ".join([w.get("text") for w in line_words]).strip()
                    # Strip leading colon or dashes
                    val = re.sub(r'^[::\-\s]+', '', val)
                    if val:
                        return val
        return ""

    # ── 4. Key Fields Extraction ──

    # Case ID
    case_id = get_table_val("Case ID") or get_table_val("Case No") or find_value_right_of_anchor([r"Case\s*ID", r"Case\s*No", r"Case\s*Number"])
    if not case_id:
        m = re.search(r'\b([A-Z]{2,6}[-\/][A-Z0-9]{1,8}[-\/](?:E?\d+)[-\/]\d{4})\b', raw_text, re.IGNORECASE)
        if not m:
            m = re.search(r'\b([A-Z]{2,6}[-\/](?:E?\d+|\d+)[-\/]\d{4})\b', raw_text, re.IGNORECASE)
        if not m:
            m = re.search(r'\b((?:Civil|Criminal|Commercial|Family|ELC|EACC|Environment)\s+(?:Suit|Cause|App|Case)\s+No\.?\s*(?:E?\d+)\s+of\s+\d{4})\b', raw_text, re.IGNORECASE)
        if m:
            case_id = m.group(1).upper()
    extracted["judiciary_case_id"] = case_id.strip()

    # PRN / Customer Ref
    prn = get_table_val("Customer Ref") or get_table_val("PRN") or find_value_right_of_anchor([r"PRN", r"Customer\s*Ref"])
    if not prn:
        m = re.search(r'\b(PRN[-\s]?[0-9]{4}[-\s]?[0-9]{4})\b', raw_text, re.IGNORECASE)
        if m:
            prn = m.group(1).upper()
    extracted["prn_number"] = prn.strip()

    # M-Pesa Code / Payment Ref
    mpesa = get_table_val("M-PESA") or get_table_val("Payment Ref") or find_value_right_of_anchor([r"M-PESA", r"Payment\s*Ref"])
    if not mpesa:
        m = re.search(r'\b(?=.*[0-9])(?=.*[A-Z])[A-Z0-9]{10}\b', raw_text)
        if m and any(k in text_upper for k in ['MPESA', 'PAYBILL', 'RECEIPT', 'PAYMENT']):
            mpesa = m.group(0)
    extracted["payment_ref"] = mpesa.strip()

    # Amount Paid
    amt_str = get_table_val("Amount") or find_value_right_of_anchor([r"Amount\s*Paid", r"Total\s*Amount", r"Fee\s*Paid"])
    if not amt_str:
        m = re.search(r'(?:KES|KSH|\$)\s*([\d,]+(?:\.\d{2})?)', raw_text, re.IGNORECASE)
        if m:
            amt_str = m.group(1)
    if amt_str:
        clean_amt = re.sub(r'[^\d.]', '', amt_str)
        extracted["amount"] = clean_amt

    # Payment Date
    pay_date = get_table_val("Date of Payment") or find_value_right_of_anchor([r"Date\s*of\s*Payment", r"Payment\s*Date"])
    if not pay_date:
        m = re.search(r'\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b', raw_text, re.IGNORECASE)
        if not m:
            m = re.search(r'\b(\d{4}[-\/]\d{2}[-\/]\d{2})\b', raw_text)
        if m:
            pay_date = m.group(1)
    extracted["payment_date"] = pay_date.strip()

    # Court Station
    station = get_table_val("Court Station") or find_value_right_of_anchor([r"Court\s*Station"])
    if not station:
        m = re.search(r'(?:IN THE|AT)\s+([A-Z\s]+(?:LAW COURTS|HIGH COURT|MAGISTRATE\'S COURT|COURT AT [A-Z]+))', raw_text, re.IGNORECASE)
        if m:
            station = m.group(1).strip()
    extracted["court_station"] = station.strip()

    # Presiding Officer / Judge
    judge = get_table_val("Presiding") or find_value_right_of_anchor([r"Presiding\s*Officer", r"Presiding\s*Judge", r"Hon\."])
    if not judge:
        m = re.search(r'\b(Hon\.\s*(?:Lady\s+Justice|Justice|Senior\s+Principal\s+Magistrate|Resident\s+Magistrate|Magistrate)?\s*[A-Za-z\s.\'\-]+)\b', raw_text)
        if m:
            judge = m.group(1).strip()
    extracted["assigned_judge"] = judge.strip()

    # Mention / Scheduled Hearing Date
    m_date = get_table_val("Scheduled") or get_table_val("Mention Date") or find_value_right_of_anchor([r"Scheduled\s*Mention", r"Mention\s*Date", r"Hearing\s*Date"])
    if not m_date:
        m = re.search(r'(?:Scheduled\s*Date|Mention\s*Date|Hearing\s*Date)[\s.:]*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})', raw_text, re.IGNORECASE)
        if m:
            m_date = m.group(1)
    extracted["mention_date"] = m_date.strip()

    # Virtual Court Link (Teams / Zoom / Meet / Webex)
    v_link = get_table_val("Virtual") or find_value_right_of_anchor([r"Virtual\s*Court", r"Zoom\s*Link", r"Teams\s*Link"])
    if not v_link:
        m = re.search(r'(https?:\/\/(?:teams\.microsoft\.com|zoom\.us|meet\.google\.com|webex\.com)[^\s]+)', raw_text, re.IGNORECASE)
        if not m:
            m = re.search(r'(https?:\/\/(?:teams\.microsoft\.com|zoom\.us|meet\.google\.com|webex\.com)[\s\S]{1,120})', raw_text, re.IGNORECASE)
        if m:
            v_link = m.group(1)
    if v_link:
        v_link = re.sub(r'\s+', '', v_link.strip())
    extracted["virtual_court_link"] = v_link

    # Client KYC (National ID / KRA PIN / Payer Name)
    id_no = get_table_val("National ID") or find_value_right_of_anchor([r"National\s*ID", r"ID\s*Number"])
    if id_no:
        extracted["id_number"] = id_no.strip()
    
    kra = get_table_val("KRA PIN") or find_value_right_of_anchor([r"KRA\s*PIN"])
    if kra:
        extracted["kra_pin"] = kra.strip()

    payer = get_table_val("Payer") or find_value_right_of_anchor([r"Payer", r"Depositor"])
    if payer:
        extracted["payer_name"] = payer.strip()

    # Parties (Plaintiff / Defendant / Applicant / Respondent)
    p_match = re.search(r'(.*?)\s*(?:\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.|-|\s)\s*(?:PLAINTIFF|APPLICANT|PETITIONER)', raw_text, re.IGNORECASE)
    if p_match:
        extracted["client_name"] = p_match.group(1).strip().rstrip('.').strip()
    elif extracted["payer_name"]:
        extracted["client_name"] = extracted["payer_name"]

    d_match = re.search(r'(?:AND|VERSUS|VS\.?)\s*\n?\s*(.*?)\s*(?:\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.|-|\s)\s*(?:DEFENDANT|RESPONDENT)', raw_text, re.IGNORECASE)
    if d_match:
        extracted["opposing_party"] = d_match.group(1).strip().rstrip('.').strip()

    # Order details (for Decree/Orders)
    order_details = get_table_val("Order Details") or find_value_right_of_anchor([r"Order\s*Details", r"IT\s*IS\s*HEREBY\s*ORDERED"])
    if order_details:
        extracted["doc_notes"] = order_details

    # Matches summary score
    confidence = "HIGH (Spatial Anchor Match)"
    if not extracted["judiciary_case_id"] and not extracted["payment_ref"]:
        confidence = "MEDIUM (Fuzzy Text Match)"

    return {
        "success": True,
        "extracted": extracted,
        "match": {
            "confidence": confidence
        }
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No PDF file path provided"}))
        sys.exit(1)

    target_pdf = sys.argv[1]
    result = parse_pdf(target_pdf)
    print(json.dumps(result, indent=2))
