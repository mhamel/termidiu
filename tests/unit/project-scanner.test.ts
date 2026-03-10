import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { flattenScripts, scanProject } from '../../src/shared/project-scanner';

const tempPaths: string[] = [];

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('scanProject', () => {
  it('discovers ps1 files and ignores common build folders', async () => {
    const root = await createTempProject();
    await mkdir(join(root, 'Scripts', 'skills'), { recursive: true });
    await mkdir(join(root, 'node_modules', 'ignored'), { recursive: true });
    await writeFile(join(root, 'Scripts', 'skills', 'run.ps1'), 'Write-Host "ok"', 'utf8');
    await writeFile(join(root, 'node_modules', 'ignored', 'skip.ps1'), 'Write-Host "skip"', 'utf8');

    const tree = scanProject(root);
    const scripts = flattenScripts(tree);

    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.relativePath).toBe(`Scripts${pathSeparator()}skills${pathSeparator()}run.ps1`);
  });

  it('marks layout sidecars when present', async () => {
    const root = await createTempProject();
    await writeFile(join(root, 'stack.ps1'), 'Write-Host "ok"', 'utf8');
    await writeFile(join(root, 'stack.ps1.layout.json'), '{"title":"Stack","layout":{"type":"split"}}', 'utf8');

    const tree = scanProject(root);
    const scripts = flattenScripts(tree);

    expect(scripts[0]?.layoutPath).toBe(join(root, 'stack.ps1.layout.json'));
  });
});

async function createTempProject(): Promise<string> {
  const root = join(tmpdir(), `termidiu-scan-${crypto.randomUUID()}`);
  tempPaths.push(root);
  await mkdir(root, { recursive: true });
  return root;
}

function pathSeparator(): string {
  return process.platform === 'win32' ? '\\' : '/';
}

