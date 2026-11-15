// The foot of every page: the version (without „in Entwicklung“ since Tobias 2026-11-15) and, where
// the local Kanzlei configuration names them, the Kanzlei's Impressum and privacy policy (Tobias
// 2026-11-15). The addresses never come from this public repo. They open in a new tab, so a result
// on the page is not lost.
import { Fragment } from 'react';
import { APP_VERSION } from '../appInfo';
import { APP_CONFIG } from '../config';
import { TEXTS } from '../logic/texts';

export function Footer() {
  const links = [
    { href: APP_CONFIG.imprintUrl, text: TEXTS.imprint },
    { href: APP_CONFIG.privacyUrl, text: TEXTS.privacy },
  ].filter((link): link is { href: string; text: string } => link.href !== undefined);
  return (
    <footer className="version">
      Version {APP_VERSION}
      {links.map((link) => (
        <Fragment key={link.text}>
          {' · '}
          <a href={link.href} target="_blank" rel="noopener noreferrer">
            {link.text}
          </a>
        </Fragment>
      ))}
    </footer>
  );
}
