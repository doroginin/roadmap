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
  team: string[]; // Team names for display
  teamIds?: string[]; // Team UUIDs for saving (optional for backward compatibility)
  fn: string; // Function name for display
  functionId?: string; // Function UUID for saving
  empl?: string; // Employee name for display
  employeeId?: string; // Employee UUID for saving
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
  team: string; // Team name for display
  teamId?: string; // Team UUID for saving
  fn: string; // Function name for display
  functionId?: string; // Function UUID for saving
  empl?: string; // Employee name for display
  employeeId?: string; // Employee UUID for saving
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
  id?: string; // Team UUID
  name: string;
  jiraProject: string;
  featureTeam: string;
  issueType: string;
  createdAt?: string;
  updatedAt?: string;
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

