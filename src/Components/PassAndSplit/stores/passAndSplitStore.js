import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import useBillStore, { SPLIT_TYPES } from 'src/billStore';

// Define flow stages for type safety
export const STAGES = {
  PERSON_SELECTION: 'personSelection',
  ITEM_SWIPING: 'itemSwiping', 
  COMPLETION: 'completion'
};

// Define the Pass and Split store
const usePassAndSplitStore = create(
  devtools(
    (set, get) => ({
      // State
      isActive: false,                // Whether Pass and Split mode is active
      currentPersonId: null,          // Currently selecting person
      completedPersonIds: [],         // People who have completed
      remainingPersonIds: [],         // People who haven't gone yet
      stage: STAGES.PERSON_SELECTION, // Current UI stage
      itemQueue: [],                  // Items yet to be shown
      pendingAssignments: {},         // Temporary item assignments
      
      // Actions
      
      // Activate Pass and Split mode
      activate: () => {
        const billPeople = useBillStore.getState().people;
        const billItems = useBillStore.getState().items;
        
        set({
          isActive: true,
          stage: STAGES.PERSON_SELECTION,
          completedPersonIds: [],
          remainingPersonIds: billPeople.map(p => p.id),
          itemQueue: [],
          pendingAssignments: {},
          currentPersonId: null
        });
      },
      
      // Deactivate and reset
      deactivate: () => set({
        isActive: false,
        currentPersonId: null,
        completedPersonIds: [],
        remainingPersonIds: [],
        stage: STAGES.PERSON_SELECTION,
        itemQueue: [],
        pendingAssignments: {}
      }),
      
      // Set current person and prepare their item queue
      selectPerson: (personId) => {
        const billItems = useBillStore.getState().items;
        
        // Create queue of items not yet shown to this person
        const filteredItems = billItems.filter(item => {
          // Skip items already assigned to this person in the main store
          const alreadyAssigned = item.consumedBy.some(
            allocation => allocation.personId === personId
          );
          return !alreadyAssigned;
        });
        
        set(state => ({
          currentPersonId: personId,
          stage: STAGES.ITEM_SWIPING,
          itemQueue: filteredItems.map(item => item.id),
          pendingAssignments: {
            ...state.pendingAssignments,
            [personId]: state.pendingAssignments[personId] || []
          }
        }));
      },
      
      // Mark current item as consumed (swiped right)
      assignCurrentItem: () => {
        const { currentPersonId, itemQueue, pendingAssignments } = get();
        
        if (!currentPersonId || itemQueue.length === 0) return;
        
        const currentItemId = itemQueue[0];
        const newQueue = [...itemQueue.slice(1)];
        
        set(state => ({
          itemQueue: newQueue,
          pendingAssignments: {
            ...state.pendingAssignments,
            [currentPersonId]: [
              ...state.pendingAssignments[currentPersonId],
              currentItemId
            ]
          },
          // If no more items, move to completion stage
          ...(newQueue.length === 0 ? { stage: STAGES.COMPLETION } : {})
        }));
      },
      
      // Skip current item (swiped left)
      skipCurrentItem: () => {
        const { itemQueue } = get();
        
        if (itemQueue.length === 0) return;
        
        const newQueue = [...itemQueue.slice(1)];
        
        set({
          itemQueue: newQueue,
          // If no more items, move to completion stage
          ...(newQueue.length === 0 ? { stage: STAGES.COMPLETION } : {})
        });
      },
      
      // Mark person as completed and move to next
      completeCurrentPerson: () => {
        const { currentPersonId, completedPersonIds, remainingPersonIds } = get();
        
        // Add to completed, remove from remaining
        const newCompleted = [...completedPersonIds, currentPersonId];
        const newRemaining = remainingPersonIds.filter(id => id !== currentPersonId);
        
        set({
          completedPersonIds: newCompleted,
          remainingPersonIds: newRemaining,
          currentPersonId: null,
          stage: STAGES.PERSON_SELECTION,
          itemQueue: []
        });
      },
      
      // Reset current person's selections
      resetCurrentPerson: () => {
        const { currentPersonId } = get();
        
        set(state => ({
          pendingAssignments: {
            ...state.pendingAssignments,
            [currentPersonId]: []
          },
          stage: STAGES.PERSON_SELECTION,
          itemQueue: []
        }));
      },
      
      // Commit all pending assignments to main bill store
      commitAssignments: () => {
        const { pendingAssignments } = get();
        const billStore = useBillStore.getState();
        
        // Process each person's assignments
        Object.entries(pendingAssignments).forEach(([personId, itemIds]) => {
          // For each assigned item
          itemIds.forEach(itemId => {
            // Get current item details
            const item = billStore.items.find(i => i.id === itemId);
            
            if (!item) return;
            
            // Create new consumedBy array with this person added
            const existingConsumers = item.consumedBy || [];
            const personExists = existingConsumers.some(
              allocation => allocation.personId === personId
            );
            
            // Only add if not already present
            if (!personExists) {
              // Handle based on current split type
              switch (item.splitType) {
                case SPLIT_TYPES.EQUAL:
                  // For equal split, just add with value 1
                  const equalConsumers = [
                    ...existingConsumers,
                    { personId, value: 1 }
                  ];
                  billStore.updateItem(itemId, { consumedBy: equalConsumers });
                  break;
                  
                case SPLIT_TYPES.PERCENTAGE:
                case SPLIT_TYPES.FRACTION:
                  // For other split types, recalculate allocations
                  // (This is simplified - you'd need more complex logic
                  // to redistribute percentages/fractions)
                  const newConsumers = [
                    ...existingConsumers,
                    { personId, value: 1 }
                  ];
                  // Reset to equal split for simplicity
                  billStore.assignItemEqual(
                    itemId, 
                    newConsumers.map(c => c.personId)
                  );
                  break;
                  
                default:
                  // Fallback to equal split
                  billStore.assignItemEqual(
                    itemId, 
                    [...existingConsumers.map(c => c.personId), personId]
                  );
              }
            }
          });
        });
        
        // After committing, deactivate Pass and Split mode
        get().deactivate();
      },
      
      // Add a new person to the bill and select them
      addNewPerson: (name) => {
        // Use existing addPerson from billStore
        const billStore = useBillStore.getState();
        billStore.addPerson(name);
        
        // Get the new person's ID (assuming it's the last added)
        const newPersonId = billStore.people[billStore.people.length - 1].id;
        
        // Update our remaining people list
        set(state => ({
          remainingPersonIds: [...state.remainingPersonIds, newPersonId]
        }));
        
        // Select this new person
        get().selectPerson(newPersonId);
      }
    }),
    { name: 'pass-and-split-store' }
  )
);

export default usePassAndSplitStore;