import { cspFor, withCsp } from '../../src/build/csp';

const PAGE =
  '<html><head><meta charset="UTF-8" /><style>a{}</style></head><body><script type="module">x()</script></body></html>';

describe('Content-Security-Policy', () => {
  it('forbids every connection, worker and foreign source but allows WebAssembly', () => {
    const policy = cspFor(["'sha256-a'"], ["'sha256-b'"]);
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("connect-src 'none'");
    expect(policy).toContain("worker-src 'none'");
    // not installable: no service worker (worker-src) and no web app manifest
    expect(policy).toContain("manifest-src 'none'");
    // base-uri and form-action fall back to nothing, and on file:// this meta CSP is the only one;
    // the edge rule of the hosted copy repeats all three (deploy/README.md: keep both in step)
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'none'");
    expect(policy).toContain("form-action 'none'");
    expect(policy).toContain("script-src 'sha256-a' 'wasm-unsafe-eval'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("'unsafe-inline'");
  });

  it('lets only the test version connect, and only to its own address („Bericht senden“)', () => {
    const test = cspFor(["'sha256-a'"], ["'sha256-b'"], { connectSelf: true });
    expect(test).toContain("connect-src 'self'");
    expect(test).not.toContain("connect-src 'none'");
    // everything else stays as strict as in the live build
    const live = cspFor(["'sha256-a'"], ["'sha256-b'"]);
    expect(test.replace("connect-src 'self'", "connect-src 'none'")).toBe(live);
    expect(withCsp(PAGE, { connectSelf: true })).toContain("connect-src 'self'");
    expect(withCsp(PAGE)).toContain("connect-src 'none'");
  });

  it('inserts the policy right after the charset with the hashes of the inline code', () => {
    const html = withCsp(PAGE);
    expect(html).toMatch(
      /<meta charset="UTF-8" \/>\n {4}<meta http-equiv="Content-Security-Policy"/,
    );
    expect(html).toMatch(/script-src 'sha256-[A-Za-z0-9+/=]{44}' 'wasm-unsafe-eval'/);
    expect(html).toMatch(/style-src 'sha256-[A-Za-z0-9+/=]{44}'/);
  });

  it('refuses a page that loads a script or stylesheet from outside', () => {
    expect(() => withCsp(PAGE.replace('<script type="module">', '<script src="x.js">'))).toThrow(
      /script from outside/,
    );
    expect(() =>
      withCsp(PAGE.replace('<style>a{}</style>', '<link rel="stylesheet" href="x.css">')),
    ).toThrow(/stylesheet/);
  });

  it('refuses a page that already has a policy', () => {
    const once = withCsp(PAGE);
    expect(() => withCsp(once)).toThrow(/already/);
  });
});
