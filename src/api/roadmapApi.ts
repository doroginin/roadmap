// API функции для работы с roadmap данными
import type { 
  ApiResponse, 
  RoadmapData, 
  SaveResponse 
} from './types';

const API_BASE_URL = 'http://localhost:8080';

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
      data: { 
        version: 0,
        teams: [], 
        sprints: [], 
        functions: [],
        employees: [],
        resources: [],
        tasks: []
      }, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function saveRoadmapData(
  data: Partial<RoadmapData>, 
  currentVersion: number
): Promise<ApiResponse<SaveResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/data`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: currentVersion,
        ...data
      })
    });

    const result = await response.json();

    if (response.ok) {
      return { data: result };
    } else {
      return { 
        data: { version: currentVersion, success: false }, 
        error: result.error || `HTTP error! status: ${response.status}` 
      };
    }
  } catch (error) {
    console.error('Error saving roadmap data:', error);
    return { 
      data: { version: currentVersion, success: false }, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function fetchVersion(): Promise<ApiResponse<{ version: number }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/version`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('Error fetching version:', error);
    return { 
      data: { version: 0 }, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
