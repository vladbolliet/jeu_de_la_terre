import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@jdlt/shared';

// Same origin in dev (Vite proxy) and in prod (served by the game server).
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
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
