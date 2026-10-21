import { Factory, House, Landmark, Megaphone, type LucideIcon } from 'lucide-react';
import type { Role } from '@jdlt/shared';

/** Visual identity of each role (colour + icon, same icons as the screen). Names and objectives come from the server. */
export const ROLE_STYLE: Record<Role, { color: string; icon: LucideIcon }> = {
  elite: { color: '#f2a93b', icon: Factory },
  citoyen: { color: '#3cc3d3', icon: House },
  politique: { color: '#b9a6f5', icon: Landmark },
  militant: { color: '#5fd08a', icon: Megaphone },
};
