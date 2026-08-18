# generate_test_judiciary_pdfs.py — Generates 5 realistic Kenya Judiciary test PDFs with uncompressed streams for maximum parser compatibility
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

output_dir = os.path.join(os.getcwd(), 'test_pdfs')
os.makedirs(output_dir, exist_ok=True)

styles = getSampleStyleSheet()

header_style = ParagraphStyle('JudiciaryHeader', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=14, leading=18, alignment=1, textColor=colors.HexColor('#0A192F'))
sub_header_style = ParagraphStyle('JudiciarySubHeader', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, leading=14, alignment=1, textColor=colors.HexColor('#D4AF37'))
title_style = ParagraphStyle('DocTitle', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, leading=16, alignment=1, textColor=colors.HexColor('#111111'))
body_style = ParagraphStyle('DocBody', parent=styles['Normal'], fontName='Helvetica', fontSize=10, leading=15, textColor=colors.HexColor('#222222'))
bold_label_style = ParagraphStyle('BoldLabel', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=colors.HexColor('#000000'))

def create_doc(filename):
    path = os.path.join(output_dir, filename)
    doc = SimpleDocTemplate(path, pagesize=letter, leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=40)
    doc.pageCompression = 0
    return doc, path

# PDF 1: Official Judiciary Payment Receipt
doc1, _ = create_doc('1_Judiciary_Payment_Receipt_553388.pdf')
doc1.build([
    Paragraph("REPUBLIC OF KENYA — THE JUDICIARY", header_style),
    Paragraph("E-FILING PORTAL OFFICIAL RECEIPT (PAYBILL 553388)", sub_header_style),
    Spacer(1, 15),
    HRFlowable(width="100%", thickness=2, color=colors.HexColor('#D4AF37'), spaceAfter=15),
    Paragraph("OFFICIAL PAYMENT RECEIPT DETAILS", title_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Customer Ref / PRN:", bold_label_style), Paragraph("PRN-2026-9981", body_style)],
        [Paragraph("M-PESA Code / Ref:", bold_label_style), Paragraph("SGH8923JKL", body_style)],
        [Paragraph("Paybill Number:", bold_label_style), Paragraph("553388", body_style)],
        [Paragraph("Judiciary Case ID:", bold_label_style), Paragraph("MIL-CC-502-2026", body_style)],
        [Paragraph("Court Station:", bold_label_style), Paragraph("Milimani Law Courts", body_style)],
        [Paragraph("Total Amount Paid:", bold_label_style), Paragraph("KES 4,850.00", body_style)],
        [Paragraph("Client National ID:", bold_label_style), Paragraph("34892019", body_style)],
        [Paragraph("Client KRA PIN:", bold_label_style), Paragraph("A019283749B", body_style)],
        [Paragraph("Payer / Depositor:", bold_label_style), Paragraph("John Muthomi Doe", body_style)],
        [Paragraph("Date of Payment:", bold_label_style), Paragraph("28th July 2026", body_style)]
    ], colWidths=[180, 320], style=TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8F9FA')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E0E0E0')),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
])

# PDF 2: High Court Mention Notice (Zoom)
doc2, _ = create_doc('2_High_Court_Mention_Notice_Zoom.pdf')
doc2.build([
    Paragraph("IN THE HIGH COURT OF KENYA AT NAIROBI", header_style),
    Paragraph("COMMERCIAL AND TAX DIVISION", sub_header_style),
    Paragraph("JUDICIARY CASE NO: ECCC/E045/2024", title_style),
    Spacer(1, 10),
    HRFlowable(width="100%", thickness=1, color=colors.HexColor('#0A192F'), spaceAfter=15),
    Paragraph("BETWEEN:", bold_label_style),
    Paragraph("JOHN MUTHOMI DOE ................................................................ PLAINTIFF", body_style),
    Paragraph("AND", bold_label_style),
    Paragraph("SAFARICOM PLC ................................................................ DEFENDANT", body_style),
    Spacer(1, 15),
    Paragraph("NOTICE OF HEARING AND MENTION", title_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Milimani Law Courts", body_style)],
        [Paragraph("Scheduled Mention Date:", bold_label_style), Paragraph("28th August 2026", body_style)],
        [Paragraph("Presiding Officer:", bold_label_style), Paragraph("Hon. Justice Alfred Mabeya", body_style)],
        [Paragraph("Virtual Courtroom Link:", bold_label_style), Paragraph("https://zoom.us/j/98127394812?pwd=KJS91823", body_style)],
    ], colWidths=[180, 320], style=TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#D4AF37')),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
])

# PDF 3: Environment & Land Court Decree
doc3, _ = create_doc('3_Environment_Land_Court_Decree_Order.pdf')
doc3.build([
    Paragraph("IN THE ENVIRONMENT AND LAND COURT AT KIAMBU", header_style),
    Paragraph("JUDICIARY CASE NO: ELC/E102/2026", title_style),
    Spacer(1, 10),
    Paragraph("BETWEEN:", bold_label_style),
    Paragraph("JANE WAMBUI SMITH ................................................................ APPLICANT", body_style),
    Paragraph("AND", bold_label_style),
    Paragraph("CITY COUNTY GOVERNMENT OF KIAMBU ................................................................ RESPONDENT", body_style),
    Spacer(1, 15),
    Paragraph("COURT ORDER / DIRECTION", title_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Kiambu Law Courts", body_style)],
        [Paragraph("Presiding Judge:", bold_label_style), Paragraph("Hon. Lady Justice Lucy Gacheru", body_style)],
        [Paragraph("Scheduled Date:", bold_label_style), Paragraph("15th September 2026", body_style)],
        [Paragraph("Order Details:", bold_label_style), Paragraph("IT IS HEREBY ORDERED that the Respondent shall file and serve their Answering Affidavit within 14 days of service hereof.", body_style)]
    ], colWidths=[180, 320], style=TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCCCC')),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
])

# PDF 4: Mombasa Chief Magistrate Pleading (Teams)
doc4, _ = create_doc('4_Mombasa_Chief_Magistrate_Pleading_Teams.pdf')
doc4.build([
    Paragraph("IN THE CHIEF MAGISTRATE'S COURT AT MOMBASA", header_style),
    Paragraph("COMMERCIAL DIVISION", sub_header_style),
    Paragraph("JUDICIARY CASE NO: MOM-COMM-E892-2026", title_style),
    Spacer(1, 10),
    Paragraph("BETWEEN:", bold_label_style),
    Paragraph("COASTAL LOGISTICS LTD ................................................................ PLAINTIFF", body_style),
    Paragraph("VERSUS", bold_label_style),
    Paragraph("KENYA PORTS AUTHORITY ................................................................ DEFENDANT", body_style),
    Spacer(1, 15),
    Paragraph("NOTICE OF MOTION", title_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Court Station:", bold_label_style), Paragraph("Mombasa Law Courts", body_style)],
        [Paragraph("Scheduled Date:", bold_label_style), Paragraph("10th October 2026", body_style)],
        [Paragraph("Presiding Officer:", bold_label_style), Paragraph("Hon. Senior Principal Magistrate J. Omido", body_style)],
        [Paragraph("Virtual Court Link:", bold_label_style), Paragraph("https://teams.microsoft.com/l/meetup-join/19%3ameeting_MOMBASA_COURT_3", body_style)],
    ], colWidths=[180, 320], style=TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#999999')),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
])

# PDF 5: Naivasha Assessment Invoice (Meet)
doc5, _ = create_doc('5_Naivasha_Assessment_Invoice_Meet.pdf')
doc5.build([
    Paragraph("REPUBLIC OF KENYA — JUDICIARY E-FILING ASSESSMENT", header_style),
    Paragraph("FEE ASSESSMENT & COURT MENTION DIRECTIONS", sub_header_style),
    Spacer(1, 10),
    Table([
        [Paragraph("Judiciary Case ID:", bold_label_style), Paragraph("NAIVASHA-CIVIL-E012-2026", body_style)],
        [Paragraph("Court Station:", bold_label_style), Paragraph("Naivasha Law Courts", body_style)],
        [Paragraph("Customer Ref / PRN:", bold_label_style), Paragraph("PRN-2026-4412", body_style)],
        [Paragraph("M-PESA Code:", bold_label_style), Paragraph("RKT719280A", body_style)],
        [Paragraph("Total Amount Paid:", bold_label_style), Paragraph("KES 12,500.00", body_style)],
        [Paragraph("Client National ID:", bold_label_style), Paragraph("29810293", body_style)],
        [Paragraph("Presiding Officer:", bold_label_style), Paragraph("Hon. Resident Magistrate N. Ndung'u", body_style)],
        [Paragraph("Scheduled Mention Date:", bold_label_style), Paragraph("2026-09-01", body_style)],
        [Paragraph("Virtual Court Link:", bold_label_style), Paragraph("https://meet.google.com/xyz-abc-def", body_style)]
    ], colWidths=[180, 320], style=TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#D4AF37')),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
])

print("SUCCESS: 5 uncompressed, 100% compatible test PDFs generated in test_pdfs/!")
