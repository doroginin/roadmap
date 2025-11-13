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
// Note: This is now only used for API responses, not stored in DB
type RowKind string

const (
	RowKindResource RowKind = "resource"
	RowKindTask     RowKind = "task"
)

// Team represents a team in the system
type Team struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        *string   `json:"name,omitempty" db:"name"`
	JiraProject *string   `json:"jiraProject,omitempty" db:"jira_project"`
	FeatureTeam *string   `json:"featureTeam,omitempty" db:"feature_team"`
	IssueType   *string   `json:"issueType,omitempty" db:"issue_type"`
	CreatedAt   time.Time `json:"createdAt,omitempty" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt,omitempty" db:"updated_at"`
}

// Sprint represents a sprint in the system
type Sprint struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Code      *string   `json:"code,omitempty" db:"code"`
	StartDate *string   `json:"start,omitempty" db:"start_date"` // YYYY-MM-DD format
	EndDate   *string   `json:"end,omitempty" db:"end_date"`     // YYYY-MM-DD format
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// Resource represents a resource row
type Resource struct {
	ID           uuid.UUID        `json:"id" db:"id"`
	Kind         RowKind          `json:"kind"`                                     // Computed field for API responses
	TeamIDs      *pq.StringArray  `json:"team,omitempty" db:"team_ids"`             // Team names for display (populated from Team table)
	TeamUUIDs    pq.StringArray   `json:"teamIds,omitempty"`                        // Team UUIDs for saving (populated separately)
	Function     *string          `json:"fn,omitempty" db:"function"`               // Function name stored as string
	Employee     *string          `json:"empl,omitempty" db:"employee"`             // Employee name stored as string
	FnBgColor    *string          `json:"fnBgColor,omitempty" db:"fn_bg_color"`     // Function background color
	FnTextColor  *string          `json:"fnTextColor,omitempty" db:"fn_text_color"` // Function text color
	Weeks        *pq.Float64Array `json:"weeks,omitempty" db:"weeks"`
	DisplayOrder *int             `json:"displayOrder,omitempty" db:"display_order"`
	CreatedAt    time.Time        `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time        `json:"updatedAt" db:"updated_at"`
}

// Task represents a task row
type Task struct {
	ID                uuid.UUID        `json:"id" db:"id"`
	Kind              RowKind          `json:"kind"` // Computed field for API responses
	Status            *TaskStatus      `json:"status,omitempty" db:"status"`
	SprintsAuto       *pq.StringArray  `json:"sprintsAuto,omitempty" db:"sprints_auto"`
	Epic              *string          `json:"epic,omitempty" db:"epic"`
	TaskName          *string          `json:"task,omitempty" db:"task_name"`
	TeamID            *uuid.UUID       `json:"teamId,omitempty" db:"team_id"` // Team UUID for saving
	Team              string           `json:"team"`                          // Team name for display (populated from Team table)
	Function          *string          `json:"fn,omitempty" db:"function"`    // Function name stored as string
	Employee          *string          `json:"empl,omitempty" db:"employee"`  // Employee name stored as string
	PlanEmpl          *float64         `json:"planEmpl,omitempty" db:"plan_empl"`
	PlanWeeks         *float64         `json:"planWeeks,omitempty" db:"plan_weeks"`
	BlockerIDs        *pq.StringArray  `json:"blockerIds,omitempty" db:"blocker_ids"`
	WeekBlockers      *pq.Int64Array   `json:"weekBlockers,omitempty" db:"week_blockers"`
	Fact              *float64         `json:"fact,omitempty" db:"fact"`
	StartWeek         *int             `json:"startWeek" db:"start_week"`
	EndWeek           *int             `json:"endWeek" db:"end_week"`
	ExpectedStartWeek *int             `json:"expectedStartWeek" db:"expected_start_week"`
	AutoPlanEnabled   *bool            `json:"autoPlanEnabled,omitempty" db:"auto_plan_enabled"`
	Weeks             *pq.Float64Array `json:"weeks,omitempty" db:"weeks"`
	DisplayOrder      *int             `json:"displayOrder,omitempty" db:"display_order"`
	CreatedAt         time.Time        `json:"createdAt" db:"created_at"`
	UpdatedAt         time.Time        `json:"updatedAt" db:"updated_at"`
}

// Row represents either a Resource or Task (union type for API responses)
type Row interface {
	GetID() uuid.UUID
	GetKind() RowKind
	GetDisplayOrder() int
}

func (r *Resource) GetID() uuid.UUID { return r.ID }
func (r *Resource) GetKind() RowKind { return RowKindResource }
func (r *Resource) GetDisplayOrder() int {
	if r.DisplayOrder != nil {
		return *r.DisplayOrder
	}
	return 0
}

func (t *Task) GetID() uuid.UUID { return t.ID }
func (t *Task) GetKind() RowKind { return RowKindTask }
func (t *Task) GetDisplayOrder() int {
	if t.DisplayOrder != nil {
		return *t.DisplayOrder
	}
	return 0
}

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
	UserID        *string     `json:"userId,omitempty" db:"user_id"`
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
	UserID    string                 `json:"userId"` // Required field
	Teams     []Team                 `json:"teams,omitempty"`
	Sprints   []Sprint               `json:"sprints,omitempty"`
	Resources []ResourceUpdate       `json:"resources,omitempty"`
	Tasks     []TaskUpdate           `json:"tasks,omitempty"`
	Deleted   map[string][]uuid.UUID `json:"deleted,omitempty"` // table_name -> array of IDs to delete
}

// ResourceUpdate represents a resource update request
type ResourceUpdate struct {
	ID           uuid.UUID        `json:"id"`
	TeamIDs      *pq.StringArray  `json:"teamIds,omitempty"`
	Function     *string          `json:"fn,omitempty"`
	Employee     *string          `json:"empl,omitempty"`
	FnBgColor    *string          `json:"fnBgColor,omitempty"`
	FnTextColor  *string          `json:"fnTextColor,omitempty"`
	Weeks        *pq.Float64Array `json:"weeks,omitempty"`
	DisplayOrder *int             `json:"displayOrder,omitempty"`
}

// TaskUpdate represents a task update request
type TaskUpdate struct {
	ID                uuid.UUID        `json:"id"`
	Status            *TaskStatus      `json:"status,omitempty"`
	SprintsAuto       *pq.StringArray  `json:"sprintsAuto,omitempty"`
	Epic              *string          `json:"epic,omitempty"`
	TaskName          *string          `json:"task,omitempty"`
	TeamID            *uuid.UUID       `json:"teamId,omitempty"`
	Function          *string          `json:"fn,omitempty"`
	Employee          *string          `json:"empl,omitempty"`
	PlanEmpl          *float64         `json:"planEmpl,omitempty"`
	PlanWeeks         *float64         `json:"planWeeks,omitempty"`
	BlockerIDs        *pq.StringArray  `json:"blockerIds,omitempty"`
	WeekBlockers      *pq.Int64Array   `json:"weekBlockers,omitempty"`
	Fact              *float64         `json:"fact,omitempty"`
	StartWeek         *int             `json:"startWeek,omitempty"`
	EndWeek           *int             `json:"endWeek,omitempty"`
	ExpectedStartWeek *int             `json:"expectedStartWeek,omitempty"`
	AutoPlanEnabled   *bool            `json:"autoPlanEnabled,omitempty"`
	Weeks             *pq.Float64Array `json:"weeks,omitempty"`
	DisplayOrder      *int             `json:"displayOrder,omitempty"`
}

// UpdateResponse represents the response after updating data
type UpdateResponse struct {
	Version int64  `json:"version"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}
