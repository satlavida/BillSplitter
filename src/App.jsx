import { useContext, memo } from 'react';
import { BillContext, BillProvider } from './BillContext';
import PeopleInput from './components/PeopleInput';
import ItemsInput from './components/ItemsInput';
import ItemAssignment from './components/ItemAssignment';
import BillSummary from './components/BillSummary';
import './App.css';
// StepIndicator component
const StepIndicator = memo(({ currentStep }) => {
  const steps = [
    { number: 1, title: "People" },
    { number: 2, title: "Items" },
    { number: 3, title: "Assign" },
    { number: 4, title: "Summary" }
  ];
  
  return (
    <div className="mb-8 no-print">
      <div className="flex items-center justify-between">
        {steps.map((step) => (
          <div key={step.number} className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              currentStep >= step.number ? 'bg-blue-600 text-white' : 'bg-zinc-200 text-zinc-600'
            }`}>
              {step.number}
            </div>
            <span className="text-xs mt-1">{step.title}</span>
          </div>
        ))}
      </div>
      
      <div className="relative flex items-center justify-between mt-1">
        <div className="absolute left-0 right-0 h-1 bg-zinc-200">
          <div 
            className="h-1 bg-blue-600 transition-all duration-300 ease-in-out" 
            style={{ width: `${(currentStep - 1) * 100 / 3}%` }}
          ></div>
        </div>
      </div>
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
    <div className="min-h-screen bg-zinc-100 py-8 px-4">
      <div className="max-w-lg mx-auto bg-white p-6 rounded-xl shadow-lg ring-1 ring-zinc-200/50">
        <h1 className="text-2xl font-bold text-center mb-6">Bill Splitter</h1>
        <StepIndicator currentStep={state.step} />
        {renderStep()}
      </div>
    </div>
  );
};

// Main App component
const App = () => {
  return (
    <BillProvider>
      <AppContent />
    </BillProvider>
  );
};

export default App;