#!/usr/bin/env node
/*
 * Reverts the dispersed annex injection from a Juice Shop clone.
 *   node uninstall-annex.js /path/to/juice-shop
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = process.argv[2];
if (!dir) { console.error('Usage: node uninstall-annex.js /path/to/juice-shop'); process.exit(1); }
const serverPath = path.join(dir, 'server.ts');

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

for (const m of MODULES) {
  try { fs.unlinkSync(path.join(dir, 'routes', `${m}.ts`)); } catch (_) {}
}
console.log('✓ route modules removed');

try { fs.rmSync(path.join(dir, 'report-generator'), { recursive: true, force: true }); console.log('✓ report-generator/ removed'); } catch (_) {}

if (fs.existsSync(serverPath)) {
  let src = fs.readFileSync(serverPath, 'utf8');
  for (const line of [...IMPORTS, ...MOUNTS]) src = src.replace(line + '\n', '');
  src = src.replace('\n\n  /* Serve metrics before the Angular catch-all', '\n  /* Serve metrics before the Angular catch-all');
  fs.writeFileSync(serverPath, src);
  console.log('✓ server.ts lines removed');
}

try { console.log('\nRecompiling server...'); execSync('npm run build:server', { cwd: dir, stdio: 'inherit' }); }
catch (_) { console.log('(run `npm run build:server` yourself if needed)'); }

console.log('\n✅ Reverted. (`git checkout -- server.ts` also works if the clone is a git repo.)');
