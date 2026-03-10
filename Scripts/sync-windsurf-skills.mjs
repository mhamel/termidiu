/**
 * Copies .rulesync/skills/ -> .windsurf/skills/
 * Windsurf does not have native skill support in rulesync, so this script
 * propagates the source of truth (.rulesync/skills/) to the windsurf skills directory.
 */
import { readdirSync, mkdirSync, copyFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, ".rulesync", "skills");
const dest = join(root, ".windsurf", "skills");

let count = 0;
for (const skillName of readdirSync(src)) {
  const skillSrc = join(src, skillName);
  if (!statSync(skillSrc).isDirectory()) continue;
  const skillFile = join(skillSrc, "SKILL.md");
  try {
    statSync(skillFile);
  } catch {
    continue;
  }
  const destDir = join(dest, skillName);
  mkdirSync(destDir, { recursive: true });
  copyFileSync(skillFile, join(destDir, "SKILL.md"));
  count++;
}
console.log(`[sync-windsurf-skills] Synced ${count} skills to .windsurf/skills/`);
