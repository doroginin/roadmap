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

// GetResources returns all resources ordered by linked list
func (r *Repository) GetResources() ([]models.Resource, error) {
	rows, err := r.db.Query(`
		SELECT
			id, team_ids, function, employee, fn_bg_color, fn_text_color, weeks,
			prev_id, next_id, created_at, updated_at
		FROM resources
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

	// First, collect all resources in a map
	resourceMap := make(map[uuid.UUID]models.Resource)
	var firstResourceID *uuid.UUID

	for rows.Next() {
		var resource models.Resource
		var teamIDs pq.StringArray
		var function sql.NullString
		var employee sql.NullString
		var fnBgColor sql.NullString
		var fnTextColor sql.NullString
		var weeks pq.Float64Array
		var prevID, nextID sql.NullString

		err := rows.Scan(
			&resource.ID, &teamIDs, &function, &employee, &fnBgColor, &fnTextColor, &weeks,
			&prevID, &nextID, &resource.CreatedAt, &resource.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Set computed Kind field
		resource.Kind = models.RowKindResource

		// Handle nullable fields
		if teamIDs != nil {
			resource.TeamIDs = &teamIDs
		}
		if function.Valid {
			resource.Function = &function.String
		}
		if employee.Valid {
			resource.Employee = &employee.String
		}
		if fnBgColor.Valid {
			resource.FnBgColor = &fnBgColor.String
		}
		if fnTextColor.Valid {
			resource.FnTextColor = &fnTextColor.String
		}
		if weeks != nil {
			resource.Weeks = &weeks
		}
		if prevID.Valid {
			parsedPrevID, err := uuid.Parse(prevID.String)
			if err == nil {
				resource.PrevID = &parsedPrevID
			}
		} else {
			// This is the first resource
			firstResourceID = &resource.ID
		}
		if nextID.Valid {
			parsedNextID, err := uuid.Parse(nextID.String)
			if err == nil {
				resource.NextID = &parsedNextID
			}
		}

		// Save original team UUIDs before converting to names
		if teamIDs != nil {
			resource.TeamUUIDs = make([]string, len(teamIDs))
			copy(resource.TeamUUIDs, teamIDs)

			// Convert team IDs to team names for display
			teamNames := make([]string, len(teamIDs))
			for i, teamIDStr := range teamIDs {
				if teamID, err := uuid.Parse(teamIDStr); err == nil {
					if teamName, exists := teamMap[teamID]; exists {
						teamNames[i] = teamName
					}
				}
			}
			teamNamesArray := pq.StringArray(teamNames)
			resource.TeamIDs = &teamNamesArray
		}

		resourceMap[resource.ID] = resource
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Order resources using linked list
	var resources []models.Resource
	if firstResourceID != nil {
		currentID := firstResourceID
		visited := make(map[uuid.UUID]bool)

		for currentID != nil {
			if visited[*currentID] {
				// Circular reference detected, break
				break
			}
			resource, exists := resourceMap[*currentID]
			if !exists {
				break
			}
			resources = append(resources, resource)
			visited[*currentID] = true
			currentID = resource.NextID
		}
	}

	// Add any orphaned resources not in the linked list
	if len(resources) < len(resourceMap) {
		for _, resource := range resourceMap {
			found := false
			for _, r := range resources {
				if r.ID == resource.ID {
					found = true
					break
				}
			}
			if !found {
				resources = append(resources, resource)
			}
		}
	}

	return resources, nil
}

// GetTasks returns all tasks with populated team names, ordered by linked list
func (r *Repository) GetTasks() ([]models.Task, error) {
	rows, err := r.db.Query(`
		SELECT
			t.id, t.status, t.sprints_auto, t.epic, t.task_name,
			t.team_id, t.function, t.employee, t.plan_empl, t.plan_weeks,
			t.blocker_ids, t.week_blockers, t.fact, t.start_week, t.end_week,
			t.expected_start_week, t.auto_plan_enabled, t.weeks,
			t.prev_id, t.next_id, t.created_at, t.updated_at,
			tm.name as team_name
		FROM tasks t
		LEFT JOIN teams tm ON t.team_id = tm.id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// First, collect all tasks in a map
	taskMap := make(map[uuid.UUID]models.Task)
	var firstTaskID *uuid.UUID

	for rows.Next() {
		var task models.Task
		var teamName sql.NullString
		var status sql.NullString
		var sprintsAuto pq.StringArray
		var epic sql.NullString
		var taskName sql.NullString
		var teamID sql.NullString
		var function, employee sql.NullString
		var planEmpl, planWeeks, fact sql.NullFloat64
		var blockerIDs pq.StringArray
		var weekBlockers pq.Int64Array
		var startWeek, endWeek, expectedStartWeek sql.NullInt32
		var autoPlanEnabled sql.NullBool
		var weeks pq.Float64Array
		var prevID, nextID sql.NullString

		err := rows.Scan(
			&task.ID, &status, &sprintsAuto, &epic, &taskName,
			&teamID, &function, &employee, &planEmpl, &planWeeks,
			&blockerIDs, &weekBlockers, &fact, &startWeek, &endWeek,
			&expectedStartWeek, &autoPlanEnabled, &weeks,
			&prevID, &nextID, &task.CreatedAt, &task.UpdatedAt,
			&teamName,
		)
		if err != nil {
			return nil, err
		}

		// Set computed Kind field
		task.Kind = models.RowKindTask

		// Handle nullable fields
		if status.Valid {
			task.Status = (*models.TaskStatus)(&status.String)
		}
		if sprintsAuto != nil {
			task.SprintsAuto = &sprintsAuto
		}
		if epic.Valid {
			task.Epic = &epic.String
		}
		if taskName.Valid {
			task.TaskName = &taskName.String
		}
		if teamID.Valid {
			if id, err := uuid.Parse(teamID.String); err == nil {
				task.TeamID = &id
			}
		}
		if function.Valid {
			task.Function = &function.String
		}
		if employee.Valid {
			task.Employee = &employee.String
		}
		if planEmpl.Valid {
			task.PlanEmpl = &planEmpl.Float64
		}
		if planWeeks.Valid {
			task.PlanWeeks = &planWeeks.Float64
		}
		if blockerIDs != nil {
			task.BlockerIDs = &blockerIDs
		}
		if weekBlockers != nil {
			task.WeekBlockers = &weekBlockers
		}
		if fact.Valid {
			task.Fact = &fact.Float64
		}
		if startWeek.Valid {
			week := int(startWeek.Int32)
			task.StartWeek = &week
		}
		if endWeek.Valid {
			week := int(endWeek.Int32)
			task.EndWeek = &week
		}
		if expectedStartWeek.Valid {
			week := int(expectedStartWeek.Int32)
			task.ExpectedStartWeek = &week
		}
		if autoPlanEnabled.Valid {
			task.AutoPlanEnabled = &autoPlanEnabled.Bool
		}
		if weeks != nil {
			task.Weeks = &weeks
		}
		if prevID.Valid {
			parsedPrevID, err := uuid.Parse(prevID.String)
			if err == nil {
				task.PrevID = &parsedPrevID
			}
		} else {
			// This is the first task
			firstTaskID = &task.ID
		}
		if nextID.Valid {
			parsedNextID, err := uuid.Parse(nextID.String)
			if err == nil {
				task.NextID = &parsedNextID
			}
		}

		// Set display names
		if teamName.Valid {
			task.Team = teamName.String
		}

		taskMap[task.ID] = task
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Order tasks using linked list
	var tasks []models.Task
	if firstTaskID != nil {
		currentID := firstTaskID
		visited := make(map[uuid.UUID]bool)

		for currentID != nil {
			if visited[*currentID] {
				// Circular reference detected, break
				break
			}
			task, exists := taskMap[*currentID]
			if !exists {
				break
			}
			tasks = append(tasks, task)
			visited[*currentID] = true
			currentID = task.NextID
		}
	}

	// Add any orphaned tasks not in the linked list
	if len(tasks) < len(taskMap) {
		for _, task := range taskMap {
			found := false
			for _, t := range tasks {
				if t.ID == task.ID {
					found = true
					break
				}
			}
			if !found {
				tasks = append(tasks, task)
			}
		}
	}

	return tasks, nil
}

// GetChangesSince returns all changes since the specified version
func (r *Repository) GetChangesSince(fromVersion int64) ([]models.ChangeLog, error) {
	rows, err := r.db.Query(`
		SELECT id, version_number, table_name, record_id, operation, user_id, old_data, new_data, created_at
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
		var userID sql.NullString

		err := rows.Scan(
			&change.ID, &change.VersionNumber, &change.TableName, &change.RecordID,
			&change.Operation, &userID, &oldData, &newData, &change.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if userID.Valid {
			change.UserID = &userID.String
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
	// Set user_id in session variable for triggers
	fmt.Printf("Repository: Setting user_id to: %s\n", req.UserID)
	// Use string concatenation for SET LOCAL as it doesn't support parameters
	// But validate the UUID to prevent SQL injection
	if _, err := uuid.Parse(req.UserID); err != nil {
		return fmt.Errorf("invalid user_id format: %w", err)
	}
	_, err := tx.Exec("SET LOCAL app.user_id = '" + req.UserID + "'")
	if err != nil {
		fmt.Printf("Repository: Error setting user_id: %v\n", err)
		return fmt.Errorf("failed to set user_id: %w", err)
	}
	fmt.Println("Repository: user_id set successfully")
	// Update teams
	for _, team := range req.Teams {
		_, err := tx.Exec(`
			INSERT INTO teams (id, name, jira_project, feature_team, issue_type)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO UPDATE SET
				name = COALESCE(EXCLUDED.name, teams.name),
				jira_project = COALESCE(EXCLUDED.jira_project, teams.jira_project),
				feature_team = COALESCE(EXCLUDED.feature_team, teams.feature_team),
				issue_type = COALESCE(EXCLUDED.issue_type, teams.issue_type),
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
				code = COALESCE(EXCLUDED.code, sprints.code),
				start_date = COALESCE(EXCLUDED.start_date, sprints.start_date),
				end_date = COALESCE(EXCLUDED.end_date, sprints.end_date),
				updated_at = NOW()
		`, sprint.ID, sprint.Code, sprint.StartDate, sprint.EndDate)
		if err != nil {
			return fmt.Errorf("failed to update sprint %s: %w", sprint.ID, err)
		}
	}

	// Update resources
	for _, resource := range req.Resources {
		_, err := tx.Exec(`
			INSERT INTO resources (id, team_ids, function, employee, fn_bg_color, fn_text_color, weeks, prev_id, next_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (id) DO UPDATE SET
				team_ids = COALESCE(EXCLUDED.team_ids, resources.team_ids),
				function = COALESCE(EXCLUDED.function, resources.function),
				employee = COALESCE(EXCLUDED.employee, resources.employee),
				fn_bg_color = COALESCE(EXCLUDED.fn_bg_color, resources.fn_bg_color),
				fn_text_color = COALESCE(EXCLUDED.fn_text_color, resources.fn_text_color),
				weeks = COALESCE(EXCLUDED.weeks, resources.weeks),
				prev_id = COALESCE(EXCLUDED.prev_id, resources.prev_id),
				next_id = COALESCE(EXCLUDED.next_id, resources.next_id),
				updated_at = NOW()
		`, resource.ID,
			func() interface{} {
				if resource.TeamIDs != nil {
					return pq.Array(*resource.TeamIDs)
				}
				return nil
			}(),
			resource.Function, resource.Employee, resource.FnBgColor, resource.FnTextColor,
			func() interface{} {
				if resource.Weeks != nil {
					return pq.Array(*resource.Weeks)
				}
				return nil
			}(),
			resource.PrevID, resource.NextID)
		if err != nil {
			return fmt.Errorf("failed to update resource %s: %w", resource.ID, err)
		}
	}

	// Update tasks
	for _, task := range req.Tasks {
		_, err := tx.Exec(`
			INSERT INTO tasks (
				id, status, sprints_auto, epic, task_name, team_id, function, employee,
				plan_empl, plan_weeks, blocker_ids, week_blockers, fact, start_week, end_week,
				expected_start_week, auto_plan_enabled, weeks, prev_id, next_id
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
			ON CONFLICT (id) DO UPDATE SET
				status = COALESCE(EXCLUDED.status, tasks.status),
				sprints_auto = COALESCE(EXCLUDED.sprints_auto, tasks.sprints_auto),
				epic = COALESCE(EXCLUDED.epic, tasks.epic),
				task_name = COALESCE(EXCLUDED.task_name, tasks.task_name),
				team_id = COALESCE(EXCLUDED.team_id, tasks.team_id),
				function = COALESCE(EXCLUDED.function, tasks.function),
				employee = COALESCE(EXCLUDED.employee, tasks.employee),
				plan_empl = COALESCE(EXCLUDED.plan_empl, tasks.plan_empl),
				plan_weeks = COALESCE(EXCLUDED.plan_weeks, tasks.plan_weeks),
				blocker_ids = COALESCE(EXCLUDED.blocker_ids, tasks.blocker_ids),
				week_blockers = COALESCE(EXCLUDED.week_blockers, tasks.week_blockers),
				fact = COALESCE(EXCLUDED.fact, tasks.fact),
				start_week = COALESCE(EXCLUDED.start_week, tasks.start_week),
				end_week = COALESCE(EXCLUDED.end_week, tasks.end_week),
				expected_start_week = COALESCE(EXCLUDED.expected_start_week, tasks.expected_start_week),
				auto_plan_enabled = COALESCE(EXCLUDED.auto_plan_enabled, tasks.auto_plan_enabled),
				weeks = COALESCE(EXCLUDED.weeks, tasks.weeks),
				prev_id = COALESCE(EXCLUDED.prev_id, tasks.prev_id),
				next_id = COALESCE(EXCLUDED.next_id, tasks.next_id),
				updated_at = NOW()
		`, task.ID, task.Status,
			func() interface{} {
				if task.SprintsAuto != nil {
					return pq.Array(*task.SprintsAuto)
				}
				return nil
			}(),
			task.Epic, task.TaskName,
			task.TeamID, task.Function, task.Employee, task.PlanEmpl, task.PlanWeeks,
			func() interface{} {
				if task.BlockerIDs != nil {
					return pq.Array(*task.BlockerIDs)
				}
				return nil
			}(),
			func() interface{} {
				if task.WeekBlockers != nil {
					return pq.Array(*task.WeekBlockers)
				}
				return nil
			}(),
			task.Fact,
			task.StartWeek, task.EndWeek, task.ExpectedStartWeek, task.AutoPlanEnabled,
			func() interface{} {
				if task.Weeks != nil {
					return pq.Array(*task.Weeks)
				}
				return nil
			}(),
			task.PrevID, task.NextID)
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
