# AGENTS Instructions

This repository contains the Bill Splitter application. The following context provides an overview of the project. **Whenever you add new features or modify the project structure, update this file with relevant information.**

# Bill Splitter - Technical Overview

## 1. Project Overview

### Application Purpose
Bill Splitter is an intuitive React application that simplifies the process of splitting bills among multiple people. It guides users through a step-by-step process of adding people, entering items, assigning consumption with flexible splitting options, and calculating final totals including tax.

### Tech Stack
- **Framework**: React 19
- **State Management**: Zustand with IndexedDB persistence
- **Styling**: Tailwind CSS 4.0
- **Build Tool**: Vite 6.2
- **Testing Framework**: Jest with React Testing Library
- **Language**: JavaScript (ES6+)
- **Deployment**: GitHub Pages (via gh-pages branch and docs folder)

### Environment Setup
The application has two environment configurations:

- **Development Environment** (`.env`):
  ```
  VITE_WORKER_URL="http://localhost:8787"
  ```

- **Production Environment** (`.env.production`):
  ```
  VITE_WORKER_URL="https://bill-processor.satlavida.workers.dev"
  ```

This configuration allows for different API endpoints based on the environment, with the worker URL being used for receipt scanning functionality.

## 2. Folder Structure

```
bill-splitter/
├── src/                    # Source code
│   ├── assets/             # Static assets
│   ├── Components/         # React components
│   │   ├── PassAndSplit/   # Pass and Split feature components
│   │   │   └── stores/     # Pass and Split specific state
│   │   ├── Sidebar/        # Sidebar components
│   │   │   ├── index.js    # Exports for Sidebar components
│   │   │   ├── Sidebar.jsx # Main sidebar component
│   │   │   ├── SidebarItem.jsx # Individual sidebar item
│   │   │   └── HamburgerButton.jsx # Toggle button for sidebar
│   ├── ui/                 # UI component library
│   ├── App.jsx             # Main application component
│   ├── App.css             # Global styles
│   ├── ThemeContext.jsx    # Theme context provider
│   ├── billStore.js        # Main state store
│   ├── currencyStore.js    # Currency formatting store
│   └── main.jsx            # Application entry point
├── public/                 # Public assets
├── docs/                   # Build output for GitHub Pages
├── .env                    # Development environment variables
├── .env.production         # Production environment variables
└── vite.config.js          # Vite configuration
```

The project follows a component-based architecture with feature-specific directories. Components are organized into logical groups, with shared UI components in the `ui` directory and feature-specific components in dedicated directories.

## 3. Libraries and Tools

### Production Dependencies
- **React**: UI framework for building the interface (v19.0.0)
- **React DOM**: DOM-specific methods for React (v19.0.0)
- **Zustand**: State management with persistence (v5.0.3)
- **idb-keyval**: IndexedDB wrapper for offline persistence (v6.2.1)
- **Tailwind CSS**: Utility-first CSS framework (v4.0.10)
- **vite-plugin-pwa**: PWA integration for Vite

### Development Dependencies
- **Vite**: Build tool and development server (v6.2.0)
- **@vitejs/plugin-react**: React plugin for Vite (v4.3.4)
- **@tailwindcss/vite**: Tailwind CSS plugin for Vite (v4.0.10)
- **ESLint**: Linting tool with React plugins (v9.21.0)
- **Jest**: Testing framework (v29.7.0)
- **React Testing Library**: Testing utilities for React (v16.3.0)
- **Babel**: JavaScript compiler (v7.26.9)
- **PostCSS**: CSS post-processor (v8.5.3)
- **Autoprefixer**: PostCSS plugin for vendor prefixes (v10.4.20)

## 4. State Management

The application uses Zustand for state management with IndexedDB persistence (via idb-keyval). There are two main stores:

### billStore.js
The central store for all bill-related data and logic.

#### Key States:
- `step`: Current step in the bill splitting process (1-4)
- `people`: Array of people splitting the bill
- `items`: Array of bill items with enhanced split options
- `sections`: Array of labeled sections; items without a section belong to a default unlabeled section
- `taxAmount`: Tax amount for the default unlabeled section
- `title`: Title of the bill (e.g., restaurant name)
- `currency`: Currency for formatting (defaults to 'INR')

#### Key Actions:
- Navigation:
  - `nextStep()`: Increments step by 1 (max 4)
  - `prevStep()`: Decrements step by 1 (min 1)
  - `goToStep(step: number)`: Sets current step to specified value
  
- People Management:
  - `addPerson(name: string)`: Adds a new person with generated ID and returns the new person object
  - `removePerson(id: string)`: Removes a person by ID and removes them from all item assignments
  - `updatePerson(id: string, name: string)`: Updates a person's name
  
- Item Management:
  - `addItem(item: {name: string, price: number, quantity: number})`: Adds a new item with generated ID
  - `removeItem(id: string)`: Removes an item by ID
  - `updateItem(id: string, data: {name?: string, price?: number, quantity?: number})`: Updates an item's properties
  - `assignItemToSection(itemId: string, sectionId: string|null)`: Assigns an item to a labeled section or to default when `null`
  - `setTax(amount: number|string)`: Sets the tax amount for the default unlabeled section, converting to float if needed

- Section Management:
  - `addSection(section: {name: string, taxAmount?: number, paidByPersonId?: string|null})`: Adds a labeled section (with future `paidByPersonId`)
  - `updateSection(id: string, data: {name?: string, taxAmount?: number, paidByPersonId?: string|null})`: Updates a section
  - `removeSection(id: string)`: Removes a section and moves its items to the default unlabeled section
  
- Split Types:
  - `setSplitType(itemId: string, splitType: string)`: Sets split type for an item ('equal', 'percentage', 'fraction')
  - `assignItemEqual(itemId: string, peopleIds: string[])`: Assigns item equally among specified people
  - `assignItemPercentage(itemId: string, allocations: {personId: string, value: number}[])`: Assigns item by percentage
  - `assignItemFraction(itemId: string, allocations: {personId: string, value: number}[])`: Assigns item by fractional parts
  
- Assignment:
  - `assignAllPeopleEqual(itemId: string)`: Assigns item equally to all people
  - `removeAllPeople(itemId: string)`: Removes all people from an item
  
- Calculation:
  - `getPersonTotals()`: Returns array of person totals. Taxes are computed per section and distributed proportionally within each section (default section uses global `taxAmount`).
  - `getSectionsSummary()`: Returns array of `{ id, name, subtotal, tax, total, paidByPersonId }` including the default unlabeled section when applicable
  - `getSubtotal()`: Returns sum of all item prices × quantities
  - `getGrandTotal()`: Returns sum of person totals
  
- Settings:
  - `setCurrency(currency: string)`: Sets the currency code
  - `setTitle(title: string)`: Sets the bill title
  
- Utility:
  - `isItemAssigned(itemId: string)`: Returns boolean indicating if item has any consumers
  - `areAllItemsAssigned()`: Returns boolean indicating if all items have consumers
  - `getUnassignedItems()`: Returns array of items with no consumers
  - `validateAllocations(allocations: {value: number}[], splitType: string)`: Validates allocation values for a split type

#### Custom Hooks:
- `useBillPersons`: Access people array with stable reference
- `useBillItems`: Access items array with stable reference
- `useBillPersonTotals`: Get calculated person totals
- `useDocumentTitle`: Update document title based on bill title
- `useBillSections`: Access sections array with stable reference

### currencyStore.js
Manages currency-related state and formatting.

#### Key States:
- `currency`: Current currency code (detected from browser locale or defaults to 'USD')

#### Key Actions:
- `formatCurrency(amount: number)`: Formats a number as currency based on current currency code and locale, returns a formatted string
- `changeCurrency(newCurrency: string)`: Updates the currency code

#### Custom Hooks:
- `useFormatCurrency()`: Returns the formatCurrency function with a stable reference using useShallow

### passAndSplitStore.js
Manages state for the Pass and Split feature.

#### Key States:
- `isActive`: Whether Pass and Split mode is active (boolean)
- `currentPersonId`: ID of currently selecting person (string)
- `completedPersonIds`: Array of IDs of people who have completed (string[])
- `remainingPersonIds`: Array of IDs of people who haven't gone yet (string[])
- `stage`: Current UI stage ('personSelection', 'itemSwiping', 'completion')
- `itemQueue`: Array of item IDs yet to be shown (string[])
- `pendingAssignments`: Object mapping person IDs to arrays of item IDs ({[personId: string]: string[]})

#### Key Actions:
- `activate()`: Activates Pass and Split mode, resets all state
- `deactivate()`: Deactivates mode and resets all state
- `selectPerson(personId: string)`: Sets current person and prepares their item queue
- `assignCurrentItem()`: Marks current item as consumed by current person, removes from queue
- `skipCurrentItem()`: Removes current item from queue without assigning
- `completeCurrentPerson()`: Marks current person as completed, commits their assignments, moves to next stage
- `resetCurrentPerson()`: Resets current person's selections and returns to person selection
- `commitAssignmentsForPerson(personId: string)`: Commits a specific person's assignments to main bill store
- `commitAssignments()`: Commits all pending assignments to main bill store
- `addNewPerson(name: string)`: Adds a new person to the bill and selects them

## 5. Styling System

### Approach
The application uses Tailwind CSS for styling with dark mode support. The styling approach is utility-first, with reusable UI components in the `ui/components.jsx` file.

### Theme Management
Theme management is handled via React Context API in `ThemeContext.jsx`. The application supports light and dark modes.

#### Key Features:
- Theme persistence in localStorage
- System preference detection on initial load
- Dark mode toggle with smooth transitions
- Theme-aware components with proper color variables

#### Theme Provider:
```jsx
<ThemeProvider>
  <AppContent />
</ThemeProvider>
```

#### Theme Hook:
```jsx
const { theme, toggleTheme, isDark, isLight } = useTheme();
```

### Adding New Styles
To add new styles:
1. Use Tailwind utility classes directly in component JSX
2. For theme-aware styles, use the `dark:` prefix for dark mode variants
3. For transitions, use `transition-colors` or other transition utilities
4. For complex components, create reusable UI components in `ui/components.jsx`

## 6. Components

### Key Reusable Components

#### UI Components (`src/ui/components.jsx`)
- `Button`: 
  - Props: `children`, `variant` ('primary', 'secondary', 'danger', 'success'), `size` ('sm', 'md', 'lg'), `disabled`, `onClick`, `type`, `className`
  - Purpose: Consistent styled button with theme awareness

- `Input`: 
  - Props: `label`, `type`, `error`, `className`, `containerClassName`, `required`, `ref`, and other input attributes
  - Purpose: Form input with label and error handling

- `Card`: 
  - Props: `children`, `className`
  - Purpose: Container with consistent styling and theme support

- `ToggleButton`: 
  - Props: `selected`, `onClick`, `children`, `className`
  - Purpose: Toggle button for selection states

- `PrintButton`: 
  - Props: `onClick`
  - Purpose: Button with print icon for printing functionality

- `SelectAllButton`: 
  - Props: `allSelected`, `onSelectAll`, `onDeselectAll`, `className`
  - Purpose: Button that toggles between select all/deselect all states

  - `PrintWrapper`: 
  - Props: `children`
  - Purpose: Wrapper for content that needs print-specific styling

- `Modal`: 
  - Props: `isOpen`, `onClose`, `title`, `children`, `className`
  - Purpose: Accessible modal dialog with backdrop

- `FileUpload`: 
  - Props: `label`, `accept`, `onChange`, `error`, `containerClassName`, `ref`
  - Purpose: Styled file upload input with error handling

- `Spinner`: 
  - Props: `size` ('sm', 'md', 'lg'), `className`
  - Purpose: Loading spinner animation

- `Alert`: 
  - Props: `type` ('info', 'success', 'warning', 'error'), `children`, `className`
  - Purpose: Themed alert message for notifications

- `Dropdown`:
  - Props: `options` ({ value, label }[]), `value`, `onChange(value)`, `placeholder`, `className`, `buttonClassName`, `disabled`
  - Purpose: Custom-styled select replacement for better UI/UX and keyboard/mouse control

#### Sidebar Components (`src/Components/Sidebar`)
- `Sidebar`: 
  - Props: `isOpen`, `onToggle`, `items`, `activeItemId`, `onItemClick`
  - Purpose: Main sidebar container that shows navigation items

- `SidebarItem`: 
  - Props: `icon`, `label`, `isActive`, `onClick`, `id`
  - Purpose: Individual navigation item in the sidebar

- `HamburgerButton`: 
  - Props: `onClick`, `isOpen`
  - Purpose: Button to toggle the sidebar visibility

#### Feature Components
- `StepIndicator`: 
  - Purpose: Shows current step in the bill splitting process

- `Header`: 
  - Props: `toggleSidebar`, `isSidebarOpen`
  - Purpose: App header with hamburger menu and theme switcher

- `EditableTitle`: 
  - Props: `title`, `onSave`, `placeholder`
  - Purpose: In-place editable title component with edit/display modes

- `ThemeSwitcher`: 
  - Props: None
  - Purpose: Toggle button between light and dark themes using ThemeContext

- `BillTotalsSummary`: 
  - Props: `subtotal`, `taxAmount`, `grandTotal`, `className`, `formatCurrency`
  - Purpose: Reusable component for displaying bill financial totals
  - Note: When sections exist, the taxAmount passed is the sum of all section taxes (including the default unlabeled section tax)

- `EditPersonModal`: 
  - Props: `isOpen`, `onClose`, `person`, `onSave`
  - Purpose: Modal dialog for editing person name

- `EditItemModal`: 
  - Props: `isOpen`, `onClose`, `item`, `onSave`
  - Purpose: Modal dialog for editing item name, price, and quantity
  - Now includes a Section chooser using the `Dropdown` component

- `SectionsManager` (within `ItemsInput.jsx`):
  - Props: managed internally via store actions
  - Purpose: Create/update/delete labeled sections and set per-section taxes

- Item Section Selector (within `ItemsInput.jsx` list):
  - Purpose: Assign each item to a labeled section or leave it in the default unlabeled section

- `SplitTypeDrawer`: 
  - Props: `isOpen`, `onClose`, `item`, `people`, `onSave`
  - Purpose: Bottom drawer for configuring how an item's cost is split

- `PercentageSplitInput`: 
  - Props: `people`, `allocations`, `onSave`, `onCancel`
  - Purpose: Input interface for percentage-based splits

- `FractionalSplitInput`: 
  - Props: `people`, `allocations`, `onSave`, `onCancel`
  - Purpose: Input interface for fractional-based splits

- `ScanReceiptButton`: 
  - Props: None
  - Purpose: Button that triggers receipt scanning workflow with file upload

- `PassAndSplitButton`: 
  - Props: None
  - Purpose: Button that opens the Pass and Split modal interface

- `ItemCard` (in ItemAssignment): 
  - Props: `item`, `people`, `onTogglePerson`, `formatCurrency`, `onOpenSplitDrawer`
  - Purpose: Card showing item details with people assignment controls

### Component Conventions
- Components are organized by feature in the `Components` directory
- Reusable UI components are in the `ui` directory
- Each component has a single responsibility
- Components are memoized for performance where appropriate
- Props are destructured and typed with defaults
- Theme-awareness is built into components

### Props Patterns
- Props are destructured with defaults
- Optional props use default values
- Callback props use `handle` prefix
- Event handlers use `on` prefix
- Children are used for composable components
- Ref forwarding is used where necessary

### Component Structure Guidelines
1. Import dependencies and hooks
2. Define memo-wrapped subcomponents if needed
3. Define the main component with descriptive props
4. Use hooks at the top level
5. Define handler functions
6. Return JSX with proper semantic structure
7. Export the component (default export)

Example:
```jsx
import React, { memo, useState, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { Button } from '../ui/components';
import useBillStore from '../billStore';

const ComponentName = ({ prop1, prop2 = defaultValue }) => {
  // Hooks
  const { state, action } = useBillStore(useShallow(state => ({
    state: state.something,
    action: state.doSomething
  })));
  
  // State and handlers
  const [localState, setLocalState] = useState(initialValue);
  
  const handleClick = useCallback(() => {
    // Handle the click
  }, [dependencies]);
  
  // Render
  return (
    <div className="theme-aware-class dark:theme-dark-variant">
      <Button onClick={handleClick}>Action</Button>
    </div>
  );
};

export default ComponentName;
```
## 7. API & Data Fetching

### Receipt Scanning API

The application uses a single API endpoint for scanning receipts, configured through environment variables:

```javascript
const API_URL = import.meta.env.VITE_WORKER_URL;
```

#### Implementation
The API is accessed in `ScanReceiptButton.jsx` using the Fetch API with the following pattern:

```javascript
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
  mode: 'cors',
});
```

#### Request Format
The API expects a base64-encoded image and returns parsed receipt data:

```javascript
const payload = {
  image: {
    base64Data: "...",
    mimeType: "image/jpeg"
  }
};
```

#### Response Format
The API returns a JSON object with items and tax information:

```javascript
{
  items: [
    { name: "Item Name", price: 10.99, quantity: 1 },
    // ...more items
  ],
  tax: 1.23
}
```

### Data Persistence
Data is persisted locally using Zustand's persist middleware with IndexedDB (via idb-keyval). No other API calls or data fetching mechanisms are present in the application.

## 8. Routing

The application does not use traditional routing as it's a single-page application with a step-based flow. Navigation between steps is managed by the `billStore` state:

```javascript
const step = useBillStore(state => state.step);
const nextStep = useBillStore(state => state.nextStep);
const prevStep = useBillStore(state => state.prevStep);
const goToStep = useBillStore(state => state.goToStep);
```

The application has 4 main steps:
1. People Input (`PeopleInput.jsx`)
2. Items Input (`ItemsInput.jsx`)
3. Item Assignment (`ItemAssignment.jsx`)
4. Bill Summary (`BillSummary.jsx`)

The appropriate component is rendered based on the current step:

```jsx
const renderStep = () => {
  switch(step) {
    case 1: return <PeopleInput />;
    case 2: return <ItemsInput />;
    case 3: return <ItemAssignment />;
    case 4: return <BillSummary />;
    default: return <PeopleInput />;
  }
};
```

Additionally, the app now uses the sidebar for navigation between steps, with the sidebar items corresponding to the application steps.

## 9. Build & Deployment

### Build Toolchain
The application uses Vite as the build tool with several plugins:

- `@vitejs/plugin-react`: React support
- `@tailwindcss/vite`: Tailwind CSS integration
- `vite-plugin-pwa`: PWA support

### Build Configuration
The build is configured in `vite.config.js`:

```javascript
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({...})],
  base: './',
  build: {
    outDir: 'docs/'
  },
  resolve: {
    alias: {
      src: "/src",
      components: "/src/Components",
      ui: "/src/ui",
    },
  },
});
```

### Deployment
The application is deployed to GitHub Pages using a custom deploy script (`deploy.sh`):

1. Creates or switches to the `gh-pages` branch
2. Merges the latest changes from the main branch
3. Builds the project with `npm run build`
4. Commits and forces push to the `gh-pages` branch

### Environment Variables
Environment variables are managed using `.env` files:
- `.env` for development
- `.env.production` for production

These files configure the API endpoint for receipt scanning.

### Scripts
The following npm scripts are available:
- `npm run dev`: Start development server
- `npm run dev:open`: Start server and open in browser
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run test`: Run tests
- `npm run lint`: Run ESLint

## 10. Testing & Linting

### Testing Framework
The project uses Jest with React Testing Library for testing.

#### Test Files:
- `src/billStore.test.js`: Tests for the bill store

#### Test Configuration:
- `jest.config.js`: Jest configuration
- `jest.setup.js`: Jest setup with DOM testing extensions
- `babel.config.js`: Babel configuration for tests

### Linting
The project uses ESLint for linting with React-specific plugins.

#### Linting Configuration:
- `eslint.config.js`: ESLint configuration with React hooks and refresh plugins

### Testing Guidelines
- Tests focus on behavior rather than implementation
- Tests are organized around features and use cases
- Jest matchers and React Testing Library utilities are used
- Tests verify state changes and component rendering

## 11. Recent Changes: Sidebar Implementation

### Sidebar Components

The sidebar implementation is located in the `Components/Sidebar` folder and consists of:

1. **Sidebar.jsx** - The main sidebar component that receives:
   - `isOpen`: Boolean to control sidebar visibility
   - `onToggle`: Function to toggle sidebar state
   - `items`: Array of sidebar item objects
   - `activeItemId`: ID of the currently active item
   - `onItemClick`: Function to handle item clicks

2. **SidebarItem.jsx** - Individual navigation item component:
   - `icon`: React element for the item icon
   - `label`: Text label for the item
   - `isActive`: Boolean indicating if this item is active
   - `onClick`: Function called when item is clicked
   - `id`: Unique identifier for the item

3. **HamburgerButton.jsx** - Toggle button for showing/hiding the sidebar:
   - `onClick`: Function to toggle sidebar
   - `isOpen`: Boolean indicating sidebar state

### Sidebar State in App.jsx

The App component now manages the sidebar state:

- `isSidebarOpen`: Boolean state to control sidebar visibility
- `toggleSidebar`: Function to toggle the sidebar
- Persistence of sidebar state in localStorage
- Conditional layout classes based on sidebar state
- Handling of item clicks to navigate between steps

### Sidebar Items Structure

Sidebar items are defined as an array of objects with the following structure:

```javascript
{
  id: 1, // or string ID for non-step items
  label: "Add People", // Display text
  icon: <SvgIcon /> // React element for the icon
}
```

The active item is determined by matching the current application step with item IDs.

### Mobile Responsiveness

The sidebar is responsive with different behaviors on mobile and desktop:

- On desktop: Collapsible sidebar with expanded (64px) or icon-only (16px) mode
- On mobile: Full-width sidebar (256px) that slides in/out with overlay background
- Auto-close on navigation for mobile devices
- Keyboard accessibility (Escape key closes)
- Click outside to close on mobile

### CSS Changes

The App.css file has been updated with new styles for the sidebar:

- Mobile-specific styles for width and transform
- Smooth transitions for opening/closing animations
- Print styles to hide sidebar when printing
- Accessibility focus styles

## 11.1 Recent Changes: Sections Support

- Added labeled Sections support with per-section taxes and a default unlabeled section using the global tax input.
- Items can be assigned to a section; items without a section belong to the default unlabeled section.
- New store state: `sections` with actions `addSection`, `updateSection`, `removeSection`, and `assignItemToSection`.
- Person totals now compute tax per section and distribute it proportionally to consumers within that section.
- ItemsInput now includes a Sections manager and per-item Section selector.
- Bill Summary displays a Sections breakdown (section subtotal, tax, total).
- Introduced `paidByPersonId` field on sections for future use (not yet used in calculations).

### 11.2 UI Changes to Items Input
- Items are now displayed under Section headings (default unlabeled section at top followed by labeled sections).
- You can move items between sections using native HTML drag-and-drop by dragging an item into a section's drop area, or by using the Edit Item modal’s section chooser.
- SectionsManager remains for creating, renaming, removing sections and setting per-section taxes.
- Section drop areas highlight on drag-over for better affordance.
- When the “Show Post-tax price for item” setting is enabled, a small “incl. tax” badge appears next to each item’s displayed price.

### 11.3 Settings
- Added a setting in `Settings` (Options) page: “Show Post-tax price for item”.
- When enabled, the Items list shows each item’s total including its proportion of the section/global tax based on the current inputs.

### 11.4 ItemsInput UX and Tax Behavior
- Sections Manager is now collapsed by default on the Items step. A button toggles visibility with labels "Add New Section" and "Hide Add New Section". When opened, it reveals the Sections Manager for creating/updating/removing sections and setting per-section taxes.
- Global tax (default unlabeled section) is only applied when there are items in the default section. Labeled sections apply their own tax only when those sections contain items. This treats each section like a mini-bill and prevents double-applying tax to default-section items.
- The Items step totals now include only the taxes for sections that have a non-zero subtotal (default tax included only when default section has items). A "Taxes Applied" breakdown now lists per-section taxes and shows the Global Tax as the last item.

## 12. Guidelines & Conventions

### Naming Conventions
- **Components**: PascalCase, named after their purpose (e.g., `PeopleInput`)
- **Files**: Match component names (e.g., `PeopleInput.jsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useTheme`)
- **State Actions**: camelCase, descriptive verbs (e.g., `addPerson`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `SPLIT_TYPES`)

### Code Style
- **Imports**: Group by external, internal, and relative paths
- **Props**: Destructure with defaults
- **State**: Use Zustand with `useShallow` for performance
- **Effects**: Keep dependencies accurate and minimal
- **Memoization**: Use `memo`, `useCallback`, and `useMemo` appropriately
- **Event Handlers**: Prefix with `handle` or `on`

### Component Guidelines
1. **Reusability**: Create reusable components for UI patterns
2. **Single Responsibility**: Each component should do one thing well
3. **Memoization**: Memoize components and handlers for performance
4. **Theme Awareness**: Support both light and dark modes
5. **Accessibility**: Use semantic HTML and ARIA attributes
6. **State Management**: Use Zustand for shared state, local state for UI

### Data Structure Guidelines
The application uses the following data structures:

#### Person Object
```javascript
{
  id: string,
  name: string
}
```

#### Item Object
```javascript
{
  id: string,
  name: string,
  price: number,
  quantity: number,
  consumedBy: Array<string | {personId: string, value: number}>, // Enhanced to support split types
  splitType: 'equal' | 'percentage' | 'fraction', // From SPLIT_TYPES
  sectionId: string | null // Section membership; null for default unlabeled
}
```

#### Section Object
```javascript
{
  id: string,
  name: string,
  taxAmount: number,
  paidByPersonId: string | null // not yet used in calculations
}
```

#### Person Totals Object (calculated)
```javascript
{
  id: string,
  name: string,
  items: [
    {
      id: string,
      name: string,
      price: number,
      quantity: number,
      splitType: string, // Split type used
      allocation: number, // Person's allocation value based on split type
      share: number, // Final price per person based on split type
      sectionId: string | null,
      sectionName: string
    }
  ],
  subtotal: number,
  tax: number,
  total: number
}
```

#### Bill Metadata
```javascript
{
  createdAt: string,      // UTC ISO timestamp when the bill was created
  updatedAt: string,      // UTC ISO timestamp of the last modification
  lastSyncedAt: string | null // UTC ISO timestamp when last synced or null
}
```

#### Sidebar Item Object
```javascript
{
  id: number | string, // Step number or feature identifier
  label: string, // Display text
  icon: React.ReactNode // SVG icon as React element
}
```

### Future Development
Based on project documentation, planned features include:
1. Export bills in CSV and JSON formats
2. Support for multiple currencies
3. Bill history for tracking past expenses
4. Settings page for application configuration
