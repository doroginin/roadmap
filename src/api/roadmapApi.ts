// API функции для работы с roadmap данными

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export async function fetchRoadmapData(): Promise<ApiResponse<RoadmapData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/data`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('Error fetching roadmap data:', error);
    return { 
      data: { rows: [], sprints: [], teams: [] }, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
