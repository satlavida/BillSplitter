import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../ThemeContext';

const ItemCard = ({ 
  item, 
  index, 
  isTop, 
  onSwipeRight, 
  onSwipeLeft, 
  formatCurrency,
  swipeThreshold = 100
}) => {
  const { theme } = useTheme();
  
  // State for tracking card position and interaction
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [exiting, setExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState(null);
  
  // Update position when dragging
  const updatePosition = useCallback((clientX, clientY) => {
    if (dragging && isTop && !exiting) {
      const deltaX = clientX - startPoint.x;
      // Limit vertical movement for more horizontal swiping feel
      const deltaY = (clientY - startPoint.y) * 0.2;
      setPosition({ x: deltaX, y: deltaY });
    }
  }, [dragging, isTop, exiting, startPoint]);
  
  // Handle drag end
  const handleEnd = useCallback(() => {
    if (dragging && isTop && !exiting) {
      setDragging(false);
      
      // Check if should dismiss based on threshold
      if (Math.abs(position.x) > swipeThreshold) {
        const direction = position.x > 0 ? 'right' : 'left';
        setExiting(true);
        setExitDirection(direction);
        
        // Call appropriate dismiss function after animation
        setTimeout(() => {
          if (direction === 'right') {
            onSwipeRight();
          } else {
            onSwipeLeft();
          }
        }, 300);
      } else {
        // Return to center if threshold not met
        setPosition({ x: 0, y: 0 });
      }
    }
  }, [dragging, isTop, exiting, position, swipeThreshold, onSwipeRight, onSwipeLeft]);
  
  // Document-level event listeners
  useEffect(() => {
    const handleMouseMove = (e) => {
      updatePosition(e.clientX, e.clientY);
    };
    
    const handleTouchMove = (e) => {
      if (e.cancelable) e.preventDefault();
      updatePosition(e.touches[0].clientX, e.touches[0].clientY);
    };
    
    // Only add listeners if dragging
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchend', handleEnd);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [dragging, updatePosition, handleEnd]);
  
  // Start dragging
  const startDrag = (clientX, clientY) => {
    if (isTop && !exiting) {
      setDragging(true);
      setStartPoint({ x: clientX, y: clientY });
    }
  };
  
  // Handle interaction start (mouse/touch)
  const handleStart = (e) => {
    if (e.type === 'mousedown') {
      startDrag(e.clientX, e.clientY);
    } else if (e.type === 'touchstart') {
      if (e.cancelable) e.preventDefault();
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  
  // Calculate visual effects
  const rotation = position.x * 0.1; // 0.1 controls rotation intensity
  const rightOpacity = Math.min(Math.max(position.x / 100, 0), 1);
  const leftOpacity = Math.min(Math.max(-position.x / 100, 0), 1);
  const offset = -index * 4; // Staggered stack effect
  
  // Card style with theme awareness
  const cardStyle = {
    transform: exiting
      ? `translate(${exitDirection === 'right' ? '200%' : '-200%'}, 0) rotate(${exitDirection === 'right' ? '20deg' : '-20deg'})`
      : `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg)`,
    top: `${offset}px`,
    zIndex: 100 - index,
    opacity: 1 - (index * 0.2),
    transition: dragging ? 'none' : 'transform 0.3s ease',
    backgroundColor: theme === 'dark' ? '#2d3748' : 'white',
    boxShadow: theme === 'dark' 
      ? '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)'
      : '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.05)'
  };
  
  return (
    <div
      className="absolute w-full h-full rounded-xl"
      style={cardStyle}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      {/* Card content */}
      <div className="w-full h-full flex flex-col">
        {/* Card header with item name */}
        <div className={`p-4 border-b 
                        ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-xl font-semibold truncate">{item.name}</h3>
          <div className="flex justify-between items-center mt-1">
            <span className="font-medium">
              {formatCurrency(item.price)} × {item.quantity}
            </span>
            <span className="font-bold">
              {formatCurrency(item.price * item.quantity)}
            </span>
          </div>
        </div>
        
        {/* Card body - illustration */}
        <div className="flex-grow flex items-center justify-center p-4">
          {/* Simple visual representation of the item */}
          <div className={`w-24 h-24 rounded-full flex items-center justify-center
                         ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <span className="text-4xl">🍽️</span>
          </div>
        </div>
        
        {/* Instruction for swiping */}
        <div className="p-4 text-center">
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            Did you have this item?
          </p>
        </div>
      </div>
      
      {/* Swipe indicators - only shown when top card and being dragged */}
      {isTop && (
        <>
          {/* "I had this" indicator */}
          <div
            className="absolute top-4 right-4 text-green-500 font-bold text-xl border-4 border-green-500 rounded-lg px-2 py-1 rotate-12"
            style={{ opacity: rightOpacity }}
          >
            I HAD THIS
          </div>
          
          {/* "Skip" indicator */}
          <div
            className="absolute top-4 left-4 text-red-500 font-bold text-xl border-4 border-red-500 rounded-lg px-2 py-1 -rotate-12"
            style={{ opacity: leftOpacity }}
          >
            SKIP
          </div>
        </>
      )}
    </div>
  );
};

export default ItemCard;