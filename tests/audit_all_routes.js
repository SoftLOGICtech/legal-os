/**
 * audit_all_routes.js
 * Scans all frontend files in dashboard/src for API calls and compares them against backend routes in backend/server.js.
 */

const fs = require('fs');
const path = require('path');

// 1. Collect all backend routes
const serverFile = path.join(__dirname, '..', 'backend', 'server.js');
const serverContent = fs.readFileSync(serverFile, 'utf8');

const backendRoutes = [];
const routeRegex = /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
let match;
while ((match = routeRegex.exec(serverContent)) !== null) {
  const method = match[1].toUpperCase();
  const rawPath = match[2];
  if (rawPath.startsWith('/api') || rawPath.startsWith('/uploads') || rawPath.startsWith('/health')) {
    backendRoutes.push({ method, path: rawPath });
  }
}

console.log(`📡 Discovered ${backendRoutes.length} backend route declarations in backend/server.js.\n`);

// 2. Collect all frontend files
function getAllFiles(dir, exts = ['.js', '.jsx']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        files = files.concat(getAllFiles(fullPath, exts));
      }
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const frontendFiles = getAllFiles(path.join(__dirname, '..', 'dashboard', 'src'));
console.log(`🔍 Scanning ${frontendFiles.length} frontend files in dashboard/src...\n`);

const frontendCalls = [];

// Regex to capture apiGet, apiPost, apiPut, apiDelete, fetch, including concatenated strings
const apiCallRegexes = [
  { method: 'GET', regex: /apiGet\s*\(\s*[`'"]([^`'"]+)[`'"](?:\s*\+\s*([a-zA-Z0-9_.]+))?/g },
  { method: 'POST', regex: /apiPost\s*\(\s*[`'"]([^`'"]+)[`'"](?:\s*\+\s*([a-zA-Z0-9_.]+))?/g },
  { method: 'PUT', regex: /apiPut\s*\(\s*[`'"]([^`'"]+)[`'"](?:\s*\+\s*([a-zA-Z0-9_.]+))?/g },
  { method: 'DELETE', regex: /apiDelete\s*\(\s*[`'"]([^`'"]+)[`'"](?:\s*\+\s*([a-zA-Z0-9_.]+))?/g },
  { method: 'ANY', regex: /fetch\s*\(\s*[`'"]([^`'"]+)[`'"](?:\s*\+\s*([a-zA-Z0-9_.]+))?/g },
  { method: 'ANY', regex: /[`'"](\/api\/[^`'"]+)[`'"]/g }
];

for (const file of frontendFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relFile = path.relative(path.join(__dirname, '..'), file);

  // Search each pattern
  for (const pattern of apiCallRegexes) {
    let callMatch;
    const re = new RegExp(pattern.regex.source, pattern.regex.flags);
    while ((callMatch = re.exec(content)) !== null) {
      let callUrl = callMatch[1].split('?')[0].trim(); // strip query params
      // If there was a trailing parameter concatenated
      if (callMatch[2] && callUrl.endsWith('/')) {
        callUrl = callUrl + ':param';
      }
      if (callUrl.startsWith('/api') || callUrl.startsWith('api/')) {
        if (!callUrl.startsWith('/')) callUrl = '/' + callUrl;
        // Ignore api.js line 62 internal filter check
        if (callUrl === '/api/sync/') continue;
        frontendCalls.push({
          method: pattern.method,
          url: callUrl,
          file: relFile,
          line: content.substring(0, callMatch.index).split('\n').length
        });
      }
    }
  }
}

// Deduplicate frontend calls
const uniqueCallsMap = new Map();
for (const call of frontendCalls) {
  const key = `${call.method}:${call.url}:${call.file}:${call.line}`;
  if (!uniqueCallsMap.has(key)) {
    uniqueCallsMap.set(key, call);
  }
}
const uniqueCalls = Array.from(uniqueCallsMap.values());
console.log(`📊 Found ${uniqueCalls.length} API invocation points in frontend.\n`);

// 3. Helper: Normalize route patterns for matching
function normalizePattern(route) {
  return route
    .replace(/\$\{[^}]+\}/g, ':param') // replace template literals ${id} with :param
    .replace(/:[a-zA-Z0-9_]+/g, ':param') // replace :id, :case_id with :param
    .replace(/\/+$/, '') // strip trailing slashes
    .trim();
}

function matchRoute(frontendMethod, frontendUrl, backendRoutes) {
  const normFront = normalizePattern(frontendUrl);
  const frontParts = normFront.split('/');

  for (const bRoute of backendRoutes) {
    // Check method (if specified)
    if (frontendMethod !== 'ANY' && bRoute.method !== frontendMethod) {
      continue;
    }

    const normBack = normalizePattern(bRoute.path);
    const backParts = normBack.split('/');

    if (frontParts.length !== backParts.length) {
      // Check for catch-alls or subroutes
      if (bRoute.path.includes('*') || bRoute.path.includes('.*')) {
        return { matched: true, backendRoute: bRoute };
      }
      continue;
    }

    let match = true;
    for (let i = 0; i < frontParts.length; i++) {
      if (frontParts[i] === ':param' || backParts[i] === ':param') {
        continue;
      }
      if (frontParts[i] !== backParts[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      return { matched: true, backendRoute: bRoute };
    }
  }

  // If method was specific, also check if the path exists under ANY method
  if (frontendMethod !== 'ANY') {
    for (const bRoute of backendRoutes) {
      const normBack = normalizePattern(bRoute.path);
      const backParts = normBack.split('/');
      if (frontParts.length === backParts.length) {
        let pathMatch = true;
        for (let i = 0; i < frontParts.length; i++) {
          if (frontParts[i] === ':param' || backParts[i] === ':param') continue;
          if (frontParts[i] !== backParts[i]) { pathMatch = false; break; }
        }
        if (pathMatch) {
          return { matched: false, methodMismatch: true, expectedMethod: bRoute.method, actualMethod: frontendMethod, backendRoute: bRoute };
        }
      }
    }
  }

  return { matched: false };
}

// 4. Perform Audit
const unmatched = [];
const methodMismatches = [];
const matched = [];

for (const call of uniqueCalls) {
  const res = matchRoute(call.method, call.url, backendRoutes);
  if (res.matched) {
    matched.push({ ...call, backend: res.backendRoute });
  } else if (res.methodMismatch) {
    methodMismatches.push({ ...call, ...res });
  } else {
    // Exclude mock test strings or comments
    if (!call.url.includes('example') && !call.url.includes('undefined')) {
      unmatched.push(call);
    }
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(`✅ MATCHED ROUTES: ${matched.length}`);
console.log(`⚠️ METHOD MISMATCHES: ${methodMismatches.length}`);
console.log(`❌ UNMATCHED / MISSING ROUTES: ${unmatched.length}`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (methodMismatches.length > 0) {
  console.log('⚠️ METHOD MISMATCH DETAILS:');
  methodMismatches.forEach(m => {
    console.log(`  • [${m.file}:${m.line}] Frontend calls ${m.actualMethod} "${m.url}", but Backend expects ${m.expectedMethod}`);
  });
  console.log('');
}

if (unmatched.length > 0) {
  console.log('❌ UNMATCHED / MISSING ENDPOINTS:');
  unmatched.forEach(u => {
    console.log(`  • [${u.file}:${u.line}] ${u.method} "${u.url}"`);
  });
  console.log('');
}

if (methodMismatches.length === 0 && unmatched.length === 0) {
  console.log('🎉 100% ROUTE COMPATIBILITY: Every single frontend API endpoint maps to a live backend route!');
}
