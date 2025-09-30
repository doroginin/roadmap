package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// TaskStatus represents the status of a task
type TaskStatus string

const (
	TaskStatusTodo      TaskStatus = "Todo"
	TaskStatusBacklog   TaskStatus = "Backlog"
	TaskStatusCancelled TaskStatus = "Cancelled"
)

// RowKind represents the type of row (resource or task)
type RowKind string

const (
	RowKindResource RowKind = "resource"
	RowKindTask     RowKind = "task"
)

// Team represents a team in the system
type Team struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	JiraProject string    `json:"jiraProject" db:"jira_project"`
	FeatureTeam string    `json:"featureTeam" db:"feature_team"`
	IssueType   string    `json:"issueType" db:"issue_type"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// Sprint represents a sprint in the system
type Sprint struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Code      string    `json:"code" db:"code"`
	StartDate string    `json:"start" db:"start_date"` // YYYY-MM-DD format
	EndDate   string    `json:"end" db:"end_date"`     // YYYY-MM-DD format
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// Function represents a function in the system
type Function struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Color     *string   `json:"color,omitempty" db:"color"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// Employee represents an employee in the system
type Employee struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Color     *string   `json:"color,omitempty" db:"color"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// Resource represents a resource row
type Resource struct {
	ID           uuid.UUID       `json:"id" db:"id"`
	Kind         RowKind         `json:"kind" db:"kind"`
	TeamIDs      pq.StringArray  `json:"team" db:"team_ids"` // Will be converted to team names in API
	FunctionID   uuid.UUID       `json:"-" db:"function_id"`
	Function     string          `json:"fn"` // Will be populated from Function table
	EmployeeID   *uuid.UUID      `json:"-" db:"employee_id"`
	Employee     *string         `json:"empl,omitempty"` // Will be populated from Employee table
	Weeks        pq.Float64Array `json:"weeks" db:"weeks"`
	DisplayOrder int             `json:"displayOrder" db:"display_order"`
	CreatedAt    time.Time       `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time       `json:"updatedAt" db:"updated_at"`
}

// Task represents a task row
type Task struct {
	ID                uuid.UUID       `json:"id" db:"id"`
	Kind              RowKind         `json:"kind" db:"kind"`
	Status            TaskStatus      `json:"status" db:"status"`
	SprintsAuto       pq.StringArray  `json:"sprintsAuto" db:"sprints_auto"`
	Epic              *string         `json:"epic,omitempty" db:"epic"`
	TaskName          string          `json:"task" db:"task_name"`
	TeamID            uuid.UUID       `json:"-" db:"team_id"`
	Team              string          `json:"team"` // Will be populated from Team table
	FunctionID        uuid.UUID       `json:"-" db:"function_id"`
	Function          string          `json:"fn"` // Will be populated from Function table
	EmployeeID        *uuid.UUID      `json:"-" db:"employee_id"`
	Employee          *string         `json:"empl,omitempty"` // Will be populated from Employee table
	PlanEmpl          float64         `json:"planEmpl" db:"plan_empl"`
	PlanWeeks         float64         `json:"planWeeks" db:"plan_weeks"`
	BlockerIDs        pq.StringArray  `json:"blockerIds" db:"blocker_ids"`
	WeekBlockers      pq.Int64Array   `json:"weekBlockers" db:"week_blockers"`
	Fact              float64         `json:"fact" db:"fact"`
	StartWeek         *int            `json:"startWeek" db:"start_week"`
	EndWeek           *int            `json:"endWeek" db:"end_week"`
	ExpectedStartWeek *int            `json:"expectedStartWeek" db:"expected_start_week"`
	ManualEdited      bool            `json:"manualEdited" db:"manual_edited"`
	AutoPlanEnabled   bool            `json:"autoPlanEnabled" db:"auto_plan_enabled"`
	Weeks             pq.Float64Array `json:"weeks" db:"weeks"`
	DisplayOrder      int             `json:"displayOrder" db:"display_order"`
	CreatedAt         time.Time       `json:"createdAt" db:"created_at"`
	UpdatedAt         time.Time       `json:"updatedAt" db:"updated_at"`
}

// Row represents either a Resource or Task (union type for API responses)
type Row interface {
	GetID() uuid.UUID
	GetKind() RowKind
	GetDisplayOrder() int
}

func (r *Resource) GetID() uuid.UUID     { return r.ID }
func (r *Resource) GetKind() RowKind     { return r.Kind }
func (r *Resource) GetDisplayOrder() int { return r.DisplayOrder }

func (t *Task) GetID() uuid.UUID     { return t.ID }
func (t *Task) GetKind() RowKind     { return t.Kind }
func (t *Task) GetDisplayOrder() int { return t.DisplayOrder }

// DocumentVersion represents the current version of the document
type DocumentVersion struct {
	ID            uuid.UUID `json:"id" db:"id"`
	VersionNumber int64     `json:"version" db:"version_number"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
}

// ChangeLog represents a change in the system
type ChangeLog struct {
	ID            uuid.UUID   `json:"id" db:"id"`
	VersionNumber int64       `json:"version" db:"version_number"`
	TableName     string      `json:"table" db:"table_name"`
	RecordID      uuid.UUID   `json:"recordId" db:"record_id"`
	Operation     string      `json:"operation" db:"operation"`
	OldData       interface{} `json:"oldData,omitempty" db:"old_data"`
	NewData       interface{} `json:"newData,omitempty" db:"new_data"`
	CreatedAt     time.Time   `json:"createdAt" db:"created_at"`
}

// API Response structures

// DataResponse represents the full data response with version
type DataResponse struct {
	Version   int64      `json:"version"`
	Teams     []Team     `json:"teams"`
	Sprints   []Sprint   `json:"sprints"`
	Functions []Function `json:"functions"`
	Employees []Employee `json:"employees"`
	Resources []Resource `json:"resources"`
	Tasks     []Task     `json:"tasks"`
}

// VersionResponse represents just the version number
type VersionResponse struct {
	Version int64 `json:"version"`
}

// DiffResponse represents changes since a specific version
type DiffResponse struct {
	Version int64       `json:"version"`
	Changes []ChangeLog `json:"changes"`
}

// UpdateRequest represents a request to update data
type UpdateRequest struct {
	Version   int64                  `json:"version"`
	Teams     []Team                 `json:"teams,omitempty"`
	Sprints   []Sprint               `json:"sprints,omitempty"`
	Functions []Function             `json:"functions,omitempty"`
	Employees []Employee             `json:"employees,omitempty"`
	Resources []Resource             `json:"resources,omitempty"`
	Tasks     []Task                 `json:"tasks,omitempty"`
	Deleted   map[string][]uuid.UUID `json:"deleted,omitempty"` // table_name -> array of IDs to delete
}

// UpdateResponse represents the response after updating data
type UpdateResponse struct {
	Version int64  `json:"version"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}
