package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/lib/pq"

	"roadmap/internal/models"
)

type Repository struct {
	db *sql.DB
}

func New(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// GetCurrentVersion returns the current document version
func (r *Repository) GetCurrentVersion() (int64, error) {
	var version int64
	err := r.db.QueryRow("SELECT version_number FROM document_versions LIMIT 1").Scan(&version)
	return version, err
}

// GetAllData returns all data with the current version
func (r *Repository) GetAllData() (*models.DataResponse, error) {
	version, err := r.GetCurrentVersion()
	if err != nil {
		return nil, fmt.Errorf("failed to get current version: %w", err)
	}

	response := &models.DataResponse{
		Version: version,
	}

	// Get teams
	teams, err := r.GetTeams()
	if err != nil {
		return nil, fmt.Errorf("failed to get teams: %w", err)
	}
	response.Teams = teams

	// Get sprints
	sprints, err := r.GetSprints()
	if err != nil {
		return nil, fmt.Errorf("failed to get sprints: %w", err)
	}
	response.Sprints = sprints

	// Get functions
	functions, err := r.GetFunctions()
	if err != nil {
		return nil, fmt.Errorf("failed to get functions: %w", err)
	}
	response.Functions = functions

	// Get employees
	employees, err := r.GetEmployees()
	if err != nil {
		return nil, fmt.Errorf("failed to get employees: %w", err)
	}
	response.Employees = employees

	// Get resources
	resources, err := r.GetResources()
	if err != nil {
		return nil, fmt.Errorf("failed to get resources: %w", err)
	}
	response.Resources = resources

	// Get tasks
	tasks, err := r.GetTasks()
	if err != nil {
		return nil, fmt.Errorf("failed to get tasks: %w", err)
	}
	response.Tasks = tasks

	return response, nil
}

// GetTeams returns all teams
func (r *Repository) GetTeams() ([]models.Team, error) {
	rows, err := r.db.Query(`
		SELECT id, name, jira_project, feature_team, issue_type, created_at, updated_at 
		FROM teams 
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []models.Team
	for rows.Next() {
		var team models.Team
		err := rows.Scan(
			&team.ID, &team.Name, &team.JiraProject, &team.FeatureTeam,
			&team.IssueType, &team.CreatedAt, &team.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		teams = append(teams, team)
	}

	return teams, rows.Err()
}

// GetSprints returns all sprints
func (r *Repository) GetSprints() ([]models.Sprint, error) {
	rows, err := r.db.Query(`
		SELECT id, code, start_date, end_date, created_at, updated_at 
		FROM sprints 
		ORDER BY start_date
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sprints []models.Sprint
	for rows.Next() {
		var sprint models.Sprint
		err := rows.Scan(
			&sprint.ID, &sprint.Code, &sprint.StartDate, &sprint.EndDate,
			&sprint.CreatedAt, &sprint.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		sprints = append(sprints, sprint)
	}

	return sprints, rows.Err()
}

// GetFunctions returns all functions
func (r *Repository) GetFunctions() ([]models.Function, error) {
	rows, err := r.db.Query(`
		SELECT id, name, color, created_at, updated_at 
		FROM functions 
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var functions []models.Function
	for rows.Next() {
		var function models.Function
		err := rows.Scan(
			&function.ID, &function.Name, &function.Color,
			&function.CreatedAt, &function.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		functions = append(functions, function)
	}

	return functions, rows.Err()
}

// GetEmployees returns all employees
func (r *Repository) GetEmployees() ([]models.Employee, error) {
	rows, err := r.db.Query(`
		SELECT id, name, color, created_at, updated_at 
		FROM employees 
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var employees []models.Employee
	for rows.Next() {
		var employee models.Employee
		err := rows.Scan(
			&employee.ID, &employee.Name, &employee.Color,
			&employee.CreatedAt, &employee.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		employees = append(employees, employee)
	}

	return employees, rows.Err()
}

// GetResources returns all resources with populated team and function names
func (r *Repository) GetResources() ([]models.Resource, error) {
	rows, err := r.db.Query(`
		SELECT 
			r.id, r.kind, r.team_ids, r.function_id, r.employee_id, r.weeks, 
			r.display_order, r.created_at, r.updated_at,
			f.name as function_name,
			e.name as employee_name
		FROM resources r
		JOIN functions f ON r.function_id = f.id
		LEFT JOIN employees e ON r.employee_id = e.id
		ORDER BY r.display_order, r.created_at
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Create maps for team lookups
	teamMap, err := r.getTeamMap()
	if err != nil {
		return nil, fmt.Errorf("failed to get team map: %w", err)
	}

	var resources []models.Resource
	for rows.Next() {
		var resource models.Resource
		var functionName string
		var employeeName sql.NullString

		err := rows.Scan(
			&resource.ID, &resource.Kind, &resource.TeamIDs, &resource.FunctionID,
			&resource.EmployeeID, &resource.Weeks, &resource.DisplayOrder,
			&resource.CreatedAt, &resource.UpdatedAt, &functionName, &employeeName,
		)
		if err != nil {
			return nil, err
		}

		resource.Function = functionName
		if employeeName.Valid {
			resource.Employee = &employeeName.String
		}

		// Save original team UUIDs before converting to names
		resource.TeamUUIDs = make([]string, len(resource.TeamIDs))
		copy(resource.TeamUUIDs, resource.TeamIDs)

		// Convert team IDs to team names for display
		teamNames := make([]string, len(resource.TeamIDs))
		for i, teamIDStr := range resource.TeamIDs {
			if teamID, err := uuid.Parse(teamIDStr); err == nil {
				if teamName, exists := teamMap[teamID]; exists {
					teamNames[i] = teamName
				}
			}
		}
		resource.TeamIDs = teamNames

		resources = append(resources, resource)
	}

	return resources, rows.Err()
}

// GetTasks returns all tasks with populated team and function names
func (r *Repository) GetTasks() ([]models.Task, error) {
	rows, err := r.db.Query(`
		SELECT 
			t.id, t.kind, t.status, t.sprints_auto, t.epic, t.task_name, 
			t.team_id, t.function_id, t.employee_id, t.plan_empl, t.plan_weeks,
			t.blocker_ids, t.week_blockers, t.fact, t.start_week, t.end_week,
			t.expected_start_week, t.manual_edited, t.auto_plan_enabled, t.weeks,
			t.display_order, t.created_at, t.updated_at,
			tm.name as team_name,
			f.name as function_name,
			e.name as employee_name
		FROM tasks t
		JOIN teams tm ON t.team_id = tm.id
		JOIN functions f ON t.function_id = f.id
		LEFT JOIN employees e ON t.employee_id = e.id
		ORDER BY t.display_order, t.created_at
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []models.Task
	for rows.Next() {
		var task models.Task
		var teamName, functionName string
		var employeeName sql.NullString

		err := rows.Scan(
			&task.ID, &task.Kind, &task.Status, &task.SprintsAuto, &task.Epic,
			&task.TaskName, &task.TeamID, &task.FunctionID, &task.EmployeeID,
			&task.PlanEmpl, &task.PlanWeeks, &task.BlockerIDs, &task.WeekBlockers,
			&task.Fact, &task.StartWeek, &task.EndWeek, &task.ExpectedStartWeek,
			&task.ManualEdited, &task.AutoPlanEnabled, &task.Weeks,
			&task.DisplayOrder, &task.CreatedAt, &task.UpdatedAt,
			&teamName, &functionName, &employeeName,
		)
		if err != nil {
			return nil, err
		}

		task.Team = teamName
		task.Function = functionName
		if employeeName.Valid {
			task.Employee = &employeeName.String
		}

		tasks = append(tasks, task)
	}

	return tasks, rows.Err()
}

// GetChangesSince returns all changes since the specified version
func (r *Repository) GetChangesSince(fromVersion int64) ([]models.ChangeLog, error) {
	rows, err := r.db.Query(`
		SELECT id, version_number, table_name, record_id, operation, old_data, new_data, created_at
		FROM change_log 
		WHERE version_number > $1 
		ORDER BY version_number, created_at
	`, fromVersion)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var changes []models.ChangeLog
	for rows.Next() {
		var change models.ChangeLog
		var oldData, newData sql.NullString

		err := rows.Scan(
			&change.ID, &change.VersionNumber, &change.TableName, &change.RecordID,
			&change.Operation, &oldData, &newData, &change.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if oldData.Valid {
			var data interface{}
			if err := json.Unmarshal([]byte(oldData.String), &data); err == nil {
				change.OldData = data
			}
		}

		if newData.Valid {
			var data interface{}
			if err := json.Unmarshal([]byte(newData.String), &data); err == nil {
				change.NewData = data
			}
		}

		changes = append(changes, change)
	}

	return changes, rows.Err()
}

// Helper function to get team ID to name mapping
func (r *Repository) getTeamMap() (map[uuid.UUID]string, error) {
	rows, err := r.db.Query("SELECT id, name FROM teams")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	teamMap := make(map[uuid.UUID]string)
	for rows.Next() {
		var id uuid.UUID
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		teamMap[id] = name
	}

	return teamMap, rows.Err()
}

// BeginTransaction starts a new database transaction
func (r *Repository) BeginTransaction() (*sql.Tx, error) {
	return r.db.Begin()
}

// UpdateData updates data in the database within a transaction
func (r *Repository) UpdateData(tx *sql.Tx, req *models.UpdateRequest) error {
	// Update teams
	for _, team := range req.Teams {
		_, err := tx.Exec(`
			INSERT INTO teams (id, name, jira_project, feature_team, issue_type)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name,
				jira_project = EXCLUDED.jira_project,
				feature_team = EXCLUDED.feature_team,
				issue_type = EXCLUDED.issue_type,
				updated_at = NOW()
		`, team.ID, team.Name, team.JiraProject, team.FeatureTeam, team.IssueType)
		if err != nil {
			return fmt.Errorf("failed to update team %s: %w", team.ID, err)
		}
	}

	// Update sprints
	for _, sprint := range req.Sprints {
		_, err := tx.Exec(`
			INSERT INTO sprints (id, code, start_date, end_date)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (id) DO UPDATE SET
				code = EXCLUDED.code,
				start_date = EXCLUDED.start_date,
				end_date = EXCLUDED.end_date,
				updated_at = NOW()
		`, sprint.ID, sprint.Code, sprint.StartDate, sprint.EndDate)
		if err != nil {
			return fmt.Errorf("failed to update sprint %s: %w", sprint.ID, err)
		}
	}

	// Update functions
	for _, function := range req.Functions {
		_, err := tx.Exec(`
			INSERT INTO functions (id, name, color)
			VALUES ($1, $2, $3)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name,
				color = EXCLUDED.color,
				updated_at = NOW()
		`, function.ID, function.Name, function.Color)
		if err != nil {
			return fmt.Errorf("failed to update function %s: %w", function.ID, err)
		}
	}

	// Update employees
	for _, employee := range req.Employees {
		_, err := tx.Exec(`
			INSERT INTO employees (id, name, color)
			VALUES ($1, $2, $3)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name,
				color = EXCLUDED.color,
				updated_at = NOW()
		`, employee.ID, employee.Name, employee.Color)
		if err != nil {
			return fmt.Errorf("failed to update employee %s: %w", employee.ID, err)
		}
	}

	// Update resources
	for _, resource := range req.Resources {
		_, err := tx.Exec(`
			INSERT INTO resources (id, team_ids, function_id, employee_id, weeks, display_order)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (id) DO UPDATE SET
				team_ids = EXCLUDED.team_ids,
				function_id = EXCLUDED.function_id,
				employee_id = EXCLUDED.employee_id,
				weeks = EXCLUDED.weeks,
				display_order = EXCLUDED.display_order,
				updated_at = NOW()
		`, resource.ID, pq.Array(resource.TeamIDs), resource.FunctionID, resource.EmployeeID, pq.Array(resource.Weeks), resource.DisplayOrder)
		if err != nil {
			return fmt.Errorf("failed to update resource %s: %w", resource.ID, err)
		}
	}

	// Update tasks
	for _, task := range req.Tasks {
		_, err := tx.Exec(`
			INSERT INTO tasks (
				id, status, sprints_auto, epic, task_name, team_id, function_id, employee_id,
				plan_empl, plan_weeks, blocker_ids, week_blockers, fact, start_week, end_week,
				expected_start_week, manual_edited, auto_plan_enabled, weeks, display_order
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
			ON CONFLICT (id) DO UPDATE SET
				status = EXCLUDED.status,
				sprints_auto = EXCLUDED.sprints_auto,
				epic = EXCLUDED.epic,
				task_name = EXCLUDED.task_name,
				team_id = EXCLUDED.team_id,
				function_id = EXCLUDED.function_id,
				employee_id = EXCLUDED.employee_id,
				plan_empl = EXCLUDED.plan_empl,
				plan_weeks = EXCLUDED.plan_weeks,
				blocker_ids = EXCLUDED.blocker_ids,
				week_blockers = EXCLUDED.week_blockers,
				fact = EXCLUDED.fact,
				start_week = EXCLUDED.start_week,
				end_week = EXCLUDED.end_week,
				expected_start_week = EXCLUDED.expected_start_week,
				manual_edited = EXCLUDED.manual_edited,
				auto_plan_enabled = EXCLUDED.auto_plan_enabled,
				weeks = EXCLUDED.weeks,
				display_order = EXCLUDED.display_order,
				updated_at = NOW()
		`, task.ID, task.Status, pq.Array(task.SprintsAuto), task.Epic, task.TaskName,
			task.TeamID, task.FunctionID, task.EmployeeID, task.PlanEmpl, task.PlanWeeks,
			pq.Array(task.BlockerIDs), pq.Array(task.WeekBlockers), task.Fact,
			task.StartWeek, task.EndWeek, task.ExpectedStartWeek, task.ManualEdited,
			task.AutoPlanEnabled, pq.Array(task.Weeks), task.DisplayOrder)
		if err != nil {
			return fmt.Errorf("failed to update task %s: %w", task.ID, err)
		}
	}

	// Handle deletions
	for tableName, ids := range req.Deleted {
		for _, id := range ids {
			var err error
			switch tableName {
			case "teams":
				_, err = tx.Exec("DELETE FROM teams WHERE id = $1", id)
			case "sprints":
				_, err = tx.Exec("DELETE FROM sprints WHERE id = $1", id)
			case "functions":
				_, err = tx.Exec("DELETE FROM functions WHERE id = $1", id)
			case "employees":
				_, err = tx.Exec("DELETE FROM employees WHERE id = $1", id)
			case "resources":
				_, err = tx.Exec("DELETE FROM resources WHERE id = $1", id)
			case "tasks":
				_, err = tx.Exec("DELETE FROM tasks WHERE id = $1", id)
			default:
				return fmt.Errorf("unknown table for deletion: %s", tableName)
			}
			if err != nil {
				return fmt.Errorf("failed to delete %s %s: %w", tableName, id, err)
			}
		}
	}

	return nil
}
