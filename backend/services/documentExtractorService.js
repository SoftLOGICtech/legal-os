const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');

/**
 * Universal Multi-Format Document & OCR Text Extraction Service
 * Supports: PDF (digital + scanned OCR fallback), DOCX, DOC, Images (PNG, JPG, TIFF, WEBP), TXT, CSV, MD
 */

/**
 * Extract embedded JPEG/PNG image streams from a raw PDF buffer for scanned documents
 */
function extractImagesFromPdfBuffer(pdfBuffer) {
    const images = [];
    try {
        let offset = 0;
        const len = pdfBuffer.length;
        
        // Look for JPEG start-of-image (0xFFD8) and end-of-image (0xFFD9)
        while (offset < len - 4) {
            if (pdfBuffer[offset] === 0xFF && pdfBuffer[offset + 1] === 0xD8) {
                const start = offset;
                let end = start + 2;
                while (end < len - 1) {
                    if (pdfBuffer[end] === 0xFF && pdfBuffer[end + 1] === 0xD9) {
                        end += 2;
                        break;
                    }
                    end++;
                }
                if (end > start + 1024 && (end - start) < 15 * 1024 * 1024) { // Only keep reasonable image streams (>1KB, <15MB)
                    images.push(pdfBuffer.subarray(start, end));
                    if (images.length >= 3) break; // Limit to first 3 pages/images for speed
                }
                offset = end;
            } else {
                offset++;
            }
        }
    } catch (e) {
        console.warn('[DocExtractor] PDF Image stream extraction notice:', e.message);
    }
    return images;
}

/**
 * Perform OCR on an image buffer (PNG, JPEG, TIFF, BMP, etc.) using Tesseract
 */
async function performOcrOnImageBuffer(imageBuffer) {
    try {
        const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
            logger: () => {} // Silent
        });
        return (text || '').trim();
    } catch (err) {
        console.warn('[DocExtractor] Tesseract OCR error:', err.message);
        return '';
    }
}

/**
 * Clean and normalize extracted text strings
 */
function cleanExtractedText(text) {
    if (!text) return '';
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // remove unprintable control chars
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Core Universal Extractor Function
 * @param {Buffer} buffer - File buffer
 * @param {string} originalFilename - Original uploaded filename
 * @param {string} mimeType - Optional MIME type
 * @returns {Promise<{text: string, method: string, pages: number, isScanned: boolean}>}
 */
async function extractTextFromDocument(buffer, originalFilename = '', mimeType = '') {
    if (!buffer || buffer.length === 0) {
        return { text: '', method: 'empty', pages: 1, isScanned: false };
    }

    const ext = path.extname(originalFilename || '').toLowerCase();
    let text = '';
    let method = 'unknown';
    let isScanned = false;

    // 1. PDF Documents
    if (ext === '.pdf' || mimeType.includes('pdf')) {
        try {
            const pdfData = await pdfParse(buffer);
            text = pdfData?.text ? cleanExtractedText(pdfData.text) : '';
            method = 'pdf-parse';

            // Check if text is suspiciously empty or contains almost no real words (indicating scanned/photocopy PDF)
            const alphaCount = (text.match(/[a-zA-Z0-9]/g) || []).length;
            if (alphaCount < 60) {
                console.log(`[DocExtractor] PDF "${originalFilename}" has very low digital text (${alphaCount} chars). Running OCR on embedded page streams...`);
                const extractedImages = extractImagesFromPdfBuffer(buffer);
                
                if (extractedImages.length > 0) {
                    isScanned = true;
                    let ocrResults = [];
                    for (let i = 0; i < extractedImages.length; i++) {
                        const pageText = await performOcrOnImageBuffer(extractedImages[i]);
                        if (pageText) ocrResults.push(`--- Page ${i + 1} (OCR) ---\n${pageText}`);
                    }
                    if (ocrResults.length > 0) {
                        text = cleanExtractedText(ocrResults.join('\n\n'));
                        method = 'pdf-embedded-image-ocr';
                    }
                }

                // If still empty, do binary text token regex extraction as emergency fallback
                if (!text || text.length < 30) {
                    const bufStr = buffer.toString('latin1');
                    const textMatches = bufStr.match(/\(([^()]{3,})\)/g) || bufStr.match(/[A-Za-z0-9\s.,:\/-]{4,}/g) || [];
                    const fallbackText = textMatches.map(m => m.replace(/[()]/g, '')).join(' ');
                    if (fallbackText.length > text.length) {
                        text = cleanExtractedText(fallbackText);
                        method = 'pdf-raw-stream-fallback';
                    }
                }
            }
        } catch (pdfErr) {
            console.warn(`[DocExtractor] pdf-parse failed on "${originalFilename}":`, pdfErr.message);
            // Fallback: try OCR if it's a PDF wrapper around an image
            const extractedImages = extractImagesFromPdfBuffer(buffer);
            if (extractedImages.length > 0) {
                isScanned = true;
                const pageText = await performOcrOnImageBuffer(extractedImages[0]);
                text = cleanExtractedText(pageText);
                method = 'pdf-fallback-ocr';
            }
        }
    }
    // 2. Word Documents (.docx)
    else if (ext === '.docx' || mimeType.includes('officedocument.wordprocessingml')) {
        try {
            const result = await mammoth.extractRawText({ buffer });
            text = cleanExtractedText(result.value || '');
            method = 'mammoth-docx';
        } catch (docxErr) {
            console.warn(`[DocExtractor] mammoth docx extraction failed on "${originalFilename}":`, docxErr.message);
        }
    }
    // 3. Legacy Word Documents (.doc)
    else if (ext === '.doc' || mimeType.includes('msword')) {
        try {
            // Extract printable strings from binary .doc
            const bufStr = buffer.toString('latin1');
            const matches = bufStr.match(/[A-Za-z0-9\s.,;:?!\/'"()-]{4,}/g) || [];
            text = cleanExtractedText(matches.join(' '));
            method = 'binary-doc-strings';
        } catch (docErr) {
            console.warn(`[DocExtractor] binary .doc extraction failed:`, docErr.message);
        }
    }
    // 4. Image Files (PNG, JPG, JPEG, TIFF, BMP, WEBP)
    else if (['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.webp'].includes(ext) || mimeType.startsWith('image/')) {
        isScanned = true;
        text = await performOcrOnImageBuffer(buffer);
        text = cleanExtractedText(text);
        method = 'tesseract-image-ocr';
    }
    // 5. Plain Text & Code Files (.txt, .csv, .md, .rtf, .json, .eml, .tsv)
    else {
        try {
            let rawStr = buffer.toString('utf8');
            // If RTF, strip control codes
            if (rawStr.startsWith('{\\rtf')) {
                rawStr = rawStr.replace(/\\par/g, '\n').replace(/\{[^{}]*\}/g, '').replace(/\\[A-Za-z0-9-]+/g, '');
            }
            text = cleanExtractedText(rawStr);
            method = 'utf8-text';
        } catch (txtErr) {
            text = cleanExtractedText(buffer.toString('latin1'));
            method = 'latin1-text';
        }
    }

    return {
        text,
        method,
        pages: 1,
        isScanned,
        characterCount: text.length
    };
}

/**
 * Deterministic Kenyan Judiciary Keyword & Heuristic Parser
 * Accurately classifies and extracts key fields from raw text before LLM enrichment
 */
function analyzeKenyanJudiciaryKeywords(rawText, filename = '') {
    const combined = `${filename}\n${rawText}`.toUpperCase();
    const result = {
        docType: 'OTHER',
        subType: '',
        judiciary_case_id: '',
        court_station: '',
        parties: { plaintiff: '', defendant: '' },
        dates: [],
        payment_ref: '',
        prn_number: '',
        amount: 0,
        judge_name: '',
        teams_link: '',
        confidence: 'LOW'
    };

    if (!rawText || rawText.trim().length === 0) return result;

    // 1. Precise DocType Classification based on Kenyan Practice
    if (combined.includes('OFFICIAL RECEIPT') || combined.includes('PAYBILL 553388') || combined.includes('ASSESSMENT ADVICE') || combined.includes('PRN NO') || combined.includes('CUSTOMER REF')) {
        result.docType = 'RECEIPT';
        result.subType = 'Judiciary eFiling Fee Receipt';
    } else if (combined.includes('NOTICE OF MOTION') || combined.includes('CHAMBER SUMMONS') || combined.includes('CERTIFICATE OF URGENCY') || combined.includes('URGENT APPLICATION')) {
        result.docType = 'PLEADING';
        result.subType = 'Notice of Motion / Urgent Application';
    } else if (combined.includes('PLAINT') || combined.includes('STATEMENT OF CLAIM') || combined.includes('MEMORANDUM OF CLAIM')) {
        result.docType = 'PLEADING';
        result.subType = 'Plaint / Statement of Claim';
    } else if (combined.includes('STATEMENT OF DEFENCE') || combined.includes('STATEMENT OF DEFENSE') || combined.includes('REPLY TO DEFENCE') || combined.includes('COUNTER-CLAIM') || combined.includes('COUNTERCLAIM')) {
        result.docType = 'PLEADING';
        result.subType = 'Statement of Defence';
    } else if (combined.includes('AFFIDAVIT') || combined.includes('DEPONENT') || combined.includes('SWORN AT') || combined.includes('DO HEREBY MAKE OATH')) {
        result.docType = 'PLEADING';
        result.subType = 'Affidavit';
    } else if (combined.includes('WRITTEN SUBMISSIONS') || combined.includes('SKELETON ARGUMENTS') || combined.includes('LIST OF AUTHORITIES') || combined.includes('ISSUES FOR DETERMINATION')) {
        result.docType = 'PLEADING';
        result.subType = 'Written Submissions & Authorities';
    } else if (combined.includes('MEMORANDUM OF APPEARANCE') || combined.includes('NOTICE OF APPOINTMENT OF ADVOCATE') || combined.includes('NOTICE OF CHANGE OF ADVOCATE')) {
        result.docType = 'PLEADING';
        result.subType = 'Notice of Appearance';
    } else if (combined.includes('DECREE') || combined.includes('ORDER OF INJUNCTION') || combined.includes('EXTRACT OF ORDER') || combined.includes('IT IS HEREBY ORDERED AND DECREED')) {
        result.docType = 'DECREE_ORDER';
        result.subType = 'Court Order / Decree';
    } else if (combined.includes('RULING') || combined.includes('JUDGMENT') || combined.includes('JUDGEMENT') || combined.includes('ORDERS ACCORDINGLY') || combined.includes('CORAM:')) {
        result.docType = 'DECREE_ORDER';
        result.subType = 'Court Ruling / Judgment';
    } else if (combined.includes('NOTICE OF HEARING') || combined.includes('HEARING NOTICE') || combined.includes('NOTICE OF MENTION') || combined.includes('CAUSE LIST') || combined.includes('FIXED FOR MENTION') || combined.includes('FIXED FOR HEARING')) {
        result.docType = 'MENTION_NOTICE';
        result.subType = 'Court Mention / Hearing Notice';
    } else if (combined.includes('TEAMS.MICROSOFT.COM') || combined.includes('MICROSOFT TEAMS') || combined.includes('VIRTUAL HEARING') || combined.includes('MEETING ID:')) {
        result.docType = 'VIRTUAL_COURT';
        result.subType = 'Virtual Court Session';
    }

    // 2. Case Number Matcher (Kenyan CTS formats)
    // Examples: HCCC 123 OF 2024, MIL-COMM-E892-2024, ELC NO. 45/2023, CMCC E012/2025, SUCC CAUSE 88 OF 2022
    const casePatterns = [
        /\b(?:MIL|NBI|MSA|KSM|NKU|ELD|KBU|THK|MKS)[-_](?:COMM|CIV|ELC|ELRC|CRIM|SUCC)[-_]E?\d+[-_]\d{4}\b/i,
        /\b(?:HCCC|HCC|ELC|ELRC|CMCC|MCC|MCELC|MCCOMM|CRIMINAL|SUCCESSION|PETITION|MISC(?:\s*APPL)?)\s*(?:NO\.?|CAUSE\s*NO\.?)?\s*(?:E?\d+[\/\-]\d{4}|E?\d+\s+OF\s+\d{4})\b/i,
        /\b(?:CIVIL\s*SUIT|CIVIL\s*APPEAL|CONSTITUTIONAL\s*PETITION)\s*(?:NO\.?|CAUSE\s*NO\.?)?\s*(?:E?\d+[\/\-]\d{4}|E?\d+\s+OF\s+\d{4})\b/i,
        /\b[A-Z]{2,6}[-\/](?:E\d+|\d+)[-\/]\d{4}\b/
    ];

    for (const pat of casePatterns) {
        const match = rawText.match(pat);
        if (match) {
            result.judiciary_case_id = match[0].trim().replace(/\s+/g, ' ');
            result.confidence = 'HIGH';
            break;
        }
    }

    // 3. Court Station Matcher
    const stations = [
        'Milimani Law Courts', 'Milimani High Court', 'Milimani Commercial Courts',
        'Supreme Court of Kenya', 'Court of Appeal',
        'Nairobi Law Courts', 'Mombasa Law Courts', 'Kisumu Law Courts', 'Nakuru Law Courts',
        'Eldoret Law Courts', 'Machakos Law Courts', 'Kiambu Law Courts', 'Thika Law Courts',
        'Naivasha Law Courts', 'Kajiado Law Courts', 'Mavoko Law Courts', 'Kitengela Law Courts',
        'Malindi Law Courts', 'Meru Law Courts', 'Nyeri Law Courts', 'Kakamega Law Courts',
        'Kisii Law Courts', 'Kericho Law Courts', 'Garissa Law Courts', 'Embu Law Courts', 'Kilifi Law Courts'
    ];

    for (const station of stations) {
        if (combined.includes(station.toUpperCase())) {
            result.court_station = station;
            break;
        }
    }
    if (!result.court_station && combined.includes('MILIMANI')) result.court_station = 'Milimani Law Courts, Nairobi';

    // 4. M-Pesa Code & PRN / Billing Reference
    const mpesaMatch = rawText.match(/\b(?=.*[0-9])(?=.*[A-Z])[A-Z0-9]{10}\b/);
    if (mpesaMatch && !mpesaMatch[0].startsWith('HTTP')) {
        result.payment_ref = mpesaMatch[0];
    }
    const prnMatch = rawText.match(/\b(?:PRN|BILLING\s*REF|INVOICE\s*NO|INVOICE\s*NUMBER|RECEIPT\s*NO)[:\s#-]+([A-Z0-9-]{6,20})\b/i);
    if (prnMatch) result.prn_number = prnMatch[1];

    // 5. Amount (KES)
    const amountMatch = rawText.match(/(?:KES|KSH|AMOUNT|TOTAL|PAID|SUM\s*OF\s*KES)[:\s.]*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i);
    if (amountMatch) {
        const num = parseFloat(amountMatch[1].replace(/,/g, ''));
        if (!isNaN(num) && num > 0 && num < 100000000) {
            result.amount = num;
        }
    }

    // 6. Microsoft Teams Link
    const teamsMatch = rawText.match(/(https?:\/\/[^\s<>"]+teams[^\s<>"]+)/i);
    if (teamsMatch) {
        result.teams_link = teamsMatch[1];
    }

    // 7. Judge / Magistrate Presiding
    const judgeMatch = rawText.match(/(?:BEFORE\s*(?:HON\.?|HONOURABLE|JUSTICE|LADY\s*JUSTICE|JUDGE|MAGISTRATE)|CORAM:?)[:\s]+([A-Z][a-zA-Z\s.'-]+(?:\([A-Z\s]+\))?)/i);
    if (judgeMatch) {
        result.judge_name = judgeMatch[1].trim().split('\n')[0].slice(0, 60);
    }

    return result;
}

module.exports = {
    extractTextFromDocument,
    analyzeKenyanJudiciaryKeywords,
    performOcrOnImageBuffer,
    cleanExtractedText
};
