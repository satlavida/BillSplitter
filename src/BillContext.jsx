import { createContext, useReducer, useEffect, useMemo } from 'react';
import { useCurrencyFormat } from './currencyUtils';

// Initial state
const initialState = {
  step: 1,
  people: [],
  items: [],
  taxAmount: 0,
  currency: 'INR',
  title: '', 
};

// Load state from localStorage if exists
const loadState = () => {
  try {
    const savedState = localStorage.getItem('billSplitter');
    if (savedState) {
      return JSON.parse(savedState);
    }
  } catch (e) {
    console.error("Error loading state from localStorage:", e);
  }
  return initialState;
};

// Action types
export const ADD_PERSON = 'ADD_PERSON';
export const REMOVE_PERSON = 'REMOVE_PERSON';
export const UPDATE_PERSON = 'UPDATE_PERSON';
export const ADD_ITEM = 'ADD_ITEM';
export const REMOVE_ITEM = 'REMOVE_ITEM';
export const UPDATE_ITEM = 'UPDATE_ITEM';
export const SET_TAX = 'SET_TAX';
export const ASSIGN_ITEM = 'ASSIGN_ITEM';
export const ASSIGN_ALL_PEOPLE = 'ASSIGN_ALL_PEOPLE';
export const REMOVE_ALL_PEOPLE = 'REMOVE_ALL_PEOPLE';
export const NEXT_STEP = 'NEXT_STEP';
export const PREV_STEP = 'PREV_STEP';
export const GO_TO_STEP = 'GO_TO_STEP';
export const SET_CURRENCY = 'SET_CURRENCY';
export const SET_TITLE = 'SET_TITLE'; // Add action type for setting title
export const RESET = 'RESET';

// Reducer function
const billReducer = (state, action) => {
  let newState;
  
  switch(action.type) {
    case ADD_PERSON:
      newState = {
        ...state,
        people: [...state.people, {
          id: Date.now().toString(),
          name: action.payload
        }]
      };
      break;
      
    case REMOVE_PERSON:
      newState = {
        ...state,
        people: state.people.filter(person => person.id !== action.payload),
        // Also remove this person from all consumedBy arrays
        items: state.items.map(item => ({
          ...item,
          consumedBy: item.consumedBy.filter(id => id !== action.payload)
        }))
      };
      break;

    case UPDATE_PERSON:
      newState = {
        ...state,
        people: state.people.map(person => 
          person.id === action.payload.id 
            ? { ...person, name: action.payload.name } 
            : person
        )
      };
      break;
      
    case ADD_ITEM:
      newState = {
        ...state,
        items: [...state.items, {
          id: Date.now().toString() + Math.random().toString(36),
          name: action.payload.name,
          price: parseFloat(action.payload.price),
          quantity: parseInt(action.payload.quantity) || 1,
          consumedBy: []
        }]
      };
      break;
      
    case REMOVE_ITEM:
      newState = {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      };
      break;
      
    case UPDATE_ITEM:
      newState = {
        ...state,
        items: state.items.map(item => 
          item.id === action.payload.id ? {...item, ...action.payload.data} : item
        )
      };
      break;
      
    case SET_TAX:
      newState = {
        ...state,
        taxAmount: parseFloat(action.payload) || 0
      };
      break;
      
    case ASSIGN_ITEM:
      newState = {
        ...state,
        items: state.items.map(item => 
          item.id === action.payload.itemId 
            ? {...item, consumedBy: action.payload.peopleIds} 
            : item
        )
      };
      break;
      
    case ASSIGN_ALL_PEOPLE:
      newState = {
        ...state,
        items: state.items.map(item => 
          item.id === action.payload 
            ? {...item, consumedBy: state.people.map(person => person.id)}
            : item
        )
      };
      break;
      
    case REMOVE_ALL_PEOPLE:
      newState = {
        ...state,
        items: state.items.map(item => 
          item.id === action.payload
            ? {...item, consumedBy: []}
            : item
        )
      };
      break;
      
    case NEXT_STEP:
      newState = {
        ...state,
        step: Math.min(state.step + 1, 4)
      };
      break;
      
    case PREV_STEP:
      newState = {
        ...state,
        step: Math.max(state.step - 1, 1)
      };
      break;
      
    case GO_TO_STEP:
      newState = {
        ...state,
        step: action.payload
      };
      break;
      
    case SET_CURRENCY:
      newState = {
        ...state,
        currency: action.payload
      };
      break;
      
    case SET_TITLE:
      newState = {
        ...state,
        title: action.payload
      };
      break;
      
    case RESET:
      newState = initialState;
      break;
      
    default:
      return state;
  }
  
  // Save to localStorage
  localStorage.setItem('billSplitter', JSON.stringify(newState));
  return newState;
};

// Create context
export const BillContext = createContext();

// Context provider component
export const BillProvider = ({ children }) => {
  const [state, dispatch] = useReducer(billReducer, loadState());
  
  // Currency formatting utilities
  const { formatCurrency, changeCurrency } = useCurrencyFormat(state.currency);
  
  // Sync with localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('billSplitter', JSON.stringify(state));
    
    // Update document title if bill title exists
    if (state.title) {
      document.title = `Bill Splitter - ${state.title}`;
    } else {
      document.title = 'Bill Splitter';
    }
  }, [state]);
  
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    state,
    dispatch,
    formatCurrency,
    changeCurrency
  }), [state, formatCurrency, changeCurrency]);
  
  return (
    <BillContext.Provider value={contextValue}>
      {children}
    </BillContext.Provider>
  );
};