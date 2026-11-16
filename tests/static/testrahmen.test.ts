import { pruefeKopie } from '../../src/testrahmen/pruefen.mjs';

// The shared test frame of the test version (repo Testumgebung, testrahmen/; its docs/testrahmen.md)
// is a copy, changed only there and copied again (`npm run rahmen -- <folder of this app> --ziel
// src/testrahmen`). Its checker compares every file with the SHA-256 in testrahmen.json and refuses
// a trial copy (`--entwurf`).
describe('the copy of the shared test frame', () => {
  it('is unchanged and comes from a commit of Testumgebung', () => {
    expect(pruefeKopie()).toEqual([]);
  });
});
