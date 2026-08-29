// jest.setup.js
// Extends Jest expect with helpful matchers for testing DOM nodes
import '@testing-library/jest-dom';

// jsdom doesn't provide TextEncoder/TextDecoder, which react-router-dom
// (imported by any component test that renders a Link/Route) requires at
// module-load time — polyfill from Node's util before anything else runs.
import { TextEncoder, TextDecoder } from 'util';
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}

// Mock for localStorage


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