import type { Role } from '@jdlt/shared';

// Display names mirror content/roles.yaml (not part of ScreenView).
export const ROLE_LABEL: Record<Role, string> = {
  elite: 'Élite industrielle',
  citoyen: 'Citoyen·ne',
  politique: 'Politique',
  militant: 'Militant·e',
};

// Type-only import of the shared package: avoids bundling zod into the screen.
export const ROLES = Object.keys(ROLE_LABEL) as Role[];
