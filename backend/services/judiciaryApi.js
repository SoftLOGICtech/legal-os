// backend/services/judiciaryApi.js — Kenya Judiciary REST API Driver (Production & Sandbox Engine)
const fetch = require('node-fetch');

class JudiciaryApiService {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.JUDICIARY_API_BASE_URL || 'https://efiling.court.go.ke/api/v1';
    this.pNumber = config.pNumber || process.env.JUDICIARY_P_NUMBER || '';
    this.apiKey = config.apiKey || process.env.JUDICIARY_API_KEY || '';
    this.mode = config.mode || process.env.JUDICIARY_API_MODE || 'sandbox'; // 'production' | 'sandbox'
    this.token = null;
    this.tokenExpiry = null;
  }

  // OAuth2 Bearer Token Authentication
  async authenticate(password) {
    if (this.mode === 'sandbox') {
      this.token = `sandbox_bearer_${Date.now()}`;
      this.tokenExpiry = Date.now() + 3600 * 1000;
      return { success: true, token: this.token, mode: 'sandbox', message: 'Connected to Judiciary Sandbox API' };
    }

    try {
      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_number: this.pNumber,
          api_key: this.apiKey,
          password: password
        })
      });

      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.message || 'Judiciary API Authentication Failed');
      }

      this.token = data.token;
      this.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
      return { success: true, token: this.token, mode: 'production' };
    } catch (err) {
      console.error('[Judiciary API Auth Error]:', err.message);
      return { success: false, error: err.message };
    }
  }

  // Live CTS Case Status & Milestone Lookup
  async fetchCaseDetails(judiciaryCaseId) {
    if (!judiciaryCaseId) throw new Error('Judiciary Case ID is required');

    if (this.mode === 'sandbox') {
      // Realistic Sandbox Response modeled after Kenya eFiling CTS returns
      return {
        success: true,
        source: 'sandbox',
        judiciary_case_id: judiciaryCaseId,
        court_station: 'Milimani Commercial & Tax Division',
        assigned_judge: 'Hon. Justice F. Muchelule',
        court_division: 'Commercial & Admiralty',
        case_status: 'ACTIVE_HEARING_PHASE',
        next_mention_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
        virtual_court_link: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_Judiciary_Milimani_Court_4',
        last_updated: new Date().toISOString()
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/cts/cases/lookup?case_id=${encodeURIComponent(judiciaryCaseId)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'X-API-KEY': this.apiKey
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch CTS case data');
      return { success: true, source: 'production', ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Paybill 553388 & PRN Fee Verification
  async verifyPrn(prnNumber, mpesaRef) {
    if (this.mode === 'sandbox') {
      return {
        success: true,
        source: 'sandbox',
        prn_number: prnNumber || 'PRN-2026-8891',
        mpesa_ref: mpesaRef || 'SGH8923JKL',
        amount_paid: 3450,
        paybill: '553388',
        payment_status: 'CONFIRMED_SETTLED',
        receipt_issued: true,
        receipt_number: `JUD-RCT-${Math.floor(100000 + Math.random() * 900000)}`,
        verified_at: new Date().toISOString()
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/finance/verify-prn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ prn_number: prnNumber, mpesa_ref: mpesaRef })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'PRN verification failed');
      return { success: true, source: 'production', ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = JudiciaryApiService;
