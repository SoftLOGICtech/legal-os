const https = require('https');
const fs = require('fs');
const path = require('path');

function sanitizeApiKey(k) {
  if (!k || typeof k !== 'string') return '';
  return k
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^bearer\s+/i, '')
    .replace(/\\n|\\r/g, '')
    .trim();
}

function getAvailableApiKeys(preferredKey = '') {
  const candidates = [
    preferredKey,
    process.env.GROQ_SOCA_API_KEY,
    process.env.GROQ_PDF_API_KEY,
    process.env.GROQ_API_KEY,
    process.env.GROQKEY
  ];
  
  const cleaned = candidates
    .map(sanitizeApiKey)
    .filter(k => k.startsWith('gsk_') || k.length >= 20);

  return [...new Set(cleaned)];
}

function testGroqKey(key) {
  return new Promise((resolve) => {
    const sanitized = sanitizeApiKey(key);
    if (!sanitized) return resolve({ valid: false, status: 0, error: 'Empty key' });

    const req = https.request({
      hostname: 'api.groq.com',
      port: 443,
      path: '/openai/v1/models',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${sanitized}` }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ valid: true, status: res.statusCode });
        } else {
          resolve({ valid: false, status: res.statusCode, error: body });
        }
      });
    });
    req.on('error', (err) => resolve({ valid: false, status: 500, error: err.message }));
    req.end();
  });
}

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
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'groq/compound',
  'allam-2-7b',
  'groq/compound-mini'
];

function extractJsonFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  let text = stripThinkingTokens(rawText).trim();
  
  // 1. Try markdown ```json ... ``` block
  const jsonBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlock && jsonBlock[1]) {
    try {
      return JSON.parse(jsonBlock[1].trim());
    } catch (e) {}
  }
  
  // 2. Try outermost { ... }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonSub = text.slice(firstBrace, lastBrace + 1);
      return JSON.parse(jsonSub);
    } catch (e) {}
  }
  
  // 3. Fallback direct parse
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

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

function proxyToCloudBackend(messages) {
  return new Promise((resolve, reject) => {
    const remote = process.env.REMOTE_BACKEND_URL || 'https://legal-os-lea2.onrender.com';
    let parsed;
    try {
      parsed = new URL(remote);
    } catch (e) {
      return reject(new Error('Invalid REMOTE_BACKEND_URL'));
    }

    const userMsg = messages[messages.length - 1]?.content || '';
    const history = messages.slice(0, -1);
    const payload = JSON.stringify({ message: userMsg, history });

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: '/api/soca-pa/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const client = parsed.protocol === 'https:' ? https : require('http');
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsedRes = JSON.parse(body);
          if (parsedRes.reply) resolve(stripThinkingTokens(parsedRes.reply));
          else if (parsedRes.error) reject(new Error(parsedRes.error));
          else resolve(body);
        } catch (e) {
          reject(new Error(`Cloud proxy response parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Failed to reach firm cloud AI gateway: ${err.message}`)));
    req.write(payload);
    req.end();
  });
}

function callGroqApi(preferredKey, model, messages, jsonMode = false, attemptIndex = 0, keyIndex = 0) {
  const keys = getAvailableApiKeys(preferredKey);
  const currentKey = keys[keyIndex] || '';
  const currentModel = model || GROQ_MODEL_CASCADE[attemptIndex] || GROQ_MODEL_CASCADE[0];

  return new Promise((resolve, reject) => {
    if (!currentKey) {
      if (process.env.ELECTRON_APP === 'true' && process.env.REMOTE_BACKEND_URL) {
        console.log('[Electron AI] No local key detected. Proxying to firm cloud AI gateway...');
        return proxyToCloudBackend(messages).then(resolve).catch(reject);
      }
      const err = formatExecutiveError(401, 'invalid_api_key (No Groq API keys detected in environment)');
      return reject(new Error(err));
    }

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
        'Authorization': `Bearer ${currentKey}`,
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
        } else if (res.statusCode === 401 && keyIndex < keys.length - 1) {
          console.warn(`Groq HTTP 401 on key index ${keyIndex + 1}. Cascading to next available API key...`);
          callGroqApi(keys[keyIndex + 1], currentModel, messages, jsonMode, attemptIndex, keyIndex + 1)
            .then(resolve)
            .catch(reject);
        } else if ((res.statusCode === 429 || res.statusCode === 404 || res.statusCode === 400 || res.statusCode === 413) && attemptIndex < GROQ_MODEL_CASCADE.length - 1) {
          const nextModel = GROQ_MODEL_CASCADE[attemptIndex + 1];
          console.warn(`Groq HTTP ${res.statusCode} on '${currentModel}'. Cascading to next fallback model '${nextModel}'...`);
          
          let prunedMessages = messages;
          if (res.statusCode === 413) {
            prunedMessages = messages.map(m => ({
              role: m.role,
              content: (m.content || '').length > 400 ? (m.content || '').slice(0, 400) + '...' : m.content
            }));
          }

          callGroqApi(currentKey, nextModel, prunedMessages, jsonMode, attemptIndex + 1, keyIndex)
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

// ── MULTIMODAL VISION CALL (GEMINI OR GROQ VISION) ──────────────────────────
function callMultimodalVision({ prompt, imageBase64, mimeType = 'image/jpeg', preferredKey = '' }) {
  return new Promise((resolve, reject) => {
    // 1. Check if GEMINI_API_KEY is available
    const geminiKey = sanitizeApiKey(process.env.GEMINI_API_KEY);
    if (geminiKey && geminiKey !== 'your_gemini_api_key' && geminiKey.length > 15) {
      const payload = JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64
                }
              }
            ]
          }
        ],
        generationConfig: { temperature: 0.1 }
      });

      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
              resolve(stripThinkingTokens(text));
            } catch (e) {
              fallbackToGroq();
            }
          } else {
            fallbackToGroq();
          }
        });
      });
      req.on('error', () => fallbackToGroq());
      req.write(payload);
      req.end();
      return;
    }

    fallbackToGroq();

    function fallbackToGroq() {
      const keys = getAvailableApiKeys(preferredKey);
      const currentKey = keys[0] || '';
      if (!currentKey) return reject(new Error('No API key available for Vision model'));

      const payload = JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
            ]
          }
        ],
        temperature: 0.1
      });

      const req = https.request({
        hostname: 'api.groq.com',
        port: 443,
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body);
              resolve(stripThinkingTokens(parsed.choices?.[0]?.message?.content || ''));
            } catch (e) {
              reject(new Error('Failed to parse Groq vision response'));
            }
          } else {
            reject(new Error(`Groq Vision returned HTTP ${res.statusCode}: ${body}`));
          }
        });
      });
      req.on('error', err => reject(err));
      req.write(payload);
      req.end();
    }
  });
}

/**
 * 1. LLM PDF & Multi-Format Document Parser & Dynamic Custom Fields Engine
 */
async function parseDocumentWithLlm(rawText, fileName, imageBuffer = null, mimeType = 'application/pdf') {
  const systemPrompt = `You are the Senior Legal OS Intelligence & PDF Engine specialized in Kenyan Law, Litigation Practice, and Commercial Correspondence (Civil Procedure Rules, Environment & Land Court, Commercial & Tax Division, High Court, Court of Appeal, Demand Letters, Agreements, and Pleadings).
Your task is to comprehensively analyze raw text or visual scans extracted from ANY legal document (Letter of Demand, Plaint, Chamber Summons, Motion, Notice of Hearing, Cause List, Decree, Ruling, Contract, Land Search, eFiling Receipt, or Witness Statement).

EXTRACTION REQUIREMENTS:
1. Core Standard Metadata:
   - Identify Plaintiff/Applicant/Client name vs Defendant/Respondent/Opposing party.
   - Extract opposing counsel name, law firm, phone, email, and address if mentioned or signed.
   - Extract exact court station, division, presiding judge/magistrate, case reference / judiciary case ID.
   - Extract suit value / disputed claim amount in KES.
   - Extract mention/hearing dates or compliance deadlines, plus any MS Teams virtual court link.

2. Impactful Quote & Dispute Synopsis:
   - Extract "key_quote": A prominent verbatim quote or heading excerpt showing the parties in dispute, the demand ultimatum, or the key order made.
   - Extract "cause_of_action": Core legal issue (e.g. Breach of Commercial Lease, Defamation, Trespass & Land Title Invalidation, Unfair Termination).

3. DYNAMIC CUSTOM FIELDS DISCOVERY:
   - In addition to standard fields, inspect the document and dynamically generate ANY other specific key-value pairs that are vital to this specific matter.
   - Examples of custom fields: "L.R. Land Title Number", "Tenancy Agreement Date", "Demand Notice Window", "Vehicle Reg Number", "Insurance Policy Claim No", "Statutory Notice Expiry Date", "Cheque Serial No", "Bank Account Ref", "Arbitration Clause Number", "Disputed Parcel Acreage", "Reliefs / Prayers Sought".
   - Format: Array of objects with "key", "value", and "category" ("Property" | "Contract" | "Financial" | "Procedural" | "Evidence" | "Identity").

4. Determined Actions for Active Matters:
   - Generate intelligent determined actions that will effect concrete changes in the firm's Active Matter repository (e.g. update matter metadata, add calendar mention, record opposing counsel, add key quote to chronology facts, attach custom fields to KYC dossier).

Return ONLY a valid JSON object matching this schema (do not wrap in markdown quotes):
{
  "docType": "PLEADING" | "DECREE_ORDER" | "MENTION_NOTICE" | "VIRTUAL_COURT" | "RECEIPT" | "CLIENT_KYC" | "CORRESPONDENCE" | "OTHER",
  "subType": "Specific document title (e.g. Formal Demand Letter Prior to Suit, Notice of Motion under Certificate of Urgency, Plaint, Injunction Order)",
  "case_title": "string (Concise title of the dispute or matter)",
  "judiciary_case_id": "string (e.g. MIL-COMM-E892-2024, ELC 102/2023, or HCCC 88 of 2026)",
  "client_name": "string (Plaintiff / Applicant / Sender / Client name)",
  "opposing_party": "string (Defendant / Respondent / Addressee name)",
  "opposing_counsel_name": "string (Opposing advocate name if cited)",
  "opposing_counsel_firm": "string (Opposing law firm if cited)",
  "opposing_counsel_phone": "string (Phone number if cited)",
  "opposing_counsel_email": "string (Email address if cited)",
  "opposing_counsel_address": "string (Physical/postal address if cited)",
  "court_station": "string (e.g. Milimani Law Courts, Environment and Land Court Nairobi)",
  "court_division": "string (e.g. Commercial & Admiralty, ELC, Civil)",
  "assigned_judge": "string (Judge / Magistrate name if noted)",
  "cause_of_action": "string (e.g. Breach of Contract, Recovery of Land Title, Damages for Wrongful Dismissal)",
  "key_quote": "string (Verbatim quote or excerpt demonstrating the core claim, demand, or court directive)",
  "amount": number (numeric value in KES, 0 if none),
  "payment_ref": "string (M-Pesa reference code, PRN or Cheque No)",
  "prn_number": "string (PRN / Reference No)",
  "id_number": "string (National ID / Passport No)",
  "kra_pin": "string (KRA PIN)",
  "mention_date": "string (YYYY-MM-DD or readable hearing/mention date)",
  "deadline_date": "string (YYYY-MM-DD or notice expiration deadline)",
  "teams_link": "string (MS Teams URL if present)",
  "summary": "string (Executive legal summary highlighting key facts, claims, and actions needed)",
  "custom_fields": [
    {
      "key": "string (Name of discovered attribute)",
      "value": "string (Extracted value)",
      "category": "Property" | "Contract" | "Financial" | "Procedural" | "Evidence" | "Identity"
    }
  ],
  "determined_actions": [
    {
      "id": "act_1",
      "type": "ACTION_UPDATE_MATTER" | "ACTION_ATTACH_CUSTOM_FIELDS" | "ACTION_CREATE_CALENDAR_EVENT" | "ACTION_ADD_FACT" | "ACTION_RECORD_PAYMENT" | "ACTION_CREATE_CASE",
      "title": "Short title describing the action",
      "description": "Details of what will be updated on the matter",
      "payload": { "key": "value" },
      "selected": true
    }
  ]
}`;

  // If we have an image buffer and raw text is sparse, attempt Multimodal Vision
  if (imageBuffer && (!rawText || rawText.length < 120)) {
    try {
      const imageBase64 = imageBuffer.toString('base64');
      const imgMime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
      const visionPrompt = `${systemPrompt}\n\nAnalyze this visual legal document (Filename: ${fileName}) and output ONLY the JSON object.`;
      const rawVisionResponse = await callMultimodalVision({
        prompt: visionPrompt,
        imageBase64,
        mimeType: imgMime,
        preferredKey: process.env.GROQ_PDF_API_KEY
      });

      const parsed = extractJsonFromText(rawVisionResponse);
      if (parsed) {
        if (!Array.isArray(parsed.custom_fields)) parsed.custom_fields = [];
        if (!Array.isArray(parsed.determined_actions)) parsed.determined_actions = [];
        return parsed;
      }
    } catch (visErr) {
      console.warn('[DocParser] Multimodal vision deferred to text engine:', visErr.message);
    }
  }

  const userPrompt = `Document Filename: ${fileName}\n\nRAW EXTRACTED TEXT:\n${(rawText || '').slice(0, 9500)}`;

  try {
    const rawResponse = await callGroqApi(process.env.GROQ_PDF_API_KEY, 'openai/gpt-oss-120b', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], true);

    const parsed = extractJsonFromText(rawResponse);
    if (parsed) {
      if (!Array.isArray(parsed.custom_fields)) parsed.custom_fields = [];
      if (!Array.isArray(parsed.determined_actions)) parsed.determined_actions = [];
      return parsed;
    }
    throw new Error('Could not extract JSON from model output');
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
- BREVITY & EXECUTIVE TONE: Be warm, professional, and very concise. Use few words — get straight to the point without introductory fluff or repetitive pleasantries.
- MINIMAL EMOJIS: Use at most 1 or 2 emojis per response. Never spam emojis.
- ATTACHED DOCUMENTS & VISION DIRECTIVE: You have full access to all attached documents, scans, and evidence provided in the prompt context under [ATTACHED DOCUMENT] and Document Text Preview. When a user attaches an invoice, pleading, court order, or file, NEVER say "I am text-centric" or "I cannot view files". Directly analyze the document details (parties, suit number, dates, amounts in KES, line items) and answer their questions directly!
- STRATEGIC HIGHLIGHTING: Bold the most important information only (e.g. **case titles**, **court dates**, **parties**, **deadlines**, **amounts in KES**, and **actions executed**).
- ANTI-HALLUCINATION RULE: If you are uncertain about a specific date, court station, case detail, or rule, state your uncertainty briefly rather than guessing.
- FLASH EXECUTION RULE: When asked to create a new case, add a lead, schedule a mention/court date, record a fee, lock a fact, attach/file a document, or save a cross-chat memory, YOU MUST DIRECTLY EXECUTE THE ACTION by appending a hidden JSON block at the VERY END of your message on a new line:
  <!--ACTION:{"type":"CREATE_CASE"|"CREATE_LEAD"|"CREATE_CALENDAR_EVENT"|"RECORD_PAYMENT"|"ADD_FACT"|"SAVE_MEMORY","client_name":"...","case_title":"...","case_type":"Litigation","assigned_lawyer":"Sam Ogola","full_name":"...","phone":"...","service_category":"...","message":"...","date":"YYYY-MM-DD","time":"HH:MM","description":"...","amount":1000,"reference":"...","virtual_link":"...","key":"Memory Title","value":"Memory Detail","category":"client_pref|firm_rule|general"}-->
- PERSISTENT CROSS-CHAT MEMORY RULE: When asked to remember something or when you learn a key preference/rule, use "type":"SAVE_MEMORY" action tag to store it permanently across chat sessions.
- ALWAYS ANTICIPATE FOLLOW-UP QUESTIONS: At the VERY END of your message on a new line, append 2-3 relevant contextual follow-up questions the user might want to ask next as a hidden JSON array:
  <!--SUGGESTIONS:["Question 1","Question 2","Question 3"]-->
- Confirm actions conversationally in 1 brief sentence (e.g. "I've filed that under **Milimani HCCC 124/2024**.").
- NEVER output raw developer API code blocks (\`POST /api/...\`) or tell advocates to run manual API commands.
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

  const responseText = await callGroqApi(process.env.GROQ_SOCA_API_KEY, 'groq/compound', messages);
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
ADVOCATE'S EDITING DIRECTIVES:
${userInstruction}
DESIRED TONE: ${tone}`;
  } else if (action === 'EXTRACT_FACTS_ANALYSIS') {
    systemPrompt = `You are the Lead Trial Strategist & Case Analyst.
Analyze the provided document text, pleadings, or scanned court bundle. Extract a structured factual timeline, key issues in dispute, witness commitments, and legal risk factors.
Format the output into clean, structured executive sections:
1. Chronological Timeline of Material Facts
2. Contentious Issues to be Determined by the Court
3. Witness Claims & Evidentiary Vulnerabilities
4. Statutory & Case Law Angles (Kenyan Jurisprudence)`;

    userPrompt = `${matterInfo}
SOURCE DOCUMENT / PLEADING CONTENT:
${docText || rawExtractedText}

STRATEGIC FOCUS:
${userInstruction || 'Provide a complete tactical breakdown of claims, facts, and evidentiary proof elements.'}`;
  } else if (action === 'CLIENT_PLAIN_ENGLISH_BRIEF') {
    systemPrompt = `You are a compassionate, clear-speaking Legal Client Care Partner.
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

  const result = await callGroqApi(process.env.GROQ_SOCA_API_KEY, 'groq/compound', messages);
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

  const response = await callGroqApi(process.env.GROQ_SOCA_API_KEY, 'groq/compound', messages);
  return stripThinkingTokens(response);
}

module.exports = {
  parseDocumentWithLlm,
  chatWithSocaPa,
  performWebSearch,
  draftOrRefineDocumentWithLlm,
  chatWithClientAi,
  testGroqKey
};

