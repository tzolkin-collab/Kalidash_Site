import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';

// Trava do padrão de selos (docs/selos.md): todo selo sai de components/badges.tsx ou components/TagChip.tsx.
// Se este teste falhar, troque o selo feito à mão pelo componente certo do conjunto (StatusBadge, LabelBadge…).

const SRC = join(import.meta.dirname, '..', 'src');
const OWNERS = new Set(['components/badges.tsx', 'components/TagChip.tsx']);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(tsx|ts)$/.test(name) ? [full] : [];
  });
}

const sources = files(SRC).map((full) => ({ path: relative(SRC, full).split(sep).join('/'), text: readFileSync(full, 'utf8') }));

/** Linhas (1-based) de `text` que casam com `re`, como "arquivo:linha". */
function hits(re: RegExp, only?: (path: string) => boolean): string[] {
  const out: string[] = [];
  for (const { path, text } of sources) {
    if (only && !only(path)) continue;
    text.split('\n').forEach((line, i) => {
      if (!line.trimStart().startsWith('//') && re.test(line)) out.push(`${path}:${i + 1}`);
    });
  }
  return out;
}

test('não existe mais o <Badge> genérico (use StatusBadge, LabelBadge, SampleBadge…)', () => {
  assert.deepEqual(hits(/<Badge[\s>]/), []);
});

test('nenhum selo à mão com as classes antigas "badge"/"tag"', () => {
  // Classe exatamente "tag", "badge" ou "badge-…" (o ribbon antigo). tag-row, tagc, lead-badge, bell-badge são outra coisa.
  assert.deepEqual(hits(/className=["'`{][^"'`}]*(?<![\w-])(tag(?![\w-])|badge(?![\w])|badge-\w)/), []);
});

test('o visual dos selos (data-cat) só é montado nos componentes do conjunto', () => {
  assert.deepEqual(hits(/data-cat=/, (p) => !OWNERS.has(p)), []);
});

test('o conjunto exporta os selos documentados', () => {
  const lib = sources.find((s) => s.path === 'components/badges.tsx')!.text;
  for (const name of ['StatusBadge', 'LabelBadge', 'SampleBadge', 'EmptyBadge', 'StageBadge', 'SourceBadge', 'PriorityBadge', 'LifecycleBadge', 'LeadStatusBadge', 'TaskStatusBadge']) {
    assert.match(lib, new RegExp(`export function ${name}\\b`), `${name} sumiu de components/badges.tsx`);
  }
});
