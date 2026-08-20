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
