# generate_bulk_pdf_corpus.py — Generates 25 Realistic Kenya Judiciary Test PDFs + Ground Truth JSONs
import os
import json
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

corpus_dir = os.path.join(os.getcwd(), 'tests', 'fixtures', 'pdf_test_cases')
os.makedirs(corpus_dir, exist_ok=True)

styles = getSampleStyleSheet()

header_style = ParagraphStyle('JudiciaryHeader', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=14, leading=18, alignment=1, textColor=colors.HexColor('#0A192F'))
sub_header_style = ParagraphStyle('JudiciarySubHeader', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, leading=14, alignment=1, textColor=colors.HexColor('#D4AF37'))
title_style = ParagraphStyle('DocTitle', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=11, leading=15, alignment=1, textColor=colors.HexColor('#111111'))
body_style = ParagraphStyle('DocBody', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#222222'))
bold_label_style = ParagraphStyle('BoldLabel', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=13, textColor=colors.HexColor('#000000'))

def create_case(filename, elements, expected_data):
    pdf_path = os.path.join(corpus_dir, filename + '.pdf')
    json_path = os.path.join(corpus_dir, filename + '.json')
    
    doc = SimpleDocTemplate(pdf_path, pagesize=letter, leftMargin=35, rightMargin=35, topMargin=35, bottomMargin=35)
    doc.pageCompression = 0
    doc.build(elements)
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(expected_data, f, indent=2)

print("Building 25 realistic Judiciary PDF test cases & ground truth files...")

# ==============================================================================
# CATEGORY 1: eFiling Receipts (Paybill 553388 / PRNs)
# ==============================================================================

# 1.1 Pristine Receipt
create_case('receipt_01_pristine', [
    Paragraph("REPUBLIC OF KENYA — THE JUDICIARY", header_style),
    Paragraph("E-FILING PORTAL OFFICIAL RECEIPT (PAYBILL 553388)", sub_header_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Customer Ref / PRN:", bold_label_style), Paragraph("PRN-2026-1001", body_style)],
        [Paragraph("M-PESA Code / Ref:", bold_label_style), Paragraph("SGH1111AAA", body_style)],
        [Paragraph("Paybill Number:", bold_label_style), Paragraph("553388", body_style)],
        [Paragraph("Judiciary Case ID:", bold_label_style), Paragraph("MIL-CC-101-2026", body_style)],
        [Paragraph("Court Station:", bold_label_style), Paragraph("Milimani Law Courts", body_style)],
        [Paragraph("Total Amount Paid:", bold_label_style), Paragraph("KES 5,200.00", body_style)],
        [Paragraph("Client National ID:", bold_label_style), Paragraph("31223344", body_style)],
        [Paragraph("Client KRA PIN:", bold_label_style), Paragraph("A001122334K", body_style)],
        [Paragraph("Payer / Depositor:", bold_label_style), Paragraph("Samuel Ogola", body_style)],
        [Paragraph("Date of Payment:", bold_label_style), Paragraph("10th August 2026", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "RECEIPT",
    "judiciary_case_id": "MIL-CC-101-2026",
    "payment_ref": "SGH1111AAA",
    "prn_number": "PRN-2026-1001",
    "amount": "5200.00",
    "court_station": "Milimani Law Courts",
    "client_name": "Samuel Ogola"
})

# 1.2 Jumbled Margin Receipt
create_case('receipt_02_jumbled_margins', [
    Paragraph("NOTICE OF ADMINISTRATIVE HEADING OVERRIDE", body_style),
    Spacer(1, 20),
    Paragraph("REPUBLIC OF KENYA — THE JUDICIARY", header_style),
    Paragraph("E-FILING RECEIPT", sub_header_style),
    Spacer(1, 15),
    Table([
        [Paragraph("Customer Ref / PRN:", bold_label_style), Paragraph("PRN-2026-1002", body_style)],
        [Paragraph("M-PESA Code / Ref:", bold_label_style), Paragraph("SGH2222BBB", body_style)],
        [Paragraph("Judiciary Case ID:", bold_label_style), Paragraph("NAI-COMM-E202-2026", body_style)],
        [Paragraph("Court Station:", bold_label_style), Paragraph("Nairobi High Court", body_style)],
        [Paragraph("Total Amount Paid:", bold_label_style), Paragraph("KES 18,500.00", body_style)],
        [Paragraph("Payer / Depositor:", bold_label_style), Paragraph("Ivy Wanjiku", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#999999'))]))
], {
    "docType": "RECEIPT",
    "judiciary_case_id": "NAI-COMM-E202-2026",
    "payment_ref": "SGH2222BBB",
    "prn_number": "PRN-2026-1002",
    "amount": "18500.00",
    "court_station": "Nairobi High Court"
})

# 1.3 Split Co-Payers Receipt
create_case('receipt_03_split_copayers', [
    Paragraph("REPUBLIC OF KENYA — THE JUDICIARY", header_style),
    Paragraph("ASSESSMENT & ASSESSMENT FEE RECEIPT", sub_header_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Customer Ref / PRN:", bold_label_style), Paragraph("PRN-2026-1003", body_style)],
        [Paragraph("M-PESA Code / Ref:", bold_label_style), Paragraph("SGH3333CCC", body_style)],
        [Paragraph("Judiciary Case ID:", bold_label_style), Paragraph("KMB-ELC-E303-2026", body_style)],
        [Paragraph("Court Station:", bold_label_style), Paragraph("Kiambu Law Courts", body_style)],
        [Paragraph("Total Amount Paid:", bold_label_style), Paragraph("KES 9,400.00", body_style)],
        [Paragraph("Client National ID:", bold_label_style), Paragraph("28910293", body_style)],
        [Paragraph("Payer / Depositor:", bold_label_style), Paragraph("Peter Njoroge & Mary Wambui", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "RECEIPT",
    "judiciary_case_id": "KMB-ELC-E303-2026",
    "payment_ref": "SGH3333CCC",
    "prn_number": "PRN-2026-1003",
    "amount": "9400.00",
    "court_station": "Kiambu Law Courts"
})

# 1.4 Extra Administrative Headers Receipt
create_case('receipt_04_extra_headers', [
    Paragraph("JUDICIARY ICT DIRECTORATE — CENTRAL REGISTRY FILE COPY", ParagraphStyle('SubNote', parent=body_style, textColor=colors.red)),
    Spacer(1, 10),
    Paragraph("REPUBLIC OF KENYA — THE JUDICIARY", header_style),
    Paragraph("E-FILING PORTAL OFFICIAL RECEIPT (PAYBILL 553388)", sub_header_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Customer Ref / PRN:", bold_label_style), Paragraph("PRN-2026-1004", body_style)],
        [Paragraph("M-PESA Code / Ref:", bold_label_style), Paragraph("SGH4444DDD", body_style)],
        [Paragraph("Judiciary Case ID:", bold_label_style), Paragraph("MOM-CIV-E404-2026", body_style)],
        [Paragraph("Court Station:", bold_label_style), Paragraph("Mombasa Law Courts", body_style)],
        [Paragraph("Total Amount Paid:", bold_label_style), Paragraph("KES 3,750.00", body_style)],
        [Paragraph("Payer / Depositor:", bold_label_style), Paragraph("Hassan Ali", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "RECEIPT",
    "judiciary_case_id": "MOM-CIV-E404-2026",
    "payment_ref": "SGH4444DDD",
    "prn_number": "PRN-2026-1004",
    "amount": "3750.00",
    "court_station": "Mombasa Law Courts"
})

# 1.5 Multi-Fee Receipt
create_case('receipt_05_multi_fee', [
    Paragraph("REPUBLIC OF KENYA — THE JUDICIARY", header_style),
    Paragraph("PAYMENT RECEIPT — CONSOLIDATED ASSESSMENT", sub_header_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Customer Ref / PRN:", bold_label_style), Paragraph("PRN-2026-1005", body_style)],
        [Paragraph("M-PESA Code / Ref:", bold_label_style), Paragraph("SGH5555EEE", body_style)],
        [Paragraph("Judiciary Case ID:", bold_label_style), Paragraph("NKU-CC-E505-2026", body_style)],
        [Paragraph("Court Station:", bold_label_style), Paragraph("Nakuru Law Courts", body_style)],
        [Paragraph("Total Amount Paid:", bold_label_style), Paragraph("KES 14,200.00", body_style)],
        [Paragraph("Payer / Depositor:", bold_label_style), Paragraph("David Kiprono", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "RECEIPT",
    "judiciary_case_id": "NKU-CC-E505-2026",
    "payment_ref": "SGH5555EEE",
    "prn_number": "PRN-2026-1005",
    "amount": "14200.00",
    "court_station": "Nakuru Law Courts"
})

# ==============================================================================
# CATEGORY 2: High Court / Magistrate Hearing Notices
# ==============================================================================

# 2.1 Pristine Notice
create_case('notice_01_pristine', [
    Paragraph("IN THE HIGH COURT OF KENYA AT NAIROBI", header_style),
    Paragraph("COMMERCIAL AND TAX DIVISION", sub_header_style),
    Paragraph("JUDICIARY CASE NO: MIL-CC-201-2026", title_style),
    Spacer(1, 10),
    Paragraph("BETWEEN:", bold_label_style),
    Paragraph("JOHN MUTHOMI DOE ................................................................ PLAINTIFF", body_style),
    Paragraph("AND", bold_label_style),
    Paragraph("KENYA POWER PLC ................................................................ DEFENDANT", body_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Milimani Law Courts", body_style)],
        [Paragraph("Scheduled Mention Date:", bold_label_style), Paragraph("20th September 2026", body_style)],
        [Paragraph("Presiding Officer:", bold_label_style), Paragraph("Hon. Justice Alfred Mabeya", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#0A192F'))]))
], {
    "docType": "MENTION_NOTICE",
    "judiciary_case_id": "MIL-CC-201-2026",
    "court_station": "Milimani Law Courts",
    "client_name": "JOHN MUTHOMI DOE",
    "opposing_party": "KENYA POWER PLC"
})

# 2.2 Multi-Column Parties Notice
create_case('notice_02_multicolumn_parties', [
    Paragraph("IN THE CHIEF MAGISTRATE'S COURT AT KIAMBU", header_style),
    Paragraph("JUDICIARY CASE NO: KMB-CC-202-2026", title_style),
    Spacer(1, 10),
    Table([
        [Paragraph("PLAINTIFFS:", bold_label_style), Paragraph("DEFENDANTS:", bold_label_style)],
        [Paragraph("1. ALICE NJERI\n2. BOB KINYANJUI", body_style), Paragraph("1. KIAMBU COUNTY GOVERNMENT\n2. NATIONAL LAND COMMISSION", body_style)]
    ], colWidths=[240, 240], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))])),
    Spacer(1, 10),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Kiambu Law Courts", body_style)],
        [Paragraph("Scheduled Mention Date:", bold_label_style), Paragraph("25th September 2026", body_style)],
        [Paragraph("Presiding Officer:", bold_label_style), Paragraph("Hon. Resident Magistrate N. Ndung'u", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "MENTION_NOTICE",
    "judiciary_case_id": "KMB-CC-202-2026",
    "court_station": "Kiambu Law Courts"
})

# 2.3 Multi-Line Zoom Notice
create_case('notice_03_multiline_zoom', [
    Paragraph("IN THE HIGH COURT OF KENYA AT MOMBASA", header_style),
    Paragraph("JUDICIARY CASE NO: MOM-CIV-E203-2026", title_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Mombasa Law Courts", body_style)],
        [Paragraph("Scheduled Mention Date:", bold_label_style), Paragraph("30th September 2026", body_style)],
        [Paragraph("Virtual Court Link:", bold_label_style), Paragraph("https://zoom.us/j/99887766554?\npwd=XYZ1234567890LETTERCODE", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "VIRTUAL_COURT",
    "judiciary_case_id": "MOM-CIV-E203-2026",
    "court_station": "Mombasa Law Courts",
    "virtual_court_link": "https://zoom.us/j/99887766554?pwd=XYZ1234567890LETTERCODE"
})

# 2.4 Missing Judge Notice
create_case('notice_04_missing_judge', [
    Paragraph("IN THE ENVIRONMENT & LAND COURT AT ELDORET", header_style),
    Paragraph("JUDICIARY CASE NO: ELD-ELC-E204-2026", title_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Eldoret Law Courts", body_style)],
        [Paragraph("Scheduled Mention Date:", bold_label_style), Paragraph("05th October 2026", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "MENTION_NOTICE",
    "judiciary_case_id": "ELD-ELC-E204-2026",
    "court_station": "Eldoret Law Courts"
})

# 2.5 Complex Cause List Notice
create_case('notice_05_cause_list', [
    Paragraph("DAILY CAUSE LIST — HIGH COURT NAIROBI", header_style),
    Paragraph("CAUSE LIST DATED: 12TH OCTOBER 2026", sub_header_style),
    Spacer(1, 10),
    Table([
        [Paragraph("No.", bold_label_style), Paragraph("Case ID", bold_label_style), Paragraph("Parties", bold_label_style), Paragraph("Presiding Officer", bold_label_style)],
        [Paragraph("1.", body_style), Paragraph("MIL-CC-E205-2026", body_style), Paragraph("OGOLA VS SAFARICOM", body_style), Paragraph("Hon. J. Mwangi", body_style)]
    ], colWidths=[40, 140, 180, 120], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "MENTION_NOTICE",
    "judiciary_case_id": "MIL-CC-E205-2026"
})

# ==============================================================================
# CATEGORY 3: Virtual Courtroom Notices (Teams / Zoom / Meet / Webex)
# ==============================================================================

# 3.1 MS Teams Link
create_case('virtual_01_teams', [
    Paragraph("REPUBLIC OF KENYA — JUDICIARY VIRTUAL COURTROOM NOTICE", header_style),
    Paragraph("JUDICIARY CASE NO: NAI-COMM-E301-2026", title_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Milimani Commercial Court", body_style)],
        [Paragraph("Scheduled Mention Date:", bold_label_style), Paragraph("15th October 2026", body_style)],
        [Paragraph("Virtual Court Link:", bold_label_style), Paragraph("https://teams.microsoft.com/l/meetup-join/19%3ameeting_MILIMANI_COURT_01", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "VIRTUAL_COURT",
    "judiciary_case_id": "NAI-COMM-E301-2026",
    "virtual_court_link": "https://teams.microsoft.com/l/meetup-join/19%3ameeting_MILIMANI_COURT_01"
})

# 3.2 Zoom Link
create_case('virtual_02_zoom', [
    Paragraph("HIGH COURT OF KENYA — VIRTUAL HEARING DIRECTIONS", header_style),
    Paragraph("JUDICIARY CASE NO: MIL-ELC-E302-2026", title_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Nairobi High Court", body_style)],
        [Paragraph("Virtual Court Link:", bold_label_style), Paragraph("https://zoom.us/j/91283746501?pwd=PASSCODE12345", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "VIRTUAL_COURT",
    "judiciary_case_id": "MIL-ELC-E302-2026",
    "virtual_court_link": "https://zoom.us/j/91283746501?pwd=PASSCODE12345"
})

# 3.3 Google Meet Link
create_case('virtual_03_meet', [
    Paragraph("CHIEF MAGISTRATE COURT — ONLINE HEARING", header_style),
    Paragraph("JUDICIARY CASE NO: KSU-CIV-E303-2026", title_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Kisumu Law Courts", body_style)],
        [Paragraph("Virtual Court Link:", bold_label_style), Paragraph("https://meet.google.com/abc-defg-hij", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "VIRTUAL_COURT",
    "judiciary_case_id": "KSU-CIV-E303-2026",
    "virtual_court_link": "https://meet.google.com/abc-defg-hij"
})

# 3.4 Webex Link
create_case('virtual_04_webex', [
    Paragraph("ENVIRONMENT & LAND COURT — VIRTUAL COURTROOM", header_style),
    Paragraph("JUDICIARY CASE NO: NVI-ELC-E304-2026", title_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Naivasha Law Courts", body_style)],
        [Paragraph("Virtual Court Link:", bold_label_style), Paragraph("https://webex.com/meet/naivasha_courtroom_1", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "VIRTUAL_COURT",
    "judiciary_case_id": "NVI-ELC-E304-2026",
    "virtual_court_link": "https://webex.com/meet/naivasha_courtroom_1"
})

# 3.5 Embedded Password Virtual Link
create_case('virtual_05_embedded_pw', [
    Paragraph("HIGH COURT COMMERCIAL DIVISION — VIRTUAL MENTION", header_style),
    Paragraph("JUDICIARY CASE NO: MIL-CC-E305-2026", title_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Milimani Commercial Court", body_style)],
        [Paragraph("Virtual Court Link:", bold_label_style), Paragraph("https://zoom.us/j/123456789?pwd=SECRETKEY9988", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "VIRTUAL_COURT",
    "judiciary_case_id": "MIL-CC-E305-2026",
    "virtual_court_link": "https://zoom.us/j/123456789?pwd=SECRETKEY9988"
})

# ==============================================================================
# CATEGORY 4: ELC Decree Orders & Court Directions
# ==============================================================================

# 4.1 Pristine Decree
create_case('decree_01_pristine', [
    Paragraph("IN THE ENVIRONMENT AND LAND COURT AT KIAMBU", header_style),
    Paragraph("JUDICIARY CASE NO: ELC/E401/2026", title_style),
    Spacer(1, 10),
    Paragraph("COURT ORDER / DIRECTION", title_style),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Kiambu Law Courts", body_style)],
        [Paragraph("Presiding Judge:", bold_label_style), Paragraph("Hon. Lady Justice Lucy Gacheru", body_style)],
        [Paragraph("Order Details:", bold_label_style), Paragraph("IT IS HEREBY ORDERED that status quo be maintained pending hearing.", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "DECREE_ORDER",
    "judiciary_case_id": "ELC/E401/2026",
    "court_station": "Kiambu Law Courts",
    "assigned_judge": "Hon. Lady Justice Lucy Gacheru"
})

# 4.2 Multi-Paragraph Decree
create_case('decree_02_multiparagraph', [
    Paragraph("IN THE HIGH COURT OF KENYA AT NAIROBI", header_style),
    Paragraph("JUDICIARY CASE NO: MIL-CC-E402-2026", title_style),
    Spacer(1, 10),
    Paragraph("DECREE / RULING", title_style),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Milimani Law Courts", body_style)],
        [Paragraph("Presiding Officer:", bold_label_style), Paragraph("Hon. Justice Alfred Mabeya", body_style)],
        [Paragraph("Order Details:", bold_label_style), Paragraph("IT IS HEREBY ORDERED that: 1. Application is allowed. 2. Costs in the cause.", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "DECREE_ORDER",
    "judiciary_case_id": "MIL-CC-E402-2026"
})

# 4.3 Handwritten Notes Decree
create_case('decree_03_handwritten', [
    Paragraph("IN THE CHIEF MAGISTRATE'S COURT AT MACHAKOS", header_style),
    Paragraph("JUDICIARY CASE NO: MCK-CIV-E403-2026", title_style),
    Spacer(1, 10),
    Paragraph("GIVEN UNDER MY HAND AND THE SEAL OF THE COURT", title_style),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Machakos Law Courts", body_style)],
        [Paragraph("Order Details:", bold_label_style), Paragraph("IT IS HEREBY ORDERED that mention be fixed on 2026-11-15.", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "DECREE_ORDER",
    "judiciary_case_id": "MCK-CIV-E403-2026"
})

# 4.4 Injunction Decree
create_case('decree_04_injunction', [
    Paragraph("IN THE HIGH COURT OF KENYA AT NYERI", header_style),
    Paragraph("JUDICIARY CASE NO: NYR-CIV-E404-2026", title_style),
    Spacer(1, 10),
    Paragraph("INTERLOCUTORY INJUNCTION ORDER", title_style),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Nyeri Law Courts", body_style)],
        [Paragraph("Order Details:", bold_label_style), Paragraph("IT IS HEREBY ORDERED that Respondent is restrained from alienating LR 209/100.", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "DECREE_ORDER",
    "judiciary_case_id": "NYR-CIV-E404-2026"
})

# 4.5 Execution Order
create_case('decree_05_execution', [
    Paragraph("IN THE CHIEF MAGISTRATE COURT AT MERU", header_style),
    Paragraph("JUDICIARY CASE NO: MRU-COMM-E405-2026", title_style),
    Spacer(1, 10),
    Paragraph("ORDER OF EXECUTION / GARNISHEE", title_style),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Meru Law Courts", body_style)],
        [Paragraph("Order Details:", bold_label_style), Paragraph("IT IS HEREBY ORDERED that attachment do issue.", body_style)]
    ], colWidths=[160, 320], style=TableStyle([('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC'))]))
], {
    "docType": "DECREE_ORDER",
    "judiciary_case_id": "MRU-COMM-E405-2026"
})

# ==============================================================================
# CATEGORY 5: eFiling Stamped Pleadings
# ==============================================================================

# 5.1 Plaint
create_case('pleading_01_plaint', [
    Paragraph("IN THE HIGH COURT OF KENYA AT NAIROBI", header_style),
    Paragraph("MILIMANI COMMERCIAL AND TAX DIVISION", sub_header_style),
    Paragraph("JUDICIARY CASE NO: MIL-CC-E501-2026", title_style),
    Spacer(1, 10),
    Paragraph("BETWEEN:", bold_label_style),
    Paragraph("SAMUEL OGOLA ................................................................ PLAINTIFF", body_style),
    Paragraph("VERSUS", bold_label_style),
    Paragraph("SAFARICOM PLC ................................................................ DEFENDANT", body_style),
    Spacer(1, 15),
    Paragraph("PLAINT", title_style)
], {
    "docType": "PLEADING",
    "judiciary_case_id": "MIL-CC-E501-2026",
    "client_name": "SAMUEL OGOLA",
    "opposing_party": "SAFARICOM PLC"
})

# 5.2 Petition
create_case('pleading_02_petition', [
    Paragraph("IN THE HIGH COURT OF KENYA AT NAIROBI", header_style),
    Paragraph("CONSTITUTIONAL AND HUMAN RIGHTS DIVISION", sub_header_style),
    Paragraph("JUDICIARY CASE NO: PET-E502-2026", title_style),
    Spacer(1, 10),
    Paragraph("BETWEEN:", bold_label_style),
    Paragraph("LAW SOCIETY OF KENYA ................................................................ PETITIONER", body_style),
    Paragraph("AND", bold_label_style),
    Paragraph("ATTORNEY GENERAL ................................................................ RESPONDENT", body_style),
    Spacer(1, 15),
    Paragraph("CONSTITUTIONAL PETITION", title_style)
], {
    "docType": "PLEADING",
    "judiciary_case_id": "PET-E502-2026",
    "client_name": "LAW SOCIETY OF KENYA",
    "opposing_party": "ATTORNEY GENERAL"
})

# 5.3 Notice of Motion
create_case('pleading_03_motion', [
    Paragraph("IN THE ENVIRONMENT AND LAND COURT AT KIAMBU", header_style),
    Paragraph("JUDICIARY CASE NO: KMB-ELC-E503-2026", title_style),
    Spacer(1, 10),
    Paragraph("BETWEEN:", bold_label_style),
    Paragraph("JANE SMITH ................................................................ APPLICANT", body_style),
    Paragraph("AND", bold_label_style),
    Paragraph("KIAMBU COUNTY ................................................................ RESPONDENT", body_style),
    Spacer(1, 15),
    Paragraph("NOTICE OF MOTION", title_style)
], {
    "docType": "PLEADING",
    "judiciary_case_id": "KMB-ELC-E503-2026",
    "client_name": "JANE SMITH",
    "opposing_party": "KIAMBU COUNTY"
})

# 5.4 Affidavit
create_case('pleading_04_affidavit', [
    Paragraph("IN THE CHIEF MAGISTRATE COURT AT MOMBASA", header_style),
    Paragraph("JUDICIARY CASE NO: MOM-CIV-E504-2026", title_style),
    Spacer(1, 10),
    Paragraph("AFFIDAVIT IN SUPPORT", title_style)
], {
    "docType": "PLEADING",
    "judiciary_case_id": "MOM-CIV-E504-2026"
})

# 5.5 Memorandum of Appeal
create_case('pleading_05_appeal', [
    Paragraph("IN THE COURT OF APPEAL AT NAIROBI", header_style),
    Paragraph("CIVIL APPEAL NO: COA-E505-2026", title_style),
    Spacer(1, 10),
    Paragraph("MEMORANDUM OF APPEAL", title_style)
], {
    "docType": "PLEADING",
    "judiciary_case_id": "COA-E505-2026"
})

print("SUCCESS: 25 distinct PDF test cases + Ground Truth JSON files generated in tests/fixtures/pdf_test_cases/!")
