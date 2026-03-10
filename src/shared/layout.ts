import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { LaunchLayoutNode, LayoutDescriptor, ScriptDescriptor, SplitOrientation, WorkspaceTab } from './contracts';

interface RawLayoutFile {
  title?: string;
  layout?: RawLayoutNode;
}

interface RawLayoutNode {
  type?: string;
  title?: string;
  script?: string;
  orientation?: string;
  children?: RawLayoutNode[];
}

export function buildTabForScript(script: ScriptDescriptor): WorkspaceTab {
  return {
    id: randomUUID(),
    scriptPath: script.fullPath,
    title: script.name,
    layout: {
      kind: 'terminal',
      sessionId: randomUUID(),
      title: script.name,
      cwd: script.workingDirectory,
      launch: {
        mode: 'file',
        value: script.fullPath
      }
    }
  };
}

export function buildTabForLayout(layout: LayoutDescriptor): WorkspaceTab {
  const raw = JSON.parse(readFileSync(layout.fullPath, 'utf8')) as RawLayoutFile;
  if (!raw.title || !raw.layout) {
    throw new Error(`Layout file '${layout.fullPath}' must contain 'title' and 'layout'.`);
  }

  const layoutDir = dirname(layout.fullPath);

  return {
    id: randomUUID(),
    scriptPath: layout.fullPath,
    title: raw.title,
    layout: parseLayoutNode(raw.layout, layout.fullPath, layoutDir)
  };
}

export function collectSessionIds(layout: LaunchLayoutNode): string[] {
  if (layout.kind === 'terminal') {
    return [layout.sessionId];
  }

  return layout.children.flatMap(child => collectSessionIds(child));
}

export function collectTerminalNodes(layout: LaunchLayoutNode): LaunchLayoutNode[] {
  if (layout.kind === 'terminal') {
    return [layout];
  }

  return layout.children.flatMap(child => collectTerminalNodes(child));
}

function parseLayoutNode(node: RawLayoutNode, layoutPath: string, layoutDir: string): LaunchLayoutNode {
  if (!node.type) {
    throw new Error(`Layout file '${layoutPath}' contains a node without 'type'.`);
  }

  if (node.type === 'terminal') {
    if (!node.title || !node.script) {
      throw new Error(
        `Layout file '${layoutPath}' terminal nodes require 'title' and 'script'.`
      );
    }

    const scriptPath = resolve(layoutDir, node.script);

    return {
      kind: 'terminal',
      sessionId: randomUUID(),
      title: node.title,
      cwd: dirname(scriptPath),
      launch: {
        mode: 'file',
        value: scriptPath
      }
    };
  }

  if (node.type !== 'split') {
    throw new Error(`Layout file '${layoutPath}' has unsupported node type '${node.type}'.`);
  }

  if (!node.orientation || !isOrientation(node.orientation)) {
    throw new Error(`Layout file '${layoutPath}' has invalid split orientation.`);
  }

  if (!node.children || node.children.length < 2) {
    throw new Error(`Layout file '${layoutPath}' split nodes require at least two children.`);
  }

  return {
    kind: 'split',
    orientation: node.orientation,
    children: node.children.map(child => parseLayoutNode(child, layoutPath, layoutDir))
  };
}

function isOrientation(value: string): value is SplitOrientation {
  return value === 'horizontal' || value === 'vertical';
}
