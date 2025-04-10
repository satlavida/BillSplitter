# Bill Splitter Application - Context Document

## Project Overview

Bill Splitter is a React application that helps users split bills among multiple people. The application guides users through a step-by-step process of adding people, items, assigning consumption, and calculating the final totals including tax. The app uses a modern React stack with Zustand for state management, Context API for theme management, and Tailwind CSS for styling.

## Core Technologies and Project Structure

- **Framework**: React 19
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Deployment**: GitHub Pages (via gh-pages branch)
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
- Persists state to localStorage
- Dependencies: `zustand`, `zustand/middleware`, `react`
- Key State Elements:
  - `step`: Current step in the bill splitting process (1-4)
  - `people`: Array of people splitting the bill
  - `items`: Array of bill items
  - `taxAmount`: Tax amount for the bill
  - `title`: Title of the bill (e.g., restaurant name)
- Key Functions:
  - Navigation: `nextStep`, `prevStep`, `goToStep`
  - People Management: `addPerson`, `removePerson`, `updatePerson`
  - Item Management: `addItem`, `removeItem`, `updateItem`
  - Assignment: `assignItem`, `assignAllPeople`, `removeAllPeople`
  - Calculations: `getPersonTotals`, `getSubtotal`, `getGrandTotal`
  - Custom Hooks: `useBillPersons`, `useBillItems`, `useBillPersonTotals`, `useDocumentTitle`

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
  - Navigate between steps

#### `src/Components/ItemAssignment.jsx`
- Third step component for assigning items to people
- Shows who consumed what items
- Dependencies:
  - `billStore.js`: For assignment state management (`assignItem`, `assignAllPeople`, `removeAllPeople`, `nextStep`, `prevStep`)
  - `currencyStore.js`: For currency formatting
  - `ThemeContext.jsx`: For theme-aware styling
  - `ui/components.jsx`: For UI components
- Key Components:
  - `ItemCard`: Displays an item with people selection
- Main functionalities:
  - Assign items to multiple people
  - Calculate per-person costs for shared items
  - Select/deselect all people for an item
  - Navigate between steps

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
  - Display per-person itemized bills
  - Show subtotal, tax, and total per person
  - Show overall bill totals
  - Print functionality
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

#### `src/Components/ThemeSwitcher.jsx`
- Component for toggling between light and dark themes
- Dependencies: `ThemeContext.jsx` for theme state and functions
- Main functionality: Switch between light and dark modes

### UI Components

#### `src/ui/components.jsx`
- Library of reusable UI components
- Provides consistent UI styling throughout the application
- Dependencies: `ThemeContext.jsx` for theme-aware styling
- Components:
  - `Button`: Styled button with multiple variants
  - `Input`: Styled input field with label and error handling
  - `Card`: Styled card container
  - `ToggleButton`: Button for toggling selection
  - `PrintButton`: Button for printing functionality
  - `SelectAllButton`: Button for selecting all items
  - `PrintWrapper`: Wrapper for printable content
  - `Modal`: Modal dialog
  - `FileUpload`: File upload input
  - `Spinner`: Loading spinner
  - `Alert`: Alert message

### Deployment and Scripts

#### `deploy.sh`
- Shell script for deploying to GitHub Pages
- Creates or updates a gh-pages branch
- Builds the application and pushes to the gh-pages branch
- Main functionalities:
  - Check for uncommitted changes
  - Create or switch to gh-pages branch
  - Merge latest changes from the main branch
  - Build the project with Vite
  - Commit and push to the remote gh-pages branch

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
   - Calculate shared costs per item

4. **Bill Summary (step 4)**:
   - Show a summary of what each person owes
   - Display overall bill totals
   - Print the bill
   - Reset or edit previous steps

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

Based on the README.md TODO list, planned features include:

1. Implement a feature to select all people for an item at once ✓ (already implemented)
2. Define a print-friendly area for exporting the bill summary as a PDF ✓ (already implemented)
3. Add functionality to export bill details in CSV and JSON formats

## Notes for Improvement

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
   - Memoization with `memo` and `useCallback`
   - Custom hooks for common functionality
   - Context API for global state like theming
   - External state management with Zustand

4. Receipt scanning functionality:
   - Currently uses a Cloudflare Worker API endpoint
   - Development and production environments have different endpoints
