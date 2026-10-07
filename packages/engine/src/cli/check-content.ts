import { loadContent } from '../load.ts';

try {
  const { content, warnings } = loadContent(process.argv[2]);
  for (const w of warnings) console.warn(`⚠️  ${w}`);
  console.log(
    `✅ contenu valide: ${content.cards.length} cartes, ${content.votes.length} votes, ${content.roles.length} rôles`,
  );
} catch (e) {
  console.error(`❌ contenu invalide\n${(e as Error).message}`);
  process.exit(1);
}
