import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTabForScript, collectSessionIds } from '../../src/shared/layout';
import type { ScriptDescriptor } from '../../src/shared/contracts';

const tempPaths: string[] = [];

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('buildTabForScript', () => {
  it('builds a single-terminal tab for plain scripts', async () => {
    const root = await createTempProject();
    const scriptPath = join(root, 'plain.ps1');
    await writeFile(scriptPath, 'Write-Host "hello"', 'utf8');

    const tab = buildTabForScript(createScript(scriptPath, null));

    expect(tab.title).toBe('plain.ps1');
    expect(tab.layout.kind).toBe('terminal');
    expect(collectSessionIds(tab.layout)).toHaveLength(1);
  });

  it('builds split terminals from sidecar metadata', async () => {
    const root = await createTempProject();
    const scriptPath = join(root, 'stack.ps1');
    const layoutPath = `${scriptPath}.layout.json`;
    await writeFile(scriptPath, 'Write-Host "hello"', 'utf8');
    await writeFile(
      layoutPath,
      JSON.stringify({
        title: 'All Web',
        layout: {
          type: 'split',
          orientation: 'horizontal',
          children: [
            {
              type: 'terminal',
              title: 'API',
              cwd: root.replace(/\//g, '\\'),
              command: 'pnpm run api'
            },
            {
              type: 'terminal',
              title: 'WEB',
              cwd: root.replace(/\//g, '\\'),
              command: 'pnpm run web'
            }
          ]
        }
      }),
      'utf8'
    );

    const tab = buildTabForScript(createScript(scriptPath, layoutPath));

    expect(tab.title).toBe('All Web');
    expect(tab.layout.kind).toBe('split');
    expect(collectSessionIds(tab.layout)).toHaveLength(2);
  });

  it('throws on invalid sidecar data', async () => {
    const root = await createTempProject();
    const scriptPath = join(root, 'broken.ps1');
    const layoutPath = `${scriptPath}.layout.json`;
    await writeFile(scriptPath, 'Write-Host "hello"', 'utf8');
    await writeFile(layoutPath, '{"title":"Broken","layout":{"type":"terminal"}}', 'utf8');

    expect(() => buildTabForScript(createScript(scriptPath, layoutPath))).toThrow(
      /terminal nodes require/
    );
  });
});

async function createTempProject(): Promise<string> {
  const root = join(tmpdir(), `termidiu-layout-${crypto.randomUUID()}`);
  tempPaths.push(root);
  await mkdir(root, { recursive: true });
  return root;
}

function createScript(fullPath: string, layoutPath: string | null): ScriptDescriptor {
  return {
    kind: 'script',
    id: fullPath,
    name: fullPath.split(/[\\/]/g).at(-1) ?? fullPath,
    fullPath,
    relativePath: fullPath.split(/[\\/]/g).at(-1) ?? fullPath,
    workingDirectory: fullPath.slice(0, fullPath.lastIndexOf('\\') >= 0 ? fullPath.lastIndexOf('\\') : fullPath.lastIndexOf('/')),
    layoutPath
  };
}
