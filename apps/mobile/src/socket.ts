import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@jdlt/shared';

// Same origin in dev (Vite proxy) and in prod (served by the game server).
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  // Retry quickly after a network drop: an era only lasts ~2 min.
  reconnectionDelayMax: 2000,
});

const TOKEN_KEY = 'jdlt:token';
const NAME_KEY = 'jdlt:name';
const ROLE_SEEN_KEY = 'jdlt:roleSeen';

export const storage = {
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  },
  set token(v: string | undefined) {
    try {
      if (v) localStorage.setItem(TOKEN_KEY, v);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode */
    }
  },
  get name() {
    try {
      return localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      return '';
    }
  },
  set name(v: string) {
    try {
      localStorage.setItem(NAME_KEY, v);
    } catch {
      /* private mode */
    }
  },
  /** Id of the player who already dismissed the role reveal screen. */
  get roleSeen() {
    try {
      return localStorage.getItem(ROLE_SEEN_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  },
  set roleSeen(v: string | undefined) {
    try {
      if (v) localStorage.setItem(ROLE_SEEN_KEY, v);
      else localStorage.removeItem(ROLE_SEEN_KEY);
    } catch {
      /* private mode */
    }
  },
};

/** Joins (or re-joins after a phone sleep / network drop) using the saved token. */
export function join(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.emit('player:join', { name, token: storage.token }, (res) => {
      if (!res.ok) return reject(new Error(res.error));
      storage.token = res.data.token;
      storage.name = name;
      resolve();
    });
  });
}

// Error sent by the server when this socket is not bound to a player (e.g. it restarted).
const NOT_JOINED = 'Pas encore inscrit';

/** Sends a request; if the server no longer knows this socket, re-joins with the token and retries once. */
function withRejoin<T>(send: (ack: Ack<T>) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (canRetry: boolean) =>
      send((res) => {
        if (res.ok) return resolve(res.data);
        if (canRetry && res.error === NOT_JOINED && storage.token)
          return join(storage.name).then(() => attempt(false), reject);
        reject(new Error(res.error));
      });
    attempt(true);
  });
}

export function choose(instanceId: string, optionId: string) {
  return withRejoin<{ outcome: string | null }>((ack) =>
    socket.emit('player:choose', { instanceId, optionId }, ack),
  );
}

export function vote(voteId: string, optionId: string) {
  return withRejoin<null>((ack) => socket.emit('player:vote', { voteId, optionId }, ack));
}
