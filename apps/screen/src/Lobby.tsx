import { QRCodeSVG } from 'qrcode.react';
import type { Role, ScreenView } from '@jdlt/shared';
import { ROLE_LABEL } from './roles.ts';

export function Lobby({ view }: { view: ScreenView }) {
  const joinUrl = view.joinUrl ?? location.origin;
  const roles = Object.entries(view.roleCounts) as [Role, number][];

  return (
    <div className="lobby">
      <h1 className="lobby-title">Jeu de la Terre</h1>
      <div className="lobby-body">
        <div className="lobby-qr">
          <QRCodeSVG value={joinUrl} size={512} marginSize={2} level="M" />
        </div>
        <div className="lobby-info">
          <p className="lobby-label">Scannez ou ouvrez :</p>
          <p className="lobby-url">{joinUrl.replace(/^https?:\/\//, '')}</p>
          <p className="lobby-count">
            <strong>{view.connectedCount}</strong> joueur{view.connectedCount > 1 ? 's' : ''} connecté
            {view.connectedCount > 1 ? 's' : ''}
          </p>
          <ul className="lobby-roles">
            {roles.map(([role, count]) => (
              <li key={role}>
                <span>{ROLE_LABEL[role]}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
