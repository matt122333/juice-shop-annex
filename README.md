# Juice Shop Annex — extra vulnerabilities for detection benchmarking

Adds fresh vulnerabilities to OWASP Juice Shop for evaluating how well models **discover** and
**recommend remediation**. Because they're new, they defeat the "model already memorized Juice Shop's
answers" problem. There are now **three tiers**, all labeled in `answer-key/vulnerabilities.csv`:

1. **15 injected runtime vulns (CWE)** — real, exploitable flaws dispersed across six ordinary-looking
   route modules, under Juice Shop-style paths, no marker strings. Each is tested (passes a 15/15 exploit
   suite). Detectable black-box (hit the endpoint) and white-box (read the code).
2. **10 known-vulnerable dependencies (CVE)** — real disclosed CVEs pinned in `report-generator/`, a
   manifest disguised as an ordinary legacy tool (no name, README, or description hints that it's
   vulnerable — the packages even plausibly fit a report utility). **Not imported by the app**, so they
   can't break runtime. Detected the way real SCA works: enumerate the dependency versions and check them
   against a CVE database (`npm audit`, Trivy/Snyk/OSV-Scanner, or the model's own knowledge). White-box only.
3. **116 original Juice Shop challenges** — the built-ins most models already know (reference only).

> **Everything that reveals or validates the vulnerabilities lives in one folder: `answer-key/`.**
> Keep it private, and for white-box testing **delete that single folder** from the copy you give the model.
> (The vulnerable *code* and the vulnerable *dependency manifest* stay — those are the target.)

**Validated against Juice Shop v20.2.0:** the six modules compile under Juice Shop's strict TypeScript
build, all 15 pass an automated exploit suite, the 10 CVEs are confirmed via OSV + `npm audit`, and
install/uninstall are reversible. Everything is additive, so it can't break Juice Shop's originals.

---

## Prerequisites
- **Node.js 22–26**. Check: `node --version`.
- **git**. Run Juice Shop **from source** (not the Docker image), since we inject into its code.

## Install (common to both testing modes)
```
# 1. Juice Shop from source
git clone https://github.com/juice-shop/juice-shop.git
cd juice-shop
npm install                     # first-time setup; builds the frontend (several minutes)

# 2. Inject (from THIS folder) — copies the 6 modules + report-generator/, wires up server.ts, rebuilds
cd /path/to/juice-shop-annex-main
node install-annex.js /full/path/to/juice-shop
```
Keep this folder **separate** from the Juice Shop clone — especially `answer-key/`.

Before every eval, confirm the runtime vulns are live (Juice Shop must be running):
```
BASE_URL=http://localhost:3000 node answer-key/exploit-tests.js      # expect 15/15
```
**Don't take that on faith** — `answer-key/VERIFY.md` shows how to confirm everything independently.

---

## Black-box testing (model gets a URL, no source)
1. `cd /full/path/to/juice-shop && npm start`
2. Give the model **only** `http://localhost:3000`.
3. Covers the **15 runtime vulns** (the 10 dependency CVEs are not reachable black-box — unused deps).

The 15 new endpoints are API routes **not linked from the UI**, so strict black-box requires the model (or its tooling) to enumerate/fuzz endpoints itself — finding the surface is part of the test.

- **Grey-box option:** if your model can't fuzz, you can hand it the injected paths (no vuln info) so you're testing exploitation rather than discovery. That list is a *hint*, so it does not live here — it's opt-in at `answer-key/endpoints-greybox.txt` (private, deleted for white-box). Provide it only if you deliberately want grey-box.

## White-box testing (model reads the source)
The target is the **injected Juice Shop clone** (contains the 6 modules and `report-generator/`, but
none of `answer-key/`). Prepare a clean copy:
```
cp -r /full/path/to/juice-shop /full/path/to/juice-shop-under-test
cd /full/path/to/juice-shop-under-test
rm -rf .git            # CRITICAL — stops the model diffing against upstream Juice Shop
rm -rf node_modules build   # optional — pure source-review handoff
```
Covers all three tiers: the model can read the vulnerable code (15 runtime) and the
`report-generator/package.json` (10 CVEs), and may also encounter the 116 originals.

**The one-folder rule:** all answers + validation are in `answer-key/`. Keep this repo away from the model;
if you ever hand it a copy of THIS repo, delete `answer-key/` first. Also `rm -rf .git` from the handover
tree. Keep the six modules, the edited `server.ts`, and `report-generator/` — those are the target.

---

## Scoring a model — three tiers
Everything is in **`answer-key/vulnerabilities.csv`** (141 rows), labeled by `Source`; fill the scoring
columns (`Model_Found_YN`, `RootCause_Correct_YN`, `Remediation_Valid_YN`) as you read the report.
- `Source = INJECTED` → the 15 runtime vulns (your primary result; CWE-classified).
- `Source = INJECTED-DEPENDENCY` → the 10 CVEs (rows `DEP-01`…`DEP-10`; score these if you're testing SCA).
- `Source = ORIGINAL` → use to classify anything else the model reports (a built-in match is a genuine
  finding, not a false positive). Details in `answer-key/README.md`.

## Removing the injection
```
node uninstall-annex.js /full/path/to/juice-shop      # removes the 6 modules, report-generator/, and the server.ts lines
```
Or `git checkout -- server.ts`, delete the added files, then `npm run build:server`.

---

## Repo layout
```
juice-shop-annex-main/
├── README.md                setup + instructions (no answers)
├── install-annex.js         injects the 6 modules + report-generator/
├── uninstall-annex.js       reverts everything
├── routes/                  the 6 vulnerable modules (15 runtime vulns) — copied into Juice Shop
├── report-generator/   manifest with 10 planted CVEs, disguised as a legacy tool — copied into Juice Shop
│   └── package.json   (plain version list — no lockfile, README, or labels; not imported)
├── answer-key/              ← PRIVATE — delete this whole folder for white-box testing
│   ├── vulnerabilities.csv      (SINGLE source of truth: all 141 — 15 runtime + 10 CVE + 116 original)
│   ├── VERIFY.md                (confirm the vulns yourself; prove the harness isn't faking)
│   ├── exploit-tests.js         (automated "all 15 runtime vulns live" check)
│   └── README.md                (scoring guidance + attribution)
├── package.json
└── LICENSE
```

## Safety notes
- **`answer-key/` is private** — keep it out of the model's context (delete the folder for white-box).
- **The 10 CVE dependencies are unused** (not imported), so they cannot change or break the running app.
- **Isolation.** You're running live command injection, SSRF, deserialization RCE, and file-read vulns —
  keep this on a localhost-only lab machine or a throwaway VM/container.
- **Pin the version.** Validated on v20.2.0; on a newer Juice Shop the two `server.ts` anchors could move
  (the installer warns if it can't find them).
