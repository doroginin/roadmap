export interface RoadmapData {
  version: number;
  teams: TeamData[];
  sprints: Sprint[];
  functions: Function[];
  employees: Employee[];
  resources: Resource[];
  tasks: Task[];
}

export interface Resource {
  id: string;
  kind: "resource";
  team: string[];
  fn: string;
  empl?: string;
  weeks: number[];
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  kind: "task";
  status: "Todo" | "Backlog" | "Cancelled";
  sprintsAuto: string[];
  epic?: string;
  task: string;
  team: string;
  fn: string;
  empl?: string;
  planEmpl: number;
  planWeeks: number;
  blockerIds: string[];
  weekBlockers: number[];
  fact: number;
  startWeek?: number | null;
  endWeek?: number | null;
  expectedStartWeek?: number | null;
  manualEdited: boolean;
  autoPlanEnabled: boolean;
  weeks: number[];
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Function {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sprint {
  code: string;
  start: string;
  end: string;
}

export interface TeamData {
  name: string;
  jiraProject: string;
  featureTeam: string;
  issueType: string;
}

export interface SaveResponse {
  version: number;
  success: boolean;
  error?: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface AutoSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  hasUnsavedChanges: boolean;
}

export interface UseAutoSaveOptions {
  delay?: number;
  enabled?: boolean;
  onSaveSuccess?: (version: number) => void;
  onSaveError?: (error: string) => void;
}

