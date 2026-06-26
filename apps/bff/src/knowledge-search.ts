import fs from 'node:fs';
import path from 'node:path';

export interface NoteSearchResult {
  title: string;
  path: string;
  excerpt: string;
}

const SKIP_DIRS = new Set(['.obsidian', '.git', 'node_modules', '.trash', '.codegraph']);

function extractTitle(content: string, fileName: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : path.basename(fileName, '.md');
}

function excerptAround(text: string, query: string, maxLen = 140): string {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  const slice =
    idx === -1
      ? text.slice(0, maxLen)
      : text.slice(Math.max(0, idx - 50), Math.min(text.length, idx + query.length + 90));
  return slice.replace(/\s+/g, ' ').trim();
}

/** 在本地 Vault 中全文检索 Markdown（标题/路径/正文） */
export function searchVault(query: string, vaultPath: string, limit = 10): NoteSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const root = path.resolve(vaultPath);
  if (!fs.existsSync(root)) {
    throw new Error(`Vault 不存在: ${root}`);
  }

  const scored: Array<NoteSearchResult & { score: number }> = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;

      const rel = path.relative(root, full).replace(/\\/g, '/');
      const base = path.basename(entry.name, '.md').toLowerCase();
      let content = '';
      try {
        content = fs.readFileSync(full, 'utf-8');
      } catch {
        continue;
      }

      const title = extractTitle(content, entry.name);
      let score = 0;
      if (title.toLowerCase().includes(q)) score += 100;
      if (base.includes(q)) score += 80;
      if (rel.toLowerCase().includes(q)) score += 50;
      if (content.toLowerCase().includes(q)) score += 20;
      if (score === 0) continue;

      scored.push({
        title,
        path: rel,
        excerpt: excerptAround(content, query),
        score,
      });
    }
  }

  walk(root);
  return scored
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit)
    .map(({ title, path: p, excerpt }) => ({ title, path: p, excerpt }));
}
