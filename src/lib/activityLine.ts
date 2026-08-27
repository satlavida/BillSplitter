import type { LiveActivityEntry } from '../schemas/live.schema';

// Shared "X claimed 2 parts of Y" formatting — used by ActivityLogPage's
// full history list and by LiveSessionPanel.tsx's toast triggers.
export const formatActivityLine = (entry: LiveActivityEntry): string => {
  const parts = Math.abs(entry.deltaValue);
  const partWord = `${parts} part${parts === 1 ? '' : 's'}`;
  return `${entry.personName} ${entry.action === 'claim' ? 'claimed' : 'unclaimed'} ${partWord} of ${entry.itemName}`;
};
