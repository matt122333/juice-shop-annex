#!/usr/bin/env node
/*
 * Injects the dispersed annex vulnerabilities into a Juice Shop source clone.
 *   node install-annex.js /path/to/juice-shop
 * Idempotent; reverse with uninstall-annex.js.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = process.argv[2];
if (!dir) { console.error('Usage: node install-annex.js /path/to/juice-shop'); process.exit(1); }
const serverPath = path.join(dir, 'server.ts');
const routesDir = path.join(dir, 'routes');
if (!fs.existsSync(serverPath) || !fs.existsSync(routesDir)) {
  console.error(`Not a Juice Shop source clone: ${dir}\n(If you use the Docker image, clone from source instead: git clone https://github.com/juice-shop/juice-shop.git)`);
  process.exit(1);
}

const MODULES = ['productCatalog', 'deliveryTracking', 'accountManagement', 'adminDiagnostics', 'dataImport', 'integrations'];
const IMPORTS = MODULES.map(m => `import * as ${m} from './routes/${m}'`);
const MOUNTS = [
  "  app.get('/rest/products/by-tag', productCatalog.productsByTag())",
  "  app.get('/rest/products/catalog', productCatalog.catalogListing())",
  "  app.post('/rest/products/:id/questions', productCatalog.postProductQuestion())",
  "  app.get('/rest/products/:id/questions', productCatalog.listProductQuestions())",
  "  app.get('/rest/delivery/track-external', deliveryTracking.trackExternal())",
  "  app.get('/rest/track/click', deliveryTracking.trackClick())",
  "  app.get('/rest/delivery/receipt', deliveryTracking.downloadReceipt())",
  "  app.get('/rest/user/notes/:id', accountManagement.getNote())",
  "  app.put('/rest/user/notes/:id', accountManagement.updateNote())",
  "  app.post('/rest/user/profile-update', accountManagement.updateProfile())",
  "  app.post('/rest/user/quick-reset', accountManagement.requestQuickReset())",
  "  app.post('/rest/user/quick-reset/confirm', accountManagement.confirmQuickReset())",
  "  app.get('/rest/admin/service-status', adminDiagnostics.serviceStatus())",
  "  app.get('/rest/admin/user-stats', adminDiagnostics.userStats())",
  "  app.post('/rest/user/preferences/restore', dataImport.restorePreferences())",
  "  app.post('/rest/products/import-feed', dataImport.importProductFeed())",
  "  app.post('/rest/partner/verify-token', integrations.verifyPartnerToken())",
  "  app.post('/rest/notifications/preview', integrations.previewNotification())"
];

// 1. Copy the modules into the repo
for (const m of MODULES) fs.copyFileSync(path.join(__dirname, 'routes', `${m}.ts`), path.join(routesDir, `${m}.ts`));
console.log(`✓ ${MODULES.length} route modules written to routes/`);

// 1b. Copy the known-vulnerable dependency manifest (CVE / SCA target; not imported, cannot break runtime)
const vcSrc = path.join(__dirname, 'report-generator');
if (fs.existsSync(vcSrc)) {
  fs.cpSync(vcSrc, path.join(dir, 'report-generator'), { recursive: true });
  console.log('✓ report-generator/ written (10 known-vulnerable deps for SCA/CVE detection)');
}

// 2. Wire them into server.ts (idempotent)
let src = fs.readFileSync(serverPath, 'utf8');
let changed = false;
if (!src.includes("from './routes/productCatalog'")) {
  const lines = src.split('\n');
  let idx = -1;
  lines.forEach((l, i) => { if (l.includes("from './routes/")) idx = i; });
  if (idx === -1) { console.error('Could not find route imports in server.ts'); process.exit(1); }
  lines.splice(idx + 1, 0, IMPORTS.join('\n'));
  src = lines.join('\n');
  changed = true;
  console.log('✓ imports added to server.ts');
} else { console.log('· imports already present'); }

if (!src.includes("'/rest/products/by-tag'")) {
  const anchor = '  /* Serve metrics before the Angular catch-all';
  if (!src.includes(anchor)) { console.error('Could not find mount anchor in server.ts'); process.exit(1); }
  src = src.replace(anchor, MOUNTS.join('\n') + '\n\n' + anchor);
  changed = true;
  console.log('✓ route mounts added to server.ts');
} else { console.log('· route mounts already present'); }
if (changed) fs.writeFileSync(serverPath, src);

// 3. Install the one dependency (native build only) and recompile the server
console.log('\nInstalling better-sqlite3...');
execSync('npm install better-sqlite3 --ignore-scripts', { cwd: dir, stdio: 'inherit' });
execSync('npm rebuild better-sqlite3', { cwd: dir, stdio: 'inherit' });
console.log('\nRecompiling server...');
execSync('npm run build:server', { cwd: dir, stdio: 'inherit' });

console.log('\n✅ Done. Start Juice Shop with `npm start`, then target http://localhost:3000.');
console.log('   Verify:  BASE_URL=http://localhost:3000 node exploit-tests.js');
