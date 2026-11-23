import fs from 'node:fs';

const legacy = new Set(JSON.parse(fs.readFileSync(
  new URL('../data/legacy-exhibition-ids.json', import.meta.url), 'utf8'
)));

export const hasSubmissionTag = text =>
  typeof text === 'string' && /(^|[^\p{L}\p{N}_#])#twentyx(?![\p{L}\p{N}_])/iu.test(text);

export function hasAdmissionEvidence(artist) {
  const id = artist.postUrl?.match(/\/status\/(\d+)\/?$/)?.[1];
  return legacy.has(id) || (
    artist.submission?.postUrl === artist.postUrl &&
    hasSubmissionTag(artist.submission?.caption)
  );
}
