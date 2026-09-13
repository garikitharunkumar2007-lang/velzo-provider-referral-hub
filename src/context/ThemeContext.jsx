import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const ThemeContext = createContext(null);

const THEME_STORAGE_KEY = "velzo-theme";

function getInitialTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme === "dark" || savedTheme === "light") {
      return savedTheme;
    }
  } catch (error) {
    console.error("Unable to read saved theme:", error);
  }

  return "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;

    root.setAttribute("data-theme", theme);

    root.classList.remove("light", "dark");
    root.classList.add(theme);

    document.body.setAttribute("data-theme", theme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error("Unable to save theme:", error);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === "dark" ? "light" : "dark"
    );
  };

  const changeTheme = (newTheme) => {
    if (newTheme !== "dark" && newTheme !== "light") {
      return;
    }

    setTheme(newTheme);
  };

  const value = useMemo(
    () => ({
      theme,
      isDarkMode: theme === "dark",
      isLightMode: theme === "light",
      toggleTheme,
      changeTheme,
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider"
    );
  }

  return context;
}

export default ThemeContext;