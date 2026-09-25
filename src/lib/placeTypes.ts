import type { Category, Place } from './types';

/**
 * Quick "type" chips per category (Explore). Subcategories are free text from research,
 * so each chip matches a regex against subcategory + cuisine + name (plus a few specific tags).
 */
export interface PlaceType {
  key: string;
  label: string;
  re: RegExp; // tested against subcategory + cuisine + name
  tags?: string[]; // or: any of these tags
}

export const PLACE_TYPES: Partial<Record<Category, PlaceType[]>> = {
  food: [
    { key: 'italian', label: 'Italian & pizza', re: /italian|pasta|pizz|trattoria|osteria/ },
    { key: 'steak', label: 'Steak', re: /steak/ },
    { key: 'american', label: 'Burgers & American', re: /burger|american|bama/ },
    { key: 'french', label: 'French', re: /french|bistro|pâtisserie|patisserie/ },
    { key: 'spanish', label: 'Spanish & Mediterranean', re: /spanish|tapas|mediterranean/ },
    { key: 'mexican', label: 'Mexican & Latin', re: /mexican|taco|brazil|churrasc/ },
    { key: 'brunch', label: 'Brunch & bakery', re: /brunch|bakery/ },
    { key: 'buffet', label: 'Hotel buffets', re: /buffet/ },
    { key: 'kbbq', label: 'Korean BBQ & hanwoo', re: /korean bbq|hanwoo|korean pork|galbi|butcher/ },
    { key: 'korean', label: 'Korean classics', re: /korean home|soups|stew|noodles|naengmyeon|kalguksu|jokbal|korean fine|temple|street & market|fried chicken/ },
    { key: 'japanese', label: 'Japanese & sushi', re: /japanese|sushi|ramen|omakase|yakitori/ },
    { key: 'chinese', label: 'Chinese & dim sum', re: /chinese|dim sum|cantonese|taiwanese/ },
    { key: 'asian', label: 'Thai, Viet & Indian', re: /thai|vietnam|indian|middle eastern/ },
    { key: 'seafood', label: 'Seafood', re: /seafood|crab|fish/ },
    { key: 'fusion', label: 'Modern & fusion', re: /fusion/ },
  ],
  bar: [
    { key: 'rooftop', label: 'Rooftop & views', re: /rooftop|sky bar|\bsky\b|view/, tags: ['rooftop', 'night-view'] },
    { key: 'cocktail', label: 'Cocktails', re: /cocktail|speakeasy|mixolog/ },
    { key: 'wine', label: 'Wine', re: /wine|vino/ },
    { key: 'whisky', label: 'Whisky', re: /whisk/ },
    { key: 'jazz', label: 'Jazz & live music', re: /jazz|live music|vinyl|lp bar|record/, tags: ['live-music'] },
    { key: 'hotel', label: 'Hotel bars', re: /hotel|marriott|hyatt|signiel|four seasons|conrad|josun|mondrian|shilla|sofitel/, tags: ['hotel'] },
    { key: 'beer', label: 'Beer & pubs', re: /beer|hof|pub|chimaek|highball|izakaya|brew|pocha/ },
    { key: 'korean', label: 'Korean liquor', re: /makgeolli|traditional liquor|soju|korean spirits|jeon/ },
  ],
  cafe: [
    { key: 'coffee', label: 'Coffee', re: /coffee|roaster|roastery|drip/ },
    { key: 'bakery', label: 'Bakery', re: /bakery|bagel|bread|donut|scone|pâtisserie/ },
    { key: 'dessert', label: 'Dessert', re: /dessert|bingsu|cake/ },
    { key: 'tea', label: 'Tea & afternoon tea', re: /\btea\b|afternoon tea/ },
    { key: 'view', label: 'Views & rooftops', re: /rooftop|river|view|floating/ },
    { key: 'big', label: 'Big & architectural', re: /large|industrial|warehouse|flagship|library|gallery|futuristic|factory/ },
  ],
  sight: [
    { key: 'views', label: 'Observatories & views', re: /observatory|viewpoint|tower|\bsky\b|skyway/, tags: ['view', 'night-view'] },
    { key: 'modern', label: 'Modern architecture', re: /architecture|landmark|design centre|media facade|futuristic|library/, tags: ['high-tech'] },
    { key: 'art', label: 'Art & museums', re: /art museum|arts complex|contemporary|photograph|robot|\bart\b|gallery|museum of art/ },
    { key: 'parks', label: 'Parks & river', re: /park|river|stream|lake|forest|garden|island/, tags: ['han-river'] },
    { key: 'streets', label: 'Streets & neighbourhoods', re: /street|neighbourhood|square|village|evening/ },
    { key: 'daytrip', label: 'Day trips', re: /day trip/ },
    { key: 'heritage', label: 'Palaces & heritage', re: /palace|temple|historic|history|hanok|tomb|traditional|national museum|fortress/, tags: ['palace'] },
  ],
  shopping: [
    { key: 'mall', label: 'Malls', re: /\bmall\b|starfield|times square|arcade|underground shopping/ },
    { key: 'dept', label: 'Department stores & food halls', re: /department|food hall|gourmet|supermarket|food market/ },
    { key: 'outlet', label: 'Outlets', re: /outlet/ },
    { key: 'flagship', label: 'Flagships & concept stores', re: /flagship|concept|lifestyle|eyewear|record|tech|stationery|design store|muji|book/ },
    { key: 'beauty', label: 'K-beauty', re: /beauty|cosmetic|olive young/, tags: ['k-beauty'] },
    { key: 'streets', label: 'Shopping streets & markets', re: /street|market|rodeo|garosu/ },
    { key: 'characters', label: 'Characters & K-pop', re: /character|k-pop|friends|pokemon|pokémon/, tags: ['k-pop'] },
  ],
  experience: [
    { key: 'cinema', label: 'Cinemas', re: /cinema|imax|dolby|screen/ },
    { key: 'shows', label: 'Shows', re: /non-verbal|show|comedy|theatre|musical/ },
    { key: 'exhibit', label: 'Exhibitions & immersive', re: /exhibition|immersive|art|sensory|brand experience/ },
    { key: 'river', label: 'River cruises & balloon', re: /cruise|boat|river|sailing|water bus|balloon/ },
    { key: 'fun', label: 'Aquariums & theme parks', re: /aquarium|theme|resort|night market/ },
    { key: 'cars', label: 'Car showrooms', re: /car brand|motorstudio|genesis/ },
  ],
  wellness: [
    { key: 'massage', label: 'Massage', re: /massage|body care|foot/ },
    { key: 'spa', label: 'Spas', re: /\bspa\b|ginseng|skincare treatment/ },
    { key: 'sauna', label: 'Jjimjilbang & sauna', re: /jjimjilbang|sauna|water park/ },
    { key: 'skin', label: 'Skincare', re: /skin|facial|beauty spa/ },
  ],
};

const text = (p: Place) => [p.subcategory, ...(p.cuisine ?? []), p.name].join(' ').toLowerCase();

export function matchesType(p: Place, key: string): boolean {
  const t = PLACE_TYPES[p.category]?.find((x) => x.key === key);
  return !!t && (t.re.test(text(p)) || !!t.tags?.some((tag) => p.tags.includes(tag)));
}
