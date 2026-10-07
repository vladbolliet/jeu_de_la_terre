import { Users, Vote } from 'lucide-react';
import type { ScreenView } from '@jdlt/shared';
import { ROLES, ROLE_LABEL } from './roles.ts';

/**
 * `meanEmissions` is in −10…+10 but real cards stay within a few points, so the
 * bars are scaled to the most extreme role of the era, never below this floor
 * (keeps tiny differences from looking huge).
 */
const MIN_SCALE = 4;

export function ChoicesPanel({ view }: { view: ScreenView }) {
  const ratio = view.cardsDealt ? Math.min(1, view.choicesMade / view.cardsDealt) : 0;
  const scale = Math.max(MIN_SCALE, ...ROLES.map((r) => Math.abs(view.roleStats[r].meanEmissions)));
  return (
    <>
      <div className="panel-kicker">
        <Users className="icon" /> Choix des joueurs
      </div>
      <div className="panel choices-panel">
        <div className="gauge-row">
          <span className="gauge-label">
            <strong>{view.choicesMade}</strong> / {view.cardsDealt} choix faits
          </span>
          <div className="gauge">
            <div className="gauge-fill" style={{ transform: `scaleX(${ratio})` }} />
          </div>
        </div>
        <div className="emissions-legend">
          <span className="less">◀ Moins polluant</span>
          <span className="more">Plus polluant ▶</span>
        </div>
        <ul className="role-bars">
          {ROLES.map((role) => {
            const { choices, meanEmissions } = view.roleStats[role];
            const share = (Math.abs(meanEmissions) / scale) * 50;
            return (
              <li key={role} className={choices ? '' : 'waiting'}>
                <span className="role-name">{ROLE_LABEL[role]}</span>
                <div className="diverging">
                  <div className="axis" />
                  {choices > 0 && (
                    <div
                      className={`bar ${meanEmissions > 0 ? 'more' : 'less'}`}
                      style={
                        meanEmissions > 0
                          ? { left: '50%', width: `${share}%` }
                          : { right: '50%', width: `${share}%` }
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

export function VotePanel({ view }: { view: ScreenView }) {
  const { vote } = view;
  if (!vote)
    return (
      <div className="vote-panel">
        <h2 className="vote-title">Pas de vote cette ère</h2>
      </div>
    );
  const ratio = view.connectedCount ? Math.min(1, vote.ballots / view.connectedCount) : 0;
  return (
    <div className="vote-panel">
      <div className="vote-kicker">
        <Vote className="icon" /> Vote collectif
      </div>
      <h2 className="vote-title">{vote.title}</h2>
      <p className="vote-text">{vote.text}</p>
      <ul className="vote-options">
        {vote.options.map((o) => (
          <li key={o.id}>{o.label}</li>
        ))}
      </ul>
      <div className="gauge-row">
        <span className="gauge-label">
          <strong>{vote.ballots}</strong> vote{vote.ballots > 1 ? 's' : ''} / {view.connectedCount}
        </span>
        <div className="gauge">
          <div className="gauge-fill" style={{ transform: `scaleX(${ratio})` }} />
        </div>
      </div>
    </div>
  );
}
