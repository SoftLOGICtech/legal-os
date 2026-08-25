/**
 * whatsappBaileysService.js — Self-Hosted Baileys WhatsApp Gateway & Client Care AI
 * Powered by @whiskeysockets/baileys with zero Meta fees, QR code pairing,
 * deterministic keyword engine (Zero LLM/Zero Rate Limits), and AI fallback.
 *
 * RELIABILITY FIXES (v1.5.8+):
 * 1. DB-backed auth state — credentials persist across Render container restarts.
 * 2. Correct browser fingerprint (Browsers.ubuntu) — prevents WhatsApp rejecting the session mid-handshake.
 * 3. Hardened reconnect logic — handles all close codes.
 * 4. Non-client guard — bot ONLY responds to phones linked to a case or lead.
 *    All other numbers (including firm internal numbers) receive NO automatic reply.
 * 5. Incoming messages written to DB so they appear in Legal OS UI.
 */

const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  initAuthCreds,
  BufferJSON
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

let sock = null;
let qrCodeDataUrl = null;
let rawQrString = null;
let connectionStatus = 'DISCONNECTED'; // 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED'
let userPhoneNumber = null;

// ─── Firm Internal Numbers — NEVER respond automatically ─────────────────────
// Add all firm employee / internal numbers here to prevent bot auto-replies.
const FIRM_INTERNAL_NUMBERS = [
  '254768860173',  // Firm main line (Sam Ogola & Co)
  '254700000000',  // Firm office placeholder (update as needed)
];
let connectedAt = null;
let isInitializing = false;
let dbInstance = null;
let socaAiServiceInstance = null;

// Live message traffic logs (stores last 250 events)
const recentLogs = [];

// ─── DB-Backed Auth State (survives Render restarts) ─────────────────────────
/**
 * Replaces useMultiFileAuthState with a database-backed equivalent.
 * Baileys credentials are stored as JSON rows in the whatsapp_auth_state table.
 * This means a container restart on Render does NOT require re-scanning the QR.
 */
async function useDbAuthState(db) {
  // Helper: read a key from the DB
  async function readData(keyId) {
    return new Promise((resolve) => {
      db.get('SELECT key_json FROM whatsapp_auth_state WHERE key_id = ?', [keyId], (err, row) => {
        if (err || !row) return resolve(null);
        try {
          resolve(JSON.parse(row.key_json, BufferJSON.reviver));
        } catch {
          resolve(null);
        }
      });
    });
  }

  // Helper: write/update a key in the DB
  async function writeData(keyId, data) {
    return new Promise((resolve) => {
      const json = JSON.stringify(data, BufferJSON.replacer);
      db.run(
        `INSERT INTO whatsapp_auth_state (key_id, key_json, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key_id) DO UPDATE SET key_json = excluded.key_json, updated_at = CURRENT_TIMESTAMP`,
        [keyId, json],
        () => resolve()
      );
    });
  }

  // Helper: remove a key from the DB
  async function removeData(keyId) {
    return new Promise((resolve) => {
      db.run('DELETE FROM whatsapp_auth_state WHERE key_id = ?', [keyId], () => resolve());
    });
  }

  // Load or initialize credentials
  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const result = {};
          for (const id of ids) {
            const keyId = `${type}-${id}`;
            const val = await readData(keyId);
            result[id] = val;
          }
          return result;
        },
        set: async (data) => {
          for (const type of Object.keys(data)) {
            for (const id of Object.keys(data[type])) {
              const keyId = `${type}-${id}`;
              const val = data[type][id];
              if (val) {
                await writeData(keyId, val);
              } else {
                await removeData(keyId);
              }
            }
          }
        }
      }
    },
    saveCreds: async () => {
      await writeData('creds', creds);
    }
  };
}

function logMessage(direction, phone, text, handler = 'deterministic', status = 'sent', caseId = null) {
  const normPhone = normalizePhone(phone);
  const logItem = {
    id: 'wmsg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    created_at: new Date().toISOString(),
    direction, // 'incoming' | 'outgoing'
    phone: normPhone,
    text,
    handler, // 'deterministic' | 'ai' | 'broadcast' | 'manual'
    status,
    case_id: caseId
  };
  recentLogs.unshift(logItem);
  if (recentLogs.length > 250) recentLogs.pop();

  if (dbInstance) {
    dbInstance.run(
      `INSERT INTO whatsapp_messages (id, phone, direction, message_text, handler, status, case_id, sent_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [logItem.id, normPhone, direction, text, handler, status, caseId || null, direction === 'incoming' ? 'Client' : 'SocaBot'],
      (err) => {
        if (err) console.error('[WhatsApp DB] Message insert error:', err.message);
      }
    );
  }
}

async function getConversationHistory(phone, limit = 100) {
  if (!dbInstance) return recentLogs.filter(l => l.phone.includes(normalizePhone(phone).slice(-9)));
  const normPhone = normalizePhone(phone);
  const suffix = normPhone.slice(-9);
  return new Promise((resolve) => {
    dbInstance.all(
      `SELECT * FROM whatsapp_messages 
       WHERE phone LIKE ? 
       ORDER BY created_at ASC LIMIT ?`,
      [`%${suffix}%`, limit],
      (err, rows) => {
        if (err || !rows || rows.length === 0) {
          const mem = recentLogs.filter(l => l.phone.includes(suffix)).reverse();
          resolve(mem.map(m => ({
            id: m.id,
            phone: m.phone,
            direction: m.direction,
            message_text: m.text,
            handler: m.handler,
            status: m.status || 'sent',
            created_at: m.created_at || new Date().toISOString()
          })));
        } else {
          resolve(rows);
        }
      }
    );
  });
}

// Conversation history cache per phone number (keeps last 6 messages)
const clientChatMemory = new Map();

// Helper: Normalize phone numbers to Kenyan standard (254XXXXXXXXX)
function normalizePhone(phoneStr) {
  if (!phoneStr) return '';
  let digits = phoneStr.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '254' + digits.slice(1);
  if (digits.startsWith('7') && digits.length === 9) digits = '254' + digits;
  if (digits.startsWith('1') && digits.length === 9) digits = '254' + digits;
  return digits;
}

// Helper: Find case linked to phone number or token
async function findCaseForMessage(senderPhone, messageText) {
  if (!dbInstance) return null;
  const cleanPhone = normalizePhone(senderPhone);

  // 1. Check if message contains a specific tracking token (e.g. SO-1/26 or Case ID)
  const tokenMatch = messageText.match(/SO-\d+\/\d+/i) || messageText.match(/MIL-[A-Z0-9-]+/i);
  if (tokenMatch) {
    const token = tokenMatch[0].toUpperCase();
    const tokenCase = await new Promise(res => {
      dbInstance.get('SELECT * FROM case_tracking WHERE UPPER(tracking_token) = ? OR UPPER(judiciary_case_id) = ? OR UPPER(ref_no) = ?', [token, token, token], (err, row) => res(row || null));
    });
    if (tokenCase) return tokenCase;
  }

  // 2. Lookup by phone number in case_tracking
  if (cleanPhone) {
    const phoneCase = await new Promise(res => {
      dbInstance.get(
        `SELECT * FROM case_tracking 
         WHERE REPLACE(REPLACE(client_phone, '+', ''), ' ', '') LIKE ? 
            OR REPLACE(REPLACE(alternative_phone, '+', ''), ' ', '') LIKE ? 
         ORDER BY id DESC LIMIT 1`,
        [`%${cleanPhone.slice(-9)}%`, `%${cleanPhone.slice(-9)}%`],
        (err, row) => res(row || null)
      );
    });
    if (phoneCase) return phoneCase;
  }

  // 3. Also check leads table (potential clients not yet converted to full matters)
  if (cleanPhone) {
    const leadContact = await new Promise(res => {
      dbInstance.get(
        `SELECT id, full_name AS client_name, phone AS client_phone, description AS case_title,
                NULL AS judiciary_case_id, NULL AS tracking_token, NULL AS court_station,
                NULL AS assigned_lawyer, NULL AS current_milestone, NULL AS total_fee,
                NULL AS outstanding_balance, NULL AS id_number, NULL AS kra_pin,
                NULL AS case_brief
         FROM leads
         WHERE REPLACE(REPLACE(phone, '+', ''), ' ', '') LIKE ?
           AND (status IS NULL OR status != 'converted')
         ORDER BY id DESC LIMIT 1`,
        [`%${cleanPhone.slice(-9)}%`],
        (err, row) => res(row || null)
      );
    });
    if (leadContact) return leadContact;
  }

  return null;
}


// Helper: Fetch upcoming court events for a case
async function getUpcomingEventsForCase(caseId) {
  if (!dbInstance || !caseId) return [];
  return new Promise(res => {
    dbInstance.all(
      `SELECT * FROM court_calendar 
       WHERE case_id = ? AND date(event_date) >= date('now')
       ORDER BY event_date ASC LIMIT 3`,
      [caseId],
      (err, rows) => res(rows || [])
    );
  });
}

// ─── Deterministic Response Generator (Zero AI / Instant) ───────────────────
async function handleDeterministicResponse(messageText, matterCase) {
  const msg = messageText.trim().toUpperCase();

  // 1. HELP / MENU / START
  if (['HI', 'HELLO', 'HELP', 'MENU', 'HABARI', 'START'].includes(msg)) {
    return `⚖️ *SAM OGOLA & CO. ADVOCATES — CLIENT DESK*

Karibu! I am the automated client service assistant for Sam Ogola & Co. Advocates.

Here is what you can check 24/7 by sending a keyword:
• *STATUS* — Check active matter progress & milestone
• *HEARING* — View upcoming court mentions & Teams link
• *FEES* — Check fee note, payments & outstanding balance
• *KYC* — Verify if your required documents are complete
• *ADVOCATE* — Get direct contact for your assigned lawyer

${matterCase ? `📌 *Active Matter Linked:* ${matterCase.client_name} (${matterCase.judiciary_case_id || matterCase.tracking_token})` : `💡 _You can also send your tracking token (e.g. *SO-1/26*) anytime._`}

_You can also ask any question in plain English or Swahili!_`;
  }

  // 2. STATUS / PROGRESS / TRACK
  if (msg.includes('STATUS') || msg.includes('TRACK') || msg.includes('PROGRESS') || msg.includes('STAGE')) {
    if (!matterCase) {
      return `⚠️ No active legal matter is linked to this phone number. Please send your tracking token (e.g., *SO-1/26*) or call our office at +254 700 000 000.`;
    }
    return `📁 *MATTER STATUS REPORT — SAM OGOLA & CO.*

• *Client:* ${matterCase.client_name}
• *Matter:* ${matterCase.case_title}
• *Judiciary Case No:* ${matterCase.judiciary_case_id || 'Pending Registry Number'}
• *Tracking Ref:* ${matterCase.tracking_token || 'SO-FIRM'}
• *Court Station:* ${matterCase.court_station || 'Milimani Law Courts'}
• *Current Milestone:* Phase ${matterCase.current_milestone || '1'} (${matterCase.current_milestone === 'CLOSED' ? 'Closed & Archived' : 'Active Litigation'})
• *Assigned Advocate:* ${matterCase.assigned_lawyer || 'Sam Ogola, Advocate'}

_Send *HEARING* for upcoming court dates, or *FEES* for payment details._`;
  }

  // 3. HEARING / DATES / MENTION / COURT
  if (msg.includes('HEARING') || msg.includes('MENTION') || msg.includes('DATE') || msg.includes('COURT')) {
    if (!matterCase) {
      return `⚠️ Please send your tracking token (e.g., *SO-1/26*) to view court dates.`;
    }
    const events = await getUpcomingEventsForCase(matterCase.id);
    if (events.length === 0) {
      return `🏛️ *COURT SCHEDULE — ${matterCase.client_name.toUpperCase()}*

Judiciary Case No: ${matterCase.judiciary_case_id || matterCase.tracking_token}
Presiding Station: ${matterCase.court_station || 'Milimani Law Courts'}

No upcoming court mention is currently on the cause list. Our registry clerk is following up with the Deputy Registrar for the next allocation date.`;
    }

    const eventList = events.map((ev, i) => `
${i + 1}. *${ev.event_title || 'Court Mention'}*
   📅 *Date:* ${ev.event_date} at ${ev.event_time || '09:00 AM'}
   🏛️ *Station:* ${ev.court_station || matterCase.court_station || 'Milimani'}
   ⚖️ *Judge/Magistrate:* ${ev.assigned_judge || matterCase.assigned_judge || 'Hon. Court'}
   ${ev.teams_link ? `🔗 *Virtual Link:* ${ev.teams_link}` : '📍 *Attendance:* Physical Courtroom'}`).join('\n');

    return `🏛️ *UPCOMING COURT PROCEEDINGS — SAM OGOLA & CO.*
${eventList}

_Advocate on Record:_ ${matterCase.assigned_lawyer || 'Sam Ogola, Advocate'}`;
  }

  // 4. FEES / BALANCE / INVOICE / PAYMENT / MPESA
  if (msg.includes('FEE') || msg.includes('BALANCE') || msg.includes('PAY') || msg.includes('INVOICE') || msg.includes('MPESA')) {
    if (!matterCase) {
      return `💳 *FIRM REMITTANCE DETAILS*

Sam Ogola & Co. Advocates
• M-PESA Paybill / Business No: *553388*
• Account No: *[Your Name or Matter Token]*
• Bank Account: Direct Escrow Available upon Request`;
    }
    const totalFee = parseFloat(matterCase.total_fee) || 0;
    const balance = parseFloat(matterCase.outstanding_balance) || 0;
    const paid = totalFee - balance;

    return `💳 *FEE STATEMENT & PAYMENT INSTRUCTIONS*

• *Client Name:* ${matterCase.client_name}
• *Matter Ref:* ${matterCase.tracking_token || 'SO-FEE'}
• *Agreed Retainer Fee:* KES ${totalFee.toLocaleString()}
• *Total Paid to Date:* KES ${(paid > 0 ? paid : 0).toLocaleString()}
• *Outstanding Balance Due:* KES ${balance.toLocaleString()}

*REMITTANCE CHANNELS:*
📱 *M-PESA Paybill:* 553388
📝 *Account Number:* ${matterCase.tracking_token || matterCase.id}
🏦 *Client Trust Bank:* Sam Ogola & Co Advocates Operating Account

_Official receipts are automatically generated and linked to your case file._`;
  }

  // 5. KYC / DOCUMENTS / REQUIREMENTS
  if (msg.includes('KYC') || msg.includes('DOCUMENT') || msg.includes('ID') || msg.includes('PIN')) {
    if (!matterCase) {
      return `📋 *CLIENT ONBOARDING REQUIREMENTS*

To onboard a new matter with Sam Ogola & Co. Advocates, please provide:
1. National ID / Passport copy
2. KRA PIN Certificate
3. Brief summary of the legal dispute or contract
4. Any relevant agreements, receipts, or demand letters`;
    }

    const hasId = !!matterCase.id_number;
    const hasKra = !!matterCase.kra_pin;

    return `📋 *KYC & FILE STATUS — ${matterCase.client_name.toUpperCase()}*

• National ID: ${hasId ? `✅ Recorded (${matterCase.id_number})` : '❌ Missing (Please send clear copy)'}
• KRA PIN: ${hasKra ? `✅ Recorded (${matterCase.kra_pin})` : '❌ Missing (Please provide KRA PIN)'}
• Contact Phone: ✅ ${matterCase.client_phone || 'On Record'}
• Email: ${matterCase.client_email ? `✅ ${matterCase.client_email}` : '⚠️ Not on record'}

${(!hasId || !hasKra) ? '💡 _You can send a photo of your National ID or KRA PIN directly on this chat to update your file._' : '🎉 _All mandatory regulatory compliance records for your matter are up to date._'}`;
  }

  // 6. ADVOCATE / LAWYER / CONTACT
  if (msg.includes('ADVOCATE') || msg.includes('LAWYER') || msg.includes('COUNSEL') || msg.includes('CALL')) {
    return `⚖️ *YOUR DEDICATED LEGAL COUNSEL*

• *Assigned Advocate:* ${matterCase?.assigned_lawyer || 'Sam Ogola, Advocate (Managing Partner)'}
• *Chambers:* Legacy Plaza, 2nd Floor, Suite 12, Thindigua, along Kiambu Road, Nairobi
• *Official Phone:* +254 700 000 000
• *Email:* info@samogola.co.ke
• *Office Hours:* Monday – Friday, 8:00 AM – 5:00 PM`;
  }

  return null; // Delegate to AI fallback
}

// ─── Baileys Connection Initializer ──────────────────────────────────────────
async function initBaileys({ db, socaAiService, forceFresh = false } = {}) {
  if (isInitializing) return;
  if (sock && connectionStatus === 'CONNECTED') {
    return; // Already cleanly connected
  }

  isInitializing = true;
  dbInstance = db || dbInstance;
  socaAiServiceInstance = socaAiService || socaAiServiceInstance;

  // Clean up any stale socket before initializing
  if (sock) {
    try { sock.ev.removeAllListeners(); sock.end(); } catch (e) {}
    sock = null;
  }

  // If forceFresh, clear all DB auth state keys so a new QR is generated
  if (forceFresh && dbInstance) {
    await new Promise((resolve) => {
      dbInstance.run('DELETE FROM whatsapp_auth_state', [], () => resolve());
    });
    console.log('🧹 Purged stale WhatsApp DB auth state for fresh pairing.');
  }

  // Also clean up legacy file-based auth directory if it still exists
  const legacyAuthDir = path.join(__dirname, '..', 'auth_info_baileys');
  if (fs.existsSync(legacyAuthDir)) {
    try {
      fs.rmSync(legacyAuthDir, { recursive: true, force: true });
      console.log('🧹 Removed legacy file-based WhatsApp auth directory.');
    } catch (e) {}
  }

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Starting Baileys WhatsApp Engine (v${version.join('.')}, isLatest: ${isLatest})...`);

  // Use DB-backed auth state so credentials survive Render container restarts
  const { state, saveCreds } = await useDbAuthState(dbInstance);

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    // Use the standard Ubuntu/Chrome fingerprint that WhatsApp expects.
    // Custom browser names ('Legal OS') cause the server to reject the session mid-handshake.
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    // Prevents Baileys from marking messages as delivered before we process them
    markOnlineOnConnect: false,
    // Retries failed message sends
    retryRequestDelayMs: 250
  });

  connectionStatus = 'CONNECTING';

  // ── Connection Update Listener ──
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      connectionStatus = 'QR_READY';
      rawQrString = qr;
      try {
        qrCodeDataUrl = await qrcode.toDataURL(qr, { margin: 2, scale: 6 });
        console.log('📱 Baileys WhatsApp QR Code generated for pairing!');
      } catch (err) {
        console.error('Failed to generate QR code data URL, using QR Server fallback:', err.message);
        qrCodeDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qr)}`;
      }
    }

    if (connection === 'close') {
      isInitializing = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
      const isReplaced = statusCode === 440; // Another device/session replaced this one

      console.log(`Baileys connection closed. Status code: ${statusCode || 'unknown'}`);

      if (isLoggedOut) {
        // User explicitly logged out from their phone — clear all stored creds
        connectionStatus = 'DISCONNECTED';
        qrCodeDataUrl = null;
        rawQrString = null;
        userPhoneNumber = null;
        if (dbInstance) {
          dbInstance.run('DELETE FROM whatsapp_auth_state', [], () => {
            console.log('🧹 Cleared WhatsApp DB auth state after logout.');
          });
        }
      } else if (isReplaced) {
        // Session was replaced by another device — do not reconnect automatically
        connectionStatus = 'DISCONNECTED';
        qrCodeDataUrl = null;
        rawQrString = null;
        userPhoneNumber = null;
        console.log('⚠️ WhatsApp session replaced by another client. Please reconnect manually.');
      } else {
        // Network drop, server-side disconnect, Render container restart, etc.
        // Reconnect automatically using stored DB credentials (no new QR needed)
        connectionStatus = 'DISCONNECTED';
        console.log('🔄 Temporary disconnect detected. Reconnecting in 8 seconds...');
        setTimeout(() => {
          if (connectionStatus !== 'CONNECTED') {
            initBaileys({ db: dbInstance, socaAiService: socaAiServiceInstance });
          }
        }, 8000);
      }
    } else if (connection === 'open') {
      isInitializing = false;
      connectionStatus = 'CONNECTED';
      qrCodeDataUrl = null;
      rawQrString = null;
      connectedAt = new Date().toISOString();
      userPhoneNumber = sock.user?.id ? sock.user.id.split(':')[0].replace(/\D/g, '') : 'Linked Phone';
      console.log(`✅ Baileys WhatsApp Gateway CONNECTED as: ${userPhoneNumber}`);
    }
  });

  // ── Credentials Save Listener ──
  sock.ev.on('creds.update', saveCreds);

  // ── Incoming Message Listener ──
  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (m.type !== 'notify') return;
      const msgObj = m.messages[0];
      if (!msgObj || msgObj.key.fromMe) return; // Ignore own sent messages

      const senderJid = msgObj.key.remoteJid;
      if (!senderJid || senderJid.includes('@g.us') || senderJid.includes('status@broadcast')) return; // Ignore groups and status updates

      const senderPhone = senderJid.split('@')[0];
      const normalizedSender = normalizePhone(senderPhone);

      const messageText = msgObj.message?.conversation || 
                          msgObj.message?.extendedTextMessage?.text || 
                          msgObj.message?.imageMessage?.caption || '';

      if (!messageText.trim()) return;

      console.log(`📩 WhatsApp received from [${normalizedSender}]: "${messageText}"`);

      // ── Guard 1: Never auto-reply to firm internal numbers ──
      if (FIRM_INTERNAL_NUMBERS.includes(normalizedSender)) {
        // Still log it so it appears in Legal OS, but no bot reply
        logMessage('incoming', normalizedSender, messageText, 'internal');
        console.log(`🏢 Internal message from firm number [${normalizedSender}] — logged only, no auto-reply.`);
        return;
      }

      // ── Log incoming to DB (direction = 'incoming') ──
      // This is what makes them appear in Legal OS WhatsApp Hub.
      logMessage('incoming', normalizedSender, messageText, 'received');

      // ── Guard 2: Per-contact mute check ──
      // Advocates can mute the bot for any specific contact from the WhatsApp Hub UI.
      // The message is still logged above so it appears in Legal OS, but no reply is sent.
      if (dbInstance) {
        const isMuted = await new Promise(res => {
          dbInstance.get(
            'SELECT phone FROM whatsapp_muted_contacts WHERE phone LIKE ?',
            [`%${normalizedSender.slice(-9)}%`],
            (err, row) => res(!!row)
          );
        });
        if (isMuted) {
          console.log(`🔕 Bot muted for [${normalizedSender}] — message logged, no auto-reply.`);
          return;
        }
      }

      // 1. Lookup Matter Context (case or lead linked to this phone)
      const matterCase = await findCaseForMessage(normalizedSender, messageText);

      // ── Guard 3: Only auto-reply to known clients (linked to a case or lead) ──
      // Strangers, cold contacts, and colleagues get NO bot response.
      // Exception: if the message contains a valid tracking token, treat as client inquiry.
      const hasTrackingToken = !!(messageText.match(/SO-\d+\/\d+/i) || messageText.match(/MIL-[A-Z0-9-]+/i));
      if (!matterCase && !hasTrackingToken) {
        console.log(`🔇 Unknown sender [${normalizedSender}] — no case/lead linked, no auto-reply.`);
        return;
      }


      const clientName = matterCase?.client_name || 'Client';

      // 2. Try Deterministic Keyword Handler first (zero API cost, instant)
      const deterministicReply = await handleDeterministicResponse(messageText, matterCase);

      if (deterministicReply) {
        await sock.sendMessage(senderJid, { text: deterministicReply });
        logMessage('outgoing', normalizedSender, deterministicReply, 'deterministic');
        console.log(`⚡ Deterministic reply sent to [${normalizedSender}]`);
        return;
      }

      // 3. Fallback: AI Client Care Assistant (for open-ended questions not matched by keywords)
      if (socaAiServiceInstance?.chatWithClientAi) {
        const history = clientChatMemory.get(normalizedSender) || [];
        const upcomingEvents = matterCase ? await getUpcomingEventsForCase(matterCase.id) : [];

        const matterContext = matterCase ? {
          case_title: matterCase.case_title,
          judiciary_case_id: matterCase.judiciary_case_id,
          tracking_token: matterCase.tracking_token,
          court_station: matterCase.court_station,
          assigned_lawyer: matterCase.assigned_lawyer,
          current_milestone: matterCase.current_milestone,
          next_hearing_date: upcomingEvents[0]?.event_date,
          next_hearing_type: upcomingEvents[0]?.event_title,
          teams_link: upcomingEvents[0]?.teams_link,
          last_hearing_brief: matterCase.case_brief,
          total_fee: matterCase.total_fee,
          outstanding_balance: matterCase.outstanding_balance,
          id_number: matterCase.id_number,
          kra_pin: matterCase.kra_pin
        } : null;

        const aiReply = await socaAiServiceInstance.chatWithClientAi({
          clientName,
          clientMessage: messageText,
          matterContext,
          conversationHistory: history
        });

        // Update 6-message rolling memory per phone
        history.push({ role: 'user', content: messageText });
        history.push({ role: 'assistant', content: aiReply });
        clientChatMemory.set(normalizedSender, history.slice(-6));

        await sock.sendMessage(senderJid, { text: aiReply });
        logMessage('outgoing', normalizedSender, aiReply, 'ai');
        console.log(`🤖 AI Client Care reply sent to [${normalizedSender}]`);
      } else {
        // AI service not available — log that we couldn't respond
        console.warn(`[WhatsApp] AI service unavailable for message from [${normalizedSender}]. Message logged only.`);
      }
    } catch (err) {
      console.error('Error handling incoming WhatsApp message:', err);
    }
  });
}

// ─── Automated Court Date / Mention Reminders Dispatcher ─────────────────────
async function sendCourtReminders(daysAhead = 1) {
  if (!sock || connectionStatus !== 'CONNECTED' || !dbInstance) {
    return { sent: 0, error: 'WhatsApp gateway not connected or DB not initialized' };
  }

  return new Promise((resolve) => {
    // Scan calendar events occurring in N days
    const query = `
      SELECT e.*, c.client_name, c.client_phone, c.alternative_phone, c.court_station, c.assigned_judge, c.judiciary_case_id, c.tracking_token, c.assigned_lawyer
      FROM court_calendar e
      JOIN case_tracking c ON e.case_id = c.id
      WHERE date(e.event_date) = date('now', '+${daysAhead} day')
    `;

    dbInstance.all(query, [], async (err, rows) => {
      if (err) {
        console.error('Failed to query reminder events:', err);
        return resolve({ sent: 0, error: err.message });
      }

      let sentCount = 0;
      for (const ev of (rows || [])) {
        const rawPhones = [];
        if (ev.client_phone) rawPhones.push(...ev.client_phone.split(/[,;]+/));
        if (ev.alternative_phone) rawPhones.push(...ev.alternative_phone.split(/[,;]+/));
        const uniquePhones = [...new Set(rawPhones.map(p => normalizePhone(p)).filter(Boolean))];

        for (const normalized of uniquePhones) {
          const jid = `${normalized}@s.whatsapp.net`;

          const reminderText = `⚖️ *COURT HEARING REMINDER — SAM OGOLA & CO. ADVOCATES*

Dear *${ev.client_name}*,

This is an automated reminder regarding your upcoming court appearance tomorrow:

• *Matter Ref:* ${ev.judiciary_case_id || ev.tracking_token}
• *Event:* ${ev.event_title || 'Court Mention'}
• *Date:* ${ev.event_date} at ${ev.event_time || '09:00 AM'}
• *Court Station:* ${ev.court_station || 'Milimani Law Courts'}
• *Presiding Judge:* ${ev.assigned_judge || 'Hon. Court'}
${ev.teams_link ? `• 🔗 *Virtual Hearing Link:* ${ev.teams_link}` : '• 📍 *Mode:* Physical Courtroom Attendance'}

_Assigned Counsel:_ ${ev.assigned_lawyer || 'Sam Ogola, Advocate'}
_Please ensure all relevant exhibits and identification documents are ready._`;

          try {
            await sock.sendMessage(jid, { text: reminderText });
            logMessage('outgoing', normalized, reminderText, 'broadcast');
            sentCount++;
            console.log(`📢 Automated Court Reminder sent to ${ev.client_name} (${normalized})`);
          } catch (e) {
            console.error(`Failed to send reminder to ${normalized}:`, e.message);
          }
        }
      }

      resolve({ sent: sentCount, total: (rows || []).length });
    });
  });
}

// ─── Direct Outgoing Message Methods ─────────────────────────────────────────
async function sendTextMessage(phoneStr, text) {
  if (!sock || connectionStatus !== 'CONNECTED') {
    throw new Error('WhatsApp gateway is currently disconnected. Please scan the QR code first.');
  }
  const clean = normalizePhone(phoneStr);
  const jid = `${clean}@s.whatsapp.net`;
  const res = await sock.sendMessage(jid, { text });
  logMessage('outgoing', clean, text, 'manual');
  return res;
}

async function sendDocumentMessage(phoneStr, buffer, fileName, caption = '') {
  if (!sock || connectionStatus !== 'CONNECTED') {
    throw new Error('WhatsApp gateway is currently disconnected.');
  }
  const clean = normalizePhone(phoneStr);
  const jid = `${clean}@s.whatsapp.net`;
  const res = await sock.sendMessage(jid, {
    document: buffer,
    mimetype: 'application/pdf',
    fileName: fileName || 'Legal_Document.pdf',
    caption: caption
  });
  logMessage('outgoing', clean, `[Document: ${fileName}] ${caption}`, 'manual');
  return res;
}

function getConnectionStatus() {
  return {
    status: connectionStatus,
    qr: qrCodeDataUrl,
    rawQr: rawQrString,
    phoneNumber: userPhoneNumber,
    connectedAt: connectedAt,
    deviceInfo: userPhoneNumber ? {
      phone: userPhoneNumber,
      name: 'Sam Ogola & Co Firm WhatsApp Bot',
      platform: 'WhatsApp Multi-Device Web Gateway',
      connectedAt: connectedAt
    } : null,
    logs: recentLogs
  };
}

async function disconnectBaileys() {
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {}
    try {
      sock.ev.removeAllListeners();
      sock.end();
    } catch (e) {}
    sock = null;
  }
  // Clear DB auth state
  if (dbInstance) {
    await new Promise((resolve) => {
      dbInstance.run('DELETE FROM whatsapp_auth_state', [], () => resolve());
    });
  }
  // Also remove any legacy file auth if present
  const legacyAuthDir = path.join(__dirname, '..', 'auth_info_baileys');
  if (fs.existsSync(legacyAuthDir)) {
    try { fs.rmSync(legacyAuthDir, { recursive: true, force: true }); } catch (e) {}
  }
  connectionStatus = 'DISCONNECTED';
  qrCodeDataUrl = null;
  rawQrString = null;
  userPhoneNumber = null;
  connectedAt = null;
  isInitializing = false;
}

module.exports = {
  initBaileys,
  sendCourtReminders,
  sendTextMessage,
  sendDocumentMessage,
  getConnectionStatus,
  getConversationHistory,
  disconnectBaileys
};
