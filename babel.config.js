export default {
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' } }], // Target current Node version for Jest
      ['@babel/preset-react', { runtime: 'automatic' }], // Handle JSX transformation
      ['@babel/preset-typescript'] // Strip TS syntax for Jest (no type-checking here; tsc --noEmit is the gate)
    ]
  };