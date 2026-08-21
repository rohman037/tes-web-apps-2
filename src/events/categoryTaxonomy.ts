export interface SubCategoryItem {
  id: string;
  name: string;
  keywords: string[];
}

export interface MainCategoryItem {
  id: string;
  name: string;
  keywords: string[];
  requiresManualReview?: boolean;
  subcategories?: SubCategoryItem[];
}

export const CATEGORY_TAXONOMY: MainCategoryItem[] = [
  {
    id: 'fashion',
    name: 'Fashion & Pakaian',
    keywords: ['outfit', 'baju', 'celana', 'dress', 'hijab', 'skincare', 'style', 'fashion', 'ootd', 'sepatu', 'tas', 'aksesoris', 'jaket', 'kaos'],
    subcategories: [
      { id: 'fashion_pria', name: "Fashion Pria (Men's Fashion)", keywords: ['pria', 'cowok', 'men', 'kemeja pria', 'celana pria'] },
      { id: 'fashion_wanita', name: "Fashion Wanita (Women's Fashion)", keywords: ['wanita', 'cewek', 'women', 'dress', 'rok', 'blouse', 'tunik'] },
      { id: 'fashion_muslim', name: 'Fashion Muslim & Hijab', keywords: ['hijab', 'gamis', 'kerudung', 'pashmina', 'abaya', 'kokoh'] }
    ]
  },
  {
    id: 'beauty_grooming',
    name: 'Beauty & Skincare',
    keywords: ['makeup', 'skincare', 'serum', 'sunscreen', 'lipstik', 'toner', 'moisturizer', 'kecantikan', 'glowing', 'jerawat', 'cleanser'],
    subcategories: [
      { id: 'skincare_wanita', name: 'Skincare & Makeup Wanita', keywords: ['skincare', 'makeup', 'serum', 'lipstik', 'cushion', 'blush'] },
      { id: 'grooming_pria', name: 'Men Grooming & Perawatan Pria', keywords: ['pomade', 'beard', 'grooming', 'sabun cuci muka pria', 'shampoo pria'] }
    ]
  },
  {
    id: 'herbal_kesehatan',
    name: 'Herbal & Kesehatan',
    keywords: ['herbal', 'obat', 'jamu', 'suplemen', 'vitamins', 'kesehatan', 'madu', 'terapi', 'penyakit', 'diet', 'langsing', 'stamina', 'detox'],
    requiresManualReview: true, // MANDATORY MANUAL REVIEW
    subcategories: [
      { id: 'herbal_alami', name: 'Suplemen & Jamu Herbal Alami', keywords: ['jamu', 'madu', 'herbal', 'ekstrak', 'resep dokter'] },
      { id: 'kesehatan_alat', name: 'Alat & Terapi Kesehatan', keywords: ['alat kesehatan', 'terapi', 'pijat', 'korset', 'kacamata terapi'] }
    ]
  },
  {
    id: 'rumah_tangga',
    name: 'Perabot & Rumah Tangga',
    keywords: ['perabot', 'dapur', 'alat dapur', 'dekorasi', 'sapu', 'sprei', 'kasur', 'organizer', 'kebersihan', 'masak'],
    subcategories: [
      { id: 'peralatan_dapur', name: 'Peralatan Dapur & Masak', keywords: ['panci', 'wajan', 'pisau', 'blender', 'air fryer', 'piring'] },
      { id: 'dekorasi_kamar', name: 'Dekorasi & Perlengkapan Kamar', keywords: ['sprei', 'bantal', 'gorden', 'lampu tidur', 'rak'] }
    ]
  },
  {
    id: 'teknologi_gadget',
    name: 'Teknologi & Gadget',
    keywords: ['hp', 'gadget', 'headphone', 'casing', 'charger', 'powerbank', 'laptop', 'smartwatch', 'twss', 'elektronik'],
    subcategories: [
      { id: 'aksesoris_hp', name: 'Aksesoris HP & Tablet', keywords: ['casing', 'tempered glass', 'charger', 'holder', 'powerbank'] },
      { id: 'audio_smartwear', name: 'Audio & Smartwatch', keywords: ['tws', 'headphone', 'speaker', 'smartwatch', 'earphone'] }
    ]
  },
  {
    id: 'kuliner_makanan',
    name: 'Kuliner & Makanan-Minuman',
    keywords: ['makanan', 'snack', 'jajanan', 'kopi', 'minuman', 'pedas', 'keripik', 'resep', 'kuliner', 'mukbang', 'frozen food'],
    subcategories: [
      { id: 'snack_jajanan', name: 'Snack & Camilan Kekinian', keywords: ['keripik', 'baso goreng', 'basreng', 'cookies', 'cokelat', 'pedas'] },
      { id: 'minuman_kopi', name: 'Minuman & Kopi Instant', keywords: ['kopi', 'boba', 'matcha', 'susu', 'sirup', 'tea'] }
    ]
  },
  {
    id: 'umum',
    name: 'Umum & Lainnya',
    keywords: ['viral', 'foryou', 'trending', 'random', 'daily', 'review', 'racun'],
    subcategories: []
  }
];

export function findCategoryByKeyword(text: string): { main: MainCategoryItem; sub?: SubCategoryItem } {
  const clean = text.toLowerCase();

  // Mandatory check for Herbal & Kesehatan first
  const herbalCat = CATEGORY_TAXONOMY.find((c) => c.id === 'herbal_kesehatan');
  if (herbalCat && herbalCat.keywords.some((k) => clean.includes(k))) {
    const subMatch = herbalCat.subcategories?.find((sub) => sub.keywords.some((sk) => clean.includes(sk)));
    return { main: herbalCat, sub: subMatch };
  }

  for (const mainCat of CATEGORY_TAXONOMY) {
    if (mainCat.id === 'umum') continue;
    const matchesMain = mainCat.keywords.some((k) => clean.includes(k));
    if (matchesMain) {
      const subMatch = mainCat.subcategories?.find((sub) => sub.keywords.some((sk) => clean.includes(sk)));
      return { main: mainCat, sub: subMatch };
    }
  }

  const defaultCat = CATEGORY_TAXONOMY.find((c) => c.id === 'umum')!;
  return { main: defaultCat };
}
