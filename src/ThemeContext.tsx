import {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export type Theme = (typeof THEMES)[keyof typeof THEMES];

export interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (newTheme: Theme) => void;
  isDark: boolean;
  isLight: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('billSplitterTheme') as Theme | null;
    if (savedTheme) {
      return savedTheme;
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return THEMES.DARK;
    }

    return THEMES.LIGHT;
  });

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT));
  };

  const setSpecificTheme = (newTheme: Theme) => {
    if (Object.values(THEMES).includes(newTheme)) {
      setTheme(newTheme);
    }
  };

  useEffect(() => {
    localStorage.setItem('billSplitterTheme', theme);

    if (theme === THEMES.DARK) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      theme,
      toggleTheme,
      setTheme: setSpecificTheme,
      isDark: theme === THEMES.DARK,
      isLight: theme === THEMES.LIGHT,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
