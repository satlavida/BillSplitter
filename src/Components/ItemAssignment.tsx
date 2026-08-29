import { useMemo, memo, useCallback, useState } from 'react';
import useBillStore, { useBillPersons, useBillItems, SPLIT_TYPES, getDiscountedItemPrice, type Allocation, type SplitType } from '../billStore';
import useSessionStore from '../sessionStore';
import useSettingsStore from '../settingsStore';
import { formatAmountInCurrency } from '../lib/currencyDisplay';
import { useShallow } from 'zustand/shallow';
import { Card, Button, ToggleButton, SelectAllButton } from '../ui/components';
import SplitTypeDrawer from './SplitTypeDrawer';
import PassAndSplitButton from './PassAndSplit/PassAndSplitButton';
import type { Item, Person } from '../schemas/bill.schema';

interface ItemCardProps {
  item: Item;
  people: Person[];
  onTogglePerson: (personId: string, itemId: string) => void;
  onSetPersonQuantity: (itemId: string, personId: string, value: number) => void;
  useDetailedQuantitySplit: boolean;
  formatCurrency: (amount: number | null | undefined) => string;
  onOpenSplitDrawer: (item: Item) => void;
  // Only meaningful in a live session: a joiner's fraction stepper writes
  // literal "how many of item.quantity units I'm claiming" counts (see
  // JoinerItemRow.tsx), so consumedBy sums are comparable to quantity there.
  // Offline, fraction `value` is a pure ratio/weight (personTotals.ts
  // normalizes it against the sum of all values, never against quantity) —
  // e.g. weights 1:3 are a perfectly valid split regardless of quantity —
  // so this check is deliberately gated on isLive rather than always shown.
  isLive: boolean;
}

const FRACTION_EPSILON = 1e-6;

// Individual Item Card component
const ItemCard = memo(({ item, people, onTogglePerson, onSetPersonQuantity, useDetailedQuantitySplit, formatCurrency, onOpenSplitDrawer, isLive }: ItemCardProps) => {
  // Compute if all people are assigned to this item
  const allSelected = useMemo(() => {
    // Extract person IDs from consumedBy (handle both string and object formats)
    const personIds = item.consumedBy.map((c) => (typeof c === 'string' ? c : c.personId));
    return people.length > 0 && personIds.length === people.length;
  }, [item.consumedBy, people.length]);

  // Compute list of person names assigned to this item
  const assignedNames = useMemo(() => {
    // Extract person IDs from consumedBy (handle both string and object formats)
    const personIds = item.consumedBy.map((c) => (typeof c === 'string' ? c : c.personId));

    return personIds
      .map((id) => people.find((p) => p.id === id)?.name || '')
      .filter(Boolean)
      .join(', ');
  }, [item.consumedBy, people]);

  // Get the split type display text
  const splitTypeText = useMemo(() => {
    switch (item.splitType) {
      case SPLIT_TYPES.PERCENTAGE:
        return 'Percentage Split';
      case SPLIT_TYPES.FRACTION:
        return 'Quantity Split';
      case SPLIT_TYPES.EQUAL:
      default:
        return 'Equal Split';
    }
  }, [item.splitType]);

  // Determine if this item has a custom split (not equal)
  const hasCustomSplit = useMemo(() => {
    return item.splitType && item.splitType !== SPLIT_TYPES.EQUAL;
  }, [item.splitType]);

  // For custom splits, generate split info text
  const splitInfoText = useMemo(() => {
    if (!hasCustomSplit) return null;

    // For percentage splits, show percentages
    if (item.splitType === SPLIT_TYPES.PERCENTAGE) {
      const allocations = item.consumedBy
        .map((c) => {
          if (typeof c === 'string') return null;
          const person = people.find((p) => p.id === c.personId);
          return person ? `${person.name}: ${c.value}%` : null;
        })
        .filter(Boolean);

      return allocations.join(', ');
    }

    // For fractional (quantity) splits, show the quantity each person was
    // allocated rather than a derived percentage.
    if (item.splitType === SPLIT_TYPES.FRACTION) {
      const allocations = item.consumedBy
        .map((c) => {
          if (typeof c === 'string') return null;
          const person = people.find((p) => p.id === c.personId);
          return person ? `${person.name}: ${c.value}` : null;
        })
        .filter(Boolean);

      return allocations.join(', ');
    }

    return null;
  }, [item.splitType, item.consumedBy, hasCustomSplit, people]);

  const handleSelectAll = useCallback(() => {
    onTogglePerson('all', item.id);
  }, [onTogglePerson, item.id]);

  const handleDeselectAll = useCallback(() => {
    onTogglePerson('none', item.id);
  }, [onTogglePerson, item.id]);

  const fractionCorrectness = useMemo(() => {
    if (!isLive || item.splitType !== SPLIT_TYPES.FRACTION) return null;
    const total = item.consumedBy.reduce((sum, c) => sum + (typeof c === 'string' ? 1 : c.value), 0);
    return Math.abs(total - item.quantity) < FRACTION_EPSILON ? { ok: true, total } : { ok: false, total };
  }, [isLive, item.splitType, item.consumedBy, item.quantity]);

  const itemPrice = useMemo(() => getDiscountedItemPrice(item), [item]);
  const hasDiscount = item.discount > 0;
  const discountText = hasDiscount ? `Discount ${item.discountType === 'percentage' ? `${item.discount}%` : formatCurrency(item.discount)}` : '';

  return (
    <Card className="mb-4">
      <div className="mb-3 flex justify-between">
        <div>
          <h3 className="text-lg font-medium text-zinc-800 dark:text-white transition-colors">{item.name}</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 transition-colors">
            {item.quantity > 1 ? `${item.quantity} × ` : ''}
            {formatCurrency(itemPrice)}
            {hasDiscount && <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400 transition-colors">({discountText})</span>}
          </p>
        </div>
        <button
          onClick={() => onOpenSplitDrawer(item)}
          className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          title="Change how this item is split"
          aria-label="Split Type"
        >
          Split Type
        </button>
      </div>

      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors">
          {item.splitType === SPLIT_TYPES.FRACTION ? 'How many did each person have:' : 'Select who consumed this:'}
        </p>

        {item.splitType !== SPLIT_TYPES.FRACTION && (
          <SelectAllButton allSelected={allSelected} onSelectAll={handleSelectAll} onDeselectAll={handleDeselectAll} />
        )}
      </div>

      {item.splitType === SPLIT_TYPES.FRACTION ? (
        // Quantity Split's split-input moved out of the Split Type drawer
        // and onto the Assign card directly, so most quantity edits never
        // need to open the drawer at all — honors the same
        // useDetailedQuantitySplit setting the drawer uses to pick between
        // FractionalSplitInput's independent +/- stepper ("Detailed view")
        // and DependentQuantitySplitInput's dependent number-grid ("Basic
        // view", each person's range shrinks live to `quantity -
        // sum(everyone else's current value)`). Either way, tapping/
        // stepping to 0 removes the person from consumedBy (deselects
        // them); any value > 0 upserts their allocation (selects them) —
        // there's no separate select step, unlike the toggle-row split
        // types.
        <div className="flex flex-col gap-3 mb-2">
          {people.map((person) => {
            const entry = item.consumedBy.find((c) => (typeof c === 'string' ? c === person.id : c.personId === person.id));
            const value = entry ? (typeof entry === 'string' ? 1 : entry.value) : 0;
            const othersTotal = item.consumedBy.reduce((sum, c) => {
              const cid = typeof c === 'string' ? c : c.personId;
              if (cid === person.id) return sum;
              return sum + (typeof c === 'string' ? 1 : c.value);
            }, 0);
            const quantityFloor = Math.max(1, Math.floor(item.quantity));
            const available = Math.max(0, quantityFloor - othersTotal);

            if (useDetailedQuantitySplit) {
              return (
                <div key={person.id} className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm truncate transition-colors ${
                      value > 0 ? 'font-medium text-zinc-800 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {person.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      aria-label={`Decrease ${person.name}'s quantity`}
                      disabled={value <= 0}
                      onClick={() => onSetPersonQuantity(item.id, person.id, value - 1)}
                      className="h-8 w-8 rounded-md border border-zinc-300 dark:border-zinc-600 text-base font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold text-zinc-800 dark:text-white transition-colors">{value}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${person.name}'s quantity`}
                      onClick={() => onSetPersonQuantity(item.id, person.id, value + 1)}
                      className="h-8 w-8 rounded-md border border-zinc-300 dark:border-zinc-600 text-base font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            }

            const numbers = Array.from({ length: available + 1 }, (_, i) => i);

            return (
              <div key={person.id}>
                <p
                  className={`text-sm mb-1 transition-colors ${
                    value > 0 ? 'font-medium text-zinc-800 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {person.name}
                </p>
                <div className="grid grid-cols-6 gap-1.5">
                  {numbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onSetPersonQuantity(item.id, person.id, n)}
                      aria-label={`${person.name}: ${n}`}
                      className={`h-9 rounded-md text-sm font-medium border transition-colors ${
                        n === value
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-600'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-2">
          {people.map((person) => {
            // Check if person is in consumedBy (handling both formats)
            const isSelected = item.consumedBy.some((c) => (typeof c === 'string' && c === person.id) || c.personId === person.id);

            return (
              <ToggleButton key={person.id} selected={isSelected} onClick={() => onTogglePerson(person.id, item.id)}>
                {person.name}
              </ToggleButton>
            );
          })}
        </div>
      )}

      {/* Rendered outside the consumedBy.length > 0 gate below — a fraction
          item with zero claims so far is exactly the "under-claimed"
          warning case this badge exists to surface, so it can't be hidden
          behind "has at least one claim yet". */}
      {fractionCorrectness && (
        <p
          className={`text-xs mt-2 ${fractionCorrectness.ok ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}
        >
          {fractionCorrectness.ok
            ? '✓ Split complete'
            : `⚠ Claimed parts total ${fractionCorrectness.total}, item has ${item.quantity} — tap the split icon to adjust`}
        </p>
      )}

      {item.consumedBy.length > 0 && (
        <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-700 transition-colors">
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 transition-colors">
              <span className="font-medium">Split between:</span> {assignedNames}
            </p>
            <span className="text-xs py-1 px-2 bg-zinc-100 dark:bg-zinc-700 rounded-full text-zinc-600 dark:text-zinc-400 transition-colors">
              {splitTypeText}
            </span>
          </div>

          {hasCustomSplit ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 transition-colors">{splitInfoText}</p>
          ) : (
            item.consumedBy.length > 1 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 transition-colors">
                Each person pays: {formatCurrency((itemPrice * item.quantity) / item.consumedBy.length)}
              </p>
            )
          )}
        </div>
      )}
    </Card>
  );
});

// Main ItemAssignment component
const ItemAssignment = () => {
  // Use Zustand store with specialized hooks and useShallow
  const people = useBillPersons();
  const items = useBillItems();
  const isLive = useSessionStore((s) => s.getCurrentSession()?.isLive ?? false);
  const useDetailedQuantitySplit = useSettingsStore((s) => s.useDetailedQuantitySplit);
  const [splitDrawerItem, setSplitDrawerItem] = useState<Item | null>(null);

  const { assignItemEqual, assignItemPercentage, assignItemFraction, assignAllPeopleEqual, removeAllPeople, nextStep, prevStep, getUnassignedItems, currency } =
    useBillStore(
      useShallow((state) => ({
        assignItemEqual: state.assignItemEqual,
        assignItemPercentage: state.assignItemPercentage,
        assignItemFraction: state.assignItemFraction,
        assignAllPeopleEqual: state.assignAllPeopleEqual,
        removeAllPeople: state.removeAllPeople,
        nextStep: state.nextStep,
        prevStep: state.prevStep,
        getUnassignedItems: state.getUnassignedItems,
        currency: state.currency,
      }))
    );

  // This bill's own currency, not the user's global preference — see
  // architecture/currency.md.
  const formatCurrency = (amount: number | null | undefined) => formatAmountInCurrency(amount, currency);

  const handleTogglePerson = useCallback(
    (personId: string, itemId: string) => {
      if (personId === 'all') {
        assignAllPeopleEqual(itemId);
        return;
      }

      if (personId === 'none') {
        removeAllPeople(itemId);
        return;
      }

      const item = items.find((item) => item.id === itemId);
      if (!item) return;

      // Extract person IDs from consumedBy
      const personIds = item.consumedBy.map((c) => (typeof c === 'string' ? c : c.personId));

      // Check if this person is already assigned to the item
      const isAssigned = personIds.includes(personId);

      // Handle based on split type
      if (!item.splitType || item.splitType === SPLIT_TYPES.EQUAL) {
        // For equal splits
        let newPersonIds: string[];

        if (isAssigned) {
          // Remove person from the list
          newPersonIds = personIds.filter((id) => id !== personId);
        } else {
          // Add person to the list
          newPersonIds = [...personIds, personId];
        }

        assignItemEqual(itemId, newPersonIds);
      } else if (item.splitType === SPLIT_TYPES.PERCENTAGE) {
        // For percentage splits
        let newAllocations: Allocation[];

        if (isAssigned) {
          // Remove person from allocations
          newAllocations = item.consumedBy.filter((c) => (typeof c === 'string' && c !== personId) || c.personId !== personId);
        } else {
          // Add person with a percentage value
          // Create new allocations from existing ones
          const existingAllocations = item.consumedBy.map((c) =>
            typeof c === 'string' ? { personId: c, value: 100 / (personIds.length + 1) } : c
          );

          // Add new person's allocation
          newAllocations = [...existingAllocations, { personId, value: 100 / (personIds.length + 1) }];
        }

        assignItemPercentage(itemId, newAllocations);
      } else if (item.splitType === SPLIT_TYPES.FRACTION) {
        // For fractional splits
        let newAllocations: Allocation[];

        if (isAssigned) {
          // Remove person from allocations
          newAllocations = item.consumedBy.filter((c) => (typeof c === 'string' && c !== personId) || c.personId !== personId);
        } else {
          // Add person with default value of 1
          // Create new allocations from existing ones
          const existingAllocations = item.consumedBy.map((c) => (typeof c === 'string' ? { personId: c, value: 1 } : c));

          // Add new person's allocation
          newAllocations = [...existingAllocations, { personId, value: 1 }];
        }

        assignItemFraction(itemId, newAllocations);
      }
    },
    [items, assignItemEqual, assignItemPercentage, assignItemFraction, assignAllPeopleEqual, removeAllPeople]
  );

  const handleSetPersonQuantity = useCallback(
    (itemId: string, personId: string, newValue: number) => {
      const item = items.find((item) => item.id === itemId);
      if (!item) return;

      const clamped = Math.max(0, newValue);

      if (clamped === 0) {
        // 0 deselects: drop the allocation entirely rather than keeping a
        // zero-value entry, matching handleTogglePerson's fraction "off" path.
        const newAllocations = item.consumedBy.filter((c) => (typeof c === 'string' ? c !== personId : c.personId !== personId));
        assignItemFraction(itemId, newAllocations);
        return;
      }

      const normalized = item.consumedBy.map((c) => (typeof c === 'string' ? { personId: c, value: 1 } : c));
      const exists = normalized.some((c) => c.personId === personId);
      const newAllocations: Allocation[] = exists
        ? normalized.map((c) => (c.personId === personId ? { personId, value: clamped } : c))
        : [...normalized, { personId, value: clamped }];

      assignItemFraction(itemId, newAllocations);
    },
    [items, assignItemFraction]
  );

  const handleOpenSplitDrawer = useCallback((item: Item) => {
    setSplitDrawerItem(item);
  }, []);

  const handleCloseSplitDrawer = useCallback(() => {
    setSplitDrawerItem(null);
  }, []);

  const handleSaveSplit = useCallback(
    (itemId: string, splitType: SplitType, allocations: Person[] | Allocation[]) => {
      // Each assignItem* action below already sets both splitType and
      // consumedBy atomically (billStore.ts) — calling the store's
      // setSplitType first was redundant and briefly reset consumedBy to
      // [] between the two set() calls, a state the billStore subscription
      // in BillEditorPage.tsx picks up and commits to sessionStore. In a
      // live session that momentary [] triggered spurious unclaim-then-
      // reclaim pushes via syncConsumedByLive, which could race and drop a
      // person from the item.
      switch (splitType) {
        case SPLIT_TYPES.PERCENTAGE:
          assignItemPercentage(itemId, allocations as Allocation[]);
          break;
        case SPLIT_TYPES.FRACTION:
          assignItemFraction(itemId, allocations as Allocation[]);
          break;
        default: {
          // For equal split, we need to extract just the personIds
          const personIds = (allocations as Person[]).map((a) => a.id);
          assignItemEqual(itemId, personIds);
          break;
        }
      }
    },
    [assignItemPercentage, assignItemFraction, assignItemEqual]
  );

  const handlePrev = useCallback(() => {
    prevStep();
  }, [prevStep]);

  const handleNext = useCallback(() => {
    // Check if all items have at least one person assigned
    const unassignedItems = getUnassignedItems();

    if (unassignedItems.length > 0) {
      const proceed = window.confirm(`${unassignedItems.length} item(s) do not have anyone assigned. Continue anyway?`);
      if (!proceed) return;
    }

    nextStep();
  }, [getUnassignedItems, nextStep]);

  return (
    <div>
      <div className="mb-4">
        <div className={`p-3 rounded-lg dark:text-white transition-colors`}>
          <h3 className="font-medium mb-2">Quick Assignment</h3>
          <p className={`text-sm mb-3 dark:text-white transition-colors`}>Pass your phone around so everyone can select what they had.</p>
          <PassAndSplitButton />
        </div>
      </div>
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Who consumed what?</h2>

      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          people={people}
          onTogglePerson={handleTogglePerson}
          onSetPersonQuantity={handleSetPersonQuantity}
          useDetailedQuantitySplit={useDetailedQuantitySplit}
          formatCurrency={formatCurrency}
          onOpenSplitDrawer={handleOpenSplitDrawer}
          isLive={isLive}
        />
      ))}

      <div className="flex justify-between mt-4">
        <Button variant="secondary" onClick={handlePrev}>
          Back
        </Button>
        <Button onClick={handleNext}>Calculate Split</Button>
      </div>

      {/* Split Type Drawer */}
      <SplitTypeDrawer
        isOpen={splitDrawerItem !== null}
        onClose={handleCloseSplitDrawer}
        item={(splitDrawerItem || {}) as Item}
        people={people}
        onSave={handleSaveSplit}
      />
    </div>
  );
};

export default ItemAssignment;
