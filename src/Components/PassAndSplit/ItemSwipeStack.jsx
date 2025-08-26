import React, { useState, useEffect } from 'react';
import usePassAndSplitStore from './stores/passAndSplitStore';
import useBillStore from '../../billStore';
import useFormatCurrency from '../../currencyStore';
import ItemCard from './ItemCard';

// Constants
const SWIPE_THRESHOLD = 100; // Minimum px to trigger dismiss

const ItemSwipeStack = () => {
  const formatCurrency = useFormatCurrency().formatCurrency;
  
  // Get relevant data from stores
  const itemQueue = usePassAndSplitStore(state => state.itemQueue);
  const assignCurrentItem = usePassAndSplitStore(state => state.assignCurrentItem);
  const skipCurrentItem = usePassAndSplitStore(state => state.skipCurrentItem);
  const items = useBillStore(state => state.items);
  
  // Local state for card management
  const [activeCards, setActiveCards] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Update active cards when item queue changes
  useEffect(() => {
    // Get full item details for the queue
    const itemDetails = itemQueue
      .map(itemId => items.find(item => item.id === itemId))
      .filter(Boolean)
      .slice(0, 3); // Only show top 3 for performance
      
    setActiveCards(itemDetails);
  }, [itemQueue, items]);
  
  // Handle swipe actions
  const handleSwipeRight = () => {
    if (isAnimating || activeCards.length === 0) return;
    
    setIsAnimating(true);
    setTimeout(() => {
      assignCurrentItem();
      setIsAnimating(false);
    }, 300); // Match animation duration
  };
  
  const handleSwipeLeft = () => {
    if (isAnimating || activeCards.length === 0) return;
    
    setIsAnimating(true);
    setTimeout(() => {
      skipCurrentItem();
      setIsAnimating(false);
    }, 300); // Match animation duration
  };
  
  // Manual button handlers
  const handleYesClick = () => {
    if (!isAnimating) handleSwipeRight();
  };
  
  const handleNoClick = () => {
    if (!isAnimating) handleSwipeLeft();
  };
  
  // Empty state when no items left
  if (activeCards.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <div className={`p-6 rounded-full mb-4 dark:bg-gray-700 bg-gray-200`}>
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold mb-2">All Done!</h3>
        <p className={`mb-4 dark:text-gray-300 text-gray-600`}>
          You've gone through all your items.
        </p>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Card stack area */}
      <div className="relative flex-grow flex-col items-center justify-center p-4">
        <div className="relative w-full h-[350px]">
          {activeCards.map((item, index) => (
            <ItemCard
              key={item.id}
              item={item}
              index={index}
              isTop={index === 0}
              onSwipeRight={handleSwipeRight}
              onSwipeLeft={handleSwipeLeft}
              formatCurrency={formatCurrency}
              swipeThreshold={SWIPE_THRESHOLD}
            />
          ))}
        </div>
        
        {/* Instructions */}
        <div className={`mt-5 bottom-1 left-0 right-0 flex justify-center space-x-16 text-xs
                        dark:text-gray-400 text-gray-500}`}>
          <div className="flex flex-col items-center">
            <span>←</span>
            <span>Skip</span>
          </div>
          <div className="flex flex-col items-center">
            <span>→</span>
            <span>I had this</span>
          </div>
        </div>
      </div>
      
      {/* Card count indicator */}
      <div className="text-center py-2">
        <span className={`text-sm dark:text-gray-400 text-gray-500`}>
          {itemQueue.length} item{itemQueue.length !== 1 ? 's' : ''} remaining
        </span>
      </div>
      
      {/* Button controls */}
      <div className="flex justify-center space-x-6 p-4">
        <button
          onClick={handleNoClick}
          disabled={isAnimating}
          className={`
            w-16 h-16 rounded-full flex items-center justify-center
            dark:bg-red-800 dark:hover:bg-red-700 bg-red-500 hover:bg-red-600
            text-white text-xl font-bold transition-colors
            ${isAnimating ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          ✕
        </button>
        
        <button
          onClick={handleYesClick}
          disabled={isAnimating}
          className={`
            w-16 h-16 rounded-full flex items-center justify-center
            dark:bg-green-800 dark:hover:bg-green-700 bg-green-500 hover:bg-green-600
            text-white text-xl font-bold transition-colors
            ${isAnimating ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          ✓
        </button>
      </div>
    </div>
  );
};

export default ItemSwipeStack;