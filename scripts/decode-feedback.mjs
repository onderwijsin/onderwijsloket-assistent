import { readFile } from "node:fs/promises";
import { decodeFeedbackSnapshot } from "../server/utils/feedback/snapshot.ts";

// Node 24 strips TypeScript types; decoding requires no build or environment secrets.
if (process.argv.length !== 3) {
  console.error("Usage: node scripts/decode-feedback.mjs <snapshot.json>");
  process.exitCode = 1;
} else {
  try {
    const value = JSON.parse(await readFile(process.argv[2], "utf8"));
    const report = await decodeFeedbackSnapshot(value);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch {
    console.error(
      "Could not decode feedback snapshot. Check the file, encoding and original byte count."
    );
    process.exitCode = 1;
  }
}
