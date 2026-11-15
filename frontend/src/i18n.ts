import english from "./english.json";
import { usePreferences } from "./preferences";

const dictionary: Record<string, string> = english;
/** German source strings also serve as stable translation keys. */
export function t(
  source: string | TemplateStringsArray,
  ...values: unknown[]
): string {
  const key =
    typeof source === "string"
      ? source
      : source.reduce(
          (text, part, i) => text + (i ? `{${i - 1}}` : "") + part,
          "",
        );
  const value = dictionary[key.replace(/\s+/g, " ").trim()];
  const translated =
    usePreferences.getState().language === "en" && value
      ? key.match(/^\s*/)![0] + value + key.match(/\s*$/)![0]
      : key;
  return typeof source === "string"
    ? translated
    : translated.replace(/\{(\d+)\}/g, (_, index: string) =>
        String(values[Number(index)]),
      );
}
