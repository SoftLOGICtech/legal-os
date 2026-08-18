/**
 * Legal OS Synthetic Advocate Testing Agent - Database & State Verifier
 * Verifies backend database state via API query or direct DB connection
 */

const fetch = require('node-fetch');

class DbVerifier {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async fetchCases() {
    try {
      const res = await fetch(`${this.baseUrl}/api/cases`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.cases || []);
    } catch (e) {
      return [];
    }
  }

  async fetchLeads() {
    try {
      const res = await fetch(`${this.baseUrl}/api/leads`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.leads || []);
    } catch (e) {
      return [];
    }
  }

  async fetchCalendar() {
    try {
      const res = await fetch(`${this.baseUrl}/api/calendar`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.events || []);
    } catch (e) {
      return [];
    }
  }

  async findCaseByTitleOrId(identifier) {
    const cases = await this.fetchCases();
    return cases.find(c => 
      c.id === identifier || 
      c.case_title === identifier || 
      c.judiciary_case_id === identifier || 
      (c.case_title && c.case_title.toLowerCase().includes(identifier.toLowerCase()))
    );
  }

  async findLeadByName(name) {
    const leads = await this.fetchLeads();
    return leads.find(l => l.full_name && l.full_name.toLowerCase().includes(name.toLowerCase()));
  }
}

module.exports = DbVerifier;
