const fs = require('fs');
const path = require('path');

const targets = [
  'src/components/layouts/UserLayout.tsx',
  'src/components/tools/ContentIdeasTool.tsx',
  'src/components/tools/VideoFrameExtractorTool.tsx',
  'src/components/views/ApiKeySettingsView.tsx',
  'src/components/views/TransactionStatusView.tsx',
  'src/views/admin/AffiliateReferralPanel.tsx',
  'src/views/admin/AiAgentPanel.tsx',
  'src/views/admin/AnnouncementBroadcastPanel.tsx',
  'src/views/admin/ApiKeyManagementPanel.tsx',
  'src/views/admin/ClientMonitoringPanel.tsx',
  'src/views/admin/ContactSettingsPanel.tsx',
  'src/views/admin/CustomAccessPanel.tsx',
  'src/views/admin/DashboardOverviewPanel.tsx',
  'src/views/admin/KnowledgeInjectionPanel.tsx',
  'src/views/admin/LearningReviewPanel.tsx',
  'src/views/admin/LiveUserGenerationMonitorPanel.tsx',
  'src/views/admin/LoginActivityPanel.tsx',
  'src/views/admin/MemoryAgentSkillPanel.tsx'
];

targets.forEach(relPath => {
  const fullPath = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) {
    console.log('File not found:', fullPath);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf-8');
  
  const importRegex = /import\s+React\s*,\s*\{([^}]+)\}\s*from\s*['"]react['"]/;
  if (importRegex.test(content)) {
    content = content.replace(importRegex, (match, imports) => {
      const items = imports.split(',').map(s => s.trim()).filter(Boolean);
      if (!items.includes('useCallback')) {
        items.push('useCallback');
      }
      return `import React, { ${items.join(', ')} } from 'react'`;
    });
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log('Updated:', relPath);
  } else {
    console.log('Regex did not match for:', relPath);
  }
});
