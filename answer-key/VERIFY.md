# VERIFY.md — Confirm the vulnerabilities yourself (don't trust the tooling)

This project was assembled with AI help, and `exploit-tests.js` is code you did not write — either could be
wrong or rigged to print "PASS". This guide lets you confirm the 15 injected vulnerabilities are real
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
Exactly **check 04 should now FAIL**, the other 14 still PASS. Canned output can't track a change you just
made to the source. (Undo the edit and rebuild afterwards.)

**1c. Read the harness.** `exploit-tests.js` is plain JavaScript — each check makes a real `fetch()` and
asserts on the response body, and the script exits non-zero on any failure. Nothing is hard-coded to pass.

Once 1a–1c convince you, trust the automated `15/15`.

---

## Step 2 — Reproduce each vuln by hand

Run the command in the `Manual_Reproduction` column of `vulnerabilities.csv` for any row and check you get
the stated result. As one worked example (note the URL-encoding — raw spaces break curl):
```
curl -G "http://localhost:3000/rest/products/by-tag" --data-urlencode "tag=' UNION SELECT id, email || ':' || password, tier FROM members -- "
```
→ `{"status":"success","data":[{"id":1,"name":"loyalty@juice-sh.op:Winter2024Loyalty!","price":"gold"},...]}`
Passwords in a product-search response can only come from SQL injection. The other 14 are in the CSV, each
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

---

## Step 4b — Verify the 10 dependency CVEs yourself

These are real, disclosed CVEs pinned in `report-generator/`. Confirm them without trusting me:
```
cd report-generator && npm install && npm audit
```
`npm audit` (which queries the GitHub/npm advisory database, not my code) will report the vulnerable
packages. Cross-check any CVE ID at https://nvd.nist.gov/vuln/detail/<CVE> or https://osv.dev/. The exact
CVE-per-package mapping is in `vulnerabilities.csv` rows `DEP-01`…`DEP-10`.

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
