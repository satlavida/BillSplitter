Change Log for Bill Splitter Enhancement: Unequal Split Implementation
1. Data Structure Changes

Modified the consumedBy data structure from an array of personIds to an array of allocation objects
New allocation object structure: { personId: string, value: number }
Added a splitType property to each item object with possible values: 'equal', 'percentage', 'fraction'

2. Store API Changes

Added constant SPLIT_TYPES with values: EQUAL, PERCENTAGE, FRACTION
Renamed the original assignItem function to assignItemEqual
Added new functions:

assignItemPercentage(itemId, allocations): Assigns percentage-based splits
assignItemFraction(itemId, allocations): Assigns fractional splits
setSplitType(itemId, splitType): Changes the split type for an item
validateAllocations(allocations, splitType): Validates allocation correctness
normalizeAllocations(allocations, splitType): Normalizes values (e.g., ensures percentages sum to 100%)
getItemSplitDetails(itemId): Returns details about an item's split



3. Calculation Logic Changes

Updated getPersonTotals() to handle different split types:

For equal splits: The price is divided equally
For percentage splits: Each person pays their percentage of the total price
For fractional splits: Each person pays according to their proportion of the total fractional value


Enhanced the person total item details to include splitType and allocation properties

4. Added Zustand Selectors

Implemented modern selector pattern for all store properties:

useBillStep(): Current step in the bill splitting process
useBillCurrency(): Current currency setting
useBillTitle(): Bill title
useBillTaxAmount(): Tax amount
useBillSubtotal(): Bill subtotal before tax
useBillGrandTotal(): Bill total with tax included
useUnassignedItems(): Items not yet assigned to any person
useItemSplitDetails(itemId): Details of how an item is split



5. UI Component Changes Needed

Item Assignment Component:

Add a split type selector (dropdown/radio buttons)
Create different input interfaces based on selected split type
For equal splits: Show checkboxes for each person (existing behavior)
For percentage splits: Show percentage input fields for selected people
For fractional splits: Show fraction/ratio input fields for selected people
Add validation to ensure percentages sum to 100%


Item List Component:

Update to display split type for each item
Show detailed breakdown of allocations (who pays what percentage/fraction)
Add UI to edit split type and allocations


Summary/Results Component:

Update to show detailed breakdown by split type
Display allocation values in addition to monetary amounts
Enhance item details to show split information



6. Migration Considerations

Handle backward compatibility for existing bills in localStorage
Convert old format (array of personIds) to new format (array of allocation objects) on load
Set default splitType as 'equal' for existing items

7. API Usage Examples
javascript// Equal splitting
billStore.assignItemEqual(itemId, [person1Id, person2Id]);

// Percentage splitting (70/30)
billStore.assignItemPercentage(itemId, [
  { personId: person1Id, value: 70 },
  { personId: person2Id, value: 30 }
]);

// Fractional splitting (2:1 ratio)
billStore.assignItemFraction(itemId, [
  { personId: person1Id, value: 2 },
  { personId: person2Id, value: 1 }
]);

// Change split type
billStore.setSplitType(itemId, SPLIT_TYPES.PERCENTAGE);

// Get split details
const splitDetails = billStore.getItemSplitDetails(itemId);
// Returns: { splitType: 'percentage', allocations: [{personId: '123', value: 70}, ...] }
This change log provides all the necessary information about the implementation of unequal bill splitting features, including data structure changes, API modifications, calculation logic updates, and UI component requirements.