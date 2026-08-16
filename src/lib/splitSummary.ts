import type { Item, Person } from '../schemas/bill.schema';

function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// Req 11: a compact, human-readable description of how an item's shares are
// split across people — e.g. "3 by Lisa and 2 by John" for a fraction-split
// item, "60% by Lisa and 40% by John" for percentage, or "Split equally
// between Lisa and John" for the common equal-split case — instead of the
// bare "Split by 2" count previously shown per person.
export function generateSplitSummaryText(item: Pick<Item, 'consumedBy' | 'splitType'>, people: Person[]): string {
  const nameFor = (id: string) => people.find((p) => p.id === id)?.name ?? 'Someone';

  if (item.consumedBy.length === 0) return 'Not yet split';
  if (item.consumedBy.length === 1) return `All to ${nameFor(item.consumedBy[0].personId)}`;

  if (item.splitType === 'fraction') {
    return joinWithAnd(item.consumedBy.map((c) => `${c.value} by ${nameFor(c.personId)}`));
  }
  if (item.splitType === 'percentage') {
    return joinWithAnd(item.consumedBy.map((c) => `${c.value}% by ${nameFor(c.personId)}`));
  }
  return `Split equally between ${joinWithAnd(item.consumedBy.map((c) => nameFor(c.personId)))}`;
}
