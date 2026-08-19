/**
 * whatsappBaileysService.js — Self-Hosted Baileys WhatsApp Gateway & Client Care AI
 * Powered by @whiskeysockets/baileys with zero Meta fees, QR code pairing,
 * deterministic keyword engine (Zero LLM/Zero Rate Limits), and AI fallback.
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

let sock = null;
let qrCodeDataUrl = null;
let rawQrString = null;
let connectionStatus = 'DISCONNECTED'; // 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED'
let userPhoneNumber = null;
let connectedAt = null;
let isInitializing = false;
let dbInstance = null;
let socaAiServiceInstance = null;

// Live message traffic logs (stores last 250 events)
const recentLogs = [];

function logMessage(direction, phone, text, handler = 'deterministic') {
  recentLogs.unshift({
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    direction, // 'incoming' | 'outgoing'
    phone,
    text,
    handler // 'deterministic' | 'ai' | 'broadcast' | 'manual'
  });
  if (recentLogs.length > 250) recentLogs.pop();
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
async function initBaileys({ db, socaAiService }) {
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

  const authDir = path.join(__dirname, '..', 'auth_info_baileys');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`Starting Baileys WhatsApp Engine (v${version.join('.')}, isLatest: ${isLatest})...`);

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Legal OS', 'Chrome', '1.2.0'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000
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
      const isReplaced = statusCode === 440;
      const shouldReconnect = !isLoggedOut && !isReplaced;

      console.log(`Baileys connection closed (${statusCode}). Reconnecting: ${shouldReconnect}...`);
      
      if (isLoggedOut) {
        connectionStatus = 'DISCONNECTED';
        qrCodeDataUrl = null;
        rawQrString = null;
        userPhoneNumber = null;
      }

      if (shouldReconnect) {
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
      if (!msgObj || msgObj.key.fromMe) return; // Ignore own messages

      const senderJid = msgObj.key.remoteJid;
      if (!senderJid || senderJid.includes('@g.us') || senderJid.includes('status@broadcast')) return; // Ignore group chats and status updates

      const senderPhone = senderJid.split('@')[0];
      const messageText = msgObj.message?.conversation || 
                          msgObj.message?.extendedTextMessage?.text || 
                          msgObj.message?.imageMessage?.caption || '';

      if (!messageText.trim()) return;

      console.log(`📩 WhatsApp received from [${senderPhone}]: "${messageText}"`);
      logMessage('incoming', senderPhone, messageText, 'incoming');

      // 1. Lookup Matter Context
      const matterCase = await findCaseForMessage(senderPhone, messageText);
      const clientName = matterCase?.client_name || 'Client';

      // 2. Try Deterministic Keyword Handler (Zero LLM / Zero Rate Limits)
      const deterministicReply = await handleDeterministicResponse(messageText, matterCase);

      if (deterministicReply) {
        await sock.sendMessage(senderJid, { text: deterministicReply });
        logMessage('outgoing', senderPhone, deterministicReply, 'deterministic');
        console.log(`⚡ Deterministic reply sent to [${senderPhone}]`);
        return;
      }

      // 3. Fallback to Client Care AI Assistant
      if (socaAiServiceInstance?.chatWithClientAi) {
        const history = clientChatMemory.get(senderPhone) || [];
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

        // Update memory
        history.push({ role: 'user', content: messageText });
        history.push({ role: 'assistant', content: aiReply });
        clientChatMemory.set(senderPhone, history.slice(-6));

        await sock.sendMessage(senderJid, { text: aiReply });
        logMessage('outgoing', senderPhone, aiReply, 'ai');
        console.log(`🤖 AI Client Care reply sent to [${senderPhone}]`);
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
    sock = null;
    connectionStatus = 'DISCONNECTED';
    qrCodeDataUrl = null;
    userPhoneNumber = null;
  }
}

module.exports = {
  initBaileys,
  sendCourtReminders,
  sendTextMessage,
  sendDocumentMessage,
  getConnectionStatus,
  disconnectBaileys
};
