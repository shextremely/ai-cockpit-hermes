<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { NDrawer, NDrawerContent, NInput, NButton, NSpace, NEmpty, NScrollbar } from 'naive-ui';
import MessageBubble from './MessageBubble.vue';
import ApprovalDialog from './ApprovalDialog.vue';
import { useChatStore } from '@/stores/chat';

defineProps<{ show: boolean }>();
const emit = defineEmits<{ 'update:show': [boolean] }>();

const chat = useChatStore();
const input = ref('');
const scrollRef = ref<InstanceType<typeof NScrollbar> | null>(null);

async function onSend(): Promise<void> {
  const text = input.value;
  input.value = '';
  await chat.send(text);
}

watch(
  () => chat.messages.map((m) => `${m.id}:${m.rev ?? 0}:${m.content.length}`).join('|'),
  async () => {
    await nextTick();
    scrollRef.value?.scrollTo({ top: 999999, behavior: chat.sending ? 'auto' : 'smooth' });
  },
);
</script>

<template>
  <NDrawer
    :show="show"
    :width="460"
    placement="right"
    display-directive="show"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <NDrawerContent title="统一对话" closable>
      <div style="display: flex; flex-direction: column; height: 100%">
        <NScrollbar ref="scrollRef" style="flex: 1">
          <NEmpty v-if="!chat.messages.length" description="向 Hermes 发起对话" style="margin-top: 40px" />
          <MessageBubble v-for="m in chat.messages" :key="`${m.id}-${m.rev ?? 0}`" :message="m" />
        </NScrollbar>

        <ApprovalDialog />

        <div style="padding-top: 12px">
          <NInput
            v-model:value="input"
            type="textarea"
            placeholder="问我点什么…(Enter 发送,Shift+Enter 换行)"
            :autosize="{ minRows: 1, maxRows: 4 }"
            @keydown.enter.exact.prevent="onSend"
          />
          <NSpace justify="end" style="margin-top: 8px">
            <NButton v-if="chat.sending" type="warning" size="small" @click="chat.stop()">停止</NButton>
            <NButton type="primary" size="small" :loading="chat.sending" @click="onSend">发送</NButton>
          </NSpace>
        </div>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>
