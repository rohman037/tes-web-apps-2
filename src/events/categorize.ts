export type ContentCategory =
  | 'fashion_beauty'
  | 'herbal_kesehatan'
  | 'rumah_tangga'
  | 'teknologi'
  | 'makanan_minuman'
  | 'umum';

const CATEGORY_KEYWORDS: Record<Exclude<ContentCategory, 'umum'>, string[]> = {
  herbal_kesehatan: [
    'herbal', 'obat', 'jamu', 'suplemen', 'vitamin', 'kesehatan', 'penyakit', 'medis',
    'tensi', 'gula darah', 'diet', 'detox', 'terapi', 'kolesterol', 'lambung', 'ginjal',
    'propolis', 'madu', 'salep', 'herbs', 'kapsul', 'kronis', 'gejala', 'racikan'
  ],
  fashion_beauty: [
    'baju', 'pakaian', 'dress', 'gamis', 'hijab', 'kerudung', 'outfit', 'skincare',
    'makeup', 'serum', 'lipstik', 'fashion', 'celana', 'sepatu', 'kemeja', 'blazer',
    'tas', 'kecantikan', 'lotion', 'sunscreen', 'atasan', 'kulot', 'tunik', 'parfum'
  ],
  rumah_tangga: [
    'rumah', 'dapur', 'panci', 'wajan', 'sapu', 'pel', 'dekorasi', 'perabot',
    'kasur', 'bantal', 'jemuran', 'organizer', 'wadah', 'gantungan', 'kamar', 'rak',
    'cangkir', 'botol', 'blender', 'alat rumah', 'keperluan dapur'
  ],
  teknologi: [
    'hp', 'smartphone', 'laptop', 'komputer', 'gadget', 'ai', 'software', 'aplikasi',
    'headphone', 'earphone', 'bluetooth', 'smartwatch', 'kamera', 'charger', 'kabel',
    'tech', 'powerbank', 'proyektor', 'elektronik'
  ],
  makanan_minuman: [
    'makanan', 'minuman', 'kuliner', 'kopi', 'resep', 'snack', 'kue', 'cemilan',
    'krimer', 'bumbu', 'resto', 'rasa', 'manis', 'gurih', 'pedas', 'boba', 'coffe',
    'mendoan', 'sambal', 'katering', 'daging', 'buah'
  ],
};

export function categorizeContent(input: {
  productName?: string;
  caption?: string;
  topic?: string;
}): { category: ContentCategory; confidence: number; requiresReview?: boolean } {
  const combinedText = [
    input.productName || '',
    input.caption || '',
    input.topic || '',
  ]
    .join(' ')
    .toLowerCase();

  if (!combinedText.trim()) {
    return { category: 'umum', confidence: 0.5, requiresReview: true };
  }

  const scores: Record<Exclude<ContentCategory, 'umum'>, number> = {
    fashion_beauty: 0,
    herbal_kesehatan: 0,
    rumah_tangga: 0,
    teknologi: 0,
    makanan_minuman: 0,
  };

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [Exclude<ContentCategory, 'umum'>, string[]][]) {
    for (const kw of keywords) {
      if (combinedText.includes(kw)) {
        scores[cat] += 1;
      }
    }
  }

  let bestCategory: ContentCategory = 'umum';
  let highestScore = 0;

  for (const [cat, score] of Object.entries(scores) as [Exclude<ContentCategory, 'umum'>, number][]) {
    if (score > highestScore) {
      highestScore = score;
      bestCategory = cat;
    }
  }

  if (highestScore === 0) {
    return { category: 'umum', confidence: 0.5, requiresReview: true };
  }

  // Calculate confidence score (scaled 0.6 - 0.98 based on match count)
  const confidence = Math.min(0.98, 0.6 + highestScore * 0.1);

  // CRITICAL RULE: herbal_kesehatan ALWAYS requires manual review!
  if (bestCategory === 'herbal_kesehatan') {
    return {
      category: 'herbal_kesehatan',
      confidence,
      requiresReview: true,
    };
  }

  // Low confidence fallback
  if (confidence < 0.65) {
    return {
      category: 'umum',
      confidence,
      requiresReview: true,
    };
  }

  return {
    category: bestCategory,
    confidence,
    requiresReview: false,
  };
}
