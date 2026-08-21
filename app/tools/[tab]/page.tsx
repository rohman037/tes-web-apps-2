'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import App from '@/src/App';

export default function ToolsTabPage() {
  const params = useParams();
  const tab = typeof params?.tab === 'string' ? params.tab : 'pengaturan';

  return <App initialView="workspace" initialTab={tab} />;
}
