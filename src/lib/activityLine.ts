import type { LiveActivityEntry } from '../schemas/live.schema';

// Shared "X claimed 2 parts of Y" formatting — used by ActivityLogPage's
// full history list and by LiveSessionPanel.tsx's toast triggers.
export const formatActivityLine = (entry: LiveActivityEntry): string => {
  if (entry.action === 'edit_item') {
    return `${entry.personName} edited ${entry.itemName} (${entry.details})`;
  }
  if (entry.action === 'delete_item') {
    return `${entry.personName} removed ${entry.itemName}`;
  }
  // itemId/itemName double as billId/bill title for these three — see
  // bill_handlers.go's DeleteBill/RestoreBill/PermanentlyDeleteBill.
  // personName is empty for restore/permanent-delete (creator-only,
  // unattributed) — falls back to "The host".
  if (entry.action === 'delete_bill') {
    return `${entry.personName || 'Someone'} deleted the bill "${entry.itemName}"`;
  }
  if (entry.action === 'restore_bill') {
    return `The host restored the bill "${entry.itemName}"`;
  }
  if (entry.action === 'permanent_delete_bill') {
    return `The host permanently removed the bill "${entry.itemName}"`;
  }
  const parts = Math.abs(entry.deltaValue);
  const partWord = `${parts} part${parts === 1 ? '' : 's'}`;
  return `${entry.personName} ${entry.action === 'claim' ? 'claimed' : 'unclaimed'} ${partWord} of ${entry.itemName}`;
};
