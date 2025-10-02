import type { RoadmapData, Task, Resource, TeamData, Sprint, Function, Employee } from '../api/types';

// Интерфейс для отслеживания изменений
export interface DataChanges {
  tasks?: Task[];
  resources?: Resource[];
  teams?: TeamData[];
  sprints?: Sprint[];
  functions?: Function[];
  employees?: Employee[];
  deleted?: {
    tasks?: string[];
    resources?: string[];
    teams?: string[];
    sprints?: string[];
    functions?: string[];
    employees?: string[];
  };
}

// Функция для глубокого сравнения объектов
function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return obj1 === obj2;
  
  if (typeof obj1 !== typeof obj2) return false;
  
  if (typeof obj1 !== 'object') return obj1 === obj2;
  
  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
  
  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
}

// Функция для сравнения массивов объектов по ID
function compareArraysById<T extends { id: string }>(
  oldArray: T[],
  newArray: T[]
): { added: T[]; updated: T[]; deleted: string[] } {
  const oldMap = new Map(oldArray.map(item => [item.id, item]));
  const newMap = new Map(newArray.map(item => [item.id, item]));
  
  const added: T[] = [];
  const updated: T[] = [];
  const deleted: string[] = [];
  
  // Найти добавленные и обновленные
  for (const [id, newItem] of newMap) {
    if (!oldMap.has(id)) {
      added.push(newItem);
    } else {
      const oldItem = oldMap.get(id)!;
      if (!deepEqual(oldItem, newItem)) {
        updated.push(newItem);
      }
    }
  }
  
  // Найти удаленные
  for (const [id] of oldMap) {
    if (!newMap.has(id)) {
      deleted.push(id);
    }
  }
  
  return { added, updated, deleted };
}

// Специальная функция для сравнения команд (TeamData с опциональным id)
function compareTeams(
  oldArray: TeamData[],
  newArray: TeamData[]
): { added: TeamData[]; updated: TeamData[]; deleted: string[] } {
  const oldMap = new Map(oldArray.map(item => [item.id || item.name, item]));
  const newMap = new Map(newArray.map(item => [item.id || item.name, item]));
  
  const added: TeamData[] = [];
  const updated: TeamData[] = [];
  const deleted: string[] = [];
  
  // Найти добавленные и обновленные
  for (const [key, newItem] of newMap) {
    if (!oldMap.has(key)) {
      added.push(newItem);
    } else {
      const oldItem = oldMap.get(key)!;
      if (!deepEqual(oldItem, newItem)) {
        updated.push(newItem);
      }
    }
  }
  
  // Найти удаленные
  for (const [key] of oldMap) {
    if (!newMap.has(key)) {
      deleted.push(key);
    }
  }
  
  return { added, updated, deleted };
}

// Специальная функция для сравнения спринтов (по code)
function compareSprints(
  oldArray: Sprint[],
  newArray: Sprint[]
): { added: Sprint[]; updated: Sprint[]; deleted: string[] } {
  const oldMap = new Map(oldArray.map(item => [item.code, item]));
  const newMap = new Map(newArray.map(item => [item.code, item]));
  
  const added: Sprint[] = [];
  const updated: Sprint[] = [];
  const deleted: string[] = [];
  
  // Найти добавленные и обновленные
  for (const [code, newItem] of newMap) {
    if (!oldMap.has(code)) {
      added.push(newItem);
    } else {
      const oldItem = oldMap.get(code)!;
      if (!deepEqual(oldItem, newItem)) {
        updated.push(newItem);
      }
    }
  }
  
  // Найти удаленные
  for (const [code] of oldMap) {
    if (!newMap.has(code)) {
      deleted.push(code);
    }
  }
  
  return { added, updated, deleted };
}

// Основная функция для вычисления изменений
export function calculateDataChanges(
  oldData: RoadmapData | null,
  newData: RoadmapData | null
): DataChanges {
  if (!oldData || !newData) {
    // Если нет старых данных, возвращаем пустые изменения
    return {};
  }
  
  const changes: DataChanges = {};
  
  // Сравниваем задачи
  const taskChanges = compareArraysById(oldData.tasks, newData.tasks);
  if (taskChanges.added.length > 0 || taskChanges.updated.length > 0) {
    changes.tasks = [...taskChanges.added, ...taskChanges.updated];
  }
  if (taskChanges.deleted.length > 0) {
    changes.deleted = { ...changes.deleted, tasks: taskChanges.deleted };
  }
  
  // Сравниваем ресурсы
  const resourceChanges = compareArraysById(oldData.resources, newData.resources);
  if (resourceChanges.added.length > 0 || resourceChanges.updated.length > 0) {
    changes.resources = [...resourceChanges.added, ...resourceChanges.updated];
  }
  if (resourceChanges.deleted.length > 0) {
    changes.deleted = { ...changes.deleted, resources: resourceChanges.deleted };
  }
  
  // Сравниваем команды
  const teamChanges = compareTeams(oldData.teams, newData.teams);
  if (teamChanges.added.length > 0 || teamChanges.updated.length > 0) {
    changes.teams = [...teamChanges.added, ...teamChanges.updated];
  }
  if (teamChanges.deleted.length > 0) {
    changes.deleted = { ...changes.deleted, teams: teamChanges.deleted };
  }
  
  // Сравниваем спринты
  const sprintChanges = compareSprints(oldData.sprints, newData.sprints);
  if (sprintChanges.added.length > 0 || sprintChanges.updated.length > 0) {
    changes.sprints = [...sprintChanges.added, ...sprintChanges.updated];
  }
  if (sprintChanges.deleted.length > 0) {
    changes.deleted = { ...changes.deleted, sprints: sprintChanges.deleted };
  }
  
  // Сравниваем функции
  const functionChanges = compareArraysById(oldData.functions, newData.functions);
  if (functionChanges.added.length > 0 || functionChanges.updated.length > 0) {
    changes.functions = [...functionChanges.added, ...functionChanges.updated];
  }
  if (functionChanges.deleted.length > 0) {
    changes.deleted = { ...changes.deleted, functions: functionChanges.deleted };
  }
  
  // Сравниваем сотрудников
  const employeeChanges = compareArraysById(oldData.employees, newData.employees);
  if (employeeChanges.added.length > 0 || employeeChanges.updated.length > 0) {
    changes.employees = [...employeeChanges.added, ...employeeChanges.updated];
  }
  if (employeeChanges.deleted.length > 0) {
    changes.deleted = { ...changes.deleted, employees: employeeChanges.deleted };
  }
  
  return changes;
}

// Функция для проверки, есть ли изменения
export function hasChanges(changes: DataChanges): boolean {
  return !!(
    changes.tasks?.length ||
    changes.resources?.length ||
    changes.teams?.length ||
    changes.sprints?.length ||
    changes.functions?.length ||
    changes.employees?.length ||
    changes.deleted?.tasks?.length ||
    changes.deleted?.resources?.length ||
    changes.deleted?.teams?.length ||
    changes.deleted?.sprints?.length ||
    changes.deleted?.functions?.length ||
    changes.deleted?.employees?.length
  );
}
