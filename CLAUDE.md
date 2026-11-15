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
- **Storage (changed 2026-11-15):**
  - Until then: no storage at all (no localStorage, IndexedDB, cookies), because other apps live on
    the same origin and their data and "delete all data on this device" must stay untouched.
  - Tobias 2026-11-15, „ja, Beschränkung fällt“: the ban falls, together with the move to a subdomain
    of its own. First use: remembering the confirmed access notice (see Status).
  - Storing anything more, such as invoices or results, only after asking him.
  - While a copy still shares the origin: only keys of its own with an own prefix; never read or
    clear another app's data.
- Development phase: only in `NebenprojektERechnung/` (office IPs or tester login), not linked.
- UI German, Sie-form, simple sentences, style like the Fragebogen app.
- **Tax questions are never decided by Claude** — collect them in `docs/offene-fragen.md` for Tobias.

**Non-goals:** no full validator (no rebuild of all CEN/KoSIT/FeRD Schematron rules), no XRechnung
BR-DE rules as errors (B2B needs no XRechnung), no PDF/A check, no tax judgement of content, no
online VAT-ID lookup.

**Workflow (Tobias 2026-11-13, changed 2026-11-14):** commit without asking and report the
commits. **Reversible GitHub actions without asking** (Tobias 2026-11-14: "reversibel GitHub
Aktionen kannst du ohne mich ausführen"): push to the working branch, open and update pull
requests, merge into `main` (a merge can be reverted) — report what was done. Not reversible, so
still only after his explicit OK: the **upload** to the server, force-pushes or deleting branches
and anything outside GitHub. GitHub: https://github.com/tobiasheinrichfaska/E-Rechnung-Pruefer
(public, created 2026-11-14 on his request; Claude Code on the web works from his GitHub account —
keep `main` current so web sessions see it).

**Cloud / local split (Tobias 2026-11-14):** development, all tests and audits run in Claude Code on
the web; locally only the upload (`npm run hochladen`), server headers, downloads behind forms and
the manual tests remain — briefing for the local Claude Code:
[`docs/briefing-claude-lokal.md`](docs/briefing-claude-lokal.md) (German).

- Plan and step status: [`docs/plan.md`](docs/plan.md) (German)
- Sources, versions, licences, SHA-256: [`docs/quellen.md`](docs/quellen.md)
- Open and decided tax questions: [`docs/offene-fragen.md`](docs/offene-fragen.md)

---

## Project Directory

| File/Folder                                                | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLAUDE.md`                                                | This file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `README.md`                                                | Public description (German), licence section                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `LICENSE`, `LICENSE_COMMERCIAL.md`, `CONTRIBUTING.md`      | AGPLv3 + commercial dual licensing, CLA (verbatim workspace templates)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `.gitattributes`                                           | Workspace template (LF) plus `-text` for the official XSD and test files (byte-identical to their source)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `.prettierrc.json`                                         | Formatting (same settings as the Fragebogen app)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `import/`                                                  | Inbox for delivered material (gitignored); empty after processing — processed files go to `import-archiv/<JJJJ-MM-TT_HH-MM-SS>/` (gitignored)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `FEATURES_REQUIRED.md`                                     | Critical user paths                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `package.json` / `package-lock.json`                       | Scripts (`build` live, `build:test` the test version into `dist-test/`, `test:e2e` builds both) and exactly pinned dependencies (versions as in the Fragebogen app)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `vite.config.ts`                                           | Vite + single-file build, CSP plugin, Vitest config (`pool: 'forks'` for pdf.js); mode `testbereich` (`build:test`) sets `__TESTER_INVITE__` = `/_zugang/einladen`, every other mode `null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `tsconfig.json`                                            | Strict TS like the Fragebogen app                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `eslint.config.js`                                         | Layering (`src/logic` free of UI/IO/engines) and a ban on storage and network APIs in `src/` — `localStorage` only in `src/io/accessStore.ts` (`ACCESS_STORE`, 2026-11-15)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `playwright.config.ts`                                     | E2E in Chromium, Firefox, WebKit on the built file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `.github/workflows/tests.yml`                              | The GitHub check **„Tests“** (Tobias 2026-11-15, after the Fragebogen's): typecheck, lint, format, unit tests and e2e in three browsers on every push to `main` and on pull requests; every upload waits for it green on its commit; tests needing the private files skip there                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `.gitignore`, `.prettierignore`                            | Ignores (`node_modules/`, `dist/`, `.tmp/`, `import/`, `import-archiv/`, `dist-test/`, `tests/fixtures/lokal` as folder or link to the private repo, `config/*.local.*`, `deploy/.local/`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `index.html`                                               | Entry HTML (`lang="de"`, no external URLs, `robots` `noindex` since 2026-11-15)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/main.tsx`                                             | Mounts the React app                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/appInfo.ts`                                           | App name + version (`__APP_VERSION__` from `package.json`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `config/`                                                  | `kanzlei.example.json` (neutral, `{}`), `kanzlei.local.json` (gitignored; the original with the access notice naming the Kanzlei lives in `E-Rechnung-Pruefer-privat/config/`), `README.md` (German): which file the build reads                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/build/kanzleiConfig.ts`                               | Node only: `configFile` / `loadAppConfig` — `config/kanzlei.local.json`, else `tests/fixtures/lokal/config/kanzlei.local.json`, else the neutral example; an invalid file stops the build. Used by `vite.config.ts` (`__APP_CONFIG__`) and the tests                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/config.ts`                                            | `APP_CONFIG`: the parsed configuration injected at build time; `TESTER_INVITE` (`{ href, text }` only in the test version, else `null`; its label lives here so the live build carries neither address nor word)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/logic/appConfig.ts`                                   | `AppConfig` (`accessNotice?`, `imprintUrl?`, `privacyUrl?`, `colors?`), `parseAppConfig`: only known keys, a non-blank text up to 2000 characters without unpaired surrogates, links only https without login data; `KanzleiColors` as in the Fragebogen (`accent` required, `chosenBg`, `infoBg`, `accentDark`), `contrastRatio` (WCAG), each colour at least 4.5:1 against its text or background, `colorVariables` → `--kanzlei-…` (set in `src/main.tsx` through the CSSOM)                                                                                                                                                                                                                        |
| `src/logic/accessGate.ts`                                  | Access notice (Tobias 2026-11-15, like the Fragebogen's): `accessGateNeeded` (notice configured, https, the remembered fingerprint read only then and differing), `accessToken` (SHA-256 of the notice, `@noble/hashes`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/logic/storageKeys.ts`                                 | `ACCESS_STORAGE` = `e-rechnung-pruefer-zugang`, the only stored name; `storageKey` per folder (`@/folder/` outside the root), `folderOf`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/io/accessStore.ts`                                    | `loadAccess`, `saveAccess`: the only browser storage of the tool, every access guarded                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/ui/AccessGate.tsx`                                    | „Bitte bestätigen“: the notice as the label of its tick box, „Antwort für die Zukunft merken“, „Weiter“ only with the tick; heading focused; `App` shows it before the tool and refuses drops meanwhile                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/ui/Footer.tsx`                                        | Foot of every page: version (no „in Entwicklung“ since 2026-11-15) and, where configured, „Impressum“ and „Datenschutz“ of the Kanzlei (Tobias 2026-11-15), new tab, `noopener noreferrer`; the test version adds „Tester einladen“ → `TESTER_INVITE`, same tab (Tobias 2026-11-15)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/build/csp.ts`                                         | CSP meta tag with hashes, `connect-src 'none'`, `'wasm-unsafe-eval'`, `worker-src` and `manifest-src` `'none'` (not installable, 2026-11-15)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/ui/App.tsx`, `src/ui/app.css`                         | Page: drop zone (the whole page takes a dropped file and highlights the zone), "wird geprüft …", result with "Geprüfte Datei … – geprüft am … um … Uhr" (and "Geprüft wurde nur die erste" for several files), a file the browser cannot read (folder) as its own result, unexpected errors shown with their message, fixed notice (the XML sentence only for an e-invoice, F19); a status line that always exists and announces one short sentence, focus on the result headline (audit U-04); print: `@media print` and all `<details>` opened on `beforeprint` (audit Bedienung)                                                                                                                    |
| `src/ui/DropZone.tsx`                                      | Drop a file or "Datei auswählen" (first file of a drop counts, the count is passed on); only drags carrying files are invited                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/ui/ResultView.tsx`                                    | Verdict box (tone ok/warn/bad; with several XML the differing values of each part), detail table per invoice XML (heading with the attachment name), other attachments of a PDF; row "Schema (XSD)" and the technical schema messages on demand, the engine's English message marked `lang="en"`                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/logic/analysis.ts`                                    | What IO found, as plain data: `Analysis`, `InvoicePart` (origin, syntax, header values), `OtherPart`, file problems; `SchemaResult` (schema, checked, reason, first 20 problems, count)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/logic/syntax.ts`                                      | `SYNTAXES` as data: UBL Invoice/CreditNote, CII, ZUGFeRD 1.0 — recognised by root element + namespace, never by file name; per syntax the official schema KoSIT uses (UBL 2.1 Invoice/CreditNote, CII D16B)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/logic/binding.ts`                                     | **The mapping as data:** EN 16931 groups (BG) and terms (BT) → XPath 1.0 for UBL Invoice, UBL CreditNote, CII (from the KoSIT visualization v2026-10-13, Apache-2.0); kinds (date, amount …), German labels; `pathFor`, `allDefinitions`, `termLabel`                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/logic/model.ts`                                       | Uniform model: `RawGroup` → `normalize` (trim, dates ISO, empty groups dropped, UBL note subject "#ADU#" split) → `InvoiceModel`; `valuesOf("BG-4/BT-27")`, `groupsOf`, `firstValue`, `coreValues`, `first`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/io/extract.ts`                                        | `extractModel`: walks the binding over a parsed invoice (group paths select nodes, term paths read text) — adding a term is data only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/build/dataModelPage.ts`                               | Generates `docs/data-model.html` from the source (`npm run docs`): entities, relations + SVG, functions, the full binding table, profiles, fixed data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/logic/profiles.ts`                                    | `PROFILES`: BT-24 identifiers → label, profile, einordnung (eRechnung / keineERechnung / nichtBeurteilt), source, `checked`; `profileOf` (exact before longest prefix); `ownSchema` (Factur-X EXTENDED → FeRD schema; ZUGFeRD 2.0 EXTENDED → not checked), `ownRules` (FeRD EXTENDED: own forms of the calculation rules)                                                                                                                                                                                                                                                                                                                                                                              |
| `src/logic/verdict.ts`                                     | `verdictOf`: headline, tone, explanation; several invoice XML compared (`differingTerms`: number, date across formats, currency, supplier, amount by value) — never picks one; schema problems (step 2b): "Rechnungsdaten mit Formatfehler (…)" + technical lines + F4 sentence, for every part of a PDF, never for "keine E-Rechnung"; `rulesOf` (step 3a): a possible irregularity in the amounts makes an e-invoice "warn" with "Mögliche Auffälligkeit bei den Beträgen: BR-…"                                                                                                                                                                                                                     |
| `src/logic/texts.ts`                                       | Every German sentence (`TEXTS`, `fill`), `TYPE_CODES` (BT-3 labels); test-guarded: never "ordnungsgemäß"/"gültig"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/logic/details.ts`                                     | Detail rows of one invoice (German date and amount, type code label, raw BT-24)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/logic/decimal.ts`, `src/logic/dates.ts`               | Exact decimals on BigInt (parse, normalize, equals, German format; add, subtract, multiply, sum, `roundTo` like XPath `round()`, `within` a tolerance); dates UBL xs:date / CII format 102 → ISO                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/io/analyze.ts`                                        | `analyzeFile`: file kind by content (`%PDF-` / XML prolog), PDF attachments recognised as XML by content, header values read via the mapping, documents disposed; schema check of each invoice XML against the bundled XSD (step 2b)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/io/pdfjs.ts`                                          | Loads the pdf.js **legacy** build on first use with the main-thread fake worker, plus a `Promise.withResolvers` polyfill — the modern build failed on every PDF in Chrome/Edge ≤ 139, Firefox ≤ 133, Safari ≤ 18.3 (audit 2026-11-14, S-01)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/logic/pflichtangaben.ts`                              | **The Pflichtangaben as data:** `PFLICHTANGABEN` (label, norm, KoSIT/FeRD source page, shown paths, `each` per occurrence, `presence` rule, `needs` per mode: immer / bedingt / einzelfall / nicht, `onlyFor`), `MODES` (Kleinunternehmer § 34a, Kleinbetrag § 33 UStDV), `ADDRESS_PARTS`                                                                                                                                                                                                                                                                                                                                                                                                              |
| `src/logic/check.ts`                                       | `checkPflichtangaben` → `PflichtResult` (mode, rows with status vorhanden / fehlt / einzelfall, missing parts, values, summary); `present`, `holds`, `modeOf`, `displayValue` (German date/amount/rate, category and unit labels)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/logic/rules.ts`                                       | **Step 3a:** `checkRules` → `RulesResult` (per rule: id, label, occurrence, status passt / auffaellig / nichtPruefbar, the values that show it): BR-CO-10 … BR-CO-17 and the breakdown per VAT category and rate (BR-S-08, BR-Z-08, BR-E-08, BR-AE-08, BR-IC-08, BR-G-08, BR-O-08, BR-IG-08, BR-IP-08) exactly as the CEN Schematron 1.3.17 computes them (round(x·100)/100, tolerance 1 for BR-CO-17 and S/L/M); `ownRules` for FeRD EXTENDED: with `extended` the FeRD rules of `rulesExtended.ts`, else only BR-CO-14; BR-CO-14 only where BT-110 is given (as the Schematron); values named ("Gesamtbetrag mit Umsatzsteuer (BT-112)") with "Nach der Regel erwartet"; `notChecked`; `RULE_LABELS` |
| `src/logic/rulesExtended.ts`                               | **F29:** `checkExtendedRules` — the calculation rules of FeRD for Factur-X 1.09.2 EXTENDED as its Schematron computes them (BR-FXEXT-CO-10 … -16, -S-09b, breakdown -08b; DETAIL lines only, logistics charges, financial adjustments, tolerance 0.01 per amount, ≤); `ExtendedAmounts` read in `src/io/analyze.ts`                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/ui/PflichtangabenView.tsx`                            | Table in the order of § 14 Abs. 4, status badges, positions in `<details>`, special cases (§ 14 Abs. 5, § 14a, § 22c) in a second table; row headers (`th scope="row"`), tables and sections named by their headings, column headers hidden on phones for the eye only (audit U-13)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/ui/RulesView.tsx`                                     | Section "Rechnerische Prüfung": summary ("Mögliche Auffälligkeit: BR-… " or "passen zusammen", plus how many rules could not be checked), irregular rules open with their values and the value the rule expects, the others on demand; EXTENDED note; named after its part with several XML                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/logic/prolog.ts`                                      | XML prolog scan: BOM/encoding, root found, **DOCTYPE refused before parsing**, `looksLikeXml`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/io/xml.ts`                                            | libxml2-wasm adapter: `readXml` (size limit, no DOCTYPE, no XXE/net), `valuesAt` (XPath), XSD validators from bundled schemas served from memory (`/schemas/…`), `schemaProblems`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/io/schemas.ts`                                        | Bundled XSD text (`import.meta.glob` `?raw`) and the entry schemas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/io/pdf.ts`                                            | pdf.js adapter: `readPdfAttachments` (pdf.js 6: Map without content + `getAttachmentContent`), password/damaged/too large                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `schemas/`                                                 | Official XSD, unchanged: UBL 2.1 (OASIS), CII D16B (UN/CEFACT), Factur-X 1.09.2 EXTENDED (FeRD, Apache-2.0, step 2a) — origin and licences in `schemas/README.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `tests/build/csp.test.ts`                                  | CSP: no connections/workers, WASM allowed, refuses external scripts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `tests/io/xml.test.ts`, `src/logic/prolog.test.ts`         | Reading official examples, XPath, DOCTYPE refusal, broken XML with line, XSD valid/invalid                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `tests/io/pdf.test.ts`                                     | Plain PDF, PDF with two attachments (names, bytes), damaged PDF                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/build/minipdf.ts`                                     | Tiny PDF writer for own edge cases and the samples: text lines (Helvetica, WinAnsi), embedded files with /AF relationship, password-protected; no PDF/A                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/build/compressedPdf.ts`                               | A PDF built like real Factur-X files (FlateDecode attachment, object stream, xref stream with predictor, name tree with Kids, optional incremental update) — the real FeRD samples may not be redistributed (audit T-02); Node only                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/build/beispiele.ts`                                   | Catalog of the tester samples (data: one entry per file — KoSIT base + exact changes, own XML, own PDF with a page drawn from the invoice data, expected result), overview page, licence note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `beispiele/`                                               | GENERATED samples for testers (`npm run beispiele`, never edit by hand): 35 files + `index.html` (download links) + `README.md` (the same table, shown by GitHub below the files) + `LIZENZEN.txt` + Apache-2.0 text; **not uploaded next to the public copy** (Tobias 2026-11-15) — testers take them from the public repo or the local folder                                                                                                                                                                                                                                                                                                                                                        |
| `tests/beispiele/beispiele.test.ts`                        | Folder = fresh build (byte-identical, deterministic), each sample shows its expected result, KoSIT-based XML schema-valid, every result headline / case text / hint appears in a sample                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `tests/support/fixtures.ts`                                | Reads official fixtures; `withSpecId`, `withInvoiceNumber` derive variants (MINIMUM, unknown id, different invoice)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `tests/io/extract.test.ts`                                 | Every binding XPath compiles (3 syntaxes); **all 33 KoSIT invoices in UBL and CII give the same model** (compared as multisets; documented differences inside the test files themselves); every path finds a value in an official file (CII BT-8, CreditNote BT-9 on schema-valid derived files); values of one official invoice; credit-note lines; CII dates                                                                                                                                                                                                                                                                                                                                         |
| `tests/docs/dataModel.test.ts`                             | `docs/data-model.html` up to date (file snapshot), every field of real objects documented, self-contained                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `tests/io/analyze.test.ts`                                 | Verdict paths with official files and own PDFs: XRechnung UBL/CII/Extension/CVD, MINIMUM/BASIC WL, ZUGFeRD 1.0, unknown/missing id, same invoice in UBL+CII, contradicting XML, attachments not read (DOCTYPE, > 20 MB, > 50 attachments), broken name tree, password, damaged, too large, empty, PNG; schema check: no problem in any official file, comma amount with line and F4 sentence, several XML in any order, EXTENDED left out, none for "keine E-Rechnung"                                                                                                                                                                                                                                 |
| `tests/io/rules.test.ts`                                   | Step 3a on real files: no possible irregularity in any official invoice (> 500 rule checks); a wrong total gives BR-CO-15/-16 with the values and "warn"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `tests/io/ferdLokal.test.ts`                               | All 61 official FeRD 2.5.2 Factur-X sample PDFs (local only, `tests/fixtures/lokal/ferd/`): MINIMUM/BASIC WL "keine E-Rechnung", all others recognised, model and Pflichtangaben built — skipped where the folder is missing; no schema problem (CII D16B, EXTENDED against its FeRD schema); no possible irregularity in the amounts (EXTENDED: only BR-CO-14) — ran in the cloud session 2026-11-14 with Tobias' upload: 62/62                                                                                                                                                                                                                                                                       |
| `tests/io/zugferd1Lokal.test.ts`                           | The 12 official FeRD ZUGFeRD 1.0 sample PDFs (local only, `tests/fixtures/lokal/zugferd-1.0/`): attachment `ZUGFeRD-invoice.xml` found by content, identifier `…:1p0:basic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | comfort | extended`, "keine E-Rechnung", no schema check; plus a PDFlib file and two XML kept by Mustang — skipped where the folder is missing |
| `src/logic/*.test.ts`                                      | Profiles, decimals, dates, verdict texts and comparison, detail rows; `check.test.ts`: table integrity (every path exists in the binding), every status path, F1–F3, § 33/§ 34a modes, § 14a/§ 22c cases, display; `rules.test.ts`: every rule passing and failing, prepaid/rounding, tolerance below 1, rate 0, exact breakdown of other categories, not a number, FeRD EXTENDED only BR-CO-14, BR-CO-14 only with BT-110, named values and expected value, unchecked rules in the summary                                                                                                                                                                                                            |
| `tests/e2e/helpers.ts`                                     | `BUILT`, `BUILT_TEST` (`dist/`, `dist-test/`); `openApp` (spy for storage/cookie/CSP, request and console listeners; storage calls with their key, reading and writing the access key allowed in `sideEffects`), `openHosted` (the built file at `https://e-rechnung.test/…`, every other address refused; both take the build to open), `upload` (waits for the result of exactly this file), `sideEffects`                                                                                                                                                                                                                                                                                           |
| `tests/e2e/erkennen.spec.ts`                               | Playwright on `dist/index.html` (file://): recognition paths, drop (also next to the zone), CSP, a hybrid PDF with the newest JS features removed (older browsers); a spy counts storage/cookie access, BroadcastChannel, WebRTC, popups, beacons, CSP violations, requests and console errors and checks afterwards that no store holds anything — all must be none (spy self-checked)                                                                                                                                                                                                                                                                                                                |
| `tests/e2e/pflichtangaben.spec.ts`                         | Pflichtangaben view: complete invoice, missing parts (KoSIT 01.14a), Kleinbetrag (KoSIT 01.02a), positions open on demand                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `tests/e2e/handy.spec.ts`                                  | Phone width 375 px and 320 px (with a long file name): no sideways scrolling, each Pflichtangabe stacked (label + status, values below) — fails without the `max-width: 640px` rules and `minmax(0, 1fr)` in `app.css`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tests/e2e/bedienung.spec.ts`                              | Audit Bedienung: check time and "only the first of several files", a file the browser cannot read (folder), drags invited only for files and over the whole page, printing (drop zone hidden, sections opened and closed again), focus ring on the button                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `tests/e2e/zugang.spec.ts`                                 | Screen readers: status line present before the result and only a short sentence in it, focus on the headline, row headers, column headers kept on a phone, named tables, several invoice XML named apart                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `tests/e2e/zugangshinweis.spec.ts`                         | Access notice over https (`openHosted`): nothing of the tool before the tick, remembered fingerprint, changed text asked again, own key in a folder, drops refused, `file://` asks nothing; spy self-check (exactly the access key allowed) — with the private configuration, else the branch "opens at once"                                                                                                                                                                                                                                                                                                                                                                                          |
| `tests/e2e/fusszeile.spec.ts`                              | Impressum and privacy links from the local configuration (href, new tab, on the notice and in the tool, also on `file://`) — else the branch "links nowhere"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `tests/e2e/farben.spec.ts`                                 | Kanzlei colours from the local configuration: button, links, drop zone while dragging and the notice take them, no CSP violation — else the defaults of `app.css`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `tests/e2e/testfassung.spec.ts`                            | The test version: `dist/index.html` contains neither `_zugang` nor the word „Tester einladen“ and shows no such link; `dist-test/index.html` links it in the footer (href, same tab, accent colour, resolves to the host root, following it asks for exactly that page), no CSP violation or storage                                                                                                                                                                                                                                                                                                                                                                                                   |
| `tests/e2e/installation.spec.ts`                           | Not installable (Tobias 2026-11-15), live build and test version: no manifest, no apple-mobile-web-app tags, no touch icon, no service-worker code; CSP `manifest-src`/`worker-src 'none'`; no service worker registered over https                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `tests/static/hiddenChars.test.ts`                         | No invisible characters (incl. bidi controls, line separators) in src/tests/docs/manual_tests/beispiele/deploy and the root files (the Write tool decodes `\u` escapes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `tests/static/words.test.ts`                               | No "ordnungsgemäß"/"gültig" in any table with German text (TEXTS, PFLICHTANGABEN, MODES, PROFILES, labels) or in the UI components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `tests/static/storageBan.test.ts`                          | Regression test of the storage ban (ESLint API): `localStorage` allowed only in the access store; sessionStorage, IndexedDB, caches, cookies, `window.localStorage`, `navigator.storage`, `fetch` refused there and everywhere                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `tests/static/noBranding.test.ts`                          | The access notice of the local configuration and its first sentence (with the Kanzlei name) in no tracked file; without a local file the build reads the neutral example                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `tests/fixtures/offiziell/`                                | Official test files, byte-identical (`-text`): CEN 1.3.17 examples (EUPL-1.2), KoSIT testsuite instances incl. all 33 UBL/CII pairs of `instances/standard` in `kosit/paare/` (Apache-2.0) — see its README                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `docs/data-model.html`                                     | Generated data model (see Data Model) — never edit by hand                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `docs/plan.md`, `docs/quellen.md`, `docs/offene-fragen.md` | Plan, sources, tax questions (German); `docs/briefing-claude-lokal.md`: what the cloud session does and what remains local; `docs/bestandsaufnahme-2026-11-14.md`: inventory and audit with refutation agents (findings, verdicts, fixes, open points); `docs/audit-bedienung-2026-11-14.md`: quality audit of the handling (flow, comprehension, accessibility, result page) with refutation agents, fixes, open design questions G-1 … G-10                                                                                                                                                                                                                                                          |
| `docs/wochenpruefung.md`                                   | Checklist of this project for the weekly scheduled task „Wochenprüfung“ (its task file: `aufgaben/wochenpruefung.md` in the private repo `Pruefvorgaenge`): BMF letters and FAQ, UStG/UStDV, UStAE, KoSIT/XRechnung releases (4.0), FeRD versions, CEN artefacts, the KoSIT/FeRD recommendation; S1 no Kanzlei data in the public repo, S2 tests with the private files. Tax changes become questions in `docs/offene-fragen.md`, never code                                                                                                                                                                                                                                                           |
| `deploy/upload.json`                                       | Upload target `test` → `NebenprojektERechnung/` (access `ipOrLogin`) for `private/Auslieferung`; `deploy/README.md`: server headers the meta CSP cannot set (`frame-ancestors`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `manual_tests/`                                            | Human-tester instructions (German), ONLY what automated tests cannot cover (Tobias 2026-11-14): `01_echte_rechnungen.md` (real supplier files vs. PDF image), `02_geraete.md` (drag from mail client/Explorer, real phone, „Tester einladen“ in the test zone), `03_verstaendlichkeit.md` (every result read like a client) — see [`manual_tests/README.md`](manual_tests/README.md)                                                                                                                                                                                                                                                                                                                   |
| `.tmp/quellen/`                                            | Downloaded official artefacts (gitignored, see `docs/quellen.md`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

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
npm run build        # dist/index.html (live)
npm run build:test   # dist-test/index.html (test zone: footer link „Tester einladen“)
npm run test:e2e     # both builds + Playwright (Chromium, Firefox, WebKit; shared browser cache)
npm run docs         # regenerate docs/data-model.html
npm run beispiele    # regenerate beispiele/ (tester samples)
```

Report only results observed in the same session (workspace test-integrity rule).

**GitHub check „Tests“** (`.github/workflows/tests.yml`, 2026-11-15): the same commands on GitHub's
runners for every push to `main` and every pull request. There the private repo is missing, so
`ferdLokal`, `zugferd1Lokal` and the Kanzlei branches of the e2e specs skip, and the cloud session
stays the place where they run. Every upload (repo `Freigabe`) waits for this check.

**Claude Code on the web (everything runs there, Tobias 2026-11-14):** the Default environment
has one setup script for all web apps (Tobias 2026-11-14: "alle Webapps die gleiche Umgebung");
each repository keeps its own block — the Fragebogen session keeps the frame and its block, this
project its `E-Rechnung-Pruefer` block: `npm ci --ignore-scripts` and the browsers of the pinned
Playwright 1.61.0 (Chromium, Firefox, WebKit) into `/opt/pw-browsers`, next to the preinstalled
Chromium. `PLAYWRIGHT_BROWSERS_PATH` points there already, so the unchanged `npm run test:e2e` runs
all three engines. To change the block: `get_environment`, edit only this block, send the whole
script with `update_environment` ("replaces the existing setup script"). Without a fresh container
(or if the block failed), run the block by hand from the folder above the checkout:

```bash
cd E-Rechnung-Pruefer && npm ci --ignore-scripts && npx playwright install --with-deps chromium firefox webkit
```

The FeRD samples may not be redistributed: they live in the **private repository
`tobiasheinrichfaska/E-Rechnung-Pruefer-privat`** (`ferd/` = the 61 samples, `ferd-paket/` = the
whole FeRD package, SHA-256 as in `docs/quellen.md`; `zugferd-1.0/` = the 12 ZUGFeRD 1.0 samples
with specification and XSD, origin in its `QUELLEN.tsv`), linked or cloned as `tests/fixtures/lokal`
(gitignored as folder and as link). **Every cloud session attaches it by itself (Tobias
2026-11-14):** if `tests/fixtures/lokal` is missing at the start, call `add_repo` (owner
`tobiasheinrichfaska`, repo `E-Rechnung-Pruefer-privat`, access `push`), clone it as that tool says,
`register_repo_root`, then `ln -s /home/user/e-rechnung-pruefer-privat tests/fixtures/lokal`.
Selected at session start, the shared setup script links it already. Without it
`tests/io/ferdLokal.test.ts` and `tests/io/zugferd1Lokal.test.ts` are skipped — not a pass. Use `npm ci`, not `npm install` (npm 10 drops
the `libc` fields from `package-lock.json`).

## Development Server Ports

| Server                    | Port                                                       |
| ------------------------- | ---------------------------------------------------------- |
| Vite dev server / preview | 5178 (workspace standard — never run two projects at once) |

## Versioning

Semantic versioning in `package.json`, injected as `__APP_VERSION__`. Workflow: bump
`package.json` → `chore: bump version to X.Y.Z` → after the merge, a row in the table below. **No git
tags** (Tobias 2026-11-14: cloud sessions cannot push tags and nothing reads them).

| Version | Merge commit in `main` | Date       | Content                                                                                 |
| ------- | ---------------------- | ---------- | --------------------------------------------------------------------------------------- |
| 0.6.3   | `5d906a1`              | 2026-11-15 | Not in search engines (`noindex`)                                                       |
| 0.6.2   | `e3deb50`              | 2026-11-15 | Footer without „in Entwicklung“                                                         |
| 0.6.1   | `0606720`              | 2026-11-15 | The Kanzlei colour through the whole design (title, tick boxes, secondary buttons)      |
| 0.6.0   | `00e4ab0`              | 2026-11-15 | Kanzlei colours from the local configuration, weekly-check list                         |
| 0.5.0   | `c2cd7a8`              | 2026-11-15 | Impressum and privacy links from the local configuration                                |
| 0.4.0   | `8877aed`              | 2026-11-15 | Access notice before the hosted copy opens (local Kanzlei configuration)                |
| 0.3.1   | `a3cf751`              | 2026-11-14 | F30: supply before 2025 needs no E-Rechnung (BMF 15.10.2024 Rn. 50)                     |
| 0.3.0   | `c78be21`              | 2026-11-14 | Decisions F22–F29, G-1 … G-10, profile schemas, FeRD EXTENDED rules, ZUGFeRD 1.0 backed |
| 0.2.0   | `06e96a0`              | 2026-11-14 | Inventory and audit, F16–F21, schema check (2a/2b), rules (3a)                          |
| 0.1.0   | (Fragebogen `76828a3`) | 2026-11-13 | Steps 1a–1c; the copy online in `NebenprojektERechnung/`                                |

---

## Known Limitations

- **In development** — all steps of the plan are built (1a–3a) plus the access notice, the Impressum/privacy links and the Kanzlei colours; version 0.7.0 not online yet.
- **Calculation rules (3a)** are a selection (BR-CO-10 … -17, breakdown per category/rate), not a
  validator: no BR-DE/XRechnung rules, no line-level rules (price × quantity), no currency
  conversion (BT-111). For **Factur-X EXTENDED** the FeRD forms are rebuilt (F29,
  `rulesExtended.ts`: BR-FXEXT-CO-10 … -16, -S-09b and the breakdown -08b; logistics charges count
  as charges, financial adjustments change the amount due, only DETAIL lines, 0.01 per amount);
  only the errors of the FeRD Schematron, not its warnings; breakdowns that only the exemption
  reason tells apart are "nicht prüfbar". All 19 FeRD EXTENDED samples: 216 checks, all "passt".
  ZUGFeRD 2.0 EXTENDED keeps BR-CO-14 only, with a note. A
  value that is no number (e.g. "336,90") makes a rule "nicht prüfbar"; the schema check names it.
- **Schema check (2a/2b)** against UBL 2.1 and CII D16B, the XSD the KoSIT validator uses;
  Factur-X **EXTENDED** against its own FeRD schema (Factur-X 1.09.2 / ZUGFeRD 2.5.2, Apache-2.0,
  uploaded by Tobias 2026-11-14). **F28:** MINIMUM, BASIC WL, BASIC and EN16931 against their own
  stricter FeRD profile XSD (CII only — a CII invoice with the plain identifier
  `urn:cen.eu:en16931:2017` counts as profile EN16931; UBL keeps UBL 2.1); XRechnung CII against D16B
  as KoSIT. ZUGFeRD **2.0** EXTENDED (`urn:zugferd.de:2p0`) is "nicht geprüft"
  (its schema is not bundled); older Factur-X EXTENDED files are checked against the 1.09.2 schema.
  ZUGFeRD 1.0 has no schema check.
- **Pflichtangaben are hints from the data, not a tax review.** Decided or researched with official
  sources (`docs/offene-fragen.md`): F5, F7 (Nr. 6a only for invoices from 01.01.2028), F10 (any
  reachable address; missing street = hint), F11, F12 (periods on some positions count, hint on
  Nebenleistung), F13, F14, F15 (replaces F3: a note "Leistungsdatum entspricht Rechnungsdatum"
  is not enough in an e-invoice, UStAE 14.5 Abs. 16 — "fehlt" with a hint), F16 (Kleinbetrag by
  the amount |BT-112|), F17 (ZUGFeRD 2.0 BASIC/EXTENDED = e-invoice with a hint: 2.0 and 2.0.1
  cannot be told apart), F18 (VAT shown excludes the Kleinunternehmer list, hint § 14c), F19 (no
  Pflichtangaben and no "Maßgeblich ist die XML" for "keine E-Rechnung"), F20 (negated reductions
  do not count), F21 (summary sentence), F22–F29 (0.3.0), F30 (supply before 2025: no E-Rechnung
  needed, also when invoiced later).
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
- **Profile identifiers** are backed by official sample files (FeRD 2.5.2, KoSIT, CEN). ZUGFeRD 1.0:
  root, namespaces and identifiers from the FeRD schema `ZUGFeRD1p0.xsd` and the specification
  (§ 6.2, § 6.3, § 7.2), checked on its 12 FeRD samples (private repo, `zugferd1Lokal.test.ts`);
  files of the 2013 release candidate (rsm `urn:un:unece:uncefact:data:standard:CBFBUY:5`) are not
  recognised. An official CEN example in CII D16B carrying the ZUGFeRD 1.0 id is called "keine
  E-Rechnung" (F5).
- **Attachments only from the EmbeddedFiles name tree** (where Factur-X/ZUGFeRD put the XML).
  Files attached only as page annotations are not seen. At most 50 attachments are read.
- **Password-protected PDF** is tested with a synthetic encryption dictionary (the reader asks for
  a password); a real protected supplier PDF is not in the tests.
- **E2E runs on file://**; the hosted copy is **older** than the repo (uploaded 2026-11-13 at
  Fragebogen commit 76828a3, step 1c, version 0.1.0); the repo is at 0.6.3 (merge `5d906a1`, see Versioning) —
  upload only after Tobias' OK.
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
- **FeRD ZUGFeRD 2.5.2 sample invoices** may not be redistributed → they live in the private
  repository `E-Rechnung-Pruefer-privat`, used as `tests/fixtures/lokal/` (61 Factur-X PDFs in
  `ferd/`); `tests/io/ferdLokal.test.ts` checks all of them and is **skipped** where the folder is
  missing — a skipped test is not a pass.
- **Mapping source:** KoSIT/FeRD recommendation, Stand 25.07.2025 — copyrighted, not in the repo;
  our data table cites it per row. Deviations from the hand-over's provisional table: F9.

---

## Status / next step

**2026-11-15 — GitHub check „Tests“ and the test version (version 0.7.0):** both tasks of the Kanzlei
PC session (Tobias) done:

- `.github/workflows/tests.yml`, `name: Tests`, after the Fragebogen's: typecheck, lint, format, unit
  tests and e2e in Chromium, Firefox and WebKit, on every push to `main`, on pull requests and by
  hand. Run once in a fresh clone without the private files before the push (the CI case).
- `npm run build:test` (mode `testbereich`, as the Fragebogen's) writes `dist-test/index.html` for the
  protected test zone; its footer links „Tester einladen“ to `/_zugang/einladen` (login script, repo
  `Testumgebung`), same tab, styled as the other links. The live build gets `null`, so the address
  never reaches `dist/index.html` (`testfassung.spec.ts`). No fetch, the CSP is unchanged.
- **For Tobias / the Kanzlei PC (repo `Freigabe`):** `erechnung` and `erechnungtest` get
  `"gate": { "workflow": "Tests" }`; `erechnungtest` builds with `npm run build:test` and uploads
  `dist-test/index.html` (`deploy/README.md`, „Testfassung und Prüfung ‚Tests‘“). Manual test MT-05.
- Checked on Tobias' request („prüfe den fehlenden link auf die testumgebung und, dass die app nicht
  installierbar ist“): the live build first still carried the unused word „Tester einladen“ (in
  `TEXTS`); now it carries neither the word nor `_zugang`. Not installable: no manifest, no
  service worker, no apple-mobile-web-app tags; the CSP now also says `manifest-src 'none'`
  (`installation.spec.ts`). What no page can stop: a browser's own „add to home screen“ shortcut,
  which without a service worker only opens the address online.

**2026-11-15 — not in search engines (version 0.6.3):** Tobias chose „Nicht auffindbar“: the page
carries `<meta name="robots" content="noindex">`, clients come by the Kanzlei's link; no
`robots.txt` with `Disallow` (it would hide the `noindex`), `deploy/README.md`. The e2e test reads
the tag. Easy to change for the neutral club version later. PR #21 merged (`5d906a1`).

**2026-11-15 — footer without „in Entwicklung“ (version 0.6.2):** Tobias: „Wegfallen“ — the footer
shows only the version (and the Kanzlei links); `fusszeile.spec.ts` checks that the word is gone. PR #19 merged (`e3deb50`).

**2026-11-15 — samples stay off bunny.net:** Tobias asked what the samples are for and agreed („ja“)
not to upload them with the public copy: clients do not need them, the public repo already holds
them. The release run uploads only `dist/index.html` (`deploy/README.md`); `beispiele/README.md`
(generated, same table as `index.html`) makes the GitHub folder the testers' page; the manual tests
point there.

**2026-11-15 — weekly check, Kanzlei colours (version 0.6.0):** Tobias asked whether the weekly
scheduled task „Wochenprüfung“ (task file `aufgaben/wochenpruefung.md` in the private repo
`Pruefvorgaenge`) has consequences here: this project had no `docs/wochenpruefung.md` (now added:
legal and technical sources, S1/S2 with the private files); the release run must write
`auslieferung/oeffentlich.json` to the private repo after each upload (`deploy/README.md`) so a daily
integrity task can follow; `npm audit --omit=dev` 0, dev tools 9 moderate (minimatch via ESLint,
below the reporting level); no CI workflow in this repo. Then: „Stelle die App auf die Kanzleifarben
um (bei Fragebogen haben wir das schon getan)“ — the Fragebogen's `colors` block, copied unchanged
into the private configuration, applied as `--kanzlei-…` variables; links now take the accent. PR #13
merged (`00e4ab0`), private repo PR #3 (`colors`) merged. **0.6.1** (Tobias: „rot für das ganze design“): the
accent also colours the title, the tick boxes (`accent-color`) and the print/copy buttons, as in the
Fragebogen; the status colours (ok/warn/bad) keep their meaning. PR #16 merged (`0606720`).

**2026-11-15 — Impressum and privacy links (version 0.5.0):** Tobias: the release repo is made by the
Kanzlei PC; asked what is left here. Decided: links to the Kanzlei's Impressum and privacy policy
from the local configuration (`imprintUrl`, `privacyUrl`; `Footer.tsx`), never in this repo
(`noBranding.test.ts` checks their host). PR #11 merged (`c2cd7a8`). Addresses found on the Kanzlei
homepage on 2026-11-15 (Tobias: „suche die impressum und datenschutz-angaben auf der aktuellen
homepage“): both pages answer 200 over https without a redirect; now in the private configuration.

**2026-11-15 — access notice (version 0.4.0):** Tobias: straight to bunny.net, the IONOS test copy
is not updated first. Decided: the notice text lives like the Fragebogen's (`config/kanzlei.local.json`,
gitignored here, the original in `E-Rechnung-Pruefer-privat/config/`, read via
`tests/fixtures/lokal`), the draft text adopted as it is. Built like the Fragebogen's gate
(`accessGate.ts`, `AccessGate.tsx`, `accessStore.ts`; SHA-256 via `@noble/hashes` 2.4.0, the
Fragebogen's library, added to `package-lock.json` by hand because npm 10 drops the `libc`
fields); ESLint allows `localStorage` only in the access store, a regression test shows every
other access still refused; the e2e spy allows exactly the access key. The release run must place
the configuration before `npm run build` (`deploy/README.md`), else it builds a copy without the
notice. PR #9 merged (`8877aed`), private repo PR #2 (`config/`) merged. Next on the bunny path: the release repo with its workflow (Tobias, Kanzlei PC; the
workflow can be drafted here as text), the bunny storage key as its secret, the first run, `curl -I`.

**Hosting move decided (Kanzlei PC session, 2026-11-15; bunny account, pull zone and DNS set up the
same day, nothing uploaded):** Tobias: this tool and
the Fragebogen move **first**, and **as the Kanzlei**, not privately and not yet as the planned club.

- **Where:**
  - To bunny.net (static CDN) under the Kanzlei's bunny account, on a **Kanzlei subdomain of its
    own**, no longer `NebenprojektERechnung/` on the Fragebogen subdomain.
  - bunny.net has no login, so moving there means going public. Until Tobias releases the tool, the
    test copy stays at IONOS behind its login.
  - Set up 2026-11-15: the subdomain and a second name that redirects to it (301, path kept) point
    by CNAME at the pull zone (IONOS DNS checked). Their certificates and the redirect are entered at
    bunny.net the same day. Until the release the storage stays empty, so the address shows bunny's
    error page.
- **Access notice before the start — built 2026-11-15 (version 0.4.0, see below).**
  - Build it like the Fragebogen's (`src/logic/accessGate.ts` there): only when a notice is
    configured, only over https, a changed text is asked again, a downloaded file does not ask.
  - The text names the Kanzlei, so it must not be in this public repo. It comes from a local config,
    like the Fragebogen's `config/kanzlei.local.json`. Where exactly it lives (gitignored here plus
    the private companion) is decided with Tobias.
  - **Decided (Tobias 2026-11-15, „ja, Beschränkung fällt“):**
    - The confirmation may be remembered in the browser, like the Fragebogen's "Antwort für die
      Zukunft merken": no cookie, and a changed text is asked again.
    - Adapt the ESLint storage ban and the e2e spy so that they allow exactly this key and still
      refuse everything else.
    - A regression test shows that any other storage access still fails.
  - Text (Tobias 2026-11-15: „Entwurf so übernehmen“; `[Kanzlei]` = the name as in the
    Fragebogen's notice; it lives in `E-Rechnung-Pruefer-privat/config/kanzlei.local.json`):

    > Der E-Rechnungs-Prüfer ist ein kostenloses Hilfsmittel der [Kanzlei]. Er gibt Hinweise zu Form
    > und Pflichtangaben einer E-Rechnung. Er ist keine Rechts- oder Steuerberatung und keine
    > verbindliche Prüfung, und seine Ergebnisse können unvollständig oder fehlerhaft sein. Bitte
    > setzen Sie ihn in Absprache mit Ihrer steuerlichen Beratung ein und klären Sie Zweifelsfälle
    > dort. Die Rechnung wird nur in Ihrem Browser geprüft und nicht übertragen.

  - No liability clause of its own.
- **Headers and pull zone (set in the bunny dashboard 2026-11-15, by hand on the Kanzlei PC; checked
  with `curl -I` only after the first upload):** see `deploy/README.md`, „Auf bunny.net“.
  - An edge rule sends the same headers as the Fragebogen's: a CSP addition with `frame-ancestors`,
    `base-uri`, `form-action` and `object-src` all `'none'`, `X-Frame-Options: DENY`, HSTS one
    year, nosniff, `no-referrer`, Permissions-Policy, COOP and CORP `same-origin`. Once checked with
    `curl -I`, this closes S-11.
  - **Keep both in step:** the `<meta>` CSP (`src/build/csp.ts`) already forbids `object-src`,
    `base-uri` and `form-action`; the header forbids them again. Relaxing one of them in `csp.ts`
    therefore needs the edge rule changed too, which only the Kanzlei PC can do; say so in the
    hand-over.
  - Cache: an edge rule sets the cache time in the CDN and in the browser to 0, so every upload
    arrives at once without a purge.
  - Also set: "Force SSL", TLS 1.2 and newer only, POST refused and only GET and HEAD allowed, logs
    without IP addresses, delivery only through data centres in EU member states.
- **Upload:**
  - Later through a separate private "Freigabe" repo: GitHub Actions, each run started by Tobias by
    hand. That repo is never attached to a cloud session.
  - The first upload to bunny.net already goes that way; the local upload tool has no bunny.net
    path. Until then the test copy at IONOS stays and the Kanzlei PC updates it as before. Cloud
    sessions never upload.
- **Kanzlei to-dos outside this repo:** a sentence on bunny.net in the Kanzlei's privacy policy (the
  CDN processes IP addresses for delivery, its logs keep none, the invoice never reaches it); the
  Kanzlei's Impressum applies. The DPA with bunny.net is accepted and filed (2026-11-15).
  - Checked 2026-11-15 on the homepage: the privacy policy (dated 11.05.2018) covers only the website
    itself (its server log, cookies); it names neither bunny.net nor a CDN nor the tools, its section
    on passing data on knows only legal claims and duties, and the remembered access notice in the
    browser (`localStorage`) is not mentioned. Whether and how to add this is the Kanzlei's call.
- **Later, a separate step:**
  - A neutral version without the Kanzlei name for everyone, offered by the planned club on a neutral
    domain of its own.
  - Its notice says "soll … in Absprache" instead of reserving the tool for clients.

**2026-11-14 — version 0.3.0 (Tobias' decisions in the dialogue, one question per round):** PR #2
merged (`d8b9d76`). F22 (missing Pflichtangaben and hints make the box yellow, "– mit Hinweisen"),
F23 (hints instead of demands, the Kanzlei only where it helps, advice by kind of rule), F24
(format error sentence with BMF 15.10.2025 Rn. 6a), F25 (simpler wording), F26 (sentence by the
date of supply and invoice, `uebergang.ts`), F27 (different invoice XML = format error with a
comparison table), F28 (Factur-X profile schemas), F29 (FeRD rules for EXTENDED,
`rulesExtended.ts`), G-1 … G-10 (folded rows, jump links, technical details closed, print and
copy buttons, compact drop zone, start view, wording). Samples 31–35. ZUGFeRD 1.0 backed by the
FeRD specification and its 12 samples (private repo `zugferd-1.0/`, `zugferd1Lokal.test.ts`). PR #3
merged (`c78be21`), private repo PR #1 (`zugferd-1.0/`) merged. **0.3.1:** F30 decided by Tobias
(supply before 2025: no E-Rechnung needed, whatever the invoice date — § 27 Abs. 1 Satz 1 UStG,
BMF 15.10.2024 Rn. 50; regime `vor2025`, `TEXTS.regimeBefore2025`), PR #5 merged (`a3cf751`). No
open question left. Next:
Tobias uploads app and samples (local, `npm run hochladen`).

**2026-11-14 — quality audit of the handling (Tobias: "Qualitätsaudit, insbesondere für die
Handhabung des Nutzers"):** PR #1 merged into `main` (`06e96a0`, 0.2.0); the tag `v0.2.0` could not
be pushed from the cloud session (the session's git access allows only its own branch) — Tobias sets
it on GitHub if wanted. Four audit agents (flow, comprehension, accessibility, result page) and four
refutation agents: 38 findings, none fully refuted; 19 fixed (print with check time, differing
values, rule values with names and expected value, unreadable file and several files, drags only
for files, phone badge column, contrast-mode borders, unique region names, `lang="en"`), report in
`docs/audit-bedienung-2026-11-14.md`. Open for Tobias: tax questions F22–F25
(`docs/offene-fragen.md`) and design questions G-1 … G-10 (report). Vitest and e2e (3 browsers)
green in the session.

**2026-11-14 — everything in the cloud:** Tobias' goal: nothing runs on his machine except the
upload. Pinned Playwright browsers installed in the container (Chromium, Firefox, WebKit: e2e
57/57); FeRD package uploaded into the session (checksum as in `docs/quellen.md`) → the FeRD
sample test ran for the first time outside his machine: 2 of 61 failed (X11, X19: "warn" from
BR-CO-12). Cause: FeRD EXTENDED has its own forms of the rules (logistics charges in BT-108); fixed
by checking only BR-CO-14 for EXTENDED, with a note (`ownRules`). Then 62/62. Also an e2e race in
WebKit (page-wide drop listener attached after the first render). Left for Tobias locally: the
upload (`npm run hochladen`) and the server header `frame-ancestors`.

**2026-11-14 — inventory and audit with refutation agents:** five audit agents (logic, IO/security,
binding, tests/docs, UI/texts) and five refutation agents; 66 findings, verdicts and fixes in
`docs/bestandsaufnahme-2026-11-14.md`. Fixed among others: PDFs in older browsers (pdf.js legacy),
phone layout (320/375 px, long file names), DOCTYPE behind another encoding, text nodes > 10 MB,
attachments not read are "nicht vollständig geprüft" instead of "Formatfehler", "§ 195 BGB" no
Kleinunternehmer hint, BT-24 in the comparison of several XML, harder storage/network guards. New
open tax questions F16–F21, then decided by Tobias the same day and implemented (sample 28).
Tobias: "your branch is the only one pursued" — phase 2b (schema check, sample 29) and phase 3a
(calculation rules as in the CEN Schematron, sample 30) on the same branch.
Then version 0.2.0 and screen-reader fixes (status line, focus, row headers). Pushed after Tobias'
OK; pull request #1 (`claude/adoring-franklin-b6xgoh` → `main`). Next: Tobias runs `npm test` (FeRD
samples incl. schema) and `npm run test:e2e` locally, merge, tag, upload, server header
`frame-ancestors`. Step 2a done the same day: Tobias uploaded the FeRD schema folders, EXTENDED
is now checked against its own schema (`schemas/factur-x-1.09.2-extended/`).

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
