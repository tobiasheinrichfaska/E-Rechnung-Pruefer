# CLAUDE.md — E-Rechnung-Pruefer („E-Rechnung prüfen“)

> Workspace-wide conventions (language, git, build, architecture, testing, collaboration):
> [`c:\skripte\private\general stuff\CLAUDE.md`](../../private/general%20stuff/CLAUDE.md)
>
> **Own project** (Tobias 2026-11-13). It started as the sub-project `e-rechnung/` of the
> Fragebogen repo and was moved out with its history (`git subtree split`, 4 commits). It shares
> nothing with Fragebogen except — **for the time being** — the hosting subdomain: the upload
> target `NebenprojektERechnung/` on the Fragebogen subdomain (access `fragebogen` in
> `private/Auslieferung`).

---

## Project overview

A browser tool for clients of the Kanzlei: a file (PDF or XML) is dropped in and the tool shows
whether it is an e-invoice (syntax UBL/CII, profile), whether the XML matches the official XSD,
which **Pflichtangaben** (§ 14 Abs. 4 UStG and related) it carries with their values, and whether a
selected set of amounts adds up. Results are **hints, never an approval**.

**Fixed frame (hand-over 2026-11-13):**

- Browser only, **one HTML file**; no network at run time, no CDN; all libraries bundled.
- **No storage at all** (no localStorage, IndexedDB, cookies): other apps live on the same origin
  and their data and "delete all data on this device" must stay untouched.
- Development phase: only in `NebenprojektERechnung/` (office IPs or tester login), not linked.
- UI German, Sie-form, simple sentences, style like the Fragebogen app.
- **Tax questions are never decided by Claude** — collect them in `docs/offene-fragen.md` for Tobias.

**Non-goals:** no full validator (no rebuild of all CEN/KoSIT/FeRD Schematron rules), no XRechnung
BR-DE rules as errors (B2B needs no XRechnung), no PDF/A check, no tax judgement of content, no
online VAT-ID lookup.

**Workflow (Tobias 2026-11-13):** commit without asking and report the commits; **push and upload
only after his explicit OK**. GitHub: https://github.com/tobiasheinrichfaska/E-Rechnung-Pruefer
(public, created 2026-11-14 on his request; Claude Code on the web works from his GitHub account —
keep `main` pushed after his OK so web sessions see the current state).

- Plan and step status: [`docs/plan.md`](docs/plan.md) (German)
- Sources, versions, licences, SHA-256: [`docs/quellen.md`](docs/quellen.md)
- Open and decided tax questions: [`docs/offene-fragen.md`](docs/offene-fragen.md)

---

## Project Directory

| File/Folder                                                | Purpose                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                                                | This file                                                                                                                                                                                                                                                                                                                                                                               |
| `README.md`                                                | Public description (German), licence section                                                                                                                                                                                                                                                                                                                                            |
| `LICENSE`, `LICENSE_COMMERCIAL.md`, `CONTRIBUTING.md`      | AGPLv3 + commercial dual licensing, CLA (verbatim workspace templates)                                                                                                                                                                                                                                                                                                                  |
| `.gitattributes`                                           | Workspace template (LF) plus `-text` for the official XSD and test files (byte-identical to their source)                                                                                                                                                                                                                                                                               |
| `.prettierrc.json`                                         | Formatting (same settings as the Fragebogen app)                                                                                                                                                                                                                                                                                                                                        |
| `import/`                                                  | Inbox for delivered material (gitignored); empty after processing — processed files go to `import-archiv/<JJJJ-MM-TT_HH-MM-SS>/` (gitignored)                                                                                                                                                                                                                                           |
| `FEATURES_REQUIRED.md`                                     | Critical user paths                                                                                                                                                                                                                                                                                                                                                                     |
| `package.json` / `package-lock.json`                       | Scripts and exactly pinned dependencies (versions as in the Fragebogen app)                                                                                                                                                                                                                                                                                                             |
| `vite.config.ts`                                           | Vite + single-file build, CSP plugin, Vitest config (`pool: 'forks'` for pdf.js)                                                                                                                                                                                                                                                                                                        |
| `tsconfig.json`                                            | Strict TS like the Fragebogen app                                                                                                                                                                                                                                                                                                                                                       |
| `eslint.config.js`                                         | Layering (`src/logic` free of UI/IO/engines) and a ban on storage and network APIs in `src/`                                                                                                                                                                                                                                                                                            |
| `playwright.config.ts`                                     | E2E in Chromium, Firefox, WebKit on the built file                                                                                                                                                                                                                                                                                                                                      |
| `.gitignore`, `.prettierignore`                            | Ignores (`node_modules/`, `dist/`, `.tmp/`, `import/`, `import-archiv/`, `tests/fixtures/lokal/`, `deploy/.local/`)                                                                                                                                                                                                                                                                     |
| `index.html`                                               | Entry HTML (`lang="de"`, no external URLs)                                                                                                                                                                                                                                                                                                                                              |
| `src/main.tsx`                                             | Mounts the React app                                                                                                                                                                                                                                                                                                                                                                    |
| `src/appInfo.ts`                                           | App name + version (`__APP_VERSION__` from `package.json`)                                                                                                                                                                                                                                                                                                                              |
| `src/build/csp.ts`                                         | CSP meta tag with hashes, `connect-src 'none'`, `'wasm-unsafe-eval'`                                                                                                                                                                                                                                                                                                                    |
| `src/ui/App.tsx`, `src/ui/app.css`                         | Page: drop zone, "wird geprüft …", result, unexpected errors shown with their message, fixed notice                                                                                                                                                                                                                                                                                     |
| `src/ui/DropZone.tsx`                                      | Drop a file or "Datei auswählen" (first file of a drop counts)                                                                                                                                                                                                                                                                                                                          |
| `src/ui/ResultView.tsx`                                    | Verdict box (tone ok/warn/bad), detail table per invoice XML, other attachments of a PDF                                                                                                                                                                                                                                                                                                |
| `src/logic/analysis.ts`                                    | What IO found, as plain data: `Analysis`, `InvoicePart` (origin, syntax, header values), `OtherPart`, file problems                                                                                                                                                                                                                                                                     |
| `src/logic/syntax.ts`                                      | `SYNTAXES` as data: UBL Invoice/CreditNote, CII, ZUGFeRD 1.0 — recognised by root element + namespace, never by file name                                                                                                                                                                                                                                                               |
| `src/logic/binding.ts`                                     | **The mapping as data:** EN 16931 groups (BG) and terms (BT) → XPath 1.0 for UBL Invoice, UBL CreditNote, CII (from the KoSIT visualization v2026-10-13, Apache-2.0); kinds (date, amount …), German labels; `pathFor`, `allDefinitions`, `termLabel`                                                                                                                                   |
| `src/logic/model.ts`                                       | Uniform model: `RawGroup` → `normalize` (trim, dates ISO, empty groups dropped, UBL note subject "#ADU#" split) → `InvoiceModel`; `valuesOf("BG-4/BT-27")`, `groupsOf`, `firstValue`, `coreValues`, `first`                                                                                                                                                                             |
| `src/io/extract.ts`                                        | `extractModel`: walks the binding over a parsed invoice (group paths select nodes, term paths read text) — adding a term is data only                                                                                                                                                                                                                                                   |
| `src/build/dataModelPage.ts`                               | Generates `docs/data-model.html` from the source (`npm run docs`): entities, relations + SVG, functions, the full binding table, profiles, fixed data                                                                                                                                                                                                                                   |
| `src/logic/profiles.ts`                                    | `PROFILES`: BT-24 identifiers → label, profile, einordnung (eRechnung / keineERechnung / nichtBeurteilt), source, `checked`; `profileOf` (exact before longest prefix)                                                                                                                                                                                                                  |
| `src/logic/verdict.ts`                                     | `verdictOf`: headline, tone, explanation; several invoice XML compared (`differingTerms`: number, date across formats, currency, supplier, amount by value) — never picks one                                                                                                                                                                                                           |
| `src/logic/texts.ts`                                       | Every German sentence (`TEXTS`, `fill`), `TYPE_CODES` (BT-3 labels); test-guarded: never "ordnungsgemäß"/"gültig"                                                                                                                                                                                                                                                                       |
| `src/logic/details.ts`                                     | Detail rows of one invoice (German date and amount, type code label, raw BT-24)                                                                                                                                                                                                                                                                                                         |
| `src/logic/decimal.ts`, `src/logic/dates.ts`               | Exact decimals on BigInt (parse, normalize, equals, German format); dates UBL xs:date / CII format 102 → ISO                                                                                                                                                                                                                                                                            |
| `src/io/analyze.ts`                                        | `analyzeFile`: file kind by content (`%PDF-` / XML prolog), PDF attachments recognised as XML by content, header values read via the mapping, documents disposed                                                                                                                                                                                                                        |
| `src/io/pdfjs.ts`                                          | Loads the pdf.js **legacy** build on first use with the main-thread fake worker, plus a `Promise.withResolvers` polyfill — the modern build failed on every PDF in Chrome/Edge ≤ 139, Firefox ≤ 133, Safari ≤ 18.3 (audit 2026-11-14, S-01)                                                                                                                                             |
| `src/logic/pflichtangaben.ts`                              | **The Pflichtangaben as data:** `PFLICHTANGABEN` (label, norm, KoSIT/FeRD source page, shown paths, `each` per occurrence, `presence` rule, `needs` per mode: immer / bedingt / einzelfall / nicht, `onlyFor`), `MODES` (Kleinunternehmer § 34a, Kleinbetrag § 33 UStDV), `ADDRESS_PARTS`                                                                                               |
| `src/logic/check.ts`                                       | `checkPflichtangaben` → `PflichtResult` (mode, rows with status vorhanden / fehlt / einzelfall, missing parts, values, summary); `present`, `holds`, `modeOf`, `displayValue` (German date/amount/rate, category and unit labels)                                                                                                                                                       |
| `src/ui/PflichtangabenView.tsx`                            | Table in the order of § 14 Abs. 4, status badges, positions in `<details>`, special cases (§ 14 Abs. 5, § 14a, § 22c) in a second table                                                                                                                                                                                                                                                 |
| `src/logic/prolog.ts`                                      | XML prolog scan: BOM/encoding, root found, **DOCTYPE refused before parsing**, `looksLikeXml`                                                                                                                                                                                                                                                                                           |
| `src/io/xml.ts`                                            | libxml2-wasm adapter: `readXml` (size limit, no DOCTYPE, no XXE/net), `valuesAt` (XPath), XSD validators from bundled schemas served from memory (`/schemas/…`), `schemaProblems`                                                                                                                                                                                                       |
| `src/io/schemas.ts`                                        | Bundled XSD text (`import.meta.glob` `?raw`) and the entry schemas                                                                                                                                                                                                                                                                                                                      |
| `src/io/pdf.ts`                                            | pdf.js adapter: `readPdfAttachments` (pdf.js 6: Map without content + `getAttachmentContent`), password/damaged/too large                                                                                                                                                                                                                                                               |
| `schemas/`                                                 | Official XSD, unchanged: UBL 2.1 (OASIS), CII D16B (UN/CEFACT) — origin and licences in `schemas/README.md`                                                                                                                                                                                                                                                                             |
| `tests/build/csp.test.ts`                                  | CSP: no connections/workers, WASM allowed, refuses external scripts                                                                                                                                                                                                                                                                                                                     |
| `tests/io/xml.test.ts`, `src/logic/prolog.test.ts`         | Reading official examples, XPath, DOCTYPE refusal, broken XML with line, XSD valid/invalid                                                                                                                                                                                                                                                                                              |
| `tests/io/pdf.test.ts`                                     | Plain PDF, PDF with two attachments (names, bytes), damaged PDF                                                                                                                                                                                                                                                                                                                         |
| `src/build/minipdf.ts`                                     | Tiny PDF writer for own edge cases and the samples: text lines (Helvetica, WinAnsi), embedded files with /AF relationship, password-protected; no PDF/A                                                                                                                                                                                                                                 |
| `src/build/beispiele.ts`                                   | Catalog of the tester samples (data: one entry per file — KoSIT base + exact changes, own XML, own PDF with a page drawn from the invoice data, expected result), overview page, licence note                                                                                                                                                                                           |
| `beispiele/`                                               | GENERATED samples for testers (`npm run beispiele`, never edit by hand): 27 files + `index.html` (download links) + `LIZENZEN.txt` + Apache-2.0 text; to be uploaded next to the app (postponed by Tobias, not online yet)                                                                                                                                                              |
| `tests/beispiele/beispiele.test.ts`                        | Folder = fresh build (byte-identical, deterministic), each sample shows its expected result, KoSIT-based XML schema-valid, every result headline / case text / hint appears in a sample                                                                                                                                                                                                 |
| `tests/support/fixtures.ts`                                | Reads official fixtures; `withSpecId`, `withInvoiceNumber` derive variants (MINIMUM, unknown id, different invoice)                                                                                                                                                                                                                                                                     |
| `tests/io/extract.test.ts`                                 | Every binding XPath compiles (3 syntaxes); **21 KoSIT invoices in UBL and CII give the same model** (documented differences inside the test files themselves); values of one official invoice; credit-note lines; CII dates                                                                                                                                                             |
| `tests/docs/dataModel.test.ts`                             | `docs/data-model.html` up to date (file snapshot), every field of real objects documented, self-contained                                                                                                                                                                                                                                                                               |
| `tests/io/analyze.test.ts`                                 | Verdict paths with official files and own PDFs: XRechnung UBL/CII/Extension/CVD, MINIMUM/BASIC WL, ZUGFeRD 1.0, unknown/missing id, same invoice in UBL+CII, contradicting XML, attachments not read (DOCTYPE, > 20 MB, > 50 attachments), broken name tree, password, damaged, too large, empty, PNG                                                                                   |
| `tests/io/ferdLokal.test.ts`                               | All 61 official FeRD 2.5.2 Factur-X sample PDFs (local only, `tests/fixtures/lokal/ferd/`): MINIMUM/BASIC WL "keine E-Rechnung", all others recognised, model and Pflichtangaben built — skipped where the folder is missing                                                                                                                                                            |
| `src/logic/*.test.ts`                                      | Profiles, decimals, dates, verdict texts and comparison, detail rows; `check.test.ts`: table integrity (every path exists in the binding), every status path, F1–F3, § 33/§ 34a modes, § 14a/§ 22c cases, display                                                                                                                                                                       |
| `tests/e2e/helpers.ts`                                     | `openApp` (spy for storage/cookie/CSP, request and console listeners), `upload` (waits for the result of exactly this file), `sideEffects`                                                                                                                                                                                                                                              |
| `tests/e2e/erkennen.spec.ts`                               | Playwright on `dist/index.html` (file://): recognition paths, drop (also next to the zone), CSP, a hybrid PDF with the newest JS features removed (older browsers); a spy counts storage/cookie access, BroadcastChannel, WebRTC, popups, beacons, CSP violations, requests and console errors and checks afterwards that no store holds anything — all must be none (spy self-checked) |
| `tests/e2e/pflichtangaben.spec.ts`                         | Pflichtangaben view: complete invoice, missing parts (KoSIT 01.14a), Kleinbetrag (KoSIT 01.02a), positions open on demand                                                                                                                                                                                                                                                               |
| `tests/e2e/handy.spec.ts`                                  | Phone width 375 px and 320 px (with a long file name): no sideways scrolling, each Pflichtangabe stacked (label + status, values below) — fails without the `max-width: 640px` rules and `minmax(0, 1fr)` in `app.css`                                                                                                                                                                  |
| `tests/static/hiddenChars.test.ts`                         | No invisible characters (incl. bidi controls, line separators) in src/tests/docs/manual_tests/beispiele/deploy and the root files (the Write tool decodes `\u` escapes)                                                                                                                                                                                                                 |
| `tests/static/words.test.ts`                               | No "ordnungsgemäß"/"gültig" in any table with German text (TEXTS, PFLICHTANGABEN, MODES, PROFILES, labels) or in the UI components                                                                                                                                                                                                                                                      |
| `tests/fixtures/offiziell/`                                | Official test files, byte-identical (`-text`): CEN 1.3.17 examples (EUPL-1.2), KoSIT testsuite instances incl. 21 UBL/CII pairs in `kosit/paare/` (Apache-2.0) — see its README                                                                                                                                                                                                         |
| `docs/data-model.html`                                     | Generated data model (see Data Model) — never edit by hand                                                                                                                                                                                                                                                                                                                              |
| `docs/plan.md`, `docs/quellen.md`, `docs/offene-fragen.md` | Plan, sources, tax questions (German); `docs/bestandsaufnahme-2026-11-14.md`: inventory and audit with refutation agents (findings, verdicts, fixes, open points)                                                                                                                                                                                                                       |
| `deploy/upload.json`                                       | Upload target `test` → `NebenprojektERechnung/` (access `ipOrLogin`) for `private/Auslieferung`; `deploy/README.md`: server headers the meta CSP cannot set (`frame-ancestors`)                                                                                                                                                                                                         |
| `manual_tests/`                                            | Human-tester instructions (German), ONLY what automated tests cannot cover (Tobias 2026-11-14): `01_echte_rechnungen.md` (real supplier files vs. PDF image), `02_geraete.md` (drag from mail client/Explorer, real phone), `03_verstaendlichkeit.md` (every result read like a client) — see [`manual_tests/README.md`](manual_tests/README.md)                                        |
| `.tmp/quellen/`                                            | Downloaded official artefacts (gitignored, see `docs/quellen.md`)                                                                                                                                                                                                                                                                                                                       |

---

## Data Model

[`docs/data-model.html`](docs/data-model.html) — generated from the source with `npm run docs`
(entities, relationship map, functions, the complete BT → XPath binding, profiles, fixed data).
**Regenerate whenever the model or the binding changes**; `tests/docs/dataModel.test.ts` fails when
the file is out of date or a field of a real object is not documented.

---

## Testing

```bash
npm install --ignore-scripts
npm test             # Vitest (unit + Node integration with pdf.js and libxml2-wasm)
npm run typecheck
npm run lint
npm run format:check
npm run build        # dist/index.html
npm run test:e2e     # build + Playwright (Chromium, Firefox, WebKit; shared browser cache)
npm run docs         # regenerate docs/data-model.html
npm run beispiele    # regenerate beispiele/ (tester samples)
```

Report only results observed in the same session (workspace test-integrity rule).

**Claude Code on the web:** the container has only Chromium, a newer build than the pinned
Playwright 1.61.0 expects. Run the e2e tests with a config in the gitignored `.tmp/` that sets
`launchOptions.executablePath: '/opt/pw-browsers/chromium'`; Firefox and WebKit run only locally.
`npm install` with npm 10 drops the `libc` fields from `package-lock.json` — revert that change.

## Development Server Ports

| Server                    | Port                                                       |
| ------------------------- | ---------------------------------------------------------- |
| Vite dev server / preview | 5178 (workspace standard — never run two projects at once) |

## Versioning

Semantic versioning in `package.json`, injected as `__APP_VERSION__`. Workflow: bump
`package.json` → `chore: bump version to X.Y.Z` → `git tag vX.Y.Z`.

---

## Known Limitations

- **In development** — steps 2b–3a not built yet (see `docs/plan.md`).
- **Pflichtangaben are hints from the data, not a tax review.** Decided or researched with official
  sources (`docs/offene-fragen.md`): F5, F7 (Nr. 6a only for invoices from 01.01.2028), F10 (any
  reachable address; missing street = hint), F11, F12 (periods on some positions count, hint on
  Nebenleistung), F13, F14, F15 (replaces F3: a note "Leistungsdatum entspricht Rechnungsdatum"
  is not enough in an e-invoice, UStAE 14.5 Abs. 16 — "fehlt" with a hint).
- **Text detection** (notes, exemption reasons, payment terms) uses German keywords as data
  (`pflichtangaben.ts`, e.g. `REDUCTION_WORDS` for § 14 Abs. 4 Nr. 7, F8); other
  languages or unusual wording are not recognised. A row found by its wording shows the matching
  text as its value.
- **§ 3c UStG** (distance sales, excluded from § 33 UStDV) and new vehicles (§ 14a Abs. 4) cannot be
  recognised from the data.
- **Binding scope:** payment instructions (BG-16 … BG-19), references BT-11/12/14–19, BT-29 schemes
  and XRechnung sub-lines (BG-DEX) are not mapped — not needed for the Pflichtangaben or the rules.
  UBL notes: the subject code is read only in the XRechnung form "#ADU#Text" (KoSIT's own
  stylesheet also accepts a separate preceding three-letter note).
- **UBL `ChargeIndicator`** accepted as false/true and 0/1; CII `TaxTotalAmount` without a currency
  attribute counts as BT-110 (the D16B schema allows it, KoSIT does not).
- **Profile identifiers** are backed by official sample files (FeRD 2.5.2, KoSIT, CEN) except
  ZUGFeRD 1.0: its namespaces in `syntax.ts` are from memory, not from a sample file (`checked:
false`). An official CEN example in CII D16B carrying the ZUGFeRD 1.0 id is called "keine
  E-Rechnung" (F5).
- **Attachments only from the EmbeddedFiles name tree** (where Factur-X/ZUGFeRD put the XML).
  Files attached only as page annotations are not seen. At most 50 attachments are read.
- **Password-protected PDF** is tested with a synthetic encryption dictionary (the reader asks for
  a password); a real protected supplier PDF is not in the tests.
- **E2E runs on file://**; the hosted copy is **older** than the repo (uploaded 2026-11-13 at
  Fragebogen commit 76828a3, step 1c) and both show version 0.1.0 — bump the version before the next
  upload so testers can tell them apart.
- **Browsers:** the single inline script needs class static blocks and the CSP
  `'wasm-unsafe-eval'`, so the floor is about Chrome/Edge 98, Firefox 102, Safari 16.4 (derived from
  MDN data, not tested in those versions). Above it XML and PDF work (pdf.js legacy build, e2e test
  without the newest JS features).
- **Hierarchical CII lines** (ZUGFeRD EXTENDED: `ParentLineID`, `LineStatusReasonCode` GROUP /
  INFORMATION) are read as ordinary positions, as the KoSIT visualization does; a GROUP line
  without quantity shows "Menge fehlt" (audit B-02b).
- **Not recognised:** a UBL invoice inside a Peppol Standard Business Document envelope (SBDH,
  "XML ohne bekanntes Rechnungsformat"); duplicate keys in a PDF name tree hide one attachment
  (pdf.js builds a map); the size of a compressed attachment is only known after unpacking (only
  the file size is limited); a `<meta>` CSP cannot set `frame-ancestors` (`deploy/README.md`).
- **FeRD ZUGFeRD 2.5.2 sample invoices** may not be redistributed → they stay local in
  `tests/fixtures/lokal/ferd/` (61 Factur-X PDFs); `tests/io/ferdLokal.test.ts` checks all of them
  and is **skipped** where the folder is missing — a skipped test is not a pass.
- **Mapping source:** KoSIT/FeRD recommendation, Stand 25.07.2025 — copyrighted, not in the repo;
  our data table cites it per row. Deviations from the hand-over's provisional table: F9.

---

## Status / next step

**2026-11-14 — inventory and audit with refutation agents:** five audit agents (logic, IO/security,
binding, tests/docs, UI/texts) and five refutation agents; 66 findings, verdicts and fixes in
`docs/bestandsaufnahme-2026-11-14.md`. Fixed among others: PDFs in older browsers (pdf.js legacy),
phone layout (320/375 px, long file names), DOCTYPE behind another encoding, text nodes > 10 MB,
attachments not read are "nicht vollständig geprüft" instead of "Formatfehler", "§ 195 BGB" no
Kleinunternehmer hint, BT-24 in the comparison of several XML, harder storage/network guards. New
open tax questions F16–F21 for Tobias. Not pushed (waiting for Tobias' OK).

**2026-11-14 — tester samples, F8/F9, GitHub:** manual tests reduced to what automation cannot
cover (phone width is now an e2e test); `beispiele/` (26 samples, `npm run beispiele`) with
coverage of every headline/case text/hint; F8 and F9 decided; fixes: exemption reason per VAT
category, text-found rows show their text, "aufzubewahren". Repo pushed to GitHub. Upload of the
samples to `NebenprojektERechnung/` postponed by Tobias ("lassen wir"). Next: phase 2b (schema
view, FeRD profile XSDs), then 3a (rules).

**2026-11-13 — own project:** moved out of `Fragebogen/e-rechnung/` with its history; workspace
conventions added (licences, `.gitattributes`, `import/` rule); registered in the workspace
projects table. Phase 1 uploaded to `NebenprojektERechnung/`. Next: process the FeRD package
(profile ids, profile XSDs, local samples), research answers F5/F7/F10/F12, then phase 2b.

**2026-11-13 — phase 0 done:** plan approved; sources downloaded to `.tmp/quellen/` (KoSIT config +
testsuite, CEN 1.3.17, KoSIT/FeRD recommendation); scaffold; `npm install --ignore-scripts`; spike
passed in Chromium, Firefox, WebKit (throw-away code in `.tmp/spike/`, results in `docs/plan.md`).
XSDs (UBL 2.1, CII D16B) taken over early because the spike needed them.

**2026-11-13 — step 1a done (detect):** file kind by content, PDF attachments, syntax and profile
tables as data, verdicts with the hand-over's headlines, several XML compared, UI with drop zone.
Waiting for Tobias: FeRD 2.5.2 package (form download) → `.tmp/quellen/ferd/`; confirmation of F5.

**2026-11-13 — step 1c done (Pflichtangaben view):** table after the KoSIT/FeRD recommendation and
the law text (gesetze-im-internet.de, fetched 13.11.2026), modes § 33/§ 34a UStDV, view with
status badges. Phase 1 complete; next: push/upload only after Tobias' OK, then phase 2b (schema).

**2026-11-13 — step 1b done (normalise):** binding as data from the KoSIT visualization
(`.tmp/quellen/kosit-visualization/`, extracted tables `*.binding.txt`), generic extraction,
normalisation, 21 UBL/CII pairs cross-checked, `docs/data-model.html` generated. Next: step 1c
(Pflichtangaben view after the KoSIT/FeRD recommendation, F1–F3, F7–F9).
