import React, { useEffect } from 'react';
import { useTheme } from '../../ThemeContext';
import PassAndSplitController from './PassAndSplitController';
import usePassAndSplitStore from 'components/PassAndSplit/stores/passAndSplitStore.js';
import useBillStore from '../../billStore';

const PassAndSplit = ({ onClose }) => {
  const isActive = usePassAndSplitStore(state => state.isActive);
  const activate = usePassAndSplitStore(state => state.activate);
  const deactivate = usePassAndSplitStore(state => state.deactivate);
  const commitAssignments = usePassAndSplitStore(state => state.commitAssignments);
  const people = useBillStore(state => state.people);
  
  // Activate on mount
  useEffect(() => {
    activate();
    
    // Cleanup on unmount
    return () => deactivate();
  }, [activate, deactivate]);
  
  const handleClose = () => {
    // Commit any pending assignments before closing
    commitAssignments();
    onClose();
  };
  
  // Check if we have people to continue
  if (people.length === 0) {
    return (
      <div className={`fixed inset-0 flex items-center justify-center z-50 
                      bg-black bg-opacity-50 dark:text-white text-gray-800`}>
        <div className={`relative w-11/12 max-w-md p-6 rounded-lg shadow-lg 
                       dark:bg-gray-800 bg-white`}>
          <h3 className="text-xl font-bold mb-4">No People Added</h3>
          <p className="mb-4">
            You need to add people to the bill before using Pass and Split mode.
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-md dark:bg-blue-600 dark:hover:bg-blue-700 bg-blue-500 hover:bg-blue-600 text-white`}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Main modal UI
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 flex items-center justify-center">
        <div className="fixed inset-0 bg-black opacity-40" onClick={handleClose}></div>
        
        <div className={`relative w-full max-w-md p-0 rounded-xl shadow-2xl transition-all
                        dark:bg-gray-800 dark:text-white bg-white text-gray-800`}>
          {/* Modal Header */}
          <div className={`flex justify-between items-center p-4 border-b
                         dark:border-gray-700 border-gray-200`}>
            <h3 className="text-xl font-bold">Pass and Split</h3>
            <button
              onClick={handleClose}
              className={`rounded-full p-1 dark:hover:bg-gray-700 hover:bg-gray-200`}
            >
              {/* X icon */}
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="flex flex-col">
            {isActive && <PassAndSplitController />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PassAndSplit;