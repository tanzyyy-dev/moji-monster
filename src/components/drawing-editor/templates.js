export const templateDefs = [
  ["なし", "❌", ""],
  [
    "ねこ",
    "🐱",
    '<path d="M27 43 22 15 42 28Q60 22 78 28L98 15 93 43Q107 62 94 84Q80 104 60 101Q40 104 26 84Q13 62 27 43Z"/><path d="M42 62h3m30 0h3M55 77q5 7 10 0M29 75l-13 -4m13 12-13 4m75-12 13-4m-13 12 13 4"/>',
  ],
  [
    "いぬ",
    "🐶",
    '<path d="M34 31Q60 20 86 31Q99 46 94 76Q83 101 60 100Q37 101 26 76Q21 46 34 31Z"/><path d="M34 31Q13 22 12 47Q12 64 29 61M86 31Q107 22 108 47Q108 64 91 61M44 62h2m28 0h2M54 78q6 7 12 0"/>',
  ],
  [
    "うさぎ",
    "🐰",
    '<path d="M39 40Q25 5 36 5Q48 4 52 37M68 37Q72 4 84 5Q95 5 81 40M60 33Q99 32 99 68Q99 100 60 101Q21 100 21 68Q21 32 60 33Z"/><path d="M43 67h2m30 0h2M56 80q4 5 8 0"/>',
  ],
  [
    "くるま",
    "🚗",
    '<path d="M18 52 31 30H89L102 52V83H18Z"/><path d="M25 52h70M42 30 36 52M78 30 84 52"/><circle cx="37" cy="84" r="11"/><circle cx="83" cy="84" r="11"/>',
  ],
  [
    "おはな",
    "🌸",
    '<circle cx="60" cy="52" r="12"/><path d="M48 46Q18 12 43 8Q60 5 60 34Q60 5 77 8Q102 12 72 46Q105 24 111 49Q113 70 75 61Q102 83 82 99Q63 111 60 69Q57 111 38 99Q18 83 45 61Q7 70 9 49Q15 24 48 46Z"/><circle cx="60" cy="52" r="12"/>',
  ],
  [
    "おさかな",
    "🐟",
    '<path d="M21 55Q51 15 94 55Q51 95 21 55Z"/><path d="M93 55 113 30V80Z M54 35 65 16 78 37 M54 75 65 94 78 73"/><circle cx="39" cy="50" r="3"/>',
  ],
  [
    "ほし",
    "⭐",
    '<path d="M60 9 74 40 108 44 82 67 89 102 60 84 31 102 38 67 12 44 46 40Z"/>',
  ],
  [
    "きょうりゅう",
    "🦕",
    '<path d="M26 89Q14 74 19 55L10 37 31 45 42 28 54 38 67 19Q91 8 101 26Q111 43 90 47L82 60Q95 75 91 88L75 88 70 74 54 76 49 89Z"/><circle cx="86" cy="30" r="2.5"/>',
  ],
];

export function loadTemplateImages(renderDrawing) {
  return templateDefs.map(([name, emoji, paths]) => {
    if (!paths) return null;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 110"><g fill="white" stroke="#564b47" stroke-width="3.8" stroke-linejoin="round" stroke-linecap="round">' +
      paths +
      "</g></svg>";
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    img.onload = () => renderDrawing();
    return img;
  });
}
