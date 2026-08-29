import { memo } from 'react';
import { generateSplitSummaryText } from '../lib/splitSummary';
import type { Item, Person } from '../schemas/bill.schema';

interface ItemSplitCardProps {
  item: Item;
  people: Person[];
  formatCurrency: (amount: number | null | undefined) => string;
}

// A compact per-item card for the Split Breakdown drawer (BillSummary.tsx)
// — name/price header plus a one-line who-claimed-what summary, replacing
// the old plain-text <li> row. Read-only; editing an item's split stays in
// the wizard steps. Shares its rounded-border/header-row chrome (not a
// literal shared component, since their responsibilities differ) with
// JoinerItemRow.tsx's claim row for a consistent "mini card" look across
// the creator and joiner views.
const ItemSplitCard = memo(({ item, people, formatCurrency }: ItemSplitCardProps) => {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50 dark:bg-zinc-900/40 transition-colors">
      <div className="flex justify-between items-baseline gap-2">
        <span className="font-medium text-zinc-800 dark:text-white">{item.name}</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400 shrink-0">{formatCurrency(item.price)}</span>
      </div>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{generateSplitSummaryText(item, people)}</p>
    </div>
  );
});

export default ItemSplitCard;
