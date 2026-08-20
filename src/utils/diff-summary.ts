import { MAX_DIFF_LENGTH } from "./constants.js";

// Skeleton extraction: send a few signature/declaration lines per file instead of
// the full diff, so huge diffs cost far fewer tokens while keeping the gist.
const PER_FILE_ADDED = 8;
const PER_FILE_REMOVED = 4;
const LINE_MAX = 120;
const SKELETON_BUDGET = MAX_DIFF_LENGTH;

const CONTROL_FLOW =
  /^(?:else\s+)?(?:if|for|while|switch|case|default|return|break|continue|goto|do|catch|throw|new|delete|try)\b/;

const isSkeletonLine = (line: string): boolean => {
  const t = line.trim();
  if (t.length < 4 || t.length > LINE_MAX) return false;
  if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) return false;
  if (/^[{};,]/.test(t) || CONTROL_FLOW.test(t)) return false;
  if (t.startsWith("#")) return true; // preprocessor directives (#include, #define, ...)
  // Declaration-ish line: starts with an identifier, mentions `(` or ends with `;`/`{`
  return (
    /^[A-Za-z_][\w:<>]*/.test(t) && (t.includes("(") || t.includes("::") || /[;:{]\s*$/.test(t))
  );
};

const pickInteresting = (lines: string[], cap: number): string[] => {
  const seen = new Set<string>();
  const picked: string[] = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (seen.has(t) || !isSkeletonLine(t)) continue;
    seen.add(t);
    picked.push(t);
    if (picked.length >= cap) break;
  }
  return picked;
};

const splitFileSections = (diff: string) => {
  const sections: { path: string; added: string[]; removed: string[] }[] = [];
  let current: { path: string; added: string[]; removed: string[] } | null = null;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      if (current) sections.push(current);
      const p = raw.slice(11); // after "diff --git "
      const path = p.startsWith("a/") ? p.slice(2).split(" b/")[0] : p.split(" b/")[0];
      current = { path, added: [], removed: [] };
      continue;
    }
    if (!current) continue;
    if (raw.startsWith("+++") || raw.startsWith("---") || raw.startsWith("@@")) continue;
    if (raw.startsWith("+")) current.added.push(raw.slice(1));
    else if (raw.startsWith("-")) current.removed.push(raw.slice(1));
    // skip context lines (leading space), "\ No newline"
  }
  if (current) sections.push(current);
  return sections;
};

export const summarizeDiff = (diff: string): string => {
  const sections = splitFileSections(diff).filter(
    (s) => s.added.length > 0 || s.removed.length > 0, // skip binary/mode-only entries
  );
  if (sections.length === 0) return diff;

  let totalAdded = 0;
  let totalRemoved = 0;
  let out = "";
  let omitted = 0;

  for (const s of sections) {
    totalAdded += s.added.length;
    totalRemoved += s.removed.length;
    const block = [
      `FILE ${s.path} (+${s.added.length}, -${s.removed.length})`,
      ...pickInteresting(s.added, PER_FILE_ADDED).map((l) => `  ${l}`),
      ...pickInteresting(s.removed, PER_FILE_REMOVED).map((l) => `- ${l}`),
    ].join("\n");
    if (out && out.length + block.length > SKELETON_BUDGET) {
      omitted = sections.length - sections.indexOf(s);
      break;
    }
    out += (out ? "\n" : "") + block;
  }

  if (omitted > 0) out += `\n... and ${omitted} more files`;
  return (
    `# Condensed diff: ${sections.length} files, +${totalAdded} -${totalRemoved} ` +
    `(full diff was ${(diff.length / 1024).toFixed(0)} KB; only skeleton lines shown)\n` +
    out
  );
};
