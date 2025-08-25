import React, { memo, useState, useEffect } from 'react';
import { ThemeProvider } from './ThemeContext';
import ThemeSwitcher from './Components/ThemeSwitcher';
import PeopleInput from './Components/PeopleInput';
import ItemsInput from './Components/ItemsInput';
import ItemAssignment from './Components/ItemAssignment';
import BillSummary from './Components/BillSummary';
import Settings from './Components/Settings';
import { Sidebar, HamburgerButton } from './Components/Sidebar';
import useBillStore from './billStore';
import useBillHistoryStore from './billHistoryStore';
import { useDocumentTitle } from './billStore';
import { useShallow } from 'zustand/shallow';
import { BillHistoryProvider, useBillHistory } from './Components/BillHistory/BillHistoryContext';
import ServiceWorkerPrompt from './Components/Prompts/ServiceWorkerPrompt';
import './App.css';

// StepIndicator component 
const StepIndicator = memo(() => {
  // Using useShallow to prevent unnecessary re-renders when returning an object
  const { step, goToStep } = useBillStore(
    useShallow(state => ({
      step: state.step,
      goToStep: state.goToStep
    }))
  );
  
  const steps = [
    { number: 1, title: "People" },
    { number: 2, title: "Items" },
    { number: 3, title: "Assign" },
    { number: 4, title: "Summary" }
  ];
  
  // Handler for when a step is clicked
  const handleStepClick = (stepNumber) => {
    goToStep(stepNumber);
  };
  
  return (
    <div className="mb-8 no-print">
      <div className="flex items-center justify-between">
        {steps.map((stepItem) => (
          <div 
            key={stepItem.number} 
            className={`flex flex-col items-center cursor-pointer transition-opacity hover:opacity-80`}
            onClick={() => handleStepClick(stepItem.number)}
            role="button"
            aria-label={`Go to step ${stepItem.number}: ${stepItem.title}`}
            tabIndex={0}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              step >= stepItem.number
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
            }`}>
              {stepItem.number}
            </div>
            <span className="text-xs mt-1 dark:text-zinc-300">{stepItem.title}</span>
          </div>
        ))}
      </div>
      
      <div className="relative flex items-center justify-between mt-1">
        <div className="absolute left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-700">
          <div 
            className="h-1 bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-in-out" 
            style={{ width: `${(step - 1) * 100 / 3}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
});

// Header with theme switcher and hamburger button
const Header = memo(({ toggleSidebar, isSidebarOpen }) => {
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-3">
        <HamburgerButton onClick={toggleSidebar} isOpen={isSidebarOpen} />
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-white">Bill Splitter</h1>
      </div>
      <ThemeSwitcher />
    </div>
  );
});

// App content component
const AppContent = () => {
  // This is fine as-is since it's only selecting a primitive value
  const { step, goToStep } = useBillStore(
    useShallow(state => ({
      step: state.step,
      goToStep: state.goToStep
    }))
  );
  
  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState(step);
  
  // Use local storage to remember sidebar state
  useEffect(() => {
    const savedSidebarState = localStorage.getItem('sidebarOpen');
    if (savedSidebarState !== null) {
      setIsSidebarOpen(JSON.parse(savedSidebarState));
    }
  }, []);
  
  // Save sidebar state to local storage
  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  // Keep active sidebar item in sync with step changes
  useEffect(() => {
    setActiveItemId(step);
  }, [step]);
  
  // Toggle sidebar
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const { openModal } = useBillHistory();
  
  // Sidebar items
  const sidebarItems = [
    {
      id: 1,
      label: "Add People",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      id: 2,
      label: "Add Items",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    },
    {
      id: 3,
      label: "Assign Items",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      )
    },
    {
      id: 4,
      label: "Summary",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'settings',
      label: "Settings",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      id: 'history',
      label: "Bill History",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];
  
  // Handle sidebar item click
  const handleSidebarItemClick = (itemId) => {
    if (!isNaN(itemId)) {
      const numericId = Number(itemId);
      goToStep(numericId);
      setActiveItemId(numericId);
    } else if (itemId === 'history') {
      openModal();
    } else if (itemId === 'settings') {
      setActiveItemId('settings');
    }
  };
  
  // Set document title based on bill title
  useDocumentTitle();
  // Check if we need to load the current bill from history
  const currentBill = useBillHistoryStore(state => state.getCurrentBill());
  const { importBill, billId, people, items } = useBillStore(
    useShallow(state => ({
      importBill: state.importBill,
      billId: state.billId,
      people: state.people,
      items: state.items,
    }))
  );

  const hasBillData = billId || people.length > 0 || items.length > 0;

  // Load current bill from history only if we don't already have bill data
  useEffect(() => {
    if (currentBill && !hasBillData) {
      importBill(currentBill.data);
    }
  }, [currentBill, importBill, hasBillData]);
  
  // Render the appropriate step
  const renderStep = () => {
    switch(step) {
      case 1:
        return <PeopleInput />;
      case 2:
        return <ItemsInput />;
      case 3:
        return <ItemAssignment />;
      case 4:
        return <BillSummary />;
      default:
        return <PeopleInput />;
    }
  };

  const renderContent = () => {
    if (activeItemId === 'settings') {
      return <Settings />;
    }
    return renderStep();
  };
  
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 transition-colors duration-200">
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        items={sidebarItems}
        activeItemId={activeItemId}
        onItemClick={handleSidebarItemClick}
      />
      
      {/* Main content */}
      <div className={`min-h-screen transition-all duration-300 ${
        isSidebarOpen ? 'md:ml-64' : 'ml-0 md:ml-16'
      }`}>
        <div className="py-8 px-4">
          <div className="max-w-lg mx-auto bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-lg ring-1 ring-zinc-200/50 dark:ring-zinc-700/50 transition-colors duration-200">
            <Header toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
            {typeof activeItemId === 'number' && <StepIndicator />}
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App component
const App = () => {
  return (
    <ThemeProvider>
      <BillHistoryProvider>
        <AppContent />
        <ServiceWorkerPrompt />
      </BillHistoryProvider>
    </ThemeProvider>
  );
};

export default App;