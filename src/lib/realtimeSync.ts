// [REALTIME-FIX] Central Realtime Sync Service powered by sseManager Singleton
import { getUserSession } from './auth';
import { sseManager } from './sseManager';

let hydrationPromise: Promise<void> | null = null;
let lastHydrationTimestamp = 0;

export async function hydrateDataFromServer(force = false): Promise<void> {
  const now = Date.now();
  if (!force && hydrationPromise) {
    return hydrationPromise;
  }
  if (!force && now - lastHydrationTimestamp < 5000) {
    // Avoid hammering the backend if called multiple times within 5 seconds
    return;
  }

  lastHydrationTimestamp = now;
  hydrationPromise = (async () => {
    try {
      const [trxRes, clientsRes, codesRes, pkgsRes, qrisRes, contactRes, keysRes, agentsRes] = await Promise.allSettled([
        fetch('/api/transactions').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/admin/clients').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/access-codes').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/packages').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/admin/qris').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/admin/contact-settings').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/apikeys').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/agents').then((r) => (r.ok ? r.json() : null)),
      ]);

      if (trxRes.status === 'fulfilled' && Array.isArray(trxRes.value)) {
        localStorage.setItem('satset_transactions_db', JSON.stringify(trxRes.value));
        window.dispatchEvent(new Event('transactions-updated'));
      }

      if (clientsRes.status === 'fulfilled' && Array.isArray(clientsRes.value)) {
        localStorage.setItem('satset_clients_data', JSON.stringify(clientsRes.value));
        window.dispatchEvent(new Event('satset_clients_updated'));
      }

      if (codesRes.status === 'fulfilled' && Array.isArray(codesRes.value)) {
        localStorage.setItem('satset_valid_access_codes', JSON.stringify(codesRes.value));
        window.dispatchEvent(new Event('satset_access_codes_updated'));
      }

      if (pkgsRes.status === 'fulfilled' && Array.isArray(pkgsRes.value) && pkgsRes.value.length > 0) {
        localStorage.setItem('satset_packages_data', JSON.stringify(pkgsRes.value));
        localStorage.setItem('satset_packages_db', JSON.stringify(pkgsRes.value));
        window.dispatchEvent(new Event('satset_packages_updated'));
      }

      if (qrisRes.status === 'fulfilled' && qrisRes.value && typeof qrisRes.value === 'object') {
        localStorage.setItem('satset_qris_config', JSON.stringify(qrisRes.value));
        window.dispatchEvent(new Event('satset_qris_updated'));
      }

      if (contactRes.status === 'fulfilled' && contactRes.value && typeof contactRes.value === 'object') {
        localStorage.setItem('satset_contact_settings', JSON.stringify(contactRes.value));
        window.dispatchEvent(new Event('satset_contact_settings_updated'));
      }

      if (keysRes.status === 'fulfilled' && Array.isArray(keysRes.value) && keysRes.value.length > 0) {
        localStorage.setItem('satset_apikeys_data', JSON.stringify(keysRes.value));
        window.dispatchEvent(new Event('satset_apikeys_updated'));
      }

      if (agentsRes.status === 'fulfilled' && Array.isArray(agentsRes.value) && agentsRes.value.length > 0) {
        localStorage.setItem('satset_ai_agents_data', JSON.stringify(agentsRes.value));
        localStorage.setItem('satset_ai_agents', JSON.stringify(agentsRes.value));
        window.dispatchEvent(new Event('satset_ai_agents_updated'));
      }
    } catch (err) {
      console.warn('[RealtimeSync] Error hydrating data from server:', err);
    } finally {
      hydrationPromise = null;
    }
  })();

  return hydrationPromise;
}

export function initRealtimeSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  // Hydrate initially from server REST endpoints
  hydrateDataFromServer();

  // Subscribe to central sseManager singleton (Observer Pattern)
  const unsubscribeSSE = sseManager.subscribe((data) => {
    try {
      if (!data || typeof data !== 'object') return;

      // 1. Transaction update
      if (data.type === 'transaction_updated') {
        if (data.transaction) {
          const raw = localStorage.getItem('satset_transactions_db');
          let list: any[] = [];
          if (raw) {
            try {
              list = JSON.parse(raw);
              if (!Array.isArray(list)) list = [];
            } catch (e) {
              list = [];
            }
          }
          const existingIdx = list.findIndex((t) => t.id === data.transaction.id);
          if (existingIdx >= 0) {
            list[existingIdx] = { ...list[existingIdx], ...data.transaction };
          } else {
            list.unshift(data.transaction);
          }
          localStorage.setItem('satset_transactions_db', JSON.stringify(list));
        } else {
          fetch('/api/transactions')
            .then((r) => r.json())
            .then((list) => {
              if (Array.isArray(list)) {
                localStorage.setItem('satset_transactions_db', JSON.stringify(list));
                window.dispatchEvent(new Event('transactions-updated'));
              }
            })
            .catch(() => {});
        }

        window.dispatchEvent(new Event('transactions-updated'));

        const currentSession = getUserSession();
        if (currentSession && data.event?.accessCode === currentSession.code) {
          window.dispatchEvent(new Event('satset_auth_updated'));
        }
      }

      // 2. Clients update
      if (data.type === 'clients_updated') {
        if (Array.isArray(data.clients)) {
          localStorage.setItem('satset_clients_data', JSON.stringify(data.clients));
          window.dispatchEvent(new Event('satset_clients_updated'));
        } else {
          fetch('/api/admin/clients')
            .then((r) => r.json())
            .then((list) => {
              if (Array.isArray(list)) {
                localStorage.setItem('satset_clients_data', JSON.stringify(list));
                window.dispatchEvent(new Event('satset_clients_updated'));
              }
            })
            .catch(() => {});
        }
      }

      // 3. Access codes update
      if (data.type === 'access_codes_updated') {
        if (Array.isArray(data.accessCodes)) {
          localStorage.setItem('satset_valid_access_codes', JSON.stringify(data.accessCodes));
          window.dispatchEvent(new Event('satset_access_codes_updated'));
        } else {
          fetch('/api/access-codes')
            .then((r) => r.json())
            .then((list) => {
              if (Array.isArray(list)) {
                localStorage.setItem('satset_valid_access_codes', JSON.stringify(list));
                window.dispatchEvent(new Event('satset_access_codes_updated'));
              }
            })
            .catch(() => {});
        }
      }

      // 3b. Transactions update
      if (data.type === 'transaction_updated' || data.type === 'transactions_updated') {
        if (Array.isArray(data.transactions)) {
          localStorage.setItem('satset_transactions_db', JSON.stringify(data.transactions));
        } else if (data.transaction) {
          try {
            const rawTrx = localStorage.getItem('satset_transactions_db');
            const list = rawTrx ? JSON.parse(rawTrx) : [];
            if (Array.isArray(list)) {
              const idx = list.findIndex((t: any) => t.id === data.transaction.id);
              if (idx >= 0) {
                list[idx] = { ...list[idx], ...data.transaction };
              } else {
                list.unshift(data.transaction);
              }
              localStorage.setItem('satset_transactions_db', JSON.stringify(list));
            }
          } catch (e) {}
        }
        window.dispatchEvent(new Event('transactions-updated'));
        window.dispatchEvent(new Event('satset_transactions_updated'));
      }

      // 4. Packages update
      if (data.type === 'packages_updated') {
        if (Array.isArray(data.packages) && data.packages.length > 0) {
          localStorage.setItem('satset_packages_data', JSON.stringify(data.packages));
          localStorage.setItem('satset_packages_db', JSON.stringify(data.packages));
          window.dispatchEvent(new Event('satset_packages_updated'));
        }
      }

      // 5. QRIS update
      if (data.type === 'qris_updated') {
        if (data.qrisConfig) {
          localStorage.setItem('satset_qris_config', JSON.stringify(data.qrisConfig));
          window.dispatchEvent(new Event('satset_qris_updated'));
        }
      }

      // 6. Contact settings update
      if (data.type === 'contact_settings_updated') {
        if (data.contactSettings) {
          localStorage.setItem('satset_contact_settings', JSON.stringify(data.contactSettings));
          window.dispatchEvent(new Event('satset_contact_settings_updated'));
        }
      }

      // 7. Audit logs update
      if (data.type === 'audit_logs_updated') {
        if (Array.isArray(data.auditLogs)) {
          localStorage.setItem('satset_audit_logs', JSON.stringify(data.auditLogs));
          window.dispatchEvent(new Event('satset_audit_logs_updated'));
        }
      }

      // 8. Learning Queue update
      if (data.type === 'learning_queue_updated') {
        if (data.queue) {
          localStorage.setItem('satset_learning_queue', JSON.stringify(data.queue));
        }
        window.dispatchEvent(new Event('satset_learning_queue_updated'));
      }

      // 9. System Memory update
      if (data.type === 'system_memory_updated') {
        if (data.memory) {
          localStorage.setItem('satset_system_memory', JSON.stringify(data.memory));
        }
        window.dispatchEvent(new Event('satset_system_memory_updated'));
      }

      // 10. Anomaly Detected alert
      if (data.type === 'anomaly_detected') {
        window.dispatchEvent(new CustomEvent('satset_anomaly_detected', { detail: data }));
      }

      // 11. Growth Scaling update
      if (data.type === 'growth_scaling_updated') {
        if (data.data) {
          localStorage.setItem('satset_growth_scaling', JSON.stringify(data.data));
        }
        window.dispatchEvent(new Event('satset_growth_scaling_updated'));
      }

      // 12. AI Agents update
      if (data.type === 'ai_agents_updated') {
        const agentList = data.agents || data.data;
        if (agentList) {
          localStorage.setItem('satset_ai_agents_data', JSON.stringify(agentList));
          localStorage.setItem('satset_ai_agents', JSON.stringify(agentList));
        }
        window.dispatchEvent(new Event('satset_ai_agents_updated'));
      }

      // 12b. Master Formulas update
      if (data.type === 'formulas_updated') {
        if (Array.isArray(data.formulas)) {
          localStorage.setItem('satset_prompt_formulas', JSON.stringify(data.formulas));
        }
        window.dispatchEvent(new Event('satset_formulas_updated'));
      }

      // 12c. User UI Settings update
      if (data.type === 'user_ui_settings_updated' || data.type === 'customizer_updated') {
        if (data.settings) {
          localStorage.setItem('satset_user_ui_settings', JSON.stringify(data.settings));
        }
        window.dispatchEvent(new Event('satset_user_ui_settings_updated'));
      }

      // 12d. Announcements update
      if (data.type === 'announcements_updated' || data.type === 'announcement_broadcast') {
        if (Array.isArray(data.announcements)) {
          localStorage.setItem('satset_announcements', JSON.stringify(data.announcements));
        }
        window.dispatchEvent(new Event('satset_announcements_updated'));
      }

      // 13. API Keys update
      if (data.type === 'apikeys_updated') {
        if (data.keys) {
          localStorage.setItem('satset_apikeys_data', JSON.stringify(data.keys));
        }
        window.dispatchEvent(new Event('satset_apikeys_updated'));
      }

      // 14. Active Status update
      if (data.type === 'active_status_update') {
        window.dispatchEvent(new CustomEvent('satset_active_status_updated', { detail: data }));
      }
    } catch (err) {
      console.warn('[RealtimeSync Handler Error]', err);
    }
  });

  return () => {
    unsubscribeSSE();
  };
}
