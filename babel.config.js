export default {
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' } }], // Target current Node version for Jest
      ['@babel/preset-react', { runtime: 'automatic' }] // Handle JSX transformation
    ]
  };