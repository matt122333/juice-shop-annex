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
const routesDir = path.join(dir, 'routes');

const MODULES = [
  'productCatalog',
  'deliveryTracking',
  'accountManagement',
  'adminDiagnostics',
  'dataImport',
  'integrations',
  'promotions',
  'couponManager',
  'giftCards',
  'wishlist',
  'shippingCalculator',
  'returnProcessor',
  'affiliateTracker',
  'vendorPortal',
  'taxCalculator',
  'loyaltyPoints',
  'searchIndex',
  'cartDiscounts',
  'notificationsApi',
  'adminReports',
  'mobileApi',
  'feedbackCollector',
  'inventoryManager',
  'priceTracker',
  'orderExport',
  'sessionManager',
  'contentManager',
  'analyticsTracker',
  'reviewModeration',
  'customerSupport',
  'warehouseApi',
  'billingPortal',
  'subscriptionManager',
  'complianceAudit',
  'storeLocator',
  'recipeFinder',
  'loyaltyRewards',
  'subscriptionBilling',
  'customerProfiles',
  'productReviews',
  'orderTracking',
  'wishlistManager',
  'notificationCenter',
  'inventoryCheck',
  'promoCodes',
  'shippingZones',
  'returnsManager',
  'vendorManagement',
  'customerSupport2',
  'analyticsDashboard',
  'priceManager',
  'contentPages',
  'taxExemptions',
  'giftCardRegistry'
];
const IMPORTS = MODULES.map(m => `import * as ${m} from './routes/${m}'`);

// 1. Remove the route module files
let removed = 0;
for (const m of MODULES) {
  const p = path.join(routesDir, `${m}.ts`);
  if (fs.existsSync(p)) { fs.unlinkSync(p); removed++; }
}
console.log(`✓ ${removed} route modules removed`);

// 2. Remove imports and mounts from server.ts
let src = fs.readFileSync(serverPath, 'utf8');
let changed = false;

for (const imp of IMPORTS) {
  if (src.includes(imp)) { src = src.replace(imp + '\n', ''); src = src.replace(imp, ''); changed = true; }
}

// Remove mount lines by finding and removing the block
const mountStart = "  app.get('/rest/products/by-tag'";
if (src.includes(mountStart)) {
  const lines = src.split('\n');
  const newLines = [];
  let skipping = false;
  for (const line of lines) {
    if (line.includes(mountStart)) { skipping = true; continue; }
    if (skipping) {
      if (line.trim().startsWith("app.") && (line.includes("productCatalog") || line.includes("deliveryTracking") || line.includes("accountManagement") || line.includes("adminDiagnostics") || line.includes("dataImport") || line.includes("integrations") || line.includes("promotions") || line.includes("couponManager") || line.includes("giftCards") || line.includes("wishlist") || line.includes("shippingCalculator") || line.includes("returnProcessor") || line.includes("affiliateTracker") || line.includes("vendorPortal") || line.includes("taxCalculator") || line.includes("loyaltyPoints") || line.includes("searchIndex") || line.includes("cartDiscounts") || line.includes("notificationsApi") || line.includes("adminReports") || line.includes("mobileApi") || line.includes("feedbackCollector") || line.includes("inventoryManager") || line.includes("priceTracker") || line.includes("orderExport") || line.includes("sessionManager") || line.includes("contentManager") || line.includes("analyticsTracker") || line.includes("reviewModeration") || line.includes("customerSupport") || line.includes("warehouseApi") || line.includes("billingPortal") || line.includes("subscriptionManager") || line.includes("complianceAudit") || line.includes("storeLocator") || line.includes("recipeFinder") || line.includes("loyaltyRewards") || line.includes("subscriptionBilling") || line.includes("customerProfiles") || line.includes("productReviews") || line.includes("orderTracking") || line.includes("wishlistManager") || line.includes("notificationCenter") || line.includes("inventoryCheck") || line.includes("promoCodes") || line.includes("shippingZones") || line.includes("returnsManager") || line.includes("vendorManagement") || line.includes("customerSupport2") || line.includes("analyticsDashboard") || line.includes("priceManager") || line.includes("contentPages") || line.includes("taxExemptions") || line.includes("giftCardRegistry"))) {
        continue;
      }
      skipping = false;
    }
    newLines.push(line);
  }
  src = newLines.join('\n');
  changed = true;
  console.log('✓ route mounts removed from server.ts');
} else {
  console.log('· route mounts not found (already clean?)');
}

if (changed) fs.writeFileSync(serverPath, src);

// 3. Recompile (best-effort — may fail if better-sqlite3 was removed)
try {
  execSync('npm run build:server', { cwd: dir, stdio: 'inherit' });
  console.log('\n✅ Done. Server recompiled.');
} catch (e) {
  console.log('\n✅ Done. (run `npm run build:server` yourself if needed)');
  console.log('(If `npm run build:server` fails, try: `git checkout -- server.ts`)');
}
