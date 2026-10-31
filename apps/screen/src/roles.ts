import {
  Factory,
  House,
  Landmark,
  Megaphone,
  Newspaper,
  Tractor,
  type LucideIcon,
} from 'lucide-react';
import type { Region, Role } from '@jdlt/shared';

// Display names mirror content/roles.yaml (not part of ScreenView).
export const ROLE_LABEL: Record<Role, string> = {
  elite: 'Élite industrielle',
  citoyen: 'Citoyen·ne',
  politique: 'Politique',
  militant: 'Militant·e',
  agriculteur: 'Agriculteur·rice',
  journaliste: 'Journaliste',
};

// Type-only import of the shared package: avoids bundling zod into the screen.
export const ROLES = Object.keys(ROLE_LABEL) as Role[];

export const ROLE_ICON: Record<Role, LucideIcon> = {
  elite: Factory,
  citoyen: House,
  politique: Landmark,
  militant: Megaphone,
  agriculteur: Tractor,
  journaliste: Newspaper,
};

// Mirrors REGION_NAMES in packages/shared (not imported: it would bundle zod).
export const REGION_LABEL: Record<Region, string> = {
  riche: 'Pays riches',
  emergent: 'Pays émergents',
  developpement: 'Pays en développement',
};
export const REGIONS = Object.keys(REGION_LABEL) as Region[];
