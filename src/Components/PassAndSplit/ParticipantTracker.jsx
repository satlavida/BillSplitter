import React from 'react';
import { useTheme } from '../../ThemeContext';
import usePassAndSplitStore from './stores/passAndSplitStore';
import useBillStore from '../../billStore';

const ParticipantTracker = () => {
  const { theme } = useTheme();
  const completedPersonIds = usePassAndSplitStore(state => state.completedPersonIds);
  const remainingPersonIds = usePassAndSplitStore(state => state.remainingPersonIds);
  
  // Get people from billStore
  const people = useBillStore(state => state.people);
  
  // Calculate progress percentage
  const totalPeople = people.length;
  const completedCount = completedPersonIds.length;
  const progressPercentage = totalPeople > 0 
    ? Math.round((completedCount / totalPeople) * 100) 
    : 0;
  
  return (
    <div className="flex items-center space-x-2">
      {/* Progress bar */}
      <div className={`
        relative w-24 h-2 rounded-full overflow-hidden
        ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}
      `}>
        <div 
          className={`absolute top-0 left-0 h-full rounded-full
                      ${theme === 'dark' ? 'bg-blue-500' : 'bg-blue-600'}`}
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
      
      {/* Progress text */}
      <span className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
        {completedCount}/{totalPeople}
      </span>
      
      {/* Avatar stack showing completion status */}
      <div className="flex -space-x-2">
        {people.slice(0, 3).map(person => {
          const isCompleted = completedPersonIds.includes(person.id);
          
          return (
            <div 
              key={person.id}
              className={`
                w-6 h-6 rounded-full flex items-center justify-center text-xs
                border-2 ${theme === 'dark' ? 'border-gray-800' : 'border-white'}
                ${isCompleted
                  ? `${theme === 'dark' ? 'bg-green-700' : 'bg-green-500'} text-white`
                  : `${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'} 
                     ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`
                }
              `}
              title={`${person.name} ${isCompleted ? '(completed)' : ''}`}
            >
              {person.name.charAt(0).toUpperCase()}
            </div>
          );
        })}
        
        {/* Additional counter if more than 3 people */}
        {people.length > 3 && (
          <div 
            className={`
              w-6 h-6 rounded-full flex items-center justify-center text-xs
              border-2 ${theme === 'dark' ? 'border-gray-800' : 'border-white'}
              ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}
              ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}
            `}
          >
            +{people.length - 3}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantTracker;