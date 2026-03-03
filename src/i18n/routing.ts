export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];

export const routing = {
  defaultLocale: "zh" as Locale,
  locales,
  localePrefix: "as-needed" as const,
};
