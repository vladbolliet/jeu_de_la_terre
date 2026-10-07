import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, HostAction, ServerToClientEvents } from '@jdlt/shared';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
});

/** Host key from the URL: /screen/?key=XXXX shows the host controls. */
export const hostKey = new URLSearchParams(location.search).get('key');

export function hostCommand(action: HostAction) {
  if (!hostKey) return;
  socket.emit('host:command', { key: hostKey, action }, (res) => {
    if (!res.ok) alert(res.error);
  });
}
