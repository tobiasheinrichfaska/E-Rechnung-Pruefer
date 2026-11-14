// The official XSD files, bundled as text (see schemas/README.md for origin and licences).
const raw = import.meta.glob('../../schemas/**/*.xsd', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Schema text by path below `schemas/`, e.g. `cii-d16b/CrossIndustryInvoice_100pD16B.xsd`. */
export const SCHEMA_FILES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(raw).map(([path, text]) => [path.replace(/^.*\/schemas\//, ''), text]),
);

export const SCHEMA_ENTRIES = {
  ublInvoice: 'ubl-2.1/maindoc/UBL-Invoice-2.1.xsd',
  ublCreditNote: 'ubl-2.1/maindoc/UBL-CreditNote-2.1.xsd',
  ciiD16B: 'cii-d16b/CrossIndustryInvoice_100pD16B.xsd',
  // Step 2a: FeRD ZUGFeRD 2.5.2 / Factur-X 1.09.2, profile EXTENDED (Apache-2.0)
  facturxExtended: 'factur-x-1.09.2-extended/Factur-X_1.09.2_EXTENDED.xsd',
  // F28 (Tobias 2026-11-14): the other profiles against their own, stricter FeRD schema
  facturxMinimum: 'factur-x-1.09.2-minimum/Factur-X_1.09.2_MINIMUM.xsd',
  facturxBasicWl: 'factur-x-1.09.2-basicwl/Factur-X_1.09.2_BASICWL.xsd',
  facturxBasic: 'factur-x-1.09.2-basic/Factur-X_1.09.2_BASIC.xsd',
  facturxEn16931: 'factur-x-1.09.2-en16931/Factur-X_1.09.2_EN16931.xsd',
} as const;
