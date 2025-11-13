export interface RoadmapData {
  version: number;
  teams: TeamData[];
  sprints: Sprint[];
  resources: Resource[];
  tasks: Task[];
}

export interface Resource {
  id: string;
  teamIds?: string[]; // Team UUIDs for saving
  fn?: string; // Function name
  empl?: string; // Employee name
  fnBgColor?: string; // Function background color (hex)
  fnTextColor?: string; // Function text color (hex)
  weeks?: number[];
  displayOrder?: number;
}

export interface Task {
  id: string;
  status?: "Todo" | "Backlog" | "Cancelled";
  sprintsAuto?: string[];
  epic?: string;
  task?: string;
  teamId?: string; // Team UUID for saving
  fn?: string; // Function name
  empl?: string; // Employee name
  planEmpl?: number;
  planWeeks?: number;
  blockerIds?: string[];
  weekBlockers?: number[];
  fact?: number;
  startWeek?: number | null;
  endWeek?: number | null;
  expectedStartWeek?: number | null;
  autoPlanEnabled?: boolean;
  weeks?: number[];
  displayOrder?: number;
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

