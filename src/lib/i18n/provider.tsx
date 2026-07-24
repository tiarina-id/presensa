"use client";

import { createContext, useContext, useMemo } from "react";
import {
  translate,
  type Locale,
  type MessageKey,
} from "./dictionaries";

type TranslateFn = (
  key: MessageKey,
  vars?: Record<string, string | number>
) => string;

interface I18nContextValue {
  locale: Locale;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  t: (key) => translate("en", key),
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: (key, vars) => translate(locale, key, vars) }),
    [locale]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the translation function in Client Components. */
export function useT(): TranslateFn {
  return useContext(I18nContext).t;
}

/** Access the current locale in Client Components. */
export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
