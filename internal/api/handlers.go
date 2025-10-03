package api

import (
	"fmt"
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"roadmap/internal/models"
	"roadmap/internal/service"
)

type Handlers struct {
	service *service.Service
}

func New(service *service.Service) *Handlers {
	return &Handlers{service: service}
}

// GetVersion returns the current document version (lightweight endpoint)
func (h *Handlers) GetVersion(c *gin.Context) {
	version, err := h.service.GetCurrentVersion()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get current version",
		})
		return
	}

	c.JSON(http.StatusOK, version)
}

// GetData returns all data with the current version
func (h *Handlers) GetData(c *gin.Context) {
	data, err := h.service.GetAllData()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get data",
		})
		return
	}

	c.JSON(http.StatusOK, data)
}

// GetDataDiff returns changes since the specified version
func (h *Handlers) GetDataDiff(c *gin.Context) {
	fromVersionStr := c.Param("fromVersion")
	fromVersion, err := strconv.ParseInt(fromVersionStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid version parameter",
		})
		return
	}

	diff, err := h.service.GetDataDiff(fromVersion)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get data diff",
		})
		return
	}

	c.JSON(http.StatusOK, diff)
}

// UpdateData updates data in the database
func (h *Handlers) UpdateData(c *gin.Context) {
	fmt.Printf("=== UpdateData: Received request ===\n")
	fmt.Fprintf(os.Stderr, "=== UpdateData: Received request ===\n")
	var req models.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Log the binding error for debugging
		fmt.Printf("UpdateData: JSON binding error: %v\n", err)
		fmt.Fprintf(os.Stderr, "UpdateData: JSON binding error: %v\n", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body: " + err.Error(),
		})
		return
	}
	fmt.Printf("UpdateData: JSON binding successful\n")
	fmt.Fprintf(os.Stderr, "UpdateData: JSON binding successful\n")

	// Validate required UserID
	if req.UserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "UserID is required",
		})
		return
	}

	// Validate UserID format (should be UUID)
	if _, err := uuid.Parse(req.UserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid UserID format: must be a valid UUID",
		})
		return
	}

	// Debug request content
	fmt.Printf("UpdateData: Request content - Teams: %d, Sprints: %d, Functions: %d, Employees: %d, Resources: %d, Tasks: %d\n",
		len(req.Teams), len(req.Sprints), len(req.Functions), len(req.Employees), len(req.Resources), len(req.Tasks))

	// Validate that at least one entity has changes (not just ID)
	if !h.hasValidChanges(&req) {
		fmt.Printf("UpdateData: No valid changes found in request\n")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "At least one field must be provided for update (not just ID)",
		})
		return
	}

	fmt.Printf("UpdateData: Valid changes found, proceeding with update\n")
	fmt.Printf("UpdateData: Calling service.UpdateData\n")

	response, err := h.service.UpdateData(&req)
	if err != nil {
		fmt.Printf("UpdateData: Service error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Internal server error: " + err.Error(),
		})
		return
	}
	fmt.Printf("UpdateData: Service call successful\n")

	if !response.Success {
		// Check if it's a version conflict
		if response.Error != "" && response.Error[:16] == "Version conflict" {
			c.JSON(http.StatusConflict, response)
			return
		}

		c.JSON(http.StatusBadRequest, response)
		return
	}

	c.JSON(http.StatusOK, response)
}

// hasValidChanges checks if the request has valid changes (not just IDs)
func (h *Handlers) hasValidChanges(req *models.UpdateRequest) bool {
	fmt.Printf("hasValidChanges: Checking request with %d teams, %d tasks\n", len(req.Teams), len(req.Tasks))

	// Check if there are any deletions
	if len(req.Deleted) > 0 {
		fmt.Printf("hasValidChanges: Found deletions\n")
		return true
	}

	// Check teams
	for _, team := range req.Teams {
		if team.Name != nil || team.JiraProject != nil || team.FeatureTeam != nil || team.IssueType != nil {
			return true
		}
	}

	// Check sprints
	for _, sprint := range req.Sprints {
		if sprint.Code != nil || sprint.StartDate != nil || sprint.EndDate != nil {
			return true
		}
	}

	// Check functions
	for _, function := range req.Functions {
		if function.Name != nil || function.Color != nil {
			return true
		}
	}

	// Check employees
	for _, employee := range req.Employees {
		if employee.Name != nil || employee.Color != nil {
			return true
		}
	}

	// Check resources
	for _, resource := range req.Resources {
		if resource.TeamIDs != nil || resource.FunctionID != nil || resource.EmployeeID != nil ||
			resource.Weeks != nil || resource.DisplayOrder != nil {
			return true
		}
	}

	// Check tasks
	for i, task := range req.Tasks {
		fmt.Printf("hasValidChanges: Checking task %d: TaskName=%v, Status=%v\n", i, task.TaskName, task.Status)
		fmt.Printf("hasValidChanges: Task %d fields: TaskName=%v, Status=%v, Epic=%v, TeamID=%v, FunctionID=%v\n",
			i, task.TaskName, task.Status, task.Epic, task.TeamID, task.FunctionID)
		if task.Status != nil || task.SprintsAuto != nil || task.Epic != nil || task.TaskName != nil ||
			task.TeamID != nil || task.FunctionID != nil || task.EmployeeID != nil ||
			task.PlanEmpl != nil || task.PlanWeeks != nil || task.BlockerIDs != nil ||
			task.WeekBlockers != nil || task.Fact != nil || task.StartWeek != nil ||
			task.EndWeek != nil || task.ExpectedStartWeek != nil || task.ManualEdited != nil ||
			task.AutoPlanEnabled != nil || task.Weeks != nil || task.DisplayOrder != nil {
			fmt.Printf("hasValidChanges: Found valid changes in task %d\n", i)
			return true
		}
	}

	fmt.Printf("hasValidChanges: No valid changes found\n")
	return false
}
