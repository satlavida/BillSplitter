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
      pendingAssignments: {},         // Temporary item assignments: { personId: { itemId: boolean } }
      
      // Actions
      
      // Activate Pass and Split mode
      activate: () => {
        const billPeople = useBillStore.getState().people;
        
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
        
        set(state => ({
          currentPersonId: personId,
          stage: STAGES.ITEM_SWIPING,
          itemQueue: billItems.map(item => item.id),
          pendingAssignments: {
            ...state.pendingAssignments,
            [personId]: state.pendingAssignments[personId] || []
          }
        }));
      },
      
      // Mark current item as consumed (swiped right)
      assignCurrentItem: () => {
        const { currentPersonId, itemQueue } = get();
        
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
        
        if (!currentPersonId) return;
        
        // Add to completed, remove from remaining
        const newCompleted = [...completedPersonIds, currentPersonId];
        const newRemaining = remainingPersonIds.filter(id => id !== currentPersonId);
        
        // Commit assignments to main store for this person
        get().commitAssignmentsForPerson(currentPersonId);

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
        
        if (!currentPersonId) return;
        
        set(state => ({
          pendingAssignments: {
            ...state.pendingAssignments,
            [currentPersonId]: []
          },
          stage: STAGES.PERSON_SELECTION,
          itemQueue: []
        }));
      },
      
      // Commit assignments for a specific person
      commitAssignmentsForPerson: (personId) => {
        const { pendingAssignments } = get();
        const personAssignedItems = pendingAssignments[personId] || [];
        const billStore = useBillStore.getState();
        const billItems = billStore.items;
        
        // Process all items to ensure we handle both assigned and unassigned items
        billItems.forEach(item => {
          // Check if this item is in the pending assignments
          const isAssignedInPending = personAssignedItems.includes(item.id);
          
          // Get all existing consumers except this person
          const existingConsumers = item.consumedBy.filter(consumer => {
            return typeof consumer === 'string'
              ? consumer !== personId
              : consumer.personId !== personId;
          });
          
          // Get clean list of person IDs
          let personIds = existingConsumers.map(consumer => 
            typeof consumer === 'string' ? consumer : consumer.personId
          );
          
          // If this item is assigned to this person in pending assignments, add them
          if (isAssignedInPending) {
            personIds.push(personId);
          }
          
          // Always reset to equal split for any modified items
          // This happens if:
          // 1. The item was assigned in pending (isAssignedInPending is true)
          // 2. The item was previously assigned but no longer is (personIds.length !== item.consumedBy.length)
          const wasPersonPreviouslyAssigned = item.consumedBy.some(consumer => 
            typeof consumer === 'string'
              ? consumer === personId
              : consumer.personId === personId
          );
          
          if (isAssignedInPending || wasPersonPreviouslyAssigned) {
            billStore.assignItemEqual(item.id, personIds);
          }
        });
      },
      
      // Commit all pending assignments to main bill store
      commitAssignments: () => {
        const { pendingAssignments } = get();
        
        // Commit assignments for each person
        Object.keys(pendingAssignments).forEach(personId => {
          get().commitAssignmentsForPerson(personId);
        });
        
        // After committing, deactivate Pass and Split mode
        get().deactivate();
      },
      
      // Add a new person to the bill and select them
      addNewPerson: (name) => {
        // Use existing addPerson from billStore
        const billStore = useBillStore.getState();
        const newPerson = billStore.addPerson(name);
        
        if (!newPerson || !newPerson.id) {
          // If addPerson doesn't return the new person, get the last added one
          const allPeople = billStore.people;
          const newPersonId = allPeople[allPeople.length - 1].id;
          
          // Update our remaining people list
          set(state => ({
            remainingPersonIds: [...state.remainingPersonIds, newPersonId]
          }));
          
          // Select this new person
          get().selectPerson(newPersonId);
        } else {
          // If addPerson returns the new person, use its ID
          set(state => ({
            remainingPersonIds: [...state.remainingPersonIds, newPerson.id]
          }));
          
          // Select this new person
          get().selectPerson(newPerson.id);
        }
      }
    }),
    { name: 'pass-and-split-store' }
  )
);

export default usePassAndSplitStore;