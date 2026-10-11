import type { Role } from '@jdlt/shared';

/** Visual identity of each role (colour + icon). Names and objectives come from the server. */
export const ROLE_STYLE: Record<Role, { color: string; icon: string }> = {
  elite: { color: '#fbbf24', icon: '🏭' },
  citoyen: { color: '#38bdf8', icon: '🏠' },
  politique: { color: '#c4b5fd', icon: '🏛️' },
  militant: { color: '#4ade80', icon: '📢' },
};
