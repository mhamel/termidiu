/**
 * Generates Codex skill discovery wrappers:
 *   .rulesync/skills/<skill>/SKILL.md (source of truth, full content)
 *   -> .agents/skills/<skill>/SKILL.md (wrapper with See: link)
 *
 * Codex CLI scans `.agents/skills/` for skill discovery.
 */
import { readdirSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, ".rulesync", "skills");
const dest = join(root, ".agents", "skills");

function parseFrontmatter(skillFileContent) {
  if (!skillFileContent.startsWith("---")) return null;
  const end = skillFileContent.indexOf("\n---", 3);
  if (end === -1) return null;
  const fm = skillFileContent.slice(3, end + 1);

  const lines = fm.split(/\r?\n/);
  let name = null;
  let description = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!name) {
      const m = line.match(/^name:\s*(.+?)\s*$/);
      if (m) name = m[1].trim();
    }

    if (!description) {
      const m = line.match(/^description:\s*(.*)\s*$/);
      if (!m) continue;

      const rest = m[1].trim();
      if (rest === ">-" || rest === ">" || rest === "|-" || rest === "|") {
        const collected = [];
        for (let j = i + 1; j < lines.length; j++) {
          const next = lines[j];
          if (!next.startsWith("  ") && next.trim() !== "") break;
          collected.push(next.replace(/^  /, ""));
        }
        description = collected.join(" ").replace(/\s+/g, " ").trim();
      } else {
        description = rest.replace(/^"(.*)"$/, "$1").replace(/\s+/g, " ").trim();
      }
    }
  }

  if (!name) return null;
  return { name, description };
}

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

  const content = readFileSync(skillFile, "utf8");
  const fm = parseFrontmatter(content);

  const name = fm?.name ?? skillName;
  const description = fm?.description ?? `See .rulesync/skills/${skillName}/SKILL.md`;

  const destDir = join(dest, skillName);
  mkdirSync(destDir, { recursive: true });

  const wrapper = `---
name: ${name}
description: ${JSON.stringify(description)}
---

See: [../../../.rulesync/skills/${skillName}/SKILL.md](../../../.rulesync/skills/${skillName}/SKILL.md)
`;

  writeFileSync(join(destDir, "SKILL.md"), wrapper, "utf8");
  count++;
}

console.log(`[sync-codex-skills] Synced ${count} skill wrapper(s) to .agents/skills/`);
