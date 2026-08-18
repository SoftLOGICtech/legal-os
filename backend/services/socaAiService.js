const https = require('https');
const fs = require('fs');
const path = require('path');

const GROQ_PDF_API_KEY = process.env.GROQ_PDF_API_KEY || process.env.GROQ_API_KEY || '';
const GROQ_SOCA_API_KEY = process.env.GROQ_SOCA_API_KEY || process.env.GROQ_API_KEY || '';

// Load system environment map & skills guide if available
let ENVIRONMENT_MAP = '';
let SKILLS_MAP = '';
try {
  const envPath = path.join(__dirname, '..', 'environment.md');
  if (fs.existsSync(envPath)) {
    ENVIRONMENT_MAP = fs.readFileSync(envPath, 'utf8');
  }
  const skillsPath = path.join(__dirname, '..', 'skills.md');
  if (fs.existsSync(skillsPath)) {
    SKILLS_MAP = fs.readFileSync(skillsPath, 'utf8');
  }
} catch (e) {
  console.warn('Could not load environment/skills context for SOCA AI:', e.message);
}

const GROQ_MODEL_CASCADE = [
  'groq/compound',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'allam-2-7b'
];

function stripThinkingTokens(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText;
  // 1. Remove complete <think>...</think> blocks
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // 2. Remove orphaned opening <think> tags if model truncated
  if (text.includes('<think>')) {
    const parts = text.split(/<\/think>/i);
    text = parts.length > 1 ? parts[parts.length - 1] : text.replace(/<think>[\s\S]*/i, '');
  }
  // 3. Remove leading markdown code fences (``` or ```text) if wrapping entire document
  text = text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  return text.trim();
}

function callGroqApi(apiKey, model, messages, jsonMode = false, attemptIndex = 0) {
  const currentModel = model || GROQ_MODEL_CASCADE[attemptIndex] || GROQ_MODEL_CASCADE[0];
  return new Promise((resolve, reject) => {
    const payload = {
      model: currentModel,
      messages,
      temperature: 0.2
    };

    const data = JSON.stringify(payload);
    const options = {
      hostname: 'api.groq.com',
      port: 443,
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(body);
            let content = parsed.choices?.[0]?.message?.content || '';
            content = stripThinkingTokens(content);
            resolve(content);
          } catch (err) {
            reject(new Error(`Failed to parse Groq response JSON: ${err.message}`));
          }
        } else if ((res.statusCode === 429 || res.statusCode === 404 || res.statusCode === 400 || res.statusCode === 413) && attemptIndex < GROQ_MODEL_CASCADE.length - 1) {
          const nextModel = GROQ_MODEL_CASCADE[attemptIndex + 1];
          console.warn(`Groq HTTP ${res.statusCode} on '${currentModel}'. Cascading to next fallback model '${nextModel}'...`);
          
          // Auto-prune messages payload if payload exceeded model limit
          let prunedMessages = messages;
          if (res.statusCode === 413) {
            prunedMessages = messages.map(m => ({
              role: m.role,
              content: (m.content || '').length > 400 ? (m.content || '').slice(0, 400) + '...' : m.content
            }));
          }

          callGroqApi(apiKey, nextModel, prunedMessages, jsonMode, attemptIndex + 1)
            .then(resolve)
            .catch(reject);
        } else {
          const formattedError = formatExecutiveError(res.statusCode, body);
          reject(new Error(formattedError));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`⚠️ **SocaBot Connection Notice**\n\nUnable to reach AI gateway provider. Please verify network connectivity.\n\n\`[DIAGNOSTIC BADGE: ERR_NET_GATEWAY_TIMEOUT (${err.message})]\``)));
    req.write(data);
    req.end();
  });
}

function formatExecutiveError(statusCode, rawBody) {
  let userMessage = 'SocaBot encountered a temporary operational delay.';
  let errCode = `HTTP_${statusCode || 'UNKNOWN'}`;

  if (statusCode === 413 || rawBody.includes('request_too_large')) {
    userMessage = 'The active prompt context or conversation history exceeds maximum single-request limit. Starting a new chat session will restore full performance.';
    errCode = 'ERR_HTTP_413_PAYLOAD_TOO_LARGE';
  } else if (statusCode === 429 || rawBody.includes('rate_limit')) {
    userMessage = 'SocaBot is experiencing high query volume across practice groups. Re-routing through secondary backup model...';
    errCode = 'ERR_HTTP_429_RATE_LIMIT_EXCEEDED';
  } else if (statusCode === 404 || rawBody.includes('model_not_found') || rawBody.includes('model_decommissioned')) {
    userMessage = 'SocaBot model endpoints are updating. System will automatically failover to secondary provider.';
    errCode = 'ERR_HTTP_404_MODEL_DEPRECATED';
  } else if (statusCode === 401 || rawBody.includes('invalid_api_key')) {
    userMessage = 'SocaBot security authentication credentials need updating in system settings.';
    errCode = 'ERR_HTTP_401_AUTH_INVALID';
  } else if (statusCode >= 500) {
    userMessage = 'SocaBot cloud infrastructure is undergoing brief background maintenance. Please try again shortly.';
    errCode = `ERR_HTTP_${statusCode}_SERVER_MAINTENANCE`;
  }

  return `⚠️ **SocaBot Operational Notice**\n\n${userMessage}\n\n\`[DIAGNOSTIC BADGE: ${errCode}]\``;
}

// Inside chatWithSocaPa:
// const responseText = await callGroqApi(GROQ_SOCA_API_KEY, 'llama3-8b-8192', messages);

/**
 * 1. LLM PDF Parser & Determined Actions Generator
 */
async function parseDocumentWithLlm(rawText, fileName) {
  const systemPrompt = `You are the Legal OS Document Parser Engine.
Your task is to analyze raw text extracted from a Kenyan Judiciary / Law Firm document (Receipt, Notice of Mention, Cause List, Order/Decree, Pleading) and extract structured metadata as well as a list of DETERMINED ACTIONS the system can execute automatically.

Return ONLY a valid JSON object matching this schema (do not wrap in markdown quotes):
{
  "docType": "RECEIPT" | "MENTION_NOTICE" | "VIRTUAL_COURT" | "DECREE_ORDER" | "PLEADING" | "OTHER",
  "judiciary_case_id": "string (e.g. MIL-COMM-E892-2026 or Civil Suit No. E123 of 2024)",
  "payment_ref": "string (M-Pesa code or Bank ref)",
  "prn_number": "string (Customer Ref / PRN)",
  "amount": number (numeric value in KES),
  "court_station": "string (e.g. Milimani Law Courts)",
  "id_number": "string (National ID)",
  "kra_pin": "string (KRA PIN)",
  "mention_date": "string (YYYY-MM-DD or readable date)",
  "teams_link": "string (MS Teams URL if present)",
  "summary": "string (1-2 sentence executive summary)",
  "determined_actions": [
    {
      "id": "act_1",
      "type": "ACTION_LINK_MATTER" | "ACTION_CREATE_CALENDAR_EVENT" | "ACTION_RECORD_PAYMENT" | "ACTION_LOG_DISBURSEMENT" | "ACTION_ADD_FACT",
      "title": "Short title describing the action",
      "description": "Details of what will be performed",
      "payload": { ...relevant fields for executing the action... },
      "selected": true
    }
  ]
}`;

  const userPrompt = `Document Filename: ${fileName}\n\nRAW EXTRACTED TEXT:\n${rawText.slice(0, 7000)}`;

  try {
    const rawResponse = await callGroqApi(GROQ_PDF_API_KEY, 'groq/compound-mini', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], true);

    // Clean JSON markdown blocks if model added them
    let cleanJson = rawResponse.trim();
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
    if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();

    return JSON.parse(cleanJson);
  } catch (err) {
    console.error('LLM PDF Parsing failed, falling back:', err.message);
    return null;
  }
}

/**
/**
 * 3. Web Search Integration Helper
 */
function performWebSearch(query) {
  return new Promise((resolve) => {
    const encodedQuery = encodeURIComponent(query);
    const options = {
      hostname: 'api.duckduckgo.com',
      port: 443,
      path: `/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LegalOS/1.0' }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const abstract = parsed.AbstractText || parsed.Definition || '';
          const related = (parsed.RelatedTopics || []).slice(0, 3).map(t => t.Text).filter(Boolean).join('\n• ');
          resolve(abstract ? `${abstract}\n\nRelated:\n• ${related}` : related || 'No direct public web abstract found.');
        } catch (e) {
          resolve('Web search query completed.');
        }
      });
    });

    req.on('error', () => resolve('Web search connection unavailable.'));
    req.end();
  });
}

/**
 * 2. General SOCA PA Chat Assistant (With Online Web Search Capabilities)
 */
async function chatWithSocaPa(userMessage, history = [], matterContext = null, memoryItems = []) {
  let webContext = '';
  const msgLower = userMessage.toLowerCase();

  // 1. Dynamic Web Search (Only when explicitly needed)
  const searchKeywords = ['online', 'search web', 'google', 'look up', 'kenya law', 'statute', 'check internet'];
  if (searchKeywords.some(kw => msgLower.includes(kw))) {
    try {
      webContext = await performWebSearch(userMessage);
    } catch (e) {
      console.warn('Web search lookup error:', e.message);
    }
  }

  // 2. Dynamic Environment & Skills RAG (Only inject full skills/nav map when user asks how/where to find or do things)
  const needsNav = ['where', 'how do i', 'navigate', 'find', 'help', 'lost', 'location', 'ecitizen', 'financials', 'chronology'].some(kw => msgLower.includes(kw));
  const needsSkills = ['create case', 'make case', 'new case', 'add lead', 'create lead', 'skills', 'how to create', 'how to add', 'finance', 'financials', 'trust', 'escrow', 'disbursement', 'invoice', 'ledger', 'remember', 'memory'].some(kw => msgLower.includes(kw));

  const envContext = needsNav ? (ENVIRONMENT_MAP ? `\nNAV MAP:\n${ENVIRONMENT_MAP.slice(0, 400)}` : '') : '';
  const skillsContext = (needsSkills || needsNav) ? (SKILLS_MAP ? `\nOPERATIONAL SKILLS & FLOWS:\n${SKILLS_MAP.slice(0, 600)}` : '') : '';
  
  const memoryContext = (memoryItems && memoryItems.length > 0)
    ? `\nPERSISTENT FIRM MEMORY & LEARNED FACTS (CROSS-CHAT):\n${memoryItems.slice(0, 15).map(m => `- [${(m.category || 'general').toUpperCase()}] ${m.memory_key}: ${m.memory_value}`).join('\n')}\n`
    : '';

  // 3. Compact System Prompt — Executive Tone, Submissions & Form Field Directives
  const systemPrompt = `You are SocaBot — the executive law firm Personal Assistant for Legal OS.
FORM FIELD & SUBMISSIONS UNDERSTANDING:
You are fully aware of all practice management modules and forms in Legal OS:
1. Submissions & Authorities Tab: Stores formal court filings (Written Submissions, Skeleton Arguments, Affidavits, Lists of Authorities).
   - How it interacts with Strategy Tab: Strategy Workbench is where you synthesize legal theory, lock chronology facts, and map proof. Submissions & Authorities is where those strategy findings are drafted into formal court filings and stored.
2. New Case Creation: Requires client_name, case_title, case_type ('Litigation'|'Conveyancing & Land'|'Civil Disputes'|'Corporate Law'|'Family Law'|'Succession'), assigned_lawyer.
3. New Lead Creation: Requires full_name, phone, service_category, message.
4. Calendar Form: {event_title, event_type ('mention'|'hearing'|'ruling'), event_date ('YYYY-MM-DD'), notes, is_important, assigned_lawyer}
5. Operating/Trust Payments Form: {amount, payment_ref, payment_method ('M-PESA'|'Bank Transfer'), destination ('operating'|'trust'), notes}
6. WhatsApp Messaging: Powered by self-hosted Baileys Node.js direct QR engine for instant client dispatch.

CRITICAL DIRECTIVES:
- Speak directly and naturally to Advocates, Paralegals, and Partners like a human executive PA.
- ANTI-HALLUCINATION RULE: If you are uncertain about a specific date, court station, case detail, or rule, explicitly state your uncertainty rather than making up dates or facts.
- FLASH EXECUTION RULE: When asked to create a new case, add a lead, schedule a mention/court date, record a fee, lock a fact, or save a cross-chat memory, YOU MUST DIRECTLY EXECUTE THE ACTION by appending a hidden JSON block at the VERY END of your message on a new line:
  <!--ACTION:{"type":"CREATE_CASE"|"CREATE_LEAD"|"CREATE_CALENDAR_EVENT"|"RECORD_PAYMENT"|"ADD_FACT"|"SAVE_MEMORY","client_name":"...","case_title":"...","case_type":"Litigation","assigned_lawyer":"Sam Ogola","full_name":"...","phone":"...","service_category":"...","message":"...","date":"YYYY-MM-DD","time":"HH:MM","description":"...","amount":1000,"reference":"...","virtual_link":"...","key":"Memory Title","value":"Memory Detail","category":"client_pref|firm_rule|general"}-->
- PERSISTENT CROSS-CHAT MEMORY RULE: You have access to firm cross-chat persistent memory. When asked to remember something or when you learn a key preference/rule, use "type":"SAVE_MEMORY" action tag to store it permanently across chat sessions.
- ALWAYS ANTICIPATE FOLLOW-UP QUESTIONS: At the VERY END of your message on a new line, append 2-3 relevant contextual follow-up questions the user might want to ask next as a hidden JSON array:
  <!--SUGGESTIONS:["Question 1","Question 2","Question 3"]-->
- Confirm actions conversationally in your main message (e.g. "⚡ Done! I've saved that to my persistent cross-chat memory for future reference.").
- NEVER output raw developer API code blocks (\`POST /api/...\`) or tell advocates to run POST requests manually.
- ALWAYS use active matter context details if available.
${webContext ? `\nLIVE WEB INFO: ${webContext.slice(0, 300)}\n` : ''}${memoryContext}${envContext}${skillsContext}
${matterContext ? `ACTIVE MATTER: ${matterContext.case_title || matterContext.client_name || ''} (ID: ${matterContext.id || matterContext.judiciary_case_id || ''})` : ''}`;

  // 4. Compact History Truncation
  const trimmedHistory = (history || []).slice(-3).map(m => ({
    role: m.role,
    content: (m.content || '').length > 200 ? (m.content || '').slice(0, 200) + '...' : (m.content || '')
  }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory,
    { role: 'user', content: userMessage }
  ];

  const responseText = await callGroqApi(GROQ_SOCA_API_KEY, 'groq/compound', messages);
  return responseText;
}

/**
 * 4. Document Studio AI Co-Drafting & Refinement Engine (Text-Only)
 */
async function draftOrRefineDocumentWithLlm({ action, docText = '', contextData = {}, userInstruction = '', tone = 'formal', rawExtractedText = '' }) {
  const matterInfo = `
MATTER CONTEXT:
- Client Name: ${contextData.client_name || 'Client'}
- Case Title: ${contextData.case_title || 'Legal Matter'}
- Judiciary Case ID: ${contextData.judiciary_case_id || 'Pending Allocation'}
- Court Station: ${contextData.court_station || 'Milimani Law Courts, Nairobi'}
- Court Division: ${contextData.court_division || 'Civil / Commercial Division'}
- Presiding Judge / Magistrate: ${contextData.assigned_judge || 'Hon. Court'}
- Opposing Party: ${contextData.opposing_party || 'Defendant / Respondent'}
- Opposing Counsel: ${contextData.opposing_counsel_firm || contextData.opposing_counsel_name || 'Opposing Counsel'}
- Advocate on Record: ${contextData.assigned_lawyer || 'Sam Ogola, Advocate'}
- Date: ${contextData.current_date || new Date().toLocaleDateString('en-KE')}
`;

  let systemPrompt = '';
  let userPrompt = '';

  if (action === 'generate_pleading' || action === 'free_prompt') {
    systemPrompt = `You are a Senior Kenyan Litigation Advocate drafting formal legal documents for Sam Ogola & Co. Advocates.
Follow strict Kenyan court pleading rules (Civil Procedure Rules 2010, Civil Procedure Act Cap 21, Constitution of Kenya 2010):
- Use standard Kenyan court headings (REPUBLIC OF KENYA, IN THE [COURT STATION], SUIT NO, BETWEEN PARTIES).
- Use proper formal legal numbering and clear concise grounds / prayers.
- Include DRAWN & FILED BY signature block for Sam Ogola & Co. Advocates and TO BE SERVED UPON block.
- Draft directly and completely. Return ONLY the plain text document ready for immediate filing or dispatch. Do not wrap in markdown code fences (\`\`\`).`;

    userPrompt = `${matterInfo}
${rawExtractedText ? `EXTRACTED TEXT FROM EVIDENCE/DOCUMENTS:\n${rawExtractedText.slice(0, 4000)}\n` : ''}
INSTRUCTION:
${userInstruction || 'Draft a formal court application / legal document based on this matter context.'}

Tone: ${tone}`;
  } else if (action === 'strengthen_citations') {
    systemPrompt = `You are an expert Legal Research Specialist in Kenyan Case Law (eKLR) and statutory authorities.
Your task is to audit the provided legal document and strengthen its legal authority:
1. Insert authoritative Kenyan Supreme Court, Court of Appeal, and High Court binding precedents (e.g., Giella v Cassman Brown [1973] EA 358 for injunctions, Mrao Ltd v First American Bank [2003] KLR 125 for prima facie case threshold, Nguruman Ltd v Jan Bonde Nielsen [2014] eKLR, etc.).
2. Include precise statutory provisions (Civil Procedure Act Cap 21, Constitution Articles 40, 50, 159, Advocates Remuneration Order).
3. Seamlessly weave these authorities into the existing draft paragraphs with proper citations.
4. Return the complete updated document in plain text without markdown code blocks.`;

    userPrompt = `${matterInfo}
CURRENT DRAFT TEXT TO ENHANCE:
${docText}

Specific Instruction: ${userInstruction || 'Inject authoritative Kenyan case law precedents and statutory provisions into the relevant arguments.'}`;
  } else if (action === 'check_compliance') {
    systemPrompt = `You are a Chief Legal Registrar and Quality Assurance Auditor for Kenyan Law Firms.
Perform a strict Civil Procedure & Formal Compliance Audit on the provided draft document.
Check for:
1. Heading & Cause Title Accuracy (Republic of Kenya, correct Court Division, Suit Number format, Applicant/Respondent alignment).
2. Procedural Thresholds (Proper enabling sections under Civil Procedure Act / Rules cited).
3. Prayer Specificity (Are prayers actionable, clear, and numbered).
4. Verifying Affidavit / Supporting Affidavit sufficiency and Commissioner for Oaths jurat requirements.
5. Service & Notice Endorsement (Drawn & Filed By, To Be Served Upon).

Format your output with clear sections:
- 🏛️ **COMPLIANCE RATING**: [PASSED / NEEDS AMENDMENT / CRITICAL OMISSIONS]
- 📋 **KEY AUDIT FINDINGS**: (Bullet points of what is correct vs what is missing)
- ⚖️ **REQUIRED PROCEDURAL CORRECTIONS**: (Specific statutory sections or clauses to add)
- 📝 **RECOMMENDED REVISED CLAUSES**: (Exact replacement text snippets for prayers or grounds)`;

    userPrompt = `${matterInfo}
DRAFT DOCUMENT TO AUDIT:
${docText}`;
  } else if (action === 'adjust_tone') {
    systemPrompt = `You are an executive legal editor for Sam Ogola & Co. Advocates.
Adjust the tone of the provided document to match the target style:
- 'aggressive': Firm, assertive, uncompromising legal demand emphasizing imminent litigation, personal liability, penalty interest, and indemnity costs.
- 'formal': Dignified, structured, respectful High Court / Appellate pleading following standard judicial etiquette.
- 'conciliatory': Open, pragmatic, without-prejudice settlement proposal emphasizing commercial resolution, mutual release of claims, and avoidance of protracted litigation costs.

Return ONLY the rewritten document in plain text.`;

    userPrompt = `${matterInfo}
TARGET TONE: ${tone.toUpperCase()}
CURRENT DOCUMENT:
${docText}`;
  } else if (action === 'plain_summary') {
    systemPrompt = `You are a Client Care Legal Specialist at Sam Ogola & Co. Advocates.
Read this legal document and write a clean, empathetic, plain-English summary for the client that can be sent via WhatsApp or Email.
Rules:
- Eliminate complex Latin terms (e.g. explain 'ex-parte', 'prima facie', 'inter-partes' in plain terms).
- Clearly explain: (1) What this document is, (2) What we are asking the court/party to do, (3) What happens next, (4) If any action is required from the client.
- Include advocate sign-off.`;

    userPrompt = `${matterInfo}
LEGAL DOCUMENT:
${docText}`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const result = await callGroqApi(GROQ_SOCA_API_KEY, 'groq/compound', messages);
  return result.trim();
}

/**
 * 5. Client-Facing WhatsApp AI Care Assistant (Fast, Token-Efficient Fallback)
 */
async function chatWithClientAi({ clientName, clientMessage, matterContext, conversationHistory = [] }) {
  const systemPrompt = `You are the Client Care AI Assistant for Sam Ogola & Co. Advocates (Nairobi, Kenya) communicating with a client on WhatsApp.

FIRM INFORMATION:
- Law Firm: Sam Ogola & Co. Advocates
- Location: Legacy Plaza, 2nd Floor, Suite 12, Thindigua, along Kiambu Road, Nairobi
- Telephone: +254 700 000 000 | Email: info@samogola.co.ke
- Managing Partner: Sam Ogola, Advocate

ACTIVE MATTER CONTEXT FOR THIS CLIENT:
${matterContext ? `
- Client Name: ${clientName || 'Client'}
- Matter: ${matterContext.case_title || 'General Representation'}
- Case Number / Ref: ${matterContext.judiciary_case_id || matterContext.tracking_token || 'Pending'}
- Court Station: ${matterContext.court_station || 'Milimani Law Courts'}
- Assigned Advocate: ${matterContext.assigned_lawyer || 'Sam Ogola, Advocate'}
- Current Phase / Milestone: ${matterContext.current_milestone || 'In Progress'}
- Next Scheduled Hearing/Mention: ${matterContext.next_hearing_date ? `${matterContext.next_hearing_date} (${matterContext.next_hearing_type || 'Mention'})` : 'Awaiting registry date fixing'}
- Hearing Mode / Virtual Link: ${matterContext.teams_link ? `Virtual (MS Teams: ${matterContext.teams_link})` : 'Physical Court Attendance'}
- Previous Hearing Brief: ${matterContext.last_hearing_brief || 'Pleadings closed, awaiting directions'}
- Total Agreed Fee: KES ${matterContext.total_fee || 'Per Retainer'}
- Outstanding Balance: KES ${matterContext.outstanding_balance || '0'}
- Payment Channel: M-PESA Paybill: 553388, Account: ${matterContext.tracking_token || 'FIRM'}
- KYC Compliance: ${matterContext.id_number && matterContext.kra_pin ? 'Fully Verified (ID & KRA PIN recorded)' : 'Incomplete (National ID or KRA PIN pending)'}
` : 'No active matter linked to this phone number. General firm inquiry.'}

RULES FOR CLIENT WHATSAPP CONVERSATION:
1. Tone: Polite, warm, professional, reassuring, and empathetic. Answer in clear plain English (or Swahili if client speaks Swahili).
2. Accuracy: Ground all factual answers in the provided matter context.
3. If the client asks about previous proceedings, summarize the hearing brief simply.
4. If the client asks about fees or balances, give the exact numbers and M-PESA payment instructions.
5. If the client asks about KYC, explain which documents we need (National ID copy, KRA PIN certificate).
6. CRITICAL LEGAL BOUNDARY: Do NOT give unilateral binding legal advice, make promises on trial outcomes, or advise the client to settle without instructions. For complex legal strategies, inform the client that their Advocate on record (${matterContext?.assigned_lawyer || 'Sam Ogola, Advocate'}) will review and follow up with them.
7. Keep responses concise and formatted cleanly with WhatsApp emojis and bullet points for mobile reading.`;

  const trimmedHistory = (conversationHistory || []).slice(-4).map(m => ({
    role: m.role,
    content: m.content
  }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory,
    { role: 'user', content: clientMessage }
  ];

  const response = await callGroqApi(GROQ_SOCA_API_KEY, 'qwen/qwen3.6-27b', messages);
  return stripThinkingTokens(response);
}

module.exports = {
  parseDocumentWithLlm,
  chatWithSocaPa,
  performWebSearch,
  draftOrRefineDocumentWithLlm,
  chatWithClientAi
};

