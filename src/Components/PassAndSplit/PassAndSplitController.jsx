import React from 'react';
import { useTheme } from '../../ThemeContext';
import usePassAndSplitStore, { STAGES } from './stores/passAndSplitStore';
import PersonSelection from './PersonSelection';
import ItemSwipeStack from './ItemSwipeStack';
import CompletionScreen from './CompletionScreen';
import ParticipantTracker from './ParticipantTracker';
import useBillStore from '../../billStore';

const PassAndSplitController = () => {
  const { theme } = useTheme();
  const stage = usePassAndSplitStore(state => state.stage);
  const currentPersonId = usePassAndSplitStore(state => state.currentPersonId);
  const people = useBillStore(state => state.people);
  
  // Find current person object
  const currentPerson = people.find(p => p.id === currentPersonId);
  
  // Render appropriate screen based on current stage
  const renderCurrentStage = () => {
    switch (stage) {
      case STAGES.PERSON_SELECTION:
        return <PersonSelection />;
        
      case STAGES.ITEM_SWIPING:
        return <ItemSwipeStack />;
        
      case STAGES.COMPLETION:
        return <CompletionScreen />;
        
      default:
        return <PersonSelection />;
    }
  };

  return (
    <div className={`flex flex-col h-full dark:bg-gray-800 dark:text-white bg-white text-gray-800`}>
      {/* Header section with current stage info and participant tracker */}
      <div className={`py-2 px-4 dark:bg-gray-700 bg-gray-100`}>
        {stage === STAGES.ITEM_SWIPING && currentPerson ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Current Person:</span>
              <h3 className="text-lg font-bold">{currentPerson.name}</h3>
            </div>
            <div className="text-right">
              <span className="text-xs">Swipe right for items you consumed</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <h3 className="font-medium">
              {stage === STAGES.PERSON_SELECTION ? 'Select Person' : 
               stage === STAGES.COMPLETION ? 'Completed' : 'Select Items'}
            </h3>
            
            {/* Only show participant tracker in selection stage */}
            {stage === STAGES.PERSON_SELECTION && (
              <ParticipantTracker />
            )}
          </div>
        )}
      </div>
      
      {/* Main content area */}
      <div className="flex-grow">
        {renderCurrentStage()}
      </div>
    </div>
  );
};

export default PassAndSplitController;