import chokidar, { type FSWatcher } from 'chokidar';

const IGNORED_SEGMENTS = new Set(['.git', '.vs', '.idea', 'node_modules', 'bin', 'obj']);

export class ProjectWatcher {
  private watcher: FSWatcher | null = null;

  private debounceHandle: NodeJS.Timeout | null = null;

  start(rootPath: string, onChange: () => void): void {
    this.dispose();

    this.watcher = chokidar.watch(rootPath, {
      ignoreInitial: true,
      depth: 99,
      ignored: path => path.split(/[\\/]/g).some(segment => IGNORED_SEGMENTS.has(segment))
    });

    const schedule = (): void => {
      if (this.debounceHandle) {
        clearTimeout(this.debounceHandle);
      }

      this.debounceHandle = setTimeout(onChange, 150);
    };

    this.watcher.on('add', schedule);
    this.watcher.on('unlink', schedule);
    this.watcher.on('addDir', schedule);
    this.watcher.on('unlinkDir', schedule);
    this.watcher.on('change', schedule);
  }

  dispose(): void {
    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
      this.debounceHandle = null;
    }

    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }
  }
}

