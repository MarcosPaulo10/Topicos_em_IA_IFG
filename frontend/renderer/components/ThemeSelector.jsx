import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeSelector() {
  const { themeId, setThemeId, themes } = useTheme();

  return (
    <div className="theme-selector">
      <label htmlFor="theme-select">Tema</label>
      <select
        id="theme-select"
        value={themeId}
        onChange={(e) => setThemeId(e.target.value)}
        title="Trocar tema visual"
      >
        {themes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
