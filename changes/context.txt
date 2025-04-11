# Bill Splitter Application - Context Document

## Project Overview

Bill Splitter is a React application that helps users split bills among multiple people. The application guides users through a step-by-step process of adding people, items, assigning consumption with flexible splitting options, and calculating the final totals including tax. The app uses a modern React stack with Zustand for state management, Context API for theme management, and Tailwind CSS for styling.

## Core Technologies and Project Structure

- **Framework**: React 19
- **State Management**: Zustand with persistence
- **Styling**: Tailwind CSS 4.0
- **Build Tool**: Vite 6.2
- **Deployment**: GitHub Pages (via gh-pages branch and docs folder)
- **Persistence**: localStorage

## Environment Configuration

The application has two environment configurations:

- `.env`: Development environment - Points to a local worker endpoint
  ```
  VITE_WORKER_URL="http://localhost:8787"
  ```

- `.env.production`: Production environment - Points to a production Cloudflare Worker
  ```
  VITE_WORKER_URL=https://bill-processor.satlavida.workers.dev
  ```

## Key Files and Dependencies

### Entry Points and Configuration

#### `index.html`
- Main HTML entry point
- Mounts the React application to `#root`
- References `src/main.jsx` as the script entry point

#### `main.jsx`
- React application entry point
- Renders the `App` component in `StrictMode`
- Dependencies: `react`, `react-dom`, `App.jsx`

#### `vite.config.js`
- Vite build configuration
- Configures React plugin and Tailwind CSS
- Sets the output directory to `docs` for GitHub Pages compatibility
- Dependencies: `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`

#### `eslint.config.js`
- ESLint configuration for the project
- Sets up rules and plugins for React
- Dependencies: `@eslint/js`, `globals`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`

### Core Application Files

#### `App.jsx`
- Main application component
- Contains the application layout and step-based routing
- Manages the current step and renders the appropriate component
- Dependencies:
  - `ThemeContext.jsx`: For theme management
  - `ThemeSwitcher.jsx`: For toggling between light and dark modes
  - `billStore.js`: For global state management
  - Step components: `PeopleInput`, `ItemsInput`, `ItemAssignment`, `BillSummary`
- Key Components:
  - `StepIndicator`: Shows progress through the app workflow
  - `Header`: Contains app title and theme switcher
  - `AppContent`: Renders the appropriate step component

#### `ThemeContext.jsx`
- Provides theme context to the entire application
- Implements dark/light mode toggling
- Persists theme preference in localStorage
- Dependencies: `react`
- Exports:
  - `ThemeProvider`: Context provider component
  - `useTheme`: Custom hook for accessing theme functions and state
  - `THEMES`: Constants for theme values

### State Management

#### `billStore.js`
- Central state store using Zustand
- Manages all bill-related data and logic
- Persists state to localStorage using Zustand's persist middleware
- Dependencies: `zustand`, `zustand/middleware`, `react`
- Key State Elements:
  - `step`: Current step in the bill splitting process (1-4)
  - `people`: Array of people splitting the bill
  - `items`: Array of bill items with enhanced split options
  - `taxAmount`: Tax amount for the bill
  - `title`: Title of the bill (e.g., restaurant name)
- Key Functions:
  - Navigation: `nextStep`, `prevStep`, `goToStep`
  - People Management: `addPerson`, `removePerson`, `updatePerson`
  - Item Management: `addItem`, `removeItem`, `updateItem`
  - Split Types Management: `setSplitType`, `assignItemEqual`, `assignItemPercentage`, `assignItemFraction`
  - Assignment: `assignAllPeopleEqual`, `removeAllPeople`
  - Calculations: `getPersonTotals`, `getSubtotal`, `getGrandTotal`
  - Helper Functions: `isItemAssigned`, `areAllItemsAssigned`, `getUnassignedItems`, `validateAllocations`
  - Custom Hooks: `useBillPersons`, `useBillItems`, `useBillPersonTotals`, `useDocumentTitle`, `useBillStep`, `useBillCurrency`, `useBillTitle`, `useBillTaxAmount`

#### `currencyStore.js`
- Manages currency-related state and formatting
- Persists currency preference in localStorage
- Dependencies: `zustand`, `zustand/middleware`
- Key Functions:
  - `formatCurrency`: Formats numbers as currency
  - `changeCurrency`: Changes the current currency
- Custom Hooks: `useFormatCurrency`

### Component Files

#### `src/Components/PeopleInput.jsx`
- First step component for adding people to the bill
- Contains input form and list of added people
- Dependencies: 
  - `billStore.js`: For people state management (`addPerson`, `removePerson`, `updatePerson`, `nextStep`, `setTitle`)
  - `ThemeContext.jsx`: For theme-aware styling
  - `ui/components.jsx`: For UI components
  - `EditableTitle.jsx`: For editing the bill title
  - `EditPersonModal.jsx`: For editing person details
- Key Components:
  - `PersonInputForm`: Form for adding a person
  - `PeopleList`: Displays added people with edit/delete options
- Main functionalities:
  - Add people to the bill
  - Edit existing people
  - Remove people
  - Set the bill title
  - Navigate to the next step

#### `src/Components/ItemsInput.jsx`
- Second step component for adding items to the bill
- Contains item form, list, and tax input
- Dependencies:
  - `billStore.js`: For items state management (`addItem`, `removeItem`, `updateItem`, `setTax`, `nextStep`, `prevStep`)
  - `currencyStore.js`: For currency formatting
  - `ThemeContext.jsx`: For theme-aware styling
  - `ui/components.jsx`: For UI components
  - `ScanReceiptButton.jsx`: For receipt scanning functionality
  - `EditItemModal.jsx`: For editing item details
  - `BillTotalsSummary.jsx`: For displaying bill totals
- Key Components:
  - `ItemForm`: Form for adding an item
  - `ItemsList`: Displays added items with edit/delete options
  - `TaxInput`: Input for tax amount
- Main functionalities:
  - Add items with name, price, and quantity
  - Edit existing items
  - Remove items
  - Set tax amount
  - Calculate subtotal and total
  - Scan receipts using OCR
  - Navigate between steps

#### `src/Components/ItemAssignment.jsx`
- Third step component for assigning items to people
- Shows who consumed what items with advanced split options
- Dependencies:
  - `billStore.js`: For assignment state management including split types
  - `currencyStore.js`: For currency formatting
  - `ThemeContext.jsx`: For theme-aware styling
  - `ui/components.jsx`: For UI components
  - `SplitTypeDrawer.jsx`: For configuring different split types
  - `SPLIT_TYPES`: Constants for split types (equal, percentage, fraction)
- Key Components:
  - `ItemCard`: Displays an item with people selection and split options
- Main functionalities:
  - Assign items to multiple people
  - Configure split types (equal, percentage, or fractional)
  - Calculate per-person costs based on split configuration
  - Select/deselect all people for an item
  - Navigate between steps

#### `src/Components/SplitTypeDrawer.jsx`
- Modal-like drawer for configuring item split types
- Allows users to define how an item's cost is distributed
- Dependencies:
  - `PercentageSplitInput.jsx`: For percentage-based splits
  - `FractionalSplitInput.jsx`: For fractional-based splits
  - `SPLIT_TYPES`: Constants from billStore.js
- Main functionalities:
  - Select split type (equal, percentage, fraction)
  - Configure allocation values based on split type
  - Save and apply split configuration to items

#### `src/Components/PercentageSplitInput.jsx`
- Component for percentage-based split configuration
- Uses sliders to adjust percentage allocations
- Ensures allocations always sum to 100%
- Dependencies: `ui/components.jsx`

#### `src/Components/FractionalSplitInput.jsx`
- Component for fractional split configuration
- Allows arbitrary numerical values that determine relative shares
- Dependencies: `ui/components.jsx`

#### `src/Components/BillSummary.jsx`
- Fourth and final step component showing the bill summary
- Displays per-person totals and overall bill summary
- Dependencies:
  - `billStore.js`: For accessing bill data and calculations (`title`, `taxAmount`, `goToStep`, `reset`)
  - `currencyStore.js`: For currency formatting
  - `ui/components.jsx`: For UI components
  - `BillTotalsSummary.jsx`: For displaying bill totals
- Key Components:
  - `BillTitle`: Displays the bill title
  - `PersonItemRow`: Shows an item assigned to a person
  - `PersonCard`: Displays a person's items and totals
  - `EditButtons`: Navigation buttons to edit different steps
- Main functionalities:
  - Display per-person itemized bills with split information
  - Show subtotal, tax, and total per person
  - Show overall bill totals
  - Print functionality with print-specific styling
  - Reset the application
  - Navigate to edit previous steps

#### `src/Components/BillTotalsSummary.jsx`
- Reusable component for displaying bill totals
- Used in multiple steps for consistent totals display
- Dependencies: `currencyStore.js` for currency formatting
- Main functionality: Display subtotal, tax amount, and grand total

#### `src/Components/EditItemModal.jsx`
- Modal dialog for editing existing items
- Dependencies: `ui/components.jsx` for UI components
- Main functionality: Edit item name, price, and quantity

#### `src/Components/EditPersonModal.jsx`
- Modal dialog for editing existing people
- Dependencies: `ui/components.jsx` for UI components
- Main functionality: Edit person name

#### `src/Components/EditableTitle.jsx`
- Component for editing the bill title with inline editing
- Dependencies: `billStore.js` for title state
- Main functionality: Toggle between display and edit mode for bill title

#### `src/Components/ScanReceiptButton.jsx`
- Component for scanning receipts using OCR via a Worker API
- Dependencies:
  - `billStore.js`: For adding items and tax from scan results
  - `ui/components.jsx`: For UI components
- Main functionalities:
  - Upload receipt image
  - Send to worker API for processing
  - Add detected items and tax to the bill
  - Handle loading and error states

#### `src/Components/ThemeSwitcher.jsx`
- Component for toggling between light and dark themes
- Dependencies: `ThemeContext.jsx` for theme state and functions
- Main functionality: Switch between light and dark modes
- Includes both simple and labeled variant

### UI Components

#### `src/ui/components.jsx`
- Library of reusable UI components
- Provides consistent UI styling throughout the application
- Dependencies: `ThemeContext.jsx` for theme-aware styling
- Components:
  - `Button`: Styled button with multiple variants and sizes
  - `Input`: Styled input field with label and error handling
  - `Card`: Styled card container
  - `ToggleButton`: Button for toggling selection
  - `PrintButton`: Button for printing functionality
  - `SelectAllButton`: Button for selecting all items
  - `PrintWrapper`: Wrapper for printable content with media query
  - `Modal`: Modal dialog with backdrop
  - `FileUpload`: File upload input with styles
  - `Spinner`: Loading spinner animation
  - `Alert`: Alert message with multiple type variants

## Application Flow

The application follows a 4-step process:

1. **People Input (step 1)**:
   - Set the bill title
   - Add people who are splitting the bill

2. **Items Input (step 2)**:
   - Add bill items with name, price, and quantity
   - Scan a receipt (optional)
   - Enter tax amount

3. **Item Assignment (step 3)**:
   - Assign each item to the people who consumed it
   - Configure split types (equal, percentage, or fractional)
   - Calculate shared costs per item based on split configuration

4. **Bill Summary (step 4)**:
   - Show a summary of what each person owes
   - Display overall bill totals
   - Print the bill
   - Reset or edit previous steps

The application provides seamless navigation between these steps through the step indicator UI component and back/next buttons.

## Data Structures

### Person Object
```javascript
{
  id: string,
  name: string
}
```

### Item Object
```javascript
{
  id: string,
  name: string,
  price: number,
  quantity: number,
  consumedBy: Array<string | {personId: string, value: number}>, // Enhanced to support split types
  splitType: 'equal' | 'percentage' | 'fraction' // From SPLIT_TYPES
}
```

This is an enhancement of the original structure which was:
```javascript
{
  id: string,
  name: string,
  price: number,
  quantity: number,
  consumedBy: string[] // Array of person IDs
}
```

### Person Totals Object (calculated)
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
      share: number // Final price per person based on split type
    }
  ],
  subtotal: number,
  tax: number,
  total: number
}
```

This is an enhancement of the original structure which was:
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
      sharedWith: number, // Number of people sharing the item
      share: number // Price per person
    }
  ],
  subtotal: number,
  tax: number,
  total: number
}
```

## Future Development

Based on the README.md TODO list and current implementation status, planned features include:

1. Implement a feature to select all people for an item at once ✓ (already implemented)
2. Define a print-friendly area for exporting the bill summary as a PDF ✓ (already implemented)
3. Add functionality to export bill details in CSV and JSON formats
4. Support for multiple currencies 
5. Bill history 

## Notes for Improvement and Implementation Details

1. The README.md is slightly outdated as some of the TODO items have already been implemented:
   - "Select All in People Assignment" is implemented in the `ItemAssignment.jsx` component
   - "Print Area Definition for PDF Export" is implemented in the `PrintWrapper` component

2. The code is well-structured with clear separation of concerns:
   - UI components are separated from business logic
   - State management is centralized in Zustand stores
   - Theme management is handled via Context API
   - Each step of the process has its own component

3. The project uses modern React patterns:
   - Functional components with hooks
   - Memoization with `memo`, `useCallback`, and `useMemo`
   - Custom hooks for common functionality
   - Context API for global state like theming
   - External state management with Zustand
   - Persistent storage with localStorage

4. Receipt scanning functionality:
   - Currently uses a Cloudflare Worker API endpoint
   - Development and production environments have different endpoints

5. The bill splitting logic supports three types of splits:
   - **Equal split**: Cost divided equally among assigned people
   - **Percentage split**: Each person assigned a percentage of the cost
   - **Fractional split**: Relative shares based on arbitrary numbers

6. Performance optimizations:
   - Component memoization to prevent unnecessary re-renders
   - Zustand's `useShallow` to optimize store selectors
   - Lazy loading of modal content
   - Theme context with memoized values

7. User experience considerations:
   - Dark/light mode with system preference detection
   - Responsive design with mobile-friendly controls
   - Print-specific styles for bill export
   - Form validation and error handling
   - Confirmation dialogs for destructive actions
   - Visual feedback for active states and loading

8. Accessibility features:
   - Keyboard navigation support
   - ARIA attributes for interactive elements
   - Sufficient color contrast
   - Focus management for modals
   - Semantic HTML structure