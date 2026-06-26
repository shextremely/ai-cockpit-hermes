import { Router } from 'express';
import { config } from '../config.js';
import { openVaultFile, resolveVaultFile } from '../knowledge-open.js';
import { searchVault } from '../knowledge-search.js';

export const knowledgeRouter = Router();

/** 知识库检索：直接扫描本地 Obsidian Vault */
knowledgeRouter.post('/knowledge/search', async (req, res) => {
  const query = String((req.body as { query?: string })?.query ?? '').trim();
  if (!query) {
    res.status(400).json({ error: 'bad_request', message: 'query 必填' });
    return;
  }
  const vault = config.obsidian.vaultPath;
  if (!vault) {
    res.status(503).json({ error: 'vault_not_configured', message: '未配置 OBSIDIAN_VAULT_PATH', results: [] });
    return;
  }
  try {
    const results = searchVault(query, vault);
    res.json({ results, source: 'vault' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: 'search_failed', message, results: [] });
  }
});

/** 用 Typora 或系统默认程序打开 Vault 内笔记 */
knowledgeRouter.post('/knowledge/open', async (req, res) => {
  try {
    const rel = String((req.body as { path?: string })?.path ?? '').trim();
    if (!rel) {
      res.status(400).json({ error: 'bad_request', message: 'path 必填' });
      return;
    }
    const fullPath = resolveVaultFile(rel);
    const opened = openVaultFile(fullPath);
    res.json({ ok: true, opened, path: fullPath });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(400).json({ error: 'open_failed', message });
  }
});
