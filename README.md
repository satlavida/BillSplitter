# Bill Splitter React App

A simple React application for splitting bills. It guides you through adding people, items, assigning consumption, and calculating the final totals including tax.

## Features

- **State Management:** Uses `useReducer` for handling state.
- **Global Access:** Implements Context API for global state sharing.
- **Persistence:** Stores data in `localStorage` to retain progress.
- **User Flow:** Step-by-step process for adding people, items, and assigning items.
- **Styling:** Built with Tailwind CSS for a clean, responsive UI.

## Getting Started

1. **Clone the repository:**

   ```bash

   git clone https://github.com/satlavida/BillSplitter.git
   cd bill-splitter
   ```
2. **Install dependencies:**
   ```bash

   npm install
   ```
3. Run the app:
   ```bash

   npm run dev
   ```

## TODO: 
1. Select All in People Assignment: Implement a feature to select all people for an item at once.
2. Print Area Definition for PDF Export: Define a print-friendly area for exporting the bill summary as a PDF.
3. CSV/JSON Export: Add functionality to export bill details in CSV and JSON formats.
