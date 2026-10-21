import { z } from "zod";
import type { FeedbackReport } from "./schemas";

const compressedSnapshotSchema = z.strictObject({
  format: z.literal("onderwijsloket-feedback"),
  version: z.literal(1),
  encoding: z.literal("gzip+base64"),
  originalBytes: z.number().int().positive(),
  data: z.base64()
});

const snapshotSchema = z.looseObject({
  schemaVersion: z.literal(1),
  consentVersion: z.string().min(1),
  receivedAt: z.iso.datetime(),
  input: z.record(z.string(), z.unknown()),
  context: z.record(z.string(), z.unknown())
});

/** Losslessly compress a complete snapshot using APIs shared by Node and Workers.
 * @param report - Complete validated report; nothing is selected or removed.
 * @returns A versioned JSON envelope containing gzip-compressed UTF-8 as Base64.
 */
export async function compressFeedbackSnapshot(report: FeedbackReport) {
  const json = JSON.stringify(report);
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return {
    format: "onderwijsloket-feedback" as const,
    version: 1 as const,
    encoding: "gzip+base64" as const,
    originalBytes: new TextEncoder().encode(json).byteLength,
    data: btoa(binary)
  };
}

/** Decode a normal snapshot or a versioned compressed envelope without losing fields.
 * @param value - Parsed JSON copied from the ordered JSON code blocks of a report.
 * @returns The original snapshot; corrupt, unsupported or size-mismatched envelopes fail.
 */
export async function decodeFeedbackSnapshot(value: unknown) {
  const plain = snapshotSchema.safeParse(value);
  if (plain.success) return plain.data;
  const parsed = compressedSnapshotSchema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid feedback snapshot format.");
  const envelope = parsed.data;
  try {
    const bytes = Uint8Array.from(atob(envelope.data), (character) => character.charCodeAt(0));
    const reader = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"))
      .getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        length += chunk.byteLength;
        if (length > envelope.originalBytes) throw new Error("Snapshot size mismatch.");
        chunks.push(chunk);
      }
    } finally {
      await reader.cancel();
    }
    if (length !== envelope.originalBytes) throw new Error("Snapshot size mismatch.");
    const decoded = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      decoded.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const snapshot = snapshotSchema.safeParse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded))
    );
    if (!snapshot.success) throw new Error("Invalid snapshot.");
    return snapshot.data;
  } catch {
    throw new Error("Corrupt feedback snapshot or incorrect originalBytes.");
  }
}
