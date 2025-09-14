import { DEFAULT_BG, DEFAULT_TEXT_ON_DARK, DEFAULT_TEXT_ON_LIGHT } from "./colorDefaults";

export type TeamFnColor = { bg: string; text: string };

// Parse #RGB or #RRGGBB to {r,g,b}
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  let s = hex.trim();
  if (!s.startsWith("#")) s = "#" + s;
  if (s.length === 4) {
    const r = parseInt(s[1] + s[1], 16);
    const g = parseInt(s[2] + s[2], 16);
    const b = parseInt(s[3] + s[3], 16);
    return { r, g, b };
  }
  if (s.length === 7) {
    const r = parseInt(s.slice(1, 3), 16);
    const g = parseInt(s.slice(3, 5), 16);
    const b = parseInt(s.slice(5, 7), 16);
    return { r, g, b };
  }
  return null;
}

// Простая оценка яркости по RGB: true если цвет светлый
export function isLight(hex: string): boolean {
  const rgb = parseHex(hex);
  if (!rgb) return true; // по умолчанию считаем светлым
  const { r, g, b } = rgb;
  // Перцептивная яркость (W3C)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 186; // типичный порог
}

// Возвращает контрастный цвет текста для фона
export function autoTextForBg(bg: string): string {
  return isLight(bg) ? DEFAULT_TEXT_ON_LIGHT : DEFAULT_TEXT_ON_DARK;
}

// Нормализация входного значения цвета (строка или объект)
export function normalizeColorValue(value: string | TeamFnColor | undefined): TeamFnColor {
  if (!value) {
    return { bg: DEFAULT_BG, text: DEFAULT_TEXT_ON_LIGHT };
  }
  if (typeof value === "string") {
    const bg = value;
    return { bg, text: autoTextForBg(bg) };
  }
  const bg = value.bg || DEFAULT_BG;
  const text = value.text ? value.text : autoTextForBg(bg);
  return { bg, text };
}

export function getBg(value: string | TeamFnColor | undefined): string {
  return normalizeColorValue(value).bg;
}

export function getText(value: string | TeamFnColor | undefined): string {
  return normalizeColorValue(value).text;
}