import fs from 'node:fs';
import path from 'node:path';

export interface ScannedSkill {
  name: string;
  description: string;
  category?: string;
  path: string;
}

function parseFrontmatter(skillMdPath: string, folderName: string): ScannedSkill {
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let name = folderName;
  let description = '';
  let category: string | undefined;

  if (match) {
    const block = match[1];
    const nameLine = block.match(/^name:\s*(.+)$/m);
    if (nameLine) {
      name = nameLine[1].trim().replace(/^["']|["']$/g, '');
    }
    const descLine = block.match(/^description:\s*(.+)$/m);
    if (descLine) {
      description = descLine[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  return { name, description, category, path: folderName };
}

/** 扫描 Claude 技能目录（一级子目录含 SKILL.md） */
export function scanClaudeSkills(skillsDir: string): ScannedSkill[] {
  const root = path.resolve(skillsDir);
  if (!fs.existsSync(root)) {
    throw new Error(`技能目录不存在: ${root}`);
  }

  const skills: ScannedSkill[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const skillMd = path.join(root, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;
    try {
      skills.push(parseFrontmatter(skillMd, entry.name));
    } catch {
      skills.push({ name: entry.name, description: '', path: entry.name });
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}
