import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '驾驶舱' } },
  { path: '/tfs', name: 'tfs', component: () => import('@/views/TfsView.vue'), meta: { title: 'TFS 工作台' } },
  { path: '/knowledge', name: 'knowledge', component: () => import('@/views/KnowledgeView.vue'), meta: { title: '知识库' } },
  { path: '/jobs', name: 'jobs', component: () => import('@/views/JobsView.vue'), meta: { title: '日程待办' } },
  { path: '/capabilities', name: 'capabilities', component: () => import('@/views/CapabilitiesView.vue'), meta: { title: '能力面板' } },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
