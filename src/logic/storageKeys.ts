// What the tool keeps in the browser (Tobias 2026-11-15: the storage ban falls with the own
// subdomain; first and only use the confirmed access notice). While a copy still shares its origin
// with other apps (the test copy in NebenprojektERechnung/ on the Fragebogen subdomain), the tool
// uses only keys with its own prefix and never reads or clears anything else.

/** The one name the tool stores under; the ESLint storage ban and the e2e spy allow only this. */
export const ACCESS_STORAGE = 'e-rechnung-pruefer-zugang';

/** The folder of a page address: "/" for "/" and "/index.html", "/test/" for "/test/index.html". */
export function folderOf(pathname: string): string {
  const cut = pathname.lastIndexOf('/');
  return cut < 0 ? '/' : pathname.slice(0, cut + 1);
}

/**
 * The key for the copy in this folder: the name itself at the root, else "name@/folder/" — two
 * copies on one origin (test and public) keep their confirmations apart, as in the Fragebogen.
 */
export function storageKey(name: string, pathname: string): string {
  const folder = folderOf(pathname);
  return folder === '/' ? name : `${name}@${folder}`;
}
