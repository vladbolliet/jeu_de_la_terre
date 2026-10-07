// Node-only: loads and validates /content YAML files.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import { CardSchema, ERAS, RoleDefSchema, ROLES, VoteSchema, type Content } from '@jdlt/shared';

export const DEFAULT_CONTENT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content',
);

function readYamlList<T>(dir: string, schema: z.ZodType<T>): T[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort()
    .flatMap((f) => {
      const parsed = z.array(schema).safeParse(parse(readFileSync(join(dir, f), 'utf8')) ?? []);
      if (!parsed.success) throw new Error(`${join(dir, f)}:\n${z.prettifyError(parsed.error)}`);
      return parsed.data;
    });
}

/** Throws with a readable message if content is invalid. Returns warnings for non-fatal issues. */
export function loadContent(dir = DEFAULT_CONTENT_DIR): { content: Content; warnings: string[] } {
  const rolesFile = join(dir, 'roles.yaml');
  const roles = z.array(RoleDefSchema).parse(parse(readFileSync(rolesFile, 'utf8')));
  const cards = readYamlList(join(dir, 'cards'), CardSchema);
  const votes = readYamlList(join(dir, 'votes'), VoteSchema);

  const errors: string[] = [];
  const warnings: string[] = [];
  const dup = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of dup(cards.map((c) => c.id))) errors.push(`card id en double: ${id}`);
  for (const id of dup(votes.map((v) => v.id))) errors.push(`vote id en double: ${id}`);
  for (const r of ROLES)
    if (!roles.some((d) => d.id === r)) errors.push(`rôle manquant dans roles.yaml: ${r}`);

  const cardIds = new Set(cards.map((c) => c.id));
  for (const card of [...cards, ...votes]) {
    for (const o of card.options) {
      if (o.sends && !cardIds.has(o.sends.card))
        errors.push(`${card.id}/${o.id}: sends.card inconnue "${o.sends.card}"`);
    }
  }
  for (const era of ERAS) {
    for (const role of ROLES) {
      const n = cards.filter(
        (c) => !c.interactionOnly && c.roles.includes(role) && (!c.eras || c.eras.includes(era)),
      ).length;
      if (n === 0) warnings.push(`aucune carte pour ${role} en ${era}`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { content: { roles, cards, votes }, warnings };
}
