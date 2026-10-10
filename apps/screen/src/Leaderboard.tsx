import { Trophy } from 'lucide-react';
import '@fontsource-variable/space-grotesk';
import type { ScreenView } from '@jdlt/shared';
import { ROLE_ICON, ROLE_LABEL } from './roles.ts';

type Entry = ScreenView['leaderboard'][number];

/** Podium order: 2nd on the left, 1st in the middle, 3rd on the right. */
const PODIUM_ORDER = [1, 0, 2];

/** Final ranking: podium for the top 3, then the others with score bars. */
export function Leaderboard({ entries }: { entries: Entry[] }) {
  const top = Math.max(1, ...entries.map((e) => e.score));
  const rest = entries.slice(3);

  return (
    <div className="card leaderboard">
      <div className="card-kicker">
        <Trophy className="icon" /> Classement
      </div>
      {entries.length === 0 ? (
        <p className="leaderboard-empty">Aucun joueur</p>
      ) : (
        <>
          <div className="podium">
            {PODIUM_ORDER.filter((i) => entries[i]).map((i) => (
              <PodiumPlace key={i} rank={i + 1} entry={entries[i]!} />
            ))}
          </div>
          <ol className="ranking" start={4}>
            {rest.map((e, i) => {
              const Icon = ROLE_ICON[e.role];
              return (
                <li
                  key={i}
                  className={`role-${e.role}`}
                  style={{ animationDelay: `${1.2 + i * 0.08}s` }}
                >
                  <span className="rank">{i + 4}</span>
                  <span className="role-dot" title={ROLE_LABEL[e.role]}>
                    <Icon className="icon" />
                  </span>
                  <span className="name">{e.name}</span>
                  <span className="bar">
                    <i style={{ width: `${(Math.max(0, e.score) / top) * 100}%` }} />
                  </span>
                  <span className="score">{e.score}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}

function PodiumPlace({ rank, entry }: { rank: number; entry: Entry }) {
  const Icon = ROLE_ICON[entry.role];
  return (
    <div className={`podium-place place-${rank} role-${entry.role}`}>
      <div className="podium-who">
        <span className="medal">{rank}</span>
        <strong className="name">{entry.name}</strong>
        <span className="role">
          <Icon className="icon" /> {ROLE_LABEL[entry.role]}
        </span>
      </div>
      <div className="podium-step">
        <span className="score">{entry.score}</span>
        <span className="unit">pts</span>
      </div>
    </div>
  );
}
