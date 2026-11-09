export const CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Health',
  'Entertainment',
  'Other',
]

export const CATEGORY_COLORS = {
  Food: '#f59e0b',
  Transport: '#3b82f6',
  Shopping: '#a855f7',
  Bills: '#64748b',
  Health: '#ef4444',
  Entertainment: '#ec4899',
  Other: '#6b7280',
}

// Words the chat parser recognizes as each category (lowercase)
export const CATEGORY_KEYWORDS = {
  Food: ['food', 'lunch', 'dinner', 'breakfast', 'dishes', '7-11','coffee', 'cafe', 'restaurant', 'grocery', 'groceries', 'meal', 'snack', 'drink', 'pizza', 'burger', 'tea', 'starbucks', 'mcdonald', 'market', 'coconut', 'egg', 'eggs', 'fruit', 'fruits', 'vegetable', 'bakery'],
  Transport: ['transport', 'taxi', 'bus', 'train', 'metro', 'mrt', 'fuel', 'gas', 'petrol', 'uber', 'grab', 'bolt', 'parking', 'fare', 'ride'],
  Shopping: ['shopping', 'shop', 'clothes', 'clothing', 'shoes', 'shirt', 'mall', 'amazon', 'bag', 'gift', 'charger', 'big c', 'bigc'],
  Bills: ['bills', 'bill', 'rent', ' visa report ', 'electricity', 'water', 'internet', 'wifi', 'phone', 'utility', 'subscription', 'netflix', 'spotify', 'insurance'],
  Health: ['health', 'doctor', 'medicine', 'pharmacy', 'hospital', 'dentist', 'gym', 'vitamins', 'clinic'],
  Entertainment: ['entertainment', 'movie', 'cinema', 'game', 'games', 'concert', 'beer', 'bar', 'party', 'music'],
  Other: ['other', 'misc'],
}
