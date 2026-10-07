// Fresno State posts each week's residence dining menu as a PDF named after the
// week's Sunday, with inconsistent zero padding (menu-2025-10-5.pdf,
// menu-2025-09-07.pdf). No parser exists for that, so Claude reads the PDF.
const BASE = 'https://auxiliary.fresnostate.edu/association/dining/documents/rdh_menus';

module.exports = {
  slug: 'fresno-state',
  adapter: 'ai-extract',
  fetchMode: 'http',
  aiExtract: {
    estimateMissingNutrition: true,
    halls: [
      {
        name: 'University Dining Hall',
        slug: 'university-dining-hall',
        weekStartsOn: 0,
        urls: [`${BASE}/menu-{yyyy}-{m}-{d}.pdf`, `${BASE}/menu-{yyyy}-{mm}-{dd}.pdf`],
      },
    ],
  },
};
