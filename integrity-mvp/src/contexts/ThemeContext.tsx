import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'default' | 'navy-gold' | 'clinical-light' | 'notion';
export type Font = 'inter' | 'raleway' | 'montserrat';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  font: Font;
  setFont: (font: Font) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('integrity_theme');
    return (saved as Theme) || 'default';
  });

  const [font, setFontState] = useState<Font>(() => {
    const saved = localStorage.getItem('integrity_font');
    return (saved as Font) || 'inter';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('integrity_theme', newTheme);
  };

  const setFont = (newFont: Font) => {
    setFontState(newFont);
    localStorage.setItem('integrity_font', newFont);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font', font);
  }, [font]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, font, setFont }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
