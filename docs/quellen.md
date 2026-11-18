# Quellen

Jedes offizielle Artefakt mit Herkunft, Version, Datum, Lizenz und Prüfsumme (SHA-256 der geladenen
Datei). Geladen wird nach `.tmp/quellen/` (gitignoriert). Ins Repo kommt nur, was weitergegeben werden
darf – mit seinem Lizenzhinweis. Keine inoffiziellen Kopien.

## Geladen

| Artefakt                                                                                                                                   | Quelle (URL)                                                                                                                                          | Version / Datum                                   | Lizenz                                                                         | Im Repo?                                                                                                                                       | SHA-256                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| KoSIT Validator-Konfiguration XRechnung (enthält XSD UBL 2.1 und CII D16B, Prüfszenarien, CEN-Schematron als XSLT)                         | https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v2026-08-31/xrechnung-3.0.2-validator-configuration-2026-08-31.zip | v2026-08-31 (XRechnung 3.0.2), geladen 13.11.2026 | Apache-2.0 (Repository); die XSDs tragen die Hinweise von OASIS bzw. UN/CEFACT | XSDs (UBL 2.1, CII D16B) in `schemas/`                                                                                                         | `2530cd107c414511c5d0462ec10f886910395abfca820db82e83d70bf01221a8` |
| KoSIT XRechnung-Testsuite (86 XML-Instanzen UBL/CII)                                                                                       | https://github.com/itplr-kosit/xrechnung-testsuite/releases/download/v2026-08-31/xrechnung-3.0.2-testsuite-2026-08-31.zip                             | v2026-08-31, geladen 13.11.2026                   | Apache-2.0                                                                     | ausgewählte Instanzen als Testdateien; geändert als Beispieldateien in `beispiele/` (Lizenztext dort und in `tests/fixtures/offiziell/kosit/`) | `1e81ef7563e0fa04c0e0b0631318a7e0843a3c0beb57d83ef95ac0c4a095e3d7` |
| CEN EN 16931 Validierungsartefakte CII (Beispiele, Schematron)                                                                             | https://github.com/ConnectingEurope/eInvoicing-EN16931/releases/download/validation-1.3.17/en16931-cii-1.3.17.zip                                     | 1.3.17 vom 12.10.2026, geladen 13.11.2026         | EUPL-1.2 (`LICENSE.txt` des Repositorys)                                       | Beispiele als Testdateien                                                                                                                      | `e5f3235824b6b38454b1d54cf3f14e01efb5b33971fbefc4e64997d0ef619e89` |
| CEN EN 16931 Validierungsartefakte UBL (Beispiele, Schematron)                                                                             | https://github.com/ConnectingEurope/eInvoicing-EN16931/releases/download/validation-1.3.17/en16931-ubl-1.3.17.zip                                     | 1.3.17 vom 12.10.2026, geladen 13.11.2026         | EUPL-1.2                                                                       | Beispiele als Testdateien                                                                                                                      | `bf02a0e3f6cbe692a4a28e70be7bdcaded5612b4169b543e13d6cb4f33c29e92` |
| KoSIT XRechnung Visualization (XSLT UBL/CII → semantisches Modell mit BT-/BG-Nummern) – Quelle der Zuordnung `src/logic/binding.ts`        | https://github.com/itplr-kosit/xrechnung-visualization/releases/download/v2026-10-13/xrechnung-3.0.2-visualization-2026-10-13.zip                     | v2026-10-13, geladen 13.11.2026                   | Apache-2.0                                                                     | nein – die XPaths sind als eigene Datentabelle übernommen (in XPath 1.0)                                                                       | `ecf3913029218822ee4c90a86a3e23689768bf3568a061cf9bc742115e52264e` |
| KoSIT/FeRD „Empfehlungen zu Pflichtangaben in einer E-Rechnung – Teil I: Pflichtangaben gemäß Umsatzsteuergesetz“ (Zuordnung UStG → BT/BG) | https://www.ferd-net.de/publikationen-produkte/publikationen/detailseite/pflichtangaben-in-einer-e-rechnung (Download-Link auf der Seite)             | Stand 25.07.2025, 10 Seiten, geladen 13.11.2026   | © KoSIT / FeRD, keine Lizenzangabe                                             | **nein** – nur die eigene Datentabelle mit Verweis je Zeile                                                                                    | `51e71c78b4b03148923fffa0b7054d558e938376d0fd69f7c33f2ef49a1a9abc` |

### XSD aus der KoSIT-Konfiguration (UBL 2.1, CII D16B; Prüfsummen 15.11.2026)

Die 20 XSD in `schemas/ubl-2.1/` und `schemas/cii-d16b/` sind bytegleich mit `resources/ubl/2.1/xsd/` und
`resources/cii/16b/xsd/` der KoSIT Validator-Konfiguration oben (ZIP-Prüfsumme wie dort).
`tests/static/schemaSums.test.ts` verlangt die SHA-256 jeder Datei in `schemas/` in diesem Dokument.

| Datei                                                                                   | SHA-256                                                            |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `cii-d16b/CrossIndustryInvoice_100pD16B.xsd`                                            | `3baf143b90f289d62c5dfb086aa51fa183490a2d0b38a40c6b31dcae0760f2ba` |
| `cii-d16b/CrossIndustryInvoice_QualifiedDataType_100pD16B.xsd`                          | `6649215914728652e883662bec1d3eab008c215e86a59f3bb417db9723ee8c5c` |
| `cii-d16b/CrossIndustryInvoice_ReusableAggregateBusinessInformationEntity_100pD16B.xsd` | `1c42244298a863bcc0b5196983ff0a5d084fcabe58aea77ef82b242e7cd0ddfd` |
| `cii-d16b/CrossIndustryInvoice_UnqualifiedDataType_100pD16B.xsd`                        | `04fce6f6f28521886731294be18a4e6bb5cb3003456457d99ad5c4d3e652f497` |
| `ubl-2.1/common/CCTS_CCT_SchemaModule-2.1.xsd`                                          | `dd546e4809df86b6445589f69f0d6c9df162840ae386574ddfc1da7638103e15` |
| `ubl-2.1/common/UBL-CommonAggregateComponents-2.1.xsd`                                  | `580b5af6f68f7f556bd15945ba0e819cbf561442c81694f9b9468036ebedec4d` |
| `ubl-2.1/common/UBL-CommonBasicComponents-2.1.xsd`                                      | `a3b349bf92e5cff26e303d2f05b7e00c884dcafcfd9e12755fb80289abf5e22e` |
| `ubl-2.1/common/UBL-CommonExtensionComponents-2.1.xsd`                                  | `ad7a4e490978adfbcfc5ec0bb20941cf11ac960ccf0c4de8791a7c731a8dbe87` |
| `ubl-2.1/common/UBL-CommonSignatureComponents-2.1.xsd`                                  | `4fa9e2370100040fe14c43e135ef77e2eb66b21cb8dbfc2ffb8d82ae991fe92e` |
| `ubl-2.1/common/UBL-CoreComponentParameters-2.1.xsd`                                    | `8be3379dbdcbcc7802fafdd16bac72c48fff1c0bb364213a31a17911dd06100b` |
| `ubl-2.1/common/UBL-ExtensionContentDataType-2.1.xsd`                                   | `fcee77a11870208e6377ea6311b9f2a050bca24bdad8606ea02d71e9f9e72f8d` |
| `ubl-2.1/common/UBL-QualifiedDataTypes-2.1.xsd`                                         | `7dcb156e610239c97ae70940cf4653b88e48c3595bf5f56a2204a32e2893e6cf` |
| `ubl-2.1/common/UBL-SignatureAggregateComponents-2.1.xsd`                               | `9234c2ca48dbfa9a22a786112bb075c5922a305170920eaab1e3c04fa0b7344b` |
| `ubl-2.1/common/UBL-SignatureBasicComponents-2.1.xsd`                                   | `0fbe2d7afff0c1e11164b8ec83e13f18801021c3c87e390a9d76f9cf862f6a64` |
| `ubl-2.1/common/UBL-UnqualifiedDataTypes-2.1.xsd`                                       | `09052d406b4293e2a5f9c2bfee6df10ad4d8d5f0b36e24a6349d7f7936d89eb6` |
| `ubl-2.1/common/UBL-XAdESv132-2.1.xsd`                                                  | `a4f726bcf8cc3f7d9ffa4dab99e005535a8e8b60dced1e5d94578d2e05afa96e` |
| `ubl-2.1/common/UBL-XAdESv141-2.1.xsd`                                                  | `1fa4625e9cefcb7a9abb5ac1b64315547450031eece8a55bd584e4ba4b79dbc1` |
| `ubl-2.1/common/UBL-xmldsig-core-schema-2.1.xsd`                                        | `101909c9f06456d61ddcc4fb982f1d40dc357b439f393b1a2eb46e42acd60809` |
| `ubl-2.1/maindoc/UBL-CreditNote-2.1.xsd`                                                | `1e117b6c1ab713604b29b0d685442a81a0c78a82575445ee8c43e6050cda7454` |
| `ubl-2.1/maindoc/UBL-Invoice-2.1.xsd`                                                   | `3a5aacd823f0e5b8f25ae7b5191c2002d5333ba351d87de9371ed62dca2b2b0c` |

### BR-DEX-09 aus der KoSIT-Konfiguration (Audit R5-L-01, 18.11.2026)

Für XRechnung 3.0 mit Extension (UBL Invoice) setzt `scenarios.xml` der Validator-Konfiguration
oben BR-CO-16 auf `information` („to enable Third Party Payment calculations (BR-DEX-09)“); das
Szenario für CII tut das nicht. BR-DEX-09 steht in `resources/xrechnung/3.0.2/xsl/XRechnung-UBL-validation.xsl`
(Kontext `cac:LegalMonetaryTotal[$isExtension]`): `round((BT-115 − BT-114) · 100) div 100 =
round((BT-112 − BT-113 + Σ ../cac:PrepaidPayment/cbc:PaidAmount) · 100) div 100`. Nachgebaut in
`src/logic/rules.ts`; die Testdatei `tests/fixtures/offiziell/kosit/05.01a-INVOICE_ubl.xml` ist
`instances/extension/05.01a-INVOICE_ubl.xml` der Testsuite oben, unverändert, SHA-256
`bd61ec6dcb33b29b7a3a450106bf399bd41bd211aebcd96637458d59acc59127`.

Der deutsche Name „Forderungen Dritter, im fälligen Betrag enthalten (BG-DEX-09)“ ist eine eigene
Übersetzung (Audit R6-U-01): die KoSIT-Konfiguration nennt die Gruppe nur englisch „THIRD PARTY
PAYMENT“ (BT-DEX-002 „Third party payment amount“); in 05.01a sind es „Brutto-Forderung für
Fremdleistungen“, die zum fälligen Betrag hinzukommen.

## FeRD-Infopaket (von Tobias geladen)

| Artefakt                                                                                                                                                                                                                     | Quelle                                                                                                                               | Stand                                                                        | Lizenz laut Nutzungsbedingungen                                                                                                                                                                                                                                                                                                                              | Ablage                                                                                                                                          | SHA-256                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| FeRD ZUGFeRD 2.5.2 / Factur-X 1.09.2 Infopaket `ZUGFeRD_2.5.2_DE.zip` (348 Dateien: Spezifikation, technischer Anhang je Profil, XSD und XSLT je Profil, CII D22B, 61 Musterrechnungen als Factur-X-PDF mit XML, Codelisten) | https://www.ferd-net.de/publikationen-produkte/publikationen/detailseite/zugferd-252-deutsch (Formular mit Name, E-Mail, Zustimmung) | 04.08.2026, gültig ab 01.09.2026; geladen von Tobias, verarbeitet 13.11.2026 | XSD und Schematron: Apache-2.0 („Für die Nutzung der Technischen Artefakte (Schemata und Schematron) des ZUGFeRD-Standards gelten die Apache 2.0 Lizenzbedingungen“, https://www.ferd-net.de/ueber-uns/ressourcen-1/veroeffentlichungen/haftungsausschluss-und-nutzungsrechte). Musterrechnungen: allgemeiner Urheberrechtsvorbehalt der AWV → **nur lokal** | ZIP: `import-archiv/2026-11-13_23-20-12/`; entpackt: `.tmp/quellen/ferd/x/`; Musterrechnungen: `tests/fixtures/lokal/ferd/` (alle gitignoriert) | `4d35c28b486de495b9db58581b1e5b5e38eeaf83b409e813bd8fe1ace7f7d72e` |

### Schema EXTENDED aus dem FeRD-Paket (Schritt 2a, 14.11.2026)

Von Tobias in die Sitzung hochgeladen: `Factur-X_1.09.2_MINIMUM.zip` (Teil des FeRD-Pakets oben; enthält die
Schema-Ordner aller Profile 0–4 und `5. CII D22B XSD`), SHA-256
`8ff977d9d6a1ff273956c9ee548122ae848789a6ff32d5543a03f852b7929a1f`. Übernommen sind nur die vier XSD
des Ordners `4_Factur-X_1.09.2_EXTENDED/`, unverändert, nach `schemas/factur-x-1.09.2-extended/`
(Apache-2.0, Lizenztext daneben). Die übrigen Profile prüfte das Tool damals wie der KoSIT-Validator
gegen CII D16B; seit F28 (0.3.0) prüft es jedes Factur-X-Profil gegen sein eigenes FeRD-Schema (Abschnitt
F28 unten).

| Datei                                                  | SHA-256                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| `Factur-X_1.09.2_EXTENDED.xsd`                         | `2accff44dbdc405f38fd35d789ff5e6262396940356ed362009509cd024556c6` |
| `…_QualifiedDataType_100.xsd`                          | `ece13000d4f99c97ef09b909e9f8646d45415c46fd24d19d3c9b771c72ae2b34` |
| `…_ReusableAggregateBusinessInformationEntity_100.xsd` | `83cef3c48a6c83149733ffdced362e230e9ae482f62acdfb8c0fb3a919452fdb` |
| `…_UnqualifiedDataType_100.xsd`                        | `c6c9f7b3f36c821999f20d7b7fff30db64112bc7b2a8f132e3d048d859855d00` |

### Profil-Schemata MINIMUM bis EN16931 (F28, 14.11.2026)

Auf Tobias' Entscheidung F28 aus demselben FeRD-Paket (privates Repo `E-Rechnung-Pruefer-privat`,
`ferd-paket/ZUGFeRD_2.5.2_DE.zip`, SHA-256 wie oben) übernommen: die je vier XSD der Ordner
`0_Factur-X_1.09.2_MINIMUM/` bis `3_Factur-X_1.09.2_EN16931/`, unverändert, nach
`schemas/factur-x-1.09.2-<profil>/` (Apache-2.0). Vorher geprüft: alle 32 FeRD-Musterrechnungen dieser
Profile und alle 12 amtlichen CEN-/KoSIT-CII-Dateien mit der Kennung `urn:cen.eu:en16931:2017` ohne
Abweichung vom Profil-Schema.

| Profil    | Datei                                                  | SHA-256                                                            |
| --------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| `minimum` | `Factur-X_1.09.2_MINIMUM.xsd`                          | `313e86212eaf9921f8cfe040d2acb72f718a580db3c19b8c8b3ca0a6a02b4216` |
| `minimum` | `…_QualifiedDataType_100.xsd`                          | `c65c4929cb6f51d59aec498851a9026f0a915555555b1c3e5eafd99f191be5f5` |
| `minimum` | `…_ReusableAggregateBusinessInformationEntity_100.xsd` | `8a9c1826ac156d8d2faf47de8dcd8a41fff54e6cf3ba1d44503876c086c7d9db` |
| `minimum` | `…_UnqualifiedDataType_100.xsd`                        | `7110f93a32e20af6fbc3b8c308ec77f75be18bafca9a933584eb457a187bd539` |
| `basicwl` | `Factur-X_1.09.2_BASICWL.xsd`                          | `6cd8f22081b659ebeb0a86a741ed454d1771460b822579a55b43f5f0cdd81356` |
| `basicwl` | `…_QualifiedDataType_100.xsd`                          | `5d72dd3f0df511b2994ea41b199685f9cc538e9ce57d50c84d21988fe1455c6e` |
| `basicwl` | `…_ReusableAggregateBusinessInformationEntity_100.xsd` | `17d5300dcb6d7c1d7ac70c4d28c89fd3b778abb820129ac320b9010d4dc6bed3` |
| `basicwl` | `…_UnqualifiedDataType_100.xsd`                        | `2f4686c41172611f7fc2347a7103a12c01746da17a5f7eded53254ceeff2469f` |
| `basic`   | `Factur-X_1.09.2_BASIC.xsd`                            | `808f07370fbbeaaceabbd674ee4d7d2cb358894112366989ff7d600d0432d444` |
| `basic`   | `…_QualifiedDataType_100.xsd`                          | `5d72dd3f0df511b2994ea41b199685f9cc538e9ce57d50c84d21988fe1455c6e` |
| `basic`   | `…_ReusableAggregateBusinessInformationEntity_100.xsd` | `2ca9ab167afd99ae0455db1d7119007ab1de27941752dcc55e9e24bec0511c61` |
| `basic`   | `…_UnqualifiedDataType_100.xsd`                        | `ad32b1828200bdb0afd24fbe92fe90880bf357c6a51a9da95cddbdf593e3e35b` |
| `en16931` | `Factur-X_1.09.2_EN16931.xsd`                          | `cb98b34e59398fcd8d48f29963a3fd6f4c49af9a8307569f4a1ced634f1aa885` |
| `en16931` | `…_QualifiedDataType_100.xsd`                          | `4bd1753b1f078ecc50468ec90e505a63a72c6c1f2449a893f37c72a2e933fe04` |
| `en16931` | `…_ReusableAggregateBusinessInformationEntity_100.xsd` | `d6bf8e38c3d5595c670655ccb7ee89655ae244943aaf09a31758160caabc7894` |
| `en16931` | `…_UnqualifiedDataType_100.xsd`                        | `60ee4d11da40c7ec42a4da1fb77b5d7bbffcdce42afd863fcd9da9334765315c` |

### ZUGFeRD 1.0 (Recherche 14.11.2026)

Die FeRD bietet ZUGFeRD 1.0 nicht mehr an (Seite „zugferd-10“: „steht nicht mehr zum Download
bereit“; nur das Corrigendum ist noch abrufbar). Das Paket liegt unverändert in zwei Spiegeln mit
festem Commit: `stephanstapel/ZUGFeRD-csharp` `a9975a82a4d026792c5749fffa4226f3d619cde6`
(`documentation/zugferd10/`: Spezifikation, technische Dokumentation, XSD, Musterrechnungen) und
`ZUGFeRD/mustangproject` `42127fa34e26d7420836e90d0dac7f06fedc92de` (gleiche XSD bytegleich, Schematron).
11 der 12 Muster-PDF sind außerdem bytegleich mit `konik-io/konik`. Urheberrecht der AWV
(Spezifikation Abschn. 1.2: Vervielfältigung nur mit Zustimmung) → nur im privaten Repo
`E-Rechnung-Pruefer-privat/zugferd-1.0/` (URL, Lizenz und SHA-256 je Datei in `QUELLEN.tsv`).

| Wert in `syntax.ts` / `profiles.ts`                                                                                                   | Beleg                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Wurzel `CrossIndustryDocument`                                                                                                        | `ZUGFeRD1p0.xsd` Z. 12; Spezifikation § 6.2                           |
| Namensraum `urn:ferd:CrossIndustryDocument:invoice:1p0`                                                                               | `ZUGFeRD1p0.xsd` Z. 2, 7 (targetNamespace); Änderungshistorie § 2.4.1 |
| `ram` `…:ReusableAggregateBusinessInformationEntity:12`                                                                               | `ZUGFeRD1p0.xsd` Z. 5, 10                                             |
| `udt` `…:UnqualifiedDataType:15`                                                                                                      | `ZUGFeRD1p0.xsd` Z. 6, 11                                             |
| Pfad der Kennung (`GuidelineSpecifiedDocumentContextParameter/ram:ID`)                                                                | technische Dokumentation § 4.1 (S. 48), 1..1                          |
| Kennungen `…:1p0:basic`, `…:1p0:comfort`, `…:1p0:extended`; längere für Branchenprofile (z. B. `:extended:gs1`) → Vergleich am Anfang | Spezifikation § 6.3 (S. 98)                                           |
| Anhang `ZUGFeRD-invoice.xml`                                                                                                          | Spezifikation § 7.2 (S. 106)                                          |

| Muster-PDF (FeRD)                                                     | SHA-256                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ZUGFeRD_1p0_BASIC_Einfach.pdf`                                       | `2cea9bb8ffea4031a693baee4cca59203063af9592c7b1b9a0492967d4dfc643` |
| `ZUGFeRD_1p0_BASIC_Rechnungskorrektur.pdf`                            | `e07e1d2806389657126ec81bcaeecf3f897b4c9478382962b64147a5ec548054` |
| `ZUGFeRD_1p0_COMFORT_Einfach.pdf`                                     | `d4ef7c821871d1a500f14d62bdf18d28773b2805f7bf11231c0c49afa5464972` |
| `ZUGFeRD_1p0_COMFORT_Haftpflichtversicherung_Versicherungssteuer.pdf` | `e47f76fd2bd93cf87ed9bfd1e4b121d53b22c9cebeecef641aa0c7755f805824` |
| `ZUGFeRD_1p0_COMFORT_Kraftfahrversicherung_Bruttopreise.pdf`          | `71361ce95adeb2e4c742e10b5c19deb69c0e5ddeb5a5f1ee774b05d39516a9f9` |
| `ZUGFeRD_1p0_COMFORT_Rabatte.pdf`                                     | `d332343aac0b1cab462f078cd1be3333499b02467e1b34d1f3f2155646fcba1b` |
| `ZUGFeRD_1p0_COMFORT_Rechnungskorrektur.pdf`                          | `7cdd04b96a958315e91ed3fe2bfad2bd51b2b2036ce72a18a392755f3d87ed7b` |
| `ZUGFeRD_1p0_COMFORT_SEPA_Prenotification.pdf`                        | `7b652b0bb3b2166b30d4b8ca60a4a690f7bfa6399af3317fcdba3eb01a249b3e` |
| `ZUGFeRD_1p0_COMFORT_Sachversicherung_berechneter_Steuersatz.pdf`     | `39a17b781e2dcb8e3f76e25e846931717e72feb1bd114dc2e4d0ee85b47d2c2c` |
| `ZUGFeRD_1p0_EXTENDED_Kostenrechnung.pdf`                             | `47460b85aebba41905e634413dae59936e9c2fd6a6b5842f0c2cf464bb0d8cc2` |
| `ZUGFeRD_1p0_EXTENDED_Rechnungskorrektur.pdf`                         | `487e330e99c7b05d9ef08ea1dbe05ea0d90dcbc174f253fd22ff9681a772a285` |
| `ZUGFeRD_1p0_EXTENDED_Warenrechnung.pdf`                              | `12aa68d6ce97466f7caf24e31c00ce7620942194e62e7a8d89571f92a7ad3ddb` |

## Recht und Verwaltung (Recherche 13.11.2026)

| Quelle                                                                                           | Fundstelle                                                                                                              | Verwendet für     |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------- |
| BMF-Schreiben vom 15.10.2024, III C 2 - S 7287-a/23/10001 :007, BStBl I 2024 S. 1320             | Rn. 25, 30 (ZUGFeRD ab 2.0.1 ohne MINIMUM/BASIC-WL), Rn. 33, 34, 65 (vereinbarte Formate, EDI)                          | F5, Ergebnistexte |
| BMF-Schreiben vom 15.10.2025, III C 2 - S 7287-a/00019/007/243, BStBl I 2025 S. 1806             | Rn. 6a, 6b, 24, 35a; Übernahme in den UStAE                                                                             | F4, F5, F15       |
| BMF-Schreiben vom 15.10.2026, III C 5 - S 7287-a/00019/021/017                                   | Rn. 8–9: Zuordnungstabelle KoSIT/FeRD in der jeweils aktuellen Fassung                                                  | F9                |
| Umsatzsteuer-Anwendungserlass, konsolidiert Stand 19.10.2026 (bundesfinanzministerium.de)        | 3.10 Abs. 1, 5 (Nebenleistung); 14.1 Abs. 14, 15; 14.5 Abs. 2 (Anschrift), Abs. 16 (Leistungszeitpunkt)                 | F5, F10, F12, F15 |
| Jahressteuergesetz 2024 vom 02.12.2024, BGBl. 2024 I Nr. 387                                     | Art. 27 Nr. 1 (§ 14 Abs. 4 Satz 1 Nr. 6a UStG), Art. 30 (§ 33 Nr. 3a UStDV), Art. 56 Abs. 12 (Inkrafttreten 01.01.2028) | F7                |
| § 14, § 27 Abs. 38 UStG; § 31, § 33, § 34a UStDV (gesetze-im-internet.de, 13.11.2026)            | Wortlaut                                                                                                                | F1, F5, F10, F12  |
| BFH V R 25/15 und V R 28/16 vom 21.06.2018, XI R 20/14 vom 13.06.2018, XI R 22/14 vom 05.12.2018 | Anschrift: Erreichbarkeit genügt                                                                                        | F10               |

## Bibliotheken

| Bibliothek                             | Version | Lizenz                  | Install-Skripte                |
| -------------------------------------- | ------- | ----------------------- | ------------------------------ |
| pdfjs-dist (Mozilla pdf.js)            | 6.4.299 | Apache-2.0              | keine (`npm view`, 13.11.2026) |
| libxml2-wasm (libxml2 als WebAssembly) | 0.7.2   | MIT; libxml2 selbst MIT | keine (`npm view`, 13.11.2026) |
| React, React DOM                       | 19.3.1  | MIT                     | –                              |

Die Lizenzangaben stammen aus der npm-Registry und den Repositorys. Das ist keine Prüfung auf
Schadcode.

## Recherche F8 (14.11.2026)

| Quelle                                                                                                   | Fundstelle                                                         | Ergebnis                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| KoSIT, xeinkauf.de/xrechnung/ustg und PDF `Empfehlungen_Pflichtangaben_E-Rechnung_gem_UStG_20250725.pdf` | § 14 Abs. 4 Nr. 7, Seite 6                                         | Keine neuere Fassung, kein Erratum; PDF und HTML-Tabelle nennen gleich „BT-139 Invoice line allowance amount“ neben „BT-97 Document level allowance reason“. Ebenso „BT-106 Invoice line net amount“ (in EN 16931 die Summe der Positionsbeträge). ferd-net.de war nicht erreichbar. |
| BMF-Schreiben vom 15.10.2026, Rn. 8–9; FAQ E-Rechnung (29.10.2026), Frage 16                             | Zuordnungstabelle „in der jeweils aktuellen Version“               | keine Fassung oder Datum genannt                                                                                                                                                                                                                                                     |
| Spezifikation XRechnung 3.0.2 (20.06.2024), xeinkauf.de; Vorversion 4.0.0 (15.09.2026)                   | BT-92, BT-97, BT-98, BT-136, BT-139, BT-140                        | BT-136 Betrag, BT-139 Grund als Text, BT-140 Grund als Code                                                                                                                                                                                                                          |
| CEN EN 16931 Schematron (ConnectingEurope, master)                                                       | BR-33, BR-41, BR-42                                                | jeder Nachlass hat einen Betrag und einen Grund (Text oder Code)                                                                                                                                                                                                                     |
| UStAE Stand 19.10.2026                                                                                   | 14.5 Abs. 19 Sätze 1–7, 13–14                                      | Hinweis auf die Vereinbarung; allgemeiner Hinweis genügt unter Bedingungen (Satz 6, neu durch BMF 15.10.2026, Nichtbeanstandung bis 31.12.2026); „2 % Skonto bei Zahlung bis“ genügt                                                                                                 |
| BMF-Schreiben vom 15.10.2024 Rn. 51; 15.10.2025 Rn. 35, 51a; 15.10.2026 Rn. 15–16                        | Rabatt-/Bonusvereinbarungen; Pflichtangaben im strukturierten Teil | kein BMF-Schreiben ordnet den Hinweis einem bestimmten BT zu                                                                                                                                                                                                                         |
