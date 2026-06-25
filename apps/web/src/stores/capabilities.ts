import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';

interface Capabilities {
  features?: Record<string, boolean>;
  [k: string]: unknown;
}

interface HealthResp {
  bff: string;
  hermes: unknown | null;
  error?: string;
}

export const useCapabilitiesStore = defineStore('capabilities', () => {
  const caps = ref<Capabilities | null>(null);
  const online = ref(false);
  const loaded = ref(false);

  function feature(name: string): boolean {
    return Boolean(caps.value?.features?.[name]);
  }

  async function refreshHealth(): Promise<void> {
    try {
      const h = await api.get<HealthResp>('/health');
      online.value = Boolean(h.hermes);
    } catch {
      online.value = false;
    }
  }

  async function load(): Promise<void> {
    await refreshHealth();
    try {
      caps.value = await api.get<Capabilities>('/capabilities');
    } catch {
      caps.value = null;
    } finally {
      loaded.value = true;
    }
  }

  return { caps, online, loaded, feature, load, refreshHealth };
});
