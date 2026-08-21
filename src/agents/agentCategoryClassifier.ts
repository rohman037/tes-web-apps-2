import { dbGetCategoryTaxonomy } from '../db/dbService';
import { logAdminAction } from '../lib/admin/auditLog';

export interface CategoryClassificationResult {
  categoryId: string;
  categoryName: string;
  confidence: number;
  matchedKeywords: string[];
  requiresManualReview: boolean;
  timestamp: string;
}

export async function classifyContentCategory(
  contentSummary: string
): Promise<CategoryClassificationResult> {
  const taxonomy = await dbGetCategoryTaxonomy();
  const lowerContent = contentSummary.toLowerCase();

  let bestMatchCategory = taxonomy[0] || { id: 'fashion', name: 'Fashion & Aksesoris', keywords: ['baju', 'fashion'], requiresManualReview: false };
  let highestMatchCount = 0;
  let matchedKeywords: string[] = [];

  for (const cat of taxonomy) {
    const keywords = Array.isArray(cat.keywords) ? cat.keywords : [];
    const matched = keywords.filter((kw) => lowerContent.includes(kw.toLowerCase()));
    if (matched.length > highestMatchCount) {
      highestMatchCount = matched.length;
      bestMatchCategory = cat;
      matchedKeywords = matched;
    }
  }

  const confidence = Math.min(100, Math.max(50, 60 + highestMatchCount * 12));
  const requiresManualReview = bestMatchCategory.requiresManualReview || confidence < 65;

  const result: CategoryClassificationResult = {
    categoryId: bestMatchCategory.id,
    categoryName: bestMatchCategory.name,
    confidence,
    matchedKeywords,
    requiresManualReview,
    timestamp: new Date().toISOString(),
  };

  logAdminAction(
    'Agent Category Classifier',
    `Klasifikasi Kategori: ${bestMatchCategory.name} (Skor: ${confidence}%). Match keywords: ${matchedKeywords.join(', ')}`,
    'system',
    'Agent Category Classifier'
  );

  return result;
}
