import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';

// Create a context for theme management
export const ThemeContext = createContext();

// Theme values
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};

// Theme provider component
export const ThemeProvider = ({ children }) => {
  // Initialize theme from localStorage or use system preference as fallback
  const [theme, setTheme] = useState(() => {
    // Check if theme is stored in localStorage
    const savedTheme = localStorage.getItem('billSplitterTheme');
    if (savedTheme) {
      return savedTheme;
    }
    
    // Otherwise check for system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return THEMES.DARK;
    }
    
    // Default to light theme
    return THEMES.LIGHT;
  });

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(prevTheme => 
      prevTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT
    );
  };

  // Set specific theme
  const setSpecificTheme = (newTheme) => {
    if (Object.values(THEMES).includes(newTheme)) {
      setTheme(newTheme);
    }
  };

  // Update localStorage when theme changes
  useEffect(() => {
    localStorage.setItem('billSplitterTheme', theme);
    
    // Apply theme to document
    if (theme === THEMES.DARK) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    theme,
    toggleTheme,
    setTheme: setSpecificTheme,
    isDark: theme === THEMES.DARK,
    isLight: theme === THEMES.LIGHT
  }), [theme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for using the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};