/** "120 millions", "1,2 milliard": a rounded number of people, for display. */
export function formatPeople(n: number): string {
  if (n >= 1e9) {
    const b = (n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
    return `${b} milliard${n >= 2e9 ? 's' : ''}`;
  }
  if (n >= 1e6) return `${Math.round(n / 1e6).toLocaleString('fr-FR')} millions`;
  return Math.round(n).toLocaleString('fr-FR');
}
