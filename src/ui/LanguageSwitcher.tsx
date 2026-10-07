import "./languageSwitcher.css";

export interface LanguageSwitcherProps {
  language: "zh" | "en";
  onChange: (language: "zh" | "en") => void;
  context: "header" | "story";
}

export function LanguageSwitcher({
  language,
  onChange,
  context,
}: LanguageSwitcherProps) {
  return (
    <div
      className="language-switcher"
      role="group"
      aria-label="语言 / Language"
      data-language-context={context}
    >
      {(["zh", "en"] as const).map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale === "zh" ? "zh-CN" : "en"}
          aria-label={locale === "zh" ? "切换到中文" : "Switch to English"}
          title={locale === "zh" ? "切换到中文" : "Switch to English"}
          aria-pressed={language === locale}
          data-gesture-id={`language-${context}-${locale}`}
          data-gesture-label={locale === "zh" ? "中文" : "English"}
          onClick={() => {
            if (locale !== language) onChange(locale);
          }}
        >
          {locale === "zh" ? "中文" : "EN"}
        </button>
      ))}
    </div>
  );
}
