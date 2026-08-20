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

const MODULES = [
  'productCatalog', 'deliveryTracking', 'accountManagement', 'adminDiagnostics', 'dataImport', 'integrations',
  'promotions', 'couponManager', 'giftCards', 'wishlist', 'shippingCalculator', 'returnProcessor',
  'affiliateTracker', 'vendorPortal', 'taxCalculator', 'loyaltyPoints', 'searchIndex', 'cartDiscounts',
  'notificationsApi', 'adminReports', 'mobileApi', 'feedbackCollector'
];
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
  "  app.post('/rest/notifications/preview', integrations.previewNotification())",
  "  app.get('/rest/promos/search', promotions.searchPromos())",
  "  app.get('/rest/promos/landing/:code', promotions.promoLanding())",
  "  app.post('/rest/promos/apply', promotions.applyPromo())",
  "  app.post('/rest/coupons/lookup', couponManager.lookupCoupon())",
  "  app.get('/rest/coupons/:id', couponManager.getCoupon())",
  "  app.post('/rest/coupons/validate', couponManager.validateCoupon())",
  "  app.post('/rest/gift-cards/redeem', giftCards.redeemGiftCard())",
  "  app.post('/rest/gift-cards/:id/messages', giftCards.postGiftMessage())",
  "  app.get('/rest/gift-cards/:id/messages', giftCards.viewGiftMessage())",
  "  app.post('/rest/gift-cards/configure', giftCards.configureGiftCard())",
  "  app.get('/rest/wishlists/search', wishlist.searchWishlists())",
  "  app.get('/rest/wishlists/:id', wishlist.getWishlist())",
  "  app.put('/rest/wishlists/:id/shipping', wishlist.updateShipping())",
  "  app.get('/rest/shipping/rate', shippingCalculator.getRate())",
  "  app.post('/rest/shipping/calculate', shippingCalculator.calculateShipping())",
  "  app.get('/rest/shipping/zones', shippingCalculator.loadZone())",
  "  app.get('/rest/returns/policy', returnProcessor.fetchPolicy())",
  "  app.get('/rest/returns/search', returnProcessor.searchReturns())",
  "  app.get('/rest/returns/confirm/:orderId', returnProcessor.returnConfirmation())",
  "  app.get('/rest/affiliate/click', affiliateTracker.recordClick())",
  "  app.get('/rest/affiliate/stats', affiliateTracker.affiliateStats())",
  "  app.get('/rest/affiliate/leaderboard', affiliateTracker.leaderboard())",
  "  app.post('/rest/vendor/login', vendorPortal.vendorLogin())",
  "  app.post('/rest/vendor/soap-update', vendorPortal.processSoapUpdate())",
  "  app.get('/rest/vendor/invoice', vendorPortal.fetchInvoice())",
  "  app.post('/rest/tax/calculate', taxCalculator.calculateTax())",
  "  app.get('/rest/tax/lookup', taxCalculator.lookupTaxRate())",
  "  app.get('/rest/tax-rates/search', taxCalculator.searchTaxRates())",
  "  app.put('/rest/loyalty/:id', loyaltyPoints.updateAccount())",
  "  app.post('/rest/loyalty/transfer', loyaltyPoints.transferPoints())",
  "  app.post('/rest/loyalty/adjust', loyaltyPoints.addAdjustment())",
  "  app.post('/rest/search', searchIndex.searchIndex())",
  "  app.post('/rest/products/:id/reviews', searchIndex.postReview())",
  "  app.get('/rest/products/:id/reviews', searchIndex.viewReviews())",
  "  app.get('/rest/search/synonyms', searchIndex.loadSynonyms())",
  "  app.get('/rest/search/raw-lookup', searchIndex.rawLookup())",
  "  app.post('/rest/cart/discount-preview', cartDiscounts.previewDiscount())",
  "  app.post('/rest/cart/best-discount', cartDiscounts.applyBestDiscount())",
  "  app.get('/rest/cart/rules/search', cartDiscounts.searchRules())",
  "  app.post('/rest/notifications/send', notificationsApi.sendNotification())",
  "  app.get('/rest/notifications/:id', notificationsApi.getNotification())",
  "  app.post('/rest/notifications/graphql', notificationsApi.graphqlQuery())",
  "  app.get('/rest/admin/reports/generate', adminReports.generateReport())",
  "  app.get('/rest/admin/reports/search', adminReports.searchReports())",
  "  app.get('/rest/admin/reports/verify', adminReports.verifyAdminKey())",
  "  app.get('/rest/admin/reports/download', adminReports.downloadReport())",
  "  app.post('/rest/mobile/session', mobileApi.verifySession())",
  "  app.get('/rest/mobile/profile/:id', mobileApi.getProfile())",
  "  app.get('/rest/mobile/image', mobileApi.proxyImage())",
  "  app.get('/rest/feedback/export', feedbackCollector.exportCsv())",
  "  app.post('/rest/feedback/:product', feedbackCollector.submitFeedback())",
  "  app.get('/rest/feedback/:product', feedbackCollector.viewFeedback())",
  "  app.post('/rest/feedback/xml', feedbackCollector.parseXmlFeedback())"
];

// 1. Copy the modules into the repo
for (const m of MODULES) fs.copyFileSync(path.join(__dirname, 'routes', `${m}.ts`), path.join(routesDir, `${m}.ts`));
console.log(`✓ ${MODULES.length} route modules written to routes/`);

// 1b. Copy the known-vulnerable dependency manifest (CVE / SCA target; not imported, cannot break runtime)
const vcSrc = path.join(__dirname, 'report-generator');
if (fs.existsSync(vcSrc)) {
  fs.cpSync(vcSrc, path.join(dir, 'report-generator'), { recursive: true });
  console.log('✓ report-generator/ written (35 known-vulnerable deps for SCA/CVE detection)');
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
