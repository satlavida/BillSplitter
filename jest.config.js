// jest.config.js
export default {
    // Use jsdom environment for testing React components
    testEnvironment: 'jest-environment-jsdom', 
  
    // Setup files to run before tests (e.g., for extending expect)
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], 
  
    // Transform files using Babel
    transform: {
      '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest', 
    },
  
    // Module Name Mapper for handling CSS/static assets (optional but helpful)
    moduleNameMapper: {
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy', // Mocks CSS Modules
      // Mirror the path aliases declared in vite.config.js
      '^src/(.*)$': '<rootDir>/src/$1',
      '^components/(.*)$': '<rootDir>/src/Components/$1',
      '^ui/(.*)$': '<rootDir>/src/ui/$1',
    },

    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

    // Playwright specs live under e2e/ (assertions) and screenshots/ (visual
    // capture) and run via `npm run e2e`/`npm run screenshots`, not Jest.
    testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/', '<rootDir>/screenshots/'],

    // Ignore transformations for node_modules except specific ones if needed
    transformIgnorePatterns: [
      '/node_modules/(?!(your-module-to-transform)/)'
    ],

    // Collect coverage information (optional)
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageProvider: 'v8', // or 'babel'
  };