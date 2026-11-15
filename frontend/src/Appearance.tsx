import { useState } from "react";
import { usePreferences } from "./preferences";
import { t } from "./i18n";
import styles from "./Appearance.module.css";

function Flag({ language }: { language: "de" | "en" }) {
  return (
    <svg className={styles.flag} viewBox="0 0 24 16" aria-hidden="true">
      {language === "de" ? (
        <>
          <path fill="#181818" d="M0 0h24v6H0z" />
          <path fill="#cf3030" d="M0 5.33h24v5.34H0z" />
          <path fill="#efc94d" d="M0 10.67h24V16H0z" />
        </>
      ) : (
        <>
          <path fill="#223d78" d="M0 0h24v16H0z" />
          <path stroke="#fff" strokeWidth="4" d="m0 0 24 16M24 0 0 16" />
          <path stroke="#cf3030" strokeWidth="1.5" d="m0 0 24 16M24 0 0 16" />
          <path fill="#fff" d="M9 0h6v16H9zM0 5h24v6H0z" />
          <path fill="#cf3030" d="M10.5 0h3v16h-3zM0 6.5h24v3H0z" />
        </>
      )}
    </svg>
  );
}

export function Appearance() {
  const { language, theme, setLanguage, setTheme } = usePreferences();
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.controls}>
      <button
        type="button"
        aria-label={t("Heller Modus")}
        title={t("Heller Modus")}
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={t("Dunkler Modus")}
        title={t("Dunkler Modus")}
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />
        </svg>
      </button>
      <div
        className={styles.language}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <button
          type="button"
          aria-label={t("Sprache auswählen")}
          title={t("Sprache auswählen")}
          aria-expanded={open}
          aria-controls="language-options"
          onClick={() => setOpen(!open)}
        >
          <Flag language={language} />
        </button>
        {open && (
          <div id="language-options" className={styles.menu}>
            <button
              lang="de"
              aria-label="🇩🇪 Deutsch"
              aria-pressed={language === "de"}
              onClick={() => {
                setLanguage("de");
                setOpen(false);
              }}
            >
              <Flag language="de" /> Deutsch
            </button>
            <button
              lang="en"
              aria-label="🇬🇧 English"
              aria-pressed={language === "en"}
              onClick={() => {
                setLanguage("en");
                setOpen(false);
              }}
            >
              <Flag language="en" /> English
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
