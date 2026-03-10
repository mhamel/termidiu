import { basename, dirname, join, relative, resolve } from 'node:path';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import type { FolderNode, LayoutDescriptor, ProjectTreeNode, ScriptDescriptor } from './contracts';

const IGNORED_DIRECTORIES = new Set(['.git', '.vs', '.idea', 'node_modules', 'bin', 'obj']);

interface FileEntry {
  name: string;
  fullPath: string;
  relativePath: string;
}

export function scanProject(rootPath: string): FolderNode {
  const fullRoot = normalizePath(rootPath);

  // 1. Collect all .ps1 and .layout.json files
  const allFiles = collectAllFiles(fullRoot, fullRoot);

  // 2. Build layout descriptors and track which scripts they claim
  const claimedPaths = new Set<string>();
  const layouts: LayoutDescriptor[] = [];

  for (const f of allFiles.filter(f => f.name.endsWith('.layout.json'))) {
    const children = extractLayoutChildren(f.fullPath, fullRoot);
    for (const c of children) claimedPaths.add(c.fullPath);
    layouts.push({
      kind: 'layout',
      id: f.fullPath,
      name: f.name,
      fullPath: f.fullPath,
      relativePath: f.relativePath,
      children,
    });
  }

  // 3. Standalone scripts (not owned by any layout)
  const scripts: ScriptDescriptor[] = allFiles
    .filter(f => f.name.endsWith('.ps1') && !claimedPaths.has(f.fullPath))
    .map(f => ({
      kind: 'script' as const,
      id: f.fullPath,
      name: f.name,
      fullPath: f.fullPath,
      relativePath: f.relativePath,
      workingDirectory: dirname(f.fullPath),
    }));

  // 4. Build full directory tree (all dirs, not just those containing files)
  const rootNode = buildDirTree(fullRoot, fullRoot);

  // 5. Place files into the directory tree
  for (const item of [...layouts, ...scripts]) {
    placeInTree(rootNode, item, item.relativePath);
  }

  sortNode(rootNode);
  return rootNode;
}

export function flattenScripts(node: FolderNode): ScriptDescriptor[] {
  const scripts: ScriptDescriptor[] = [];
  walk(node);
  return scripts;

  function walk(current: ProjectTreeNode): void {
    if (current.kind === 'script') {
      scripts.push(current);
      return;
    }
    if (current.kind === 'layout') {
      scripts.push(...current.children);
      return;
    }
    for (const child of current.children) {
      walk(child);
    }
  }
}

export function flattenLayouts(node: FolderNode): LayoutDescriptor[] {
  const layouts: LayoutDescriptor[] = [];
  walk(node);
  return layouts;

  function walk(current: ProjectTreeNode): void {
    if (current.kind === 'layout') {
      layouts.push(current);
      return;
    }
    if (current.kind === 'folder') {
      for (const child of current.children) walk(child);
    }
  }
}

function collectAllFiles(rootPath: string, currentPath: string): FileEntry[] {
  const entries = readdirSync(currentPath, { withFileTypes: true });
  const files: FileEntry[] = [];

  for (const entry of entries) {
    const fullPath = join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        files.push(...collectAllFiles(rootPath, fullPath));
      }
      continue;
    }
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!name.endsWith('.ps1') && !name.endsWith('.layout.json')) continue;
    files.push({ name, fullPath, relativePath: relative(rootPath, fullPath) });
  }

  return files;
}

function extractLayoutChildren(layoutPath: string, rootPath: string): ScriptDescriptor[] {
  try {
    const raw = JSON.parse(readFileSync(layoutPath, 'utf8')) as Record<string, unknown>;
    const refs: string[] = [];
    collectScriptRefs(raw['layout'], refs);
    const layoutDir = dirname(layoutPath);
    return refs.map(ref => {
      const fullPath = resolve(layoutDir, ref);
      return {
        kind: 'script' as const,
        id: fullPath,
        name: basename(fullPath),
        fullPath,
        relativePath: relative(rootPath, fullPath),
        workingDirectory: dirname(fullPath),
      };
    });
  } catch {
    return [];
  }
}

function collectScriptRefs(node: unknown, refs: string[]): void {
  if (!node || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;
  if (n['type'] === 'terminal' && typeof n['script'] === 'string') {
    refs.push(n['script']);
    return;
  }
  if (Array.isArray(n['children'])) {
    for (const child of n['children']) collectScriptRefs(child, refs);
  }
}

function buildDirTree(rootPath: string, currentPath: string): FolderNode {
  const node: FolderNode = {
    kind: 'folder',
    id: currentPath,
    name: basename(currentPath),
    relativePath: relative(rootPath, currentPath),
    children: [],
  };

  const entries = readdirSync(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    node.children.push(buildDirTree(rootPath, join(currentPath, entry.name)));
  }

  return node;
}

function placeInTree(
  rootNode: FolderNode,
  item: ScriptDescriptor | LayoutDescriptor,
  relativePath: string
): void {
  const segments = relativePath.split(/[\\/]/g);
  let current = rootNode;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const child = current.children.find(
      n => n.kind === 'folder' && n.name.toLowerCase() === segment.toLowerCase()
    ) as FolderNode | undefined;
    if (!child) return;
    current = child;
  }

  current.children.push(item);
}

function sortNode(node: FolderNode): void {
  node.children.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'folder' ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });

  for (const child of node.children) {
    if (child.kind === 'folder') {
      sortNode(child);
    }
  }
}

function normalizePath(input: string): string {
  return input.replace(/[\\/]+$/, '');
}

function statExists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

