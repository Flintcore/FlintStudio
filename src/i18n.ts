import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";
import { locales, type Locale } from "./i18n/routing";

export { locales, type Locale };
export const defaultLocale = "zh" as Locale;

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  if (!locale || !locales.includes(locale as Locale)) {
    notFound();
  }
  const messages = (await import(`./messages/${locale}/common.json`)).default;
  return { locale, messages: { common: messages } };
});
