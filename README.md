# Bill Splitter

Bill Splitter is an intuitive React application that simplifies the process of splitting bills among multiple people. It guides you through adding people, entering items, assigning who consumed what, and calculating final totals including tax.

**Live Demo**: [https://satyajeetnigade.in/BillSplitter/](https://satyajeetnigade.in/BillSplitter/)

## Features

- **User-Friendly Flow**: Step-by-step process guides you through bill splitting
- **Receipt Scanning**: Upload a receipt image to automatically extract items and tax (powered by OCR)
- **Dynamic Assignment**: Assign items to multiple people with cost splitting
- **Dark Mode Support**: Toggle between light and dark themes for comfortable viewing
- **Local Persistence**: Bill data saved in your browser's local storage
- **Print Support**: Print-friendly output for sharing results
- **Mobile Responsive**: Works on devices of all sizes

## Screenshots

### Step 1: Add People

![Step 1: Add People](https://github.com/user-attachments/assets/dbfe1432-03c0-45af-985f-dad2f67df837)


### Step 2: Enter Items

![Step 2: Enter Items](https://github.com/user-attachments/assets/f95c1713-7b37-407f-b5d9-3859b9eddf87)


### Step 3: Assign Items

![Step 3: Assign Items](https://github.com/user-attachments/assets/556ca8aa-90f1-4c9b-8e3f-c4232c2a6408)

### Step 4: Bill Summary
![Step 4: Bill Summary](https://github.com/user-attachments/assets/4a391f63-17ee-4091-b5e4-1ad182415243)


## Technology Stack

- **Framework**: React 19
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Deployment**: GitHub Pages

## Getting Started

### Prerequisites

- Node.js (version 18 or above)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/satlavida/BillSplitter.git
   cd BillSplitter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

## Usage Guide

### Adding People
1. Enter the bill title (e.g., "Pizza Night 2025-03-31")
2. Add names of everyone splitting the bill
3. Click "Next" to proceed

### Adding Items
1. Enter item details (name, price, quantity)
2. Alternatively, scan a receipt using the "Scan Receipt" button (supports item-level discounts)
3. Add tax amount if applicable
4. Click "Next" to proceed

### Assigning Items
1. For each item, select who consumed it
2. Use "Select All" to quickly assign an item to everyone
3. Items split equally among all assigned people
4. Click "Calculate Split" to proceed

### Viewing Summary
1. Review what each person owes
2. Print the summary for sharing
3. Use the edit buttons to make changes if needed
4. Click "Start Over" to begin a new bill

## Deployment

To deploy to GitHub Pages, run:

```bash
chmod +x deploy.sh  # Make the deploy script executable (first time only)
./deploy.sh
```

This script creates a GitHub Pages branch, builds the project, and pushes the changes.

## Future Enhancements

- Export bills in CSV and JSON formats
- Currency selection
- Calculate individual tips
- Custom split ratios for items
- Bill history for tracking past expenses
- Photo capture on mobile devices

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. The MIT License is a permissive license that allows anyone to use, modify, and distribute your code for both personal and commercial purposes, as long as they include the original license and copyright notice.

## Acknowledgments

- Built with React, Zustand, and Tailwind CSS
- Receipt scanning powered by Google Gemini API
- Icons from Heroicons
