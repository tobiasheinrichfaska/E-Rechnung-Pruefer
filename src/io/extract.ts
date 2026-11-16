// Walks the binding (logic/binding.ts) over a parsed invoice: group paths select nodes, term
// paths read text relative to them. Generic — adding a term means adding data, not code.
import { XmlXPath } from 'libxml2-wasm';
import type { XmlDocument, XmlNode } from 'libxml2-wasm';
import { INVOICE, pathFor } from '../logic/binding';
import type { GroupDef, SyntaxFamily } from '../logic/binding';
import type { GroupId, RawGroup } from '../logic/model';
import type { SyntaxEntry } from '../logic/syntax';
import type { Namespaces } from './xml';

export function familyOf(syntax: SyntaxEntry): SyntaxFamily | undefined {
  if (syntax.id === 'cii') return 'cii';
  if (syntax.id === 'ubl-invoice') return 'ubl';
  if (syntax.id === 'ubl-creditnote') return 'ublCreditNote';
  return undefined;
}

/**
 * Each path of the binding compiled once per document, not once per position: a string XPath is
 * compiled anew on every call, about 30 times per position, so a file of many positions took
 * seconds and held a lot of memory until the end of the task (audit R2-S-01). Disposed after.
 */
class Paths {
  private readonly compiled = new Map<string, XmlXPath>();

  constructor(private readonly ns: Namespaces) {}

  of(path: string): XmlXPath {
    let xpath = this.compiled.get(path);
    if (!xpath) {
      xpath = XmlXPath.compile(path, { ...this.ns });
      this.compiled.set(path, xpath);
    }
    return xpath;
  }

  dispose(): void {
    for (const xpath of this.compiled.values()) xpath.dispose();
    this.compiled.clear();
  }
}

/** The text of every node an XPath selects (a string, number or boolean result as one value). */
function valuesOf(context: XmlDocument | XmlNode, xpath: XmlXPath): string[] {
  const result = context.eval(xpath);
  if (Array.isArray(result)) return result.map((node) => node.content);
  return [String(result)];
}

function extractGroup(
  context: XmlDocument | XmlNode,
  def: GroupDef,
  family: SyntaxFamily,
  paths: Paths,
): RawGroup {
  const terms: RawGroup['terms'] = {};
  for (const term of def.terms) {
    const path = pathFor(term, family);
    if (path) terms[term.bt] = valuesOf(context, paths.of(path));
  }
  const groups: Partial<Record<GroupId, RawGroup[]>> = {};
  for (const child of def.groups) {
    const path = pathFor(child, family);
    if (!path) continue;
    groups[child.bg] = context
      .find(paths.of(path))
      .map((node) => extractGroup(node, child, family, paths));
  }
  return { bg: def.bg, terms, groups };
}

/** The raw model of an EN 16931 invoice (UBL or CII); undefined for other syntaxes. */
export function extractModel(doc: XmlDocument, syntax: SyntaxEntry): RawGroup | undefined {
  const family = familyOf(syntax);
  if (!family) return undefined;
  const paths = new Paths(syntax.namespaces);
  try {
    return extractGroup(doc, INVOICE, family, paths);
  } finally {
    paths.dispose();
  }
}
