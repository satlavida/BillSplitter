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
      // Add mappings for aliases if you use them (e.g., in vite.config.js)
      // '^@/(.*)$': '<rootDir>/src/$1' 
    },
  
    // Ignore transformations for node_modules except specific ones if needed
    transformIgnorePatterns: [
      '/node_modules/(?!(your-module-to-transform)/)' 
    ],
  
    // Collect coverage information (optional)
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageProvider: 'v8', // or 'babel'
  };