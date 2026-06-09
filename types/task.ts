export type TaskCategory = 'love' | 'career' | 'money' | 'growth';

export type TaskDifficulty = 'easy' | 'medium' | 'hard';

export type Task = {
  id: string;
  text: string;
  description: string;
  category: TaskCategory;
  estimatedMinutes: number;
  difficulty: TaskDifficulty;
  examples: string[];
};
