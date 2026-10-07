// A food emoji for a dish name, shown as a small thumbnail until menus carry
// real photos. Ordered most specific first; falls back to a plate.
const RULES = [
  [/omelet|omelette|egg/i, '🍳'],
  [/pancake|waffle|french toast/i, '🥞'],
  [/bacon/i, '🥓'],
  [/sausage|bratwurst|hot dog/i, '🌭'],
  [/oat|porridge|grits|cereal/i, '🥣'],
  [/yogurt|parfait/i, '🍨'],
  [/fruit|berry|berries|melon/i, '🍓'],
  [/banana/i, '🍌'],
  [/apple/i, '🍎'],
  [/bagel/i, '🥯'],
  [/croissant|pastry|danish|muffin/i, '🥐'],
  [/toast|bread|roll|biscuit/i, '🍞'],
  [/hash ?brown|potato|fries|tots/i, '🥔'],
  [/pizza|calzone/i, '🍕'],
  [/burger|slider/i, '🍔'],
  [/burrito|wrap/i, '🌯'],
  [/taco|quesadilla|nacho/i, '🌮'],
  [/sushi|poke/i, '🍣'],
  [/salmon|cod|tilapia|fish|tuna|shrimp/i, '🐟'],
  [/curry|masala|tikka|dal|lentil/i, '🍛'],
  [/ramen|pho|noodle|lo mein|udon/i, '🍜'],
  [/pasta|spaghetti|penne|mac and cheese|mac & cheese|lasagna|ziti|marinara|alfredo/i, '🍝'],
  [/rice|risotto|paella/i, '🍚'],
  [/stir fry|tofu/i, '🥢'],
  [/soup|chili|stew|chowder|bisque/i, '🍲'],
  [/salad|greens|kale|spinach|lettuce/i, '🥗'],
  [/broccoli|green bean|vegetable|veggie|asparagus|zucchini|carrot/i, '🥦'],
  [/chicken|wing|tender|nugget|turkey/i, '🍗'],
  [/steak|beef|brisket|pork|ham|ribs|lamb/i, '🥩'],
  [/sandwich|sub|panini|hoagie|blt/i, '🥪'],
  [/cookie/i, '🍪'],
  [/cake|cupcake|brownie|pie|dessert/i, '🍰'],
  [/ice cream|gelato|frozen yogurt/i, '🍦'],
  [/coffee|latte|espresso/i, '☕'],
  [/smoothie|juice|shake/i, '🥤'],
];

export function foodGlyph(name) {
  const text = String(name || '');
  for (const [pattern, glyph] of RULES) if (pattern.test(text)) return glyph;
  return '🍽️';
}
