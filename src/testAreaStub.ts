// What every build except the test version gets in place of src/testArea.tsx and the copy of the
// shared test frame (vite.config.ts): nothing of the frame, its style or the manual tests reaches
// the live file. main.tsx calls it only in the test version, so the build drops it; called anyway,
// it only throws. A name of the frame imported elsewhere is missing here and stops the build.
export function startTestArea(): never {
  throw new Error('Der Testrahmen gehört nur in die Testfassung (npm run build:test).');
}
