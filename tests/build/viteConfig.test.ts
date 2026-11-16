import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from 'vite';

// The test version carries the shared test frame and `connect-src 'self'`; it belongs to the
// protected test zone only. Its folder follows from the mode itself, so `vite build --mode
// testbereich` without `--outDir` cannot overwrite the live file in dist/ (audit 2026-11-15,
// R2-S-04), and a test version named into dist/ stops the build.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

async function outDirOf(mode: string, outDir?: string): Promise<string> {
  const config = await resolveConfig(
    {
      root: ROOT,
      configFile: resolve(ROOT, 'vite.config.ts'),
      mode,
      logLevel: 'silent',
      ...(outDir === undefined ? {} : { build: { outDir } }),
    },
    'build',
  );
  return resolve(config.root, config.build.outDir);
}

describe('the folder a build writes', () => {
  it('is dist-test/ for the test version, without --outDir', async () => {
    expect(await outDirOf('testbereich')).toBe(resolve(ROOT, 'dist-test'));
  });

  it('is dist/ for the live build', async () => {
    expect(await outDirOf('production')).toBe(resolve(ROOT, 'dist'));
  });

  it('is never dist/ for the test version, not even when named', async () => {
    await expect(outDirOf('testbereich', 'dist')).rejects.toThrow(/dist-test/);
    await expect(outDirOf('testbereich', './dist/')).rejects.toThrow(/dist-test/);
  });
});
