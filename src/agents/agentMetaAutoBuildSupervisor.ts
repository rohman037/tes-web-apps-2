import { dbGetPendingSchemaChanges, dbSavePendingSchemaChange } from '../db/dbService';
import { logAdminAction } from '../lib/admin/auditLog';

export interface SchemaProposalResult {
  hasPendingProposal: boolean;
  proposedChangeId?: string;
  description?: string;
  timestamp: string;
}

export async function superviseMetaAutoBuild(
  currentAgentsCount: number = 23,
  fullAutoEnabled: boolean = false
): Promise<SchemaProposalResult> {
  const pending = await dbGetPendingSchemaChanges();
  
  if (fullAutoEnabled && pending.length === 0) {
    const proposalId = `schema_prop_${Date.now()}`;
    const newProposal = {
      id: proposalId,
      description: 'Pengusulan penambahan indeks kolom timestamp pada tabel tracking_events untuk optimasi query analytics skala tinggi.',
      suggestedDrizzleFields: 'index("tracking_events_created_at_idx").on(table.createdAt)',
      proposedByAgentId: 'agent_meta_auto_build_supervisor',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await dbSavePendingSchemaChange(newProposal);

    logAdminAction(
      'Agent Meta Auto Build Supervisor',
      `Proposal Skema Postgres Baru diajukan (Pending Review Admin): ${newProposal.description}`,
      'system',
      'Agent Meta Auto Build Supervisor'
    );

    return {
      hasPendingProposal: true,
      proposedChangeId: proposalId,
      description: newProposal.description,
      timestamp: newProposal.createdAt,
    };
  }

  return {
    hasPendingProposal: pending.length > 0,
    proposedChangeId: pending[0]?.id,
    description: pending[0]?.description,
    timestamp: new Date().toISOString(),
  };
}
