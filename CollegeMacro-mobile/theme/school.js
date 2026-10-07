// Turns a school's official colors into the light tint layered on the base
// style. School colors range from navy to pale gold, so the tint is nudged
// darker (light mode) or lighter (dark mode) until it reads as a graphic
// (3:1 against cards), and text placed on it picks white or ink by contrast.

const hex = (value) => {
  const clean = String(value || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
};

const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const mix = (rgb, target, amount) => rgb.map((v, i) => v + (target[i] - v) * amount);

// Steps the color toward black or white until it clears `ratio` against `against`.
function readable(rgb, against, ratio, towardWhite) {
  let color = rgb;
  for (let step = 0; step < 12 && contrast(color, against) < ratio; step += 1) {
    color = mix(color, towardWhite ? [255, 255, 255] : [0, 0, 0], 0.12);
  }
  return color;
}

/**
 * @param {{ primary_color?: string | null, secondary_color?: string | null } | null} school
 * @param {Record<string, string>} c base palette
 * @param {boolean} isDark
 */
export function schoolTones(school, c, isDark) {
  const surface = hex(c.surface);
  const base = hex(school?.primary_color) || hex(c.primary);
  const alt = hex(school?.secondary_color) || base;

  const tone = readable(base, surface, 3, isDark);
  const darkText = hex(isDark ? c.inverse : c.ink);
  const onTone = contrast([255, 255, 255], tone) >= contrast(darkText, tone) ? '#FFFFFF' : toHex(darkText);

  return {
    school: toHex(tone),
    onSchool: onTone,
    schoolSoft: toHex(mix(hex(c.bg), tone, isDark ? 0.22 : 0.12)),
    schoolAlt: toHex(alt),
  };
}
