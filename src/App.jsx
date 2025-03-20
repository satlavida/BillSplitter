import { useContext, memo } from 'react';
import { BillContext, BillProvider } from './BillContext';
import { ThemeProvider } from './ThemeContext';
import ThemeSwitcher from './components/ThemeSwitcher';
import PeopleInput from './components/PeopleInput';
import ItemsInput from './components/ItemsInput';
import ItemAssignment from './components/ItemAssignment';
import BillSummary from './components/BillSummary';
import './App.css'

// StepIndicator component 
const StepIndicator = memo(({ currentStep }) => {
  const { dispatch } = useContext(BillContext);
  const steps = [
    { number: 1, title: "People" },
    { number: 2, title: "Items" },
    { number: 3, title: "Assign" },
    { number: 4, title: "Summary" }
  ];
  
  // Handler for when a step is clicked
  const handleStepClick = (stepNumber) => {
    dispatch({ type: 'GO_TO_STEP', payload: stepNumber });
  };
  
  return (
    <div className="mb-8 no-print">
      <div className="flex items-center justify-between">
        {steps.map((step) => (
          <div 
            key={step.number} 
            className={`flex flex-col items-center cursor-pointer transition-opacity hover:opacity-80`}
            onClick={() => handleStepClick(step.number)}
            role="button"
            aria-label={`Go to step ${step.number}: ${step.title}`}
            tabIndex={0}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              currentStep >= step.number
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
            }`}>
              {step.number}
            </div>
            <span className="text-xs mt-1 dark:text-zinc-300">{step.title}</span>
          </div>
        ))}
      </div>
      
      <div className="relative flex items-center justify-between mt-1">
        <div className="absolute left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-700">
          <div 
            className="h-1 bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-in-out" 
            style={{ width: `${(currentStep - 1) * 100 / 3}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
});

// Header with theme switcher
const Header = memo(() => {
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold text-zinc-800 dark:text-white">Bill Splitter</h1>
      <ThemeSwitcher />
    </div>
  );
});

// App content component
const AppContent = () => {
  const { state } = useContext(BillContext);
  
  // Render the appropriate step
  const renderStep = () => {
    switch(state.step) {
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
  
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 py-8 px-4 transition-colors duration-200">
      <div className="max-w-lg mx-auto bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-lg ring-1 ring-zinc-200/50 dark:ring-zinc-700/50 transition-colors duration-200">
        <Header />
        <StepIndicator currentStep={state.step} />
        {renderStep()}
      </div>
    </div>
  );
};

// Main App component
const App = () => {
  return (
    <ThemeProvider>
      <BillProvider>
        <AppContent />
      </BillProvider>
    </ThemeProvider>
  );
};

export default App;