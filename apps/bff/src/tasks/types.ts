export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'overdue';

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt?: string;
  category?: string;
  subtasks: SubTask[];
  remindBefore: number;
  remindEnabled: boolean;
  source?: 'manual' | 'text' | 'screenshot' | 'chat';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TaskSettings {
  defaultRemindBefore: number;
  priorityRules: {
    urgentDays: number;
    highDays: number;
    mediumDays: number;
  };
  sortBy: 'dueAt' | 'priority' | 'createdAt';
}

export interface TaskStore {
  tasks: TaskItem[];
  settings: TaskSettings;
}

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  q?: string;
  dueFrom?: string;
  dueTo?: string;
}

export interface TaskStats {
  total: number;
  done: number;
  overdue: number;
  inProgress: number;
  todo: number;
  completionRate: number;
  byPriority: Record<TaskPriority, number>;
  byStatus: Record<TaskStatus, number>;
  topOverdue: TaskItem[];
}

export const DEFAULT_SETTINGS: TaskSettings = {
  defaultRemindBefore: 60,
  priorityRules: { urgentDays: 1, highDays: 3, mediumDays: 7 },
  sortBy: 'dueAt',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
  overdue: '已逾期',
};
