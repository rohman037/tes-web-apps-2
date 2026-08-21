import { dbSaveCategoryProposal } from '../db/dbService';
import { logAdminAction } from '../lib/admin/auditLog';

export interface CategoryProposalResult {
  proposalId: string;
  proposedName: string;
  keywords: string[];
  reason: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

export async function proposeNewCategoryTaxonomy(
  unclassifiedContent: string,
  lowConfidenceScore: number
): Promise<CategoryProposalResult> {
  const proposalId = `prop_${Date.now()}`;
  const keywords = unclassifiedContent
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 5);
  
  const proposedName = keywords.length > 0 ? `Kategori Baru: ${keywords[0].toUpperCase()}` : 'Kategori AI Niche Baru';
  const reason = `Klasifikasi konten memiliki skor kepercayaan rendah (${lowConfidenceScore}%). Diperlukan penambahan kategori baru ke taksonomi.`;

  const proposal = {
    id: proposalId,
    proposedId: `cat_${Date.now().toString(36)}`,
    name: proposedName,
    keywords,
    suggestedParentId: null,
    reason,
    confidence: lowConfidenceScore,
    status: 'pending' as const,
    requiresManualReview: true,
    proposedByAgentId: 'agent_taxonomy_proposer',
    createdAt: new Date().toISOString(),
  };

  await dbSaveCategoryProposal(proposal);

  logAdminAction(
    'Agent Taxonomy Proposer',
    `Pengajuan Kategori Baru (${proposedName}) dikirim ke antrean review admin. ID: ${proposalId}`,
    'system',
    'Agent Taxonomy Proposer'
  );

  return {
    proposalId,
    proposedName,
    keywords,
    reason,
    confidence: lowConfidenceScore,
    status: 'pending',
    timestamp: proposal.createdAt,
  };
}
