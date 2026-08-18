/**
 * Legal OS Synthetic Advocate Testing Agent - API Network Interceptor
 * Monitors network requests, records HTTP response status codes, latency, and payloads
 */

class ApiInterceptor {
  constructor() {
    this.logs = [];
    this.failures = [];
  }

  attach(page) {
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/')) {
        const request = response.request();
        let status = response.status();
        let body = null;
        
        try {
          body = await response.json();
        } catch (e) {
          // Response body might not be JSON or might be empty
        }

        const entry = {
          timestamp: new Date().toISOString(),
          method: request.method(),
          url: url.replace(/http:\/\/localhost:\d+/, ''),
          status,
          postData: request.postData() ? JSON.parse(request.postData()) : null,
          responseBody: body,
          ok: response.ok()
        };

        this.logs.push(entry);

        if (!response.ok()) {
          this.failures.push(entry);
        }
      }
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.failures.push({
          timestamp: new Date().toISOString(),
          type: 'CONSOLE_ERROR',
          text: msg.text(),
          location: msg.location()
        });
      }
    });
  }

  clear() {
    this.logs = [];
    this.failures = [];
  }

  getFailures() {
    return this.failures;
  }

  getLogs() {
    return this.logs;
  }
}

module.exports = ApiInterceptor;
