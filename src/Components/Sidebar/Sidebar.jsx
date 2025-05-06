import React, { useEffect } from 'react';
import SidebarItem from './SidebarItem';

const Sidebar = ({ 
  isOpen, 
  onToggle, 
  items, 
  activeItemId,
  onItemClick
}) => {
  // Handle Escape key to close sidebar
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onToggle();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onToggle]);
  
  // Handle clicking outside to close sidebar on mobile
  useEffect(() => {
    const handleOutsideClick = (e) => {
      // Only apply this behavior on mobile
      if (window.innerWidth < 768 && isOpen) {
        // Check if click is outside sidebar and not on the hamburger button
        const sidebar = document.getElementById('sidebar');
        const hamburgerBtn = document.getElementById('hamburger-btn');
        
        if (sidebar && 
            !sidebar.contains(e.target) && 
            hamburgerBtn && 
            !hamburgerBtn.contains(e.target)) {
          onToggle();
        }
      }
    };
    
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onToggle]);
  
  const handleItemClick = (itemId) => {
    onItemClick(itemId);
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      onToggle();
    }
  };
  
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}
      
      {/* Sidebar */}
      <aside
        id="sidebar"
        className={`fixed top-0 left-0 h-full bg-white dark:bg-zinc-900 shadow-lg z-30 transition-all duration-300 ease-in-out ${
          isOpen ? 'w-64' : 'w-0 md:w-18'
        } ${isOpen ? 'visible' : 'invisible md:visible'} overflow-hidden`}
      >
        <div className="flex flex-col h-full p-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className={`font-bold text-lg ${isOpen ? 'opacity-100' : 'opacity-0 md:opacity-0'} transition-opacity duration-200`}>
              Bill Splitter
            </h2>
            <button
              onClick={onToggle}
              className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Close sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <nav className="flex-1">
            <div className={`text-xs text-zinc-500 mb-2 ${isOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}>
              Navigation
            </div>
            
            {items.map((item) => (
              <SidebarItem
                key={item.id}
                id={item.id}
                icon={item.icon}
                label={item.label}
                isActive={activeItemId === item.id}
                onClick={handleItemClick}
                isOpen={isOpen}
              />
            ))}
          </nav>
          
          <div className={`mt-auto text-center transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            <p className="text-xs text-zinc-500">Version 1.0.0</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;