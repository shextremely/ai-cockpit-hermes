import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const chatOpen = ref(false);

  function openChat(): void {
    chatOpen.value = true;
  }

  return { chatOpen, openChat };
});
