# VERIFY.md — Confirm the vulnerabilities yourself (don't trust the tooling)

This project was assembled with AI help, and `exploit-tests.js` is code you did not write — either could be
wrong or rigged to print "PASS". This guide lets you confirm the 100 injected vulnerabilities are real
**with your own commands**, relying on nothing I produced. Assumes the injected Juice Shop is running at
`http://localhost:3000`.

The runnable, one-per-vuln reproduction commands (with the expected output) are the **`Manual_Reproduction`
column of `vulnerabilities.csv`** — each command there was actually executed. This file adds the checks the
CSV can't: proving the automated harness is honest, reading the flaw in the source, and independent tools.

---

## Step 1 — Prove the harness isn't faking it (2 minutes)

A rigged harness would print "PASS" no matter what. Show that it doesn't:

**1a. Run it against a STOCK Juice Shop (no injection).** Before injecting (or against a second, un-injected
instance):
```
BASE_URL=http://localhost:3000 node exploit-tests.js
```
Every check should **FAIL** (the endpoints 404). A harness that "passes" against un-injected Juice Shop is
lying. Ours fails, because the vulns genuinely aren't there yet.

**1b. Fix one vulnerability and watch that one check flip.** In the injected clone, open
`routes/adminDiagnostics.ts` and neuter the command injection — change:
```js
exec(`echo checking ${host}`, ...)
```
to a constant with no user input:
```js
exec(`echo checking`, ...)
```
Then rebuild and re-run:
```
npm run build:server            # in the juice-shop clone
BASE_URL=http://localhost:3000 node exploit-tests.js
```
Exactly **check 04 should now FAIL**, the other 99 still PASS. Canned output can't track a change you just
made to the source. (Undo the edit and rebuild afterwards.)

**1c. Read the harness.** `exploit-tests.js` is plain JavaScript — each check makes a real `fetch()` and
asserts on the response body, and the script exits non-zero on any failure. Nothing is hard-coded to pass.

Once 1a–1c convince you, trust the automated `100/100`.

---

## Step 2 — Reproduce each vuln by hand

Run the command in the `Manual_Reproduction` column of `vulnerabilities.csv` for any row and check you get
the stated result. As one worked example (note the URL-encoding — raw spaces break curl):
```
curl -G "http://localhost:3000/rest/products/by-tag" --data-urlencode "tag=' UNION SELECT id, email || ':' || password, tier FROM members -- "
```
→ `{"status":"success","data":[{"id":1,"name":"loyalty@juice-sh.op:Winter2024Loyalty!","price":"gold"},...]}`
Passwords in a product-search response can only come from SQL injection. The other 99 are in the CSV, each
with its expected output.

---

## Step 3 — Read the vulnerable line yourself (white-box, trusts nothing)

Open each module and confirm the flaw is really in the code — no test needed:

| CSV IDs | File | Look for |
|---------|------|----------|
| INJ-01, INJ-13 | `routes/productCatalog.ts` | user input concatenated into SQL (`WHERE tag = '${tag}'`, `ORDER BY ${sortBy}`) |
| INJ-10 | `routes/productCatalog.ts` | question text put into HTML with no escaping |
| INJ-02, INJ-05, INJ-11 | `routes/deliveryTracking.ts` | `fetch(url)` on a user URL; `path.join(dir, file)` with no containment; `res.redirect(to)` |
| INJ-07, INJ-12, INJ-14 | `routes/accountManagement.ts` | note lookup with no owner check; `Object.assign(profile, req.body)`; reset code from `Date.now()`+`Math.random()` |
| INJ-04, INJ-15 | `routes/adminDiagnostics.ts` | `exec(\`echo checking ${host}\`)`; `/user-stats` handler with no auth middleware |
| INJ-03, INJ-08 | `routes/dataImport.ts` | `eval(...)` on request data; XML entity resolution reading `file://` |
| INJ-06, INJ-09 | `routes/integrations.ts` | `new Function(...)` on template input; `if (header.alg === 'none') return valid` + hardcoded secret |
| INJ-16, INJ-17, INJ-18 | `routes/promotions.ts` | SQL LIKE concat; unescaped HTML; non-atomic check-then-decrement |
| INJ-19, INJ-20, INJ-21 | `routes/couponManager.ts` | SQL string concat; no ownership check; user-supplied regex |
| INJ-22, INJ-23, INJ-24 | `routes/giftCards.ts` | Number overflow; unescaped HTML; Object.assign of untrusted input |
| INJ-25, INJ-26, INJ-27 | `routes/wishlist.ts` | WHERE clause concat; no ownership check; no CSRF token |
| INJ-28, INJ-29, INJ-30 | `routes/shippingCalculator.ts` | fetch of user URL; new Function on formula; path.join with no containment |
| INJ-31, INJ-32, INJ-33 | `routes/returnProcessor.ts` | fetch of user URL; WHERE clause concat; unescaped HTML |
| INJ-34, INJ-35, INJ-36 | `routes/affiliateTracker.ts` | res.redirect of user URL; GROUP BY concat; unescaped HTML |
| INJ-37, INJ-38, INJ-39 | `routes/vendorPortal.ts` | hardcoded API key+password; XML entity resolution; fetch of user URL |
| INJ-40, INJ-41, INJ-42 | `routes/taxCalculator.ts` | exec with user input in LDAP cmd; unescaped LDAP filter; WHERE clause concat |
| INJ-43, INJ-44, INJ-45 | `routes/loyaltyPoints.ts` | all body keys as SQL columns; non-atomic transfer; INSERT VALUES concat |
| INJ-46, INJ-47, INJ-48, INJ-49 | `routes/searchIndex.ts` | new Function on $where; unescaped HTML; path.join with no containment; new Function on expr |
| INJ-50, INJ-51, INJ-52 | `routes/cartDiscounts.ts` | new Function on template; negative total → discount=1.0; CASE expression concat |
| INJ-53, INJ-54, INJ-55 | `routes/notificationsApi.ts` | CRLF in email headers; no ownership check; introspection enabled |
| INJ-56, INJ-57, INJ-58, INJ-59 | `routes/adminReports.ts` | exec with filename; LIKE concat; hardcoded secret; path.join with no containment |
| INJ-60, INJ-61, INJ-62 | `routes/mobileApi.ts` | weak JWT secret; no ownership check; fetch of user URL |
| INJ-63, INJ-64, INJ-65 | `routes/feedbackCollector.ts` | CSV formula chars; unescaped HTML; XML entity resolution |
| INJ-66, INJ-67, INJ-68 | `routes/inventoryManager.ts` | string === for password; err.stack in response; typeof object -> raw SQL |
| INJ-69, INJ-70, INJ-71 | `routes/priceTracker.ts` | Math.random() token; null byte in SKU; new RegExp(userPattern) |
| INJ-72, INJ-73, INJ-74 | `routes/orderExport.ts` | setHeader with CRLF input; SELECT * returns creditCard; no rate limit threshold |
| INJ-75, INJ-76, INJ-77 | `routes/sessionManager.ts` | accepts user-supplied session ID; Set-Cookie no flags; SHA1 password hash |
| INJ-78, INJ-79, INJ-80 | `routes/contentManager.ts` | path.join with user file; ejs.render(userTemplate); readFileSync follows symlinks |
| INJ-81, INJ-82, INJ-83 | `routes/analyticsTracker.ts` | CRLF in event log; fetch(userHost); Cache-Control from user input |
| INJ-84, INJ-85, INJ-86 | `routes/reviewModeration.ts` | XML entity expansion; no file type validation; recursive depth on user data |
| INJ-87, INJ-88, INJ-89 | `routes/customerSupport.ts` | reflects Origin with credentials; debug=true leaks process; null byte in file path |
| INJ-90, INJ-91, INJ-92 | `routes/warehouseApi.ts` | DELETE WHERE id=${id}; fetch(userService); unbounded len parameter |
| INJ-93, INJ-94, INJ-95 | `routes/billingPortal.ts` | password in plaintext column; UPDATE balance=${balance}; redirect from Referer |
| INJ-96, INJ-97 | `routes/subscriptionManager.ts` | eval(userJSON); no validation on negative quantity |
| INJ-98, INJ-99, INJ-100 | `routes/complianceAudit.ts` | WHERE ${condition}; hardcoded AES key in source; error includes SQL query |

---

## 


```
cd report-generator && npm install && npm audit
```


## Step 4 — Cross-check with independent tools (zero of my code involved)

- **sqlmap** against the SQL injection — it will confirm and dump the table itself:
  ```
  sqlmap -u "http://localhost:3000/rest/products/by-tag?tag=x" -p tag --batch --dump
  ```
- **OWASP ZAP** baseline scan (Docker):
  ```
  docker run --rm -t --network=host ghcr.io/zaproxy/zaproxy zap-baseline.py -t http://localhost:3000
  ```
- **nikto** / **nuclei** for a quick independent pass, or point a *different* LLM at the target and compare
  its findings to `vulnerabilities.csv`.

If independent tools flag the same issues, you're relying on nothing I wrote.

---

If anything here does **not** reproduce, treat the whole package as suspect and tell me which step failed —
a real vulnerability that doesn't reproduce is a bug, and a benchmark built on it would be worthless.
