"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n";

type ThemeName = "dark" | "light";

const ThemeContext = createContext<{ theme: ThemeName; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === "dark" || current === "light") setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("finsight-theme", next);
  }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const next = theme === "dark" ? t("themeToLight") : t("themeToDark");
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={next}>
      <span className={theme === "dark" ? "theme-dot on" : "theme-dot"} />
      {next}
    </button>
  );
}
