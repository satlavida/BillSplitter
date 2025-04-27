import { useCallback, useEffect } from 'react';
import usePassAndSplitStore, { STAGES } from '../store/passAndSplitStore';
import useBillStore from '../../../billStore';

/**
 * Custom hook to manage the Pass and Split flow
 * This provides a simplified interface for components to interact with the flow
 */
const usePassAndSplitFlow = () => {
  // Get selectors and actions from store
  const isActive = usePassAndSplitStore(state => state.isActive);
  const currentStage = usePassAndSplitStore(state => state.stage);
  const currentPersonId = usePassAndSplitStore(state => state.currentPersonId);
  const completedPersonIds = usePassAndSplitStore(state => state.completedPersonIds);
  const remainingPersonIds = usePassAndSplitStore(state => state.remainingPersonIds);
  const itemQueue = usePassAndSplitStore(state => state.itemQueue);
  const pendingAssignments = usePassAndSplitStore(state => state.pendingAssignments);
  
  // Get all actions
  const activate = usePassAndSplitStore(state => state.activate);
  const deactivate = usePassAndSplitStore(state => state.deactivate);
  const selectPerson = usePassAndSplitStore(state => state.selectPerson);
  const assignCurrentItem = usePassAndSplitStore(state => state.assignCurrentItem);
  const skipCurrentItem = usePassAndSplitStore(state => state.skipCurrentItem);
  const completeCurrentPerson = usePassAndSplitStore(state => state.completeCurrentPerson);
  const resetCurrentPerson = usePassAndSplitStore(state => state.resetCurrentPerson);
  const commitAssignments = usePassAndSplitStore(state => state.commitAssignments);
  const addNewPerson = usePassAndSplitStore(state => state.addNewPerson);
  
  // Get bill people and items
  const billPeople = useBillStore(state => state.people);
  const billItems = useBillStore(state => state.items);
  
  // Derived states
  const currentPerson = currentPersonId ? billPeople.find(p => p.id === currentPersonId) : null;
  const currentItem = itemQueue.length > 0 ? billItems.find(i => i.id === itemQueue[0]) : null;
  const isCompleted = completedPersonIds.length === billPeople.length;
  const selectedItems = currentPersonId && pendingAssignments[currentPersonId] 
    ? pendingAssignments[currentPersonId].map(itemId => billItems.find(i => i.id === itemId)).filter(Boolean)
    : [];
  
  // Simplified interface for common flows
  
  // Start the Pass and Split process
  const startPassAndSplit = useCallback(() => {
    activate();
  }, [activate]);
  
  // End the Pass and Split process and apply all changes
  const finishPassAndSplit = useCallback(() => {
    commitAssignments();
  }, [commitAssignments]);
  
  // Cancel without applying changes
  const cancelPassAndSplit = useCallback(() => {
    deactivate();
  }, [deactivate]);
  
  // Swipe right on current item
  const acceptCurrentItem = useCallback(() => {
    if (currentStage === STAGES.ITEM_SWIPING && itemQueue.length > 0) {
      assignCurrentItem();
    }
  }, [currentStage, itemQueue, assignCurrentItem]);
  
  // Swipe left on current item
  const rejectCurrentItem = useCallback(() => {
    if (currentStage === STAGES.ITEM_SWIPING && itemQueue.length > 0) {
      skipCurrentItem();
    }
  }, [currentStage, itemQueue, skipCurrentItem]);
  
  // Move to next person
  const goToNextPerson = useCallback(() => {
    if (currentStage === STAGES.COMPLETION) {
      completeCurrentPerson();
    }
  }, [currentStage, completeCurrentPerson]);
  
  // Restart current person's flow
  const restartPersonFlow = useCallback(() => {
    if (currentStage === STAGES.COMPLETION) {
      resetCurrentPerson();
    }
  }, [currentStage, resetCurrentPerson]);
  
  // Auto-complete final step if all people are done
  useEffect(() => {
    if (isActive && completedPersonIds.length === billPeople.length && billPeople.length > 0) {
      // Small delay to allow UI to update
      const timer = setTimeout(() => {
        commitAssignments();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isActive, completedPersonIds, billPeople, commitAssignments]);
  
  return {
    // State
    isActive,
    currentStage,
    currentPerson,
    currentItem,
    completedPersonIds,
    remainingPersonIds,
    itemQueue,
    pendingAssignments,
    isCompleted,
    selectedItems,
    
    // Actions
    startPassAndSplit,
    finishPassAndSplit,
    cancelPassAndSplit,
    selectPerson,
    acceptCurrentItem,
    rejectCurrentItem,
    goToNextPerson,
    restartPersonFlow,
    addNewPerson
  };
};

export default usePassAndSplitFlow;