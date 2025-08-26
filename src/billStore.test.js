/**
 * Unit tests for billStore.js
 */

// Import necessary functions and constants from the store and testing library
import useBillStore, { 
    SPLIT_TYPES, 
    useBillPersons, 
    useBillItems, 
    useBillPersonTotals,
    useBillStep,
    useBillCurrency,
    useBillTitle,
    useBillTaxAmount,
    useBillSubtotal,
    useBillGrandTotal
  } from '../src/billStore'; // Adjust the path if your store is located elsewhere
import { renderHook, act } from '@testing-library/react';

// Mock localStorage for testing persistence
const mockLocalStorageData = {};
const mockLocalStorage = {
  getItem: jest.fn((key) => {
    return mockLocalStorageData[key] || null;
  }),
  setItem: jest.fn((key, value) => {
    mockLocalStorageData[key] = value;
  }),
  removeItem: jest.fn((key) => {
    delete mockLocalStorageData[key];
  }),
  clear: jest.fn(() => {
    Object.keys(mockLocalStorageData).forEach(key => delete mockLocalStorageData[key]);
  })
};

// Replace the global window.localStorage with the mock before running tests
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Reset the Zustand store and clear the mock localStorage before each test
beforeEach(() => {
  act(() => {
    useBillStore.getState().reset(); // Reset store state
  });
  mockLocalStorage.clear(); // Clear mock storage
  // Reset mocks if needed, e.g., jest.clearAllMocks();
});

// Test suite for basic store operations
describe('billStore - Basic Store Operations', () => {
  test('should initialize with default values', () => {
    const state = useBillStore.getState();
    expect(state.step).toBe(1); // Initial step [cite: 7]
    expect(state.people).toEqual([]); // Initial people array [cite: 7]
    expect(state.items).toEqual([]); // Initial items array [cite: 7]
    expect(state.taxAmount).toBe(0); // Initial tax amount [cite: 7]
    expect(state.currency).toBe('INR'); // Initial currency (may vary based on detection)
    expect(state.title).toBe(''); // Initial title [cite: 7]
  });

  test('should navigate steps correctly', () => {
    const { nextStep, prevStep, goToStep } = useBillStore.getState();
    
    // Starting at step 1
    expect(useBillStore.getState().step).toBe(1);
    
    // Navigate forward
    act(() => nextStep()); // Use nextStep action [cite: 8]
    expect(useBillStore.getState().step).toBe(2);
    
    // Jump to step 4
    act(() => goToStep(4)); // Use goToStep action [cite: 8]
    expect(useBillStore.getState().step).toBe(4);
    
    // Navigate backward
    act(() => prevStep()); // Use prevStep action [cite: 8]
    expect(useBillStore.getState().step).toBe(3);
    
    // Test bounds - should not go below 1
    act(() => goToStep(1));
    act(() => prevStep());
    expect(useBillStore.getState().step).toBe(1);
    
    // Test bounds - should not go above 4
    act(() => goToStep(4));
    act(() => nextStep());
    expect(useBillStore.getState().step).toBe(4);
  });

  test('should set title', () => {
    const { setTitle } = useBillStore.getState();
    
    act(() => setTitle('Restaurant Bill')); // Use setTitle action
    expect(useBillStore.getState().title).toBe('Restaurant Bill');
  });

  test('should set tax amount', () => {
    const { setTax } = useBillStore.getState();
    
    act(() => setTax(15.5)); // Use setTax action [cite: 10]
    expect(useBillStore.getState().taxAmount).toBe(15.5);
    
    // Test handling invalid input (should default to 0)
    act(() => setTax('invalid'));
    expect(useBillStore.getState().taxAmount).toBe(0);
  });

  test('should set currency', () => {
    const { setCurrency } = useBillStore.getState();
    
    act(() => setCurrency('USD')); // Use setCurrency action
    expect(useBillStore.getState().currency).toBe('USD');
  });

  test('should reset state to initial values', () => {
    const { addPerson, addItem, setTax, setTitle, reset } = useBillStore.getState();
    
    // Modify state
    act(() => {
      addPerson('John'); // [cite: 8]
      addItem({ name: 'Pizza', price: 20, quantity: 1 }); // [cite: 8]
      setTax(5); // [cite: 10]
      setTitle('Test Bill'); // [cite: 9]
    });
    
    // Confirm state was modified
    expect(useBillStore.getState().people.length).toBe(1);
    expect(useBillStore.getState().items.length).toBe(1);
    
    // Reset state
    act(() => reset()); // Use reset action [cite: 14]
    
    // Verify state was reset
    const initialState = {
        step: 1,
        people: [],
        items: [],
        taxAmount: 0,
        currency: 'INR', // Check against your detected/default currency
        title: '', 
    };
    expect(useBillStore.getState()).toMatchObject(initialState);
  });
});

// Test suite for people management actions
describe('billStore - People Management', () => {
  test('should add a person', () => {
    const { addPerson } = useBillStore.getState();
    
    act(() => addPerson('Alice')); // Use addPerson action [cite: 8]
    
    const people = useBillStore.getState().people;
    expect(people.length).toBe(1);
    expect(people[0].name).toBe('Alice');
    expect(people[0].id).toBeDefined(); // ID should be generated
  });

  test('should update a person', () => {
    const { addPerson, updatePerson } = useBillStore.getState();
    
    act(() => addPerson('Bob')); // [cite: 8]
    const personId = useBillStore.getState().people[0].id;
    
    act(() => updatePerson(personId, 'Robert')); // Use updatePerson action [cite: 8]
    
    const people = useBillStore.getState().people;
    expect(people[0].name).toBe('Robert');
  });

  test('should remove a person', () => {
    const { addPerson, removePerson } = useBillStore.getState();
    
    act(() => {
      addPerson('Charlie'); // [cite: 8]
      addPerson('David'); // [cite: 8]
    });
    
    const people = useBillStore.getState().people;
    const personIdToRemove = people[0].id; // ID of Charlie
    
    act(() => removePerson(personIdToRemove)); // Use removePerson action [cite: 8]
    
    const remainingPeople = useBillStore.getState().people;
    expect(remainingPeople.length).toBe(1);
    expect(remainingPeople[0].name).toBe('David'); // Only David should remain
  });

  test('should remove person from item consumedBy arrays when person is removed', () => {
    const { addPerson, addItem, assignItemEqual, removePerson } = useBillStore.getState();
    
    // Add people and items
    act(() => {
      addPerson('Eve'); // [cite: 8]
      addPerson('Frank'); // [cite: 8]
      addItem({ name: 'Burger', price: 10, quantity: 1 }); // [cite: 8]
    });
    
    const people = useBillStore.getState().people;
    const itemId = useBillStore.getState().items[0].id;
    const eveId = people.find(p => p.name === 'Eve').id;
    const frankId = people.find(p => p.name === 'Frank').id;
    
    // Assign item to both people using equal split
    act(() => assignItemEqual(itemId, [eveId, frankId])); // Use assignItemEqual action [cite: 8]
    
    // Verify assignment
    let item = useBillStore.getState().items[0];
    expect(item.consumedBy.length).toBe(2);
    expect(item.consumedBy.map(a => a.personId)).toContain(eveId);
    expect(item.consumedBy.map(a => a.personId)).toContain(frankId);
    
    // Remove one person (Eve)
    act(() => removePerson(eveId)); // [cite: 8]
    
    // Verify person was removed from item's consumedBy
    item = useBillStore.getState().items[0];
    expect(item.consumedBy.length).toBe(1);
    expect(item.consumedBy[0].personId).toBe(frankId); // Only Frank should remain
  });
});

// Test suite for item management actions
describe('billStore - Item Management', () => {
  test('should add an item with default quantity and split type', () => {
    const { addItem } = useBillStore.getState();
    
    act(() => addItem({ name: 'Pasta', price: 15.5, quantity: 2 })); // [cite: 8]
    
    const items = useBillStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].name).toBe('Pasta');
    expect(items[0].price).toBe(15.5);
    expect(items[0].quantity).toBe(2);
    expect(items[0].consumedBy).toEqual([]); // Initially empty [cite: 20]
    expect(items[0].splitType).toBe(SPLIT_TYPES.EQUAL); // Default split type [cite: 21]
  });

  test('should update an item', () => {
    const { addItem, updateItem } = useBillStore.getState();
    
    act(() => addItem({ name: 'Salad', price: 7, quantity: 1 })); // [cite: 8]
    const itemId = useBillStore.getState().items[0].id;
    
    // Update name, price, and quantity
    act(() => updateItem(itemId, { name: 'Caesar Salad', price: 9, quantity: 2 })); // Use updateItem action [cite: 8]
    
    const item = useBillStore.getState().items[0];
    expect(item.name).toBe('Caesar Salad');
    expect(item.price).toBe(9);
    expect(item.quantity).toBe(2);
  });

  test('should remove an item', () => {
    const { addItem, removeItem } = useBillStore.getState();
    
    act(() => {
      addItem({ name: 'Fish', price: 22, quantity: 1 }); // [cite: 8]
      addItem({ name: 'Chips', price: 5, quantity: 1 }); // [cite: 8]
    });
    
    const items = useBillStore.getState().items;
    const itemIdToRemove = items[0].id; // ID of Fish
    
    act(() => removeItem(itemIdToRemove)); // Use removeItem action [cite: 8]
    
    const remainingItems = useBillStore.getState().items;
    expect(remainingItems.length).toBe(1);
    expect(remainingItems[0].name).toBe('Chips'); // Only Chips should remain
  });

  test('should default item quantity to 1 if not provided or invalid', () => {
    const { addItem } = useBillStore.getState();
    
    // Test with missing quantity
    act(() => addItem({ name: 'Drink', price: 3 })); // [cite: 8]
    expect(useBillStore.getState().items[0].quantity).toBe(1);
    
    // Test with invalid quantity (e.g., null, undefined, non-numeric)
    act(() => addItem({ name: 'Sauce', price: 1, quantity: null })); // [cite: 8]
    expect(useBillStore.getState().items[1].quantity).toBe(1); // Should default to 1
  });
});

// Test suite for item assignment and split type actions
describe('billStore - Split Type Assignment', () => {
  beforeEach(() => {
    // Add people for assignment tests
    act(() => {
      useBillStore.getState().addPerson('Grace'); // [cite: 8]
      useBillStore.getState().addPerson('Henry'); // [cite: 8]
      useBillStore.getState().addPerson('Ivy'); // [cite: 8]
    });
  });

  test('should assign item equally using assignItemEqual', () => {
    const { addItem, assignItemEqual } = useBillStore.getState();
    act(() => addItem({ name: 'Pizza', price: 20, quantity: 1 })); // [cite: 8]
    
    const people = useBillStore.getState().people;
    const itemId = useBillStore.getState().items[0].id;
    const graceId = people.find(p => p.name === 'Grace').id;
    const henryId = people.find(p => p.name === 'Henry').id;
    
    act(() => assignItemEqual(itemId, [graceId, henryId])); // [cite: 8]
    
    const item = useBillStore.getState().items[0];
    expect(item.splitType).toBe(SPLIT_TYPES.EQUAL); // [cite: 21]
    expect(item.consumedBy.length).toBe(2);
    // For equal split, 'value' represents participation (e.g., 1)
    expect(item.consumedBy.map(a => a.personId)).toEqual([graceId, henryId]);
    expect(item.consumedBy.every(a => a.value === 1)).toBe(true);
  });

  test('should assign item by percentage using assignItemPercentage', () => {
    const { addItem, assignItemPercentage } = useBillStore.getState();
    act(() => addItem({ name: 'Steak', price: 30, quantity: 1 })); // [cite: 8]
    
    const people = useBillStore.getState().people;
    const itemId = useBillStore.getState().items[0].id;
    const graceId = people.find(p => p.name === 'Grace').id;
    const henryId = people.find(p => p.name === 'Henry').id;
    
    const allocations = [
      { personId: graceId, value: 70 }, // 70% [cite: 20]
      { personId: henryId, value: 30 }  // 30% [cite: 20]
    ];
    
    act(() => assignItemPercentage(itemId, allocations)); // [cite: 8]
    
    const item = useBillStore.getState().items[0];
    expect(item.splitType).toBe(SPLIT_TYPES.PERCENTAGE); // [cite: 21]
    expect(item.consumedBy.length).toBe(2);
    expect(item.consumedBy).toEqual(allocations);
  });

  test('should assign item fractionally using assignItemFraction', () => {
    const { addItem, assignItemFraction } = useBillStore.getState();
    act(() => addItem({ name: 'Dessert', price: 15, quantity: 1 })); // [cite: 8]
    
    const people = useBillStore.getState().people;
    const itemId = useBillStore.getState().items[0].id;
    const graceId = people.find(p => p.name === 'Grace').id;
    const henryId = people.find(p => p.name === 'Henry').id;
    
    const allocations = [
      { personId: graceId, value: 2 }, // 2 parts [cite: 20]
      { personId: henryId, value: 1 }  // 1 part [cite: 20]
    ];
    
    act(() => assignItemFraction(itemId, allocations)); // [cite: 8]
    
    const item = useBillStore.getState().items[0];
    expect(item.splitType).toBe(SPLIT_TYPES.FRACTION); // [cite: 21]
    expect(item.consumedBy.length).toBe(2);
    expect(item.consumedBy).toEqual(allocations);
  });

  test('should set split type for an item and clear allocations', () => {
    const { addItem, assignItemEqual, setSplitType } = useBillStore.getState();
    act(() => addItem({ name: 'Appetizer', price: 12, quantity: 1 })); // [cite: 8]
    
    const people = useBillStore.getState().people;
    const itemId = useBillStore.getState().items[0].id;
    
    // First assign equal split
    act(() => assignItemEqual(itemId, people.map(p => p.id))); // [cite: 8]
    expect(useBillStore.getState().items[0].consumedBy.length).toBe(3); // Initially assigned to 3 people
    
    // Then change split type to Percentage
    act(() => setSplitType(itemId, SPLIT_TYPES.PERCENTAGE)); // [cite: 8]
    
    const item = useBillStore.getState().items[0];
    expect(item.splitType).toBe(SPLIT_TYPES.PERCENTAGE); // [cite: 21]
    expect(item.consumedBy).toEqual([]); // Allocations should be cleared [cite: 20]
  });

  test('should assign all people equally using assignAllPeopleEqual', () => {
    const { addItem, assignAllPeopleEqual } = useBillStore.getState();
    act(() => addItem({ name: 'Shared Plate', price: 25, quantity: 1 })); // [cite: 8]
    
    const itemId = useBillStore.getState().items[0].id;
    
    act(() => assignAllPeopleEqual(itemId)); // [cite: 8]
    
    const item = useBillStore.getState().items[0];
    expect(item.splitType).toBe(SPLIT_TYPES.EQUAL); // [cite: 21]
    expect(item.consumedBy.length).toBe(3); // Should be assigned to all 3 people
    expect(item.consumedBy.every(alloc => alloc.value === 1)).toBe(true);
  });

  test('should remove all people from an item using removeAllPeople', () => {
    const { addItem, assignAllPeopleEqual, removeAllPeople } = useBillStore.getState();
    act(() => addItem({ name: 'Shared Dish', price: 18, quantity: 1 })); // [cite: 8]
    
    const itemId = useBillStore.getState().items[0].id;
    
    // First assign everyone
    act(() => assignAllPeopleEqual(itemId)); // [cite: 8]
    expect(useBillStore.getState().items[0].consumedBy.length).toBe(3);
    
    // Then remove everyone
    act(() => removeAllPeople(itemId)); // [cite: 8]
    expect(useBillStore.getState().items[0].consumedBy).toEqual([]); // [cite: 20]
  });
});

// Test suite for calculation logic
describe('billStore - Calculation Functions', () => {
    
  // Helper function to set up a basic scenario for calculation tests
  const setupScenario = () => {
    const { addPerson, addItem, setTax } = useBillStore.getState();
    act(() => {
        addPerson('Victor'); // [cite: 8]
        addPerson('Wendy'); // [cite: 8]
        addItem({ name: 'Item A', price: 30, quantity: 1 }); // [cite: 8]
        addItem({ name: 'Item B', price: 50, quantity: 2 }); // [cite: 8] Price=50, Qty=2 -> Total=100
        setTax(13); // Tax is 10% of 130 = 13 [cite: 10]
    });
    const people = useBillStore.getState().people;
    const items = useBillStore.getState().items;
    return { people, items };
  };

  test('should calculate subtotal correctly', () => {
    setupScenario();
    const { getSubtotal } = useBillStore.getState();
    // Subtotal = (30 * 1) + (50 * 2) = 30 + 100 = 130
    expect(getSubtotal()).toBe(130); // [cite: 8]
  });

  test('should calculate grand total correctly (subtotal + tax)', () => {
     // Need people and items assigned for grand total calculation via personTotals
    const { people, items } = setupScenario();
    const { assignItemEqual, getGrandTotal } = useBillStore.getState();

    // Assign items to calculate totals
    act(() => {
        assignItemEqual(items[0].id, [people[0].id]); // Item A to Victor
        assignItemEqual(items[1].id, [people[1].id]); // Item B to Wendy
    });
    
    // Grand Total = Subtotal + Tax = 130 + 13 = 143
    expect(getGrandTotal()).toBe(143); // [cite: 8]
  });

  test('should calculate person totals with EQUAL split', () => {
    const { people, items } = setupScenario();
    const { assignItemEqual, getPersonTotals } = useBillStore.getState();
    const victorId = people.find(p => p.name === 'Victor').id;
    const wendyId = people.find(p => p.name === 'Wendy').id;

    // Assign Item A (30) equally between Victor and Wendy
    act(() => assignItemEqual(items[0].id, [victorId, wendyId])); // [cite: 8]
    // Assign Item B (100) only to Wendy
    act(() => assignItemEqual(items[1].id, [wendyId])); // [cite: 8]
    
    const personTotals = getPersonTotals(); // [cite: 8]
    const victorTotal = personTotals.find(p => p.id === victorId);
    const wendyTotal = personTotals.find(p => p.id === wendyId);

    // Victor: Subtotal = 30 / 2 = 15
    // Wendy: Subtotal = (30 / 2) + 100 = 15 + 100 = 115
    // Total Subtotal = 15 + 115 = 130 (matches getSubtotal)
    expect(victorTotal.subtotal).toBeCloseTo(15);
    expect(wendyTotal.subtotal).toBeCloseTo(115);

    // Tax distribution (Total Tax = 13)
    // Victor's tax = (15 / 130) * 13 = 1.5
    // Wendy's tax = (115 / 130) * 13 = 11.5
    expect(victorTotal.tax).toBeCloseTo(1.5);
    expect(wendyTotal.tax).toBeCloseTo(11.5);

    // Final Totals
    // Victor's Total = 15 + 1.5 = 16.5
    // Wendy's Total = 115 + 11.5 = 126.5
    expect(victorTotal.total).toBeCloseTo(16.5);
    expect(wendyTotal.total).toBeCloseTo(126.5);

    // Grand Total check: 16.5 + 126.5 = 143 (matches getGrandTotal)
    expect(victorTotal.total + wendyTotal.total).toBeCloseTo(143);

    // Check item details within person totals [cite: 22]
    expect(victorTotal.items.length).toBe(1);
    expect(victorTotal.items[0].id).toBe(items[0].id);
    expect(victorTotal.items[0].share).toBeCloseTo(15); // Victor's share of Item A

    expect(wendyTotal.items.length).toBe(2);
    expect(wendyTotal.items.find(i => i.id === items[0].id).share).toBeCloseTo(15); // Wendy's share of Item A
    expect(wendyTotal.items.find(i => i.id === items[1].id).share).toBeCloseTo(100); // Wendy's share of Item B
  });

  test('should calculate person totals with PERCENTAGE split', () => {
    const { people, items } = setupScenario();
    const { assignItemPercentage, getPersonTotals } = useBillStore.getState();
    const victorId = people.find(p => p.name === 'Victor').id;
    const wendyId = people.find(p => p.name === 'Wendy').id;

    // Assign Item A (30) by percentage: Victor 70%, Wendy 30%
    act(() => assignItemPercentage(items[0].id, [ // [cite: 8]
        { personId: victorId, value: 70 },
        { personId: wendyId, value: 30 }
    ]));
    // Assign Item B (100) only to Wendy (equivalent to 100%)
     act(() => assignItemPercentage(items[1].id, [{ personId: wendyId, value: 100 }])); // [cite: 8]
    
    const personTotals = getPersonTotals(); // [cite: 8]
    const victorTotal = personTotals.find(p => p.id === victorId);
    const wendyTotal = personTotals.find(p => p.id === wendyId);

    // Victor: Subtotal = 30 * 0.70 = 21
    // Wendy: Subtotal = (30 * 0.30) + (100 * 1.00) = 9 + 100 = 109
    // Total Subtotal = 21 + 109 = 130
    expect(victorTotal.subtotal).toBeCloseTo(21);
    expect(wendyTotal.subtotal).toBeCloseTo(109);

    // Tax distribution (Total Tax = 13)
    // Victor's tax = (21 / 130) * 13 = 2.1
    // Wendy's tax = (109 / 130) * 13 = 10.9
    expect(victorTotal.tax).toBeCloseTo(2.1);
    expect(wendyTotal.tax).toBeCloseTo(10.9);

    // Final Totals
    // Victor's Total = 21 + 2.1 = 23.1
    // Wendy's Total = 109 + 10.9 = 119.9
    expect(victorTotal.total).toBeCloseTo(23.1);
    expect(wendyTotal.total).toBeCloseTo(119.9);
    
    // Grand Total check: 23.1 + 119.9 = 143
    expect(victorTotal.total + wendyTotal.total).toBeCloseTo(143);

    // Check item details [cite: 22]
     expect(victorTotal.items.length).toBe(1);
     expect(victorTotal.items[0].splitType).toBe(SPLIT_TYPES.PERCENTAGE);
     expect(victorTotal.items[0].allocation).toBe(70);
     expect(victorTotal.items[0].share).toBeCloseTo(21);

     expect(wendyTotal.items.length).toBe(2);
     expect(wendyTotal.items.find(i => i.id === items[0].id).share).toBeCloseTo(9);
     expect(wendyTotal.items.find(i => i.id === items[1].id).share).toBeCloseTo(100);
  });

  test('should calculate person totals with FRACTIONAL split', () => {
    const { people, items } = setupScenario();
    const { assignItemFraction, getPersonTotals } = useBillStore.getState();
    const victorId = people.find(p => p.name === 'Victor').id;
    const wendyId = people.find(p => p.name === 'Wendy').id;

    // Assign Item A (30) fractionally: Victor 2 parts, Wendy 1 part (Total 3 parts)
    act(() => assignItemFraction(items[0].id, [ // [cite: 8]
        { personId: victorId, value: 2 },
        { personId: wendyId, value: 1 }
    ]));
     // Assign Item B (100) only to Wendy (1 part out of 1)
    act(() => assignItemFraction(items[1].id, [{ personId: wendyId, value: 1 }])); // [cite: 8]

    const personTotals = getPersonTotals(); // [cite: 8]
    const victorTotal = personTotals.find(p => p.id === victorId);
    const wendyTotal = personTotals.find(p => p.id === wendyId);

    // Victor: Subtotal = 30 * (2/3) = 20
    // Wendy: Subtotal = (30 * (1/3)) + (100 * (1/1)) = 10 + 100 = 110
    // Total Subtotal = 20 + 110 = 130
    expect(victorTotal.subtotal).toBeCloseTo(20);
    expect(wendyTotal.subtotal).toBeCloseTo(110);

    // Tax distribution (Total Tax = 13)
    // Victor's tax = (20 / 130) * 13 = 2
    // Wendy's tax = (110 / 130) * 13 = 11
    expect(victorTotal.tax).toBeCloseTo(2);
    expect(wendyTotal.tax).toBeCloseTo(11);

    // Final Totals
    // Victor's Total = 20 + 2 = 22
    // Wendy's Total = 110 + 11 = 121
    expect(victorTotal.total).toBeCloseTo(22);
    expect(wendyTotal.total).toBeCloseTo(121);

    // Grand Total check: 22 + 121 = 143
    expect(victorTotal.total + wendyTotal.total).toBeCloseTo(143);

    // Check item details [cite: 22]
     expect(victorTotal.items.length).toBe(1);
     expect(victorTotal.items[0].splitType).toBe(SPLIT_TYPES.FRACTION);
     expect(victorTotal.items[0].allocation).toBe(2);
     expect(victorTotal.items[0].share).toBeCloseTo(20);

     expect(wendyTotal.items.length).toBe(2);
     expect(wendyTotal.items.find(i => i.id === items[0].id).share).toBeCloseTo(10);
     expect(wendyTotal.items.find(i => i.id === items[1].id).share).toBeCloseTo(100);
  });

  test('should apply item discounts in subtotal and person totals', () => {
    const { addPerson, addItem, updateItem, assignItemEqual, getSubtotal, getPersonTotals } = useBillStore.getState();
    act(() => {
      addPerson('Discount Tester');
      addItem({ name: 'Discounted', price: 100, quantity: 1 });
    });
    const state = useBillStore.getState();
    const itemId = state.items[0].id;
    const personId = state.people[0].id;
    act(() => {
      updateItem(itemId, { discount: 10, discountType: 'percentage' });
      assignItemEqual(itemId, [personId]);
    });
    expect(getSubtotal()).toBeCloseTo(90);
    const totals = getPersonTotals();
    const personTotal = totals.find(p => p.id === personId);
    expect(personTotal.subtotal).toBeCloseTo(90);
  });

  test('should handle items with zero consumers in totals calculation', () => {
    setupScenario();
    const { getPersonTotals, getGrandTotal } = useBillStore.getState();
    
    // No items assigned yet
    const personTotals = getPersonTotals(); // [cite: 8]
    expect(personTotals.every(p => p.subtotal === 0 && p.tax === 0 && p.total === 0)).toBe(true);
    expect(getGrandTotal()).toBe(0); // Grand total should be 0 if nothing is assigned
  });

  test('should handle zero tax amount correctly', () => {
    const { people, items } = setupScenario();
    const { setTax, assignItemEqual, getPersonTotals, getGrandTotal } = useBillStore.getState();
    const victorId = people.find(p => p.name === 'Victor').id;

    // Set tax to 0
    act(() => setTax(0)); // [cite: 10]
    // Assign Item A (30) to Victor
    act(() => assignItemEqual(items[0].id, [victorId])); // [cite: 8]

    const personTotals = getPersonTotals(); // [cite: 8]
    const victorTotal = personTotals.find(p => p.id === victorId);

    expect(victorTotal.subtotal).toBeCloseTo(30);
    expect(victorTotal.tax).toBe(0); // Tax should be 0
    expect(victorTotal.total).toBeCloseTo(30); // Total = Subtotal
    expect(getGrandTotal()).toBeCloseTo(30); // Grand total = Subtotal
  });
});

// Test suite for utility helper functions
describe('billStore - Utility Functions', () => {
  beforeEach(() => {
      // Setup basic state for utility tests
      act(() => {
          useBillStore.getState().addPerson('User1'); // [cite: 8]
          useBillStore.getState().addItem({ name: 'Item X', price: 10, quantity: 1 }); // [cite: 8]
          useBillStore.getState().addItem({ name: 'Item Y', price: 20, quantity: 1 }); // [cite: 8]
      });
  });

  test('isItemAssigned should return true if item has consumers, false otherwise', () => {
    const { assignItemEqual, isItemAssigned } = useBillStore.getState();
    const people = useBillStore.getState().people;
    const items = useBillStore.getState().items;
    const user1Id = people[0].id;
    const itemXId = items.find(i => i.name === 'Item X').id;
    const itemYId = items.find(i => i.name === 'Item Y').id;

    expect(isItemAssigned(itemXId)).toBe(false); // Initially false
    expect(isItemAssigned(itemYId)).toBe(false);

    // Assign Item X
    act(() => assignItemEqual(itemXId, [user1Id])); // [cite: 8]

    expect(isItemAssigned(itemXId)).toBe(true); // Should be true now
    expect(isItemAssigned(itemYId)).toBe(false); // Item Y still false
  });

  test('areAllItemsAssigned should return true only if all items have consumers', () => {
    const { assignItemEqual, areAllItemsAssigned } = useBillStore.getState();
    const people = useBillStore.getState().people;
    const items = useBillStore.getState().items;
    const user1Id = people[0].id;
    const itemXId = items.find(i => i.name === 'Item X').id;
    const itemYId = items.find(i => i.name === 'Item Y').id;

    expect(areAllItemsAssigned()).toBe(false); // Initially false

    // Assign Item X
    act(() => assignItemEqual(itemXId, [user1Id])); // [cite: 8]
    expect(areAllItemsAssigned()).toBe(false); // Still false

    // Assign Item Y
    act(() => assignItemEqual(itemYId, [user1Id])); // [cite: 8]
    expect(areAllItemsAssigned()).toBe(true); // Should be true now
  });

  test('getUnassignedItems should return only items with no consumers', () => {
    const { assignItemEqual, getUnassignedItems } = useBillStore.getState();
    const people = useBillStore.getState().people;
    const items = useBillStore.getState().items;
    const user1Id = people[0].id;
    const itemXId = items.find(i => i.name === 'Item X').id;
    const itemYId = items.find(i => i.name === 'Item Y').id;

    expect(getUnassignedItems().length).toBe(2); // Both initially unassigned

    // Assign Item X
    act(() => assignItemEqual(itemXId, [user1Id])); // [cite: 8]
    const unassigned = getUnassignedItems();
    expect(unassigned.length).toBe(1);
    expect(unassigned[0].id).toBe(itemYId); // Only Item Y should remain
  });

  test('validateAllocations should validate percentage and fractional splits', () => {
      const { validateAllocations } = useBillStore.getState();
      
      // Percentage: Sum must be close to 100
      expect(validateAllocations([{ value: 50 }, { value: 50 }], SPLIT_TYPES.PERCENTAGE)).toBe(true);
      expect(validateAllocations([{ value: 50.005 }, { value: 49.995 }], SPLIT_TYPES.PERCENTAGE)).toBe(true); // Check tolerance
      expect(validateAllocations([{ value: 60 }, { value: 50 }], SPLIT_TYPES.PERCENTAGE)).toBe(false);
      expect(validateAllocations([{ value: -10 }, { value: 110 }], SPLIT_TYPES.PERCENTAGE)).toBe(false); // Check negatives (although should sum to 100)

      // Fraction: All values must be positive
      expect(validateAllocations([{ value: 1 }, { value: 2 }], SPLIT_TYPES.FRACTION)).toBe(true);
      expect(validateAllocations([{ value: 0.5 }, { value: 1.5 }], SPLIT_TYPES.FRACTION)).toBe(true);
      expect(validateAllocations([{ value: 1 }, { value: 0 }], SPLIT_TYPES.FRACTION)).toBe(false); // Zero is invalid
      expect(validateAllocations([{ value: 1 }, { value: -1 }], SPLIT_TYPES.FRACTION)).toBe(false); // Negative is invalid

      // Equal (or other types): Should also pass if values are positive (representing participation)
      expect(validateAllocations([{ value: 1 }, { value: 1 }], SPLIT_TYPES.EQUAL)).toBe(true);
      expect(validateAllocations([{ value: 1 }], 'unknown_type')).toBe(true); // Default validation

      // Empty or invalid inputs
      expect(validateAllocations([], SPLIT_TYPES.PERCENTAGE)).toBe(false);
      expect(validateAllocations(null, SPLIT_TYPES.FRACTION)).toBe(false);
  });

  test('getItemSplitDetails should return split type and allocations for an item', () => {
     const { assignItemPercentage, getItemSplitDetails } = useBillStore.getState();
     const people = useBillStore.getState().people;
     const items = useBillStore.getState().items;
     const user1Id = people[0].id;
     const itemXId = items.find(i => i.name === 'Item X').id;

     // Assign percentage split
     const allocations = [{ personId: user1Id, value: 100 }];
     act(() => assignItemPercentage(itemXId, allocations)); // [cite: 8]

     const details = getItemSplitDetails(itemXId);
     expect(details).toEqual({
         splitType: SPLIT_TYPES.PERCENTAGE,
         allocations: allocations
     });

     // Test non-existent item
     expect(getItemSplitDetails('non-existent-id')).toBeNull();
  });
});

// Test suite for custom hooks selectors
describe('billStore - Custom Hooks (Selectors)', () => {

  test('useBillPersons should return the people array', () => {
    const { result } = renderHook(() => useBillPersons());
    expect(result.current).toEqual([]); // Initially empty

    act(() => { useBillStore.getState().addPerson('Hook Tester'); }); // [cite: 8]
    
    // Re-render or access latest state - renderHook handles updates
    expect(result.current.length).toBe(1);
    expect(result.current[0].name).toBe('Hook Tester');
  });

  test('useBillItems should return the items array', () => {
    const { result } = renderHook(() => useBillItems());
    expect(result.current).toEqual([]);

    act(() => { useBillStore.getState().addItem({ name: 'Hook Item', price: 1 }); }); // [cite: 8]
    
    expect(result.current.length).toBe(1);
    expect(result.current[0].name).toBe('Hook Item');
  });

  test('useBillStep should return the current step', () => {
    const { result } = renderHook(() => useBillStep());
    expect(result.current).toBe(1);

    act(() => { useBillStore.getState().nextStep(); }); // [cite: 8]
    expect(result.current).toBe(2);
  });
  
  test('useBillCurrency should return the current currency', () => {
    const { result } = renderHook(() => useBillCurrency());
    expect(result.current).toBe('INR'); // Or your default/detected

    act(() => { useBillStore.getState().setCurrency('EUR'); });
    expect(result.current).toBe('EUR');
  });
  
   test('useBillTitle should return the current title', () => {
    const { result } = renderHook(() => useBillTitle());
    expect(result.current).toBe('');

    act(() => { useBillStore.getState().setTitle('Hook Title Test'); }); // [cite: 9]
    expect(result.current).toBe('Hook Title Test');
  });
  
   test('useBillTaxAmount should return the current tax amount', () => {
    const { result } = renderHook(() => useBillTaxAmount());
    expect(result.current).toBe(0);

    act(() => { useBillStore.getState().setTax(9.99); }); // [cite: 10]
    expect(result.current).toBe(9.99);
  });
  
  test('useBillPersonTotals should return calculated person totals', () => {
    // Setup state within the hook's context
    act(() => {
        useBillStore.getState().addPerson('Total Tester'); // [cite: 8]
        useBillStore.getState().addItem({ name: 'Total Item', price: 50, quantity: 1 }); // [cite: 8]
        useBillStore.getState().setTax(5); // [cite: 10]
        const people = useBillStore.getState().people;
        const items = useBillStore.getState().items;
        useBillStore.getState().assignItemEqual(items[0].id, [people[0].id]); // [cite: 8]
    });

    const { result } = renderHook(() => useBillPersonTotals());
    
    expect(result.current.length).toBe(1);
    expect(result.current[0].name).toBe('Total Tester');
    expect(result.current[0].subtotal).toBe(50);
    expect(result.current[0].tax).toBe(5);
    expect(result.current[0].total).toBe(55);
  });

  test('useBillSubtotal should return the calculated subtotal', () => {
     act(() => {
        useBillStore.getState().addItem({ name: 'Sub Item 1', price: 10, quantity: 2 }); // 20 [cite: 8]
        useBillStore.getState().addItem({ name: 'Sub Item 2', price: 5, quantity: 1 });  // 5 [cite: 8]
    });
    const { result } = renderHook(() => useBillSubtotal());
    expect(result.current).toBe(25);
  });
  
  test('useBillGrandTotal should return the calculated grand total', () => {
    act(() => {
        useBillStore.getState().addPerson('Grand Tester'); // [cite: 8]
        useBillStore.getState().addItem({ name: 'Grand Item', price: 100, quantity: 1 }); // [cite: 8]
        useBillStore.getState().setTax(10); // [cite: 10]
        const people = useBillStore.getState().people;
        const items = useBillStore.getState().items;
        useBillStore.getState().assignItemEqual(items[0].id, [people[0].id]); // [cite: 8]
    });
    const { result } = renderHook(() => useBillGrandTotal());
     expect(result.current).toBe(110); // 100 (subtotal) + 10 (tax)
  });
});