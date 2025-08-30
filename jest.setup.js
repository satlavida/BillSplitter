// jest.setup.js
// Extends Jest expect with helpful matchers for testing DOM nodes
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';// Mock for localStorage

// Polyfill structuredClone for environments where it's missing
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}


// beforeEach(() => {
//     const localStorageMock = (() => {
//       let store = {};
//       return {
//         getItem: jest.fn(key => store[key] || null),
//         setItem: jest.fn((key, value) => {
//           store[key] = value.toString();
//         }),
//         removeItem: jest.fn(key => {
//           delete store[key];
//         }),
//         clear: jest.fn(() => {
//           store = {};
//         })
//       };
//     })();
    
//     Object.defineProperty(window, 'localStorage', {
//       value: localStorageMock,
//       writable: true
//     });
//   });
  
//   // Add custom matchers if needed
//   expect.extend({
//     toBeCloseToNumber(received, expected, precision = 2) {
//       const pass = Math.abs(received - expected) < Math.pow(10, -precision) / 2;
//       if (pass) {
//         return {
//           message: () => `expected ${received} not to be close to ${expected}`,
//           pass: true
//         };
//       } else {
//         return {
//           message: () => `expected ${received} to be close to ${expected}`,
//           pass: false
//         };
//       }
//     }
//   });