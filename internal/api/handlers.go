package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

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
	var req models.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Log the binding error for debugging
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body: " + err.Error(),
		})
		return
	}

	// Log user_id for debugging
	if req.UserID != nil {
		fmt.Printf("UpdateData: user_id received: %s (length: %d)\n", *req.UserID, len(*req.UserID))
		fmt.Printf("UpdateData: user_id bytes: %v\n", []byte(*req.UserID))
		fmt.Printf("UpdateData: user_id is valid UUID: %t\n", len(*req.UserID) == 36)
		fmt.Printf("UpdateData: user_id contains quotes: %t\n", strings.Contains(*req.UserID, "'"))
		fmt.Printf("UpdateData: user_id contains newlines: %t\n", strings.Contains(*req.UserID, "\n"))
		fmt.Printf("UpdateData: user_id contains carriage returns: %t\n", strings.Contains(*req.UserID, "\r"))
		fmt.Printf("UpdateData: user_id contains backslashes: %t\n", strings.Contains(*req.UserID, "\\"))
		fmt.Printf("UpdateData: user_id contains semicolons: %t\n", strings.Contains(*req.UserID, ";"))
		fmt.Printf("UpdateData: user_id contains spaces: %t\n", strings.Contains(*req.UserID, " "))
		fmt.Printf("UpdateData: user_id contains tabs: %t\n", strings.Contains(*req.UserID, "\t"))
		fmt.Printf("UpdateData: user_id contains double quotes: %t\n", strings.Contains(*req.UserID, "\""))
		fmt.Printf("UpdateData: user_id contains dollar signs: %t\n", strings.Contains(*req.UserID, "$"))
		fmt.Printf("UpdateData: user_id contains parentheses: %t\n", strings.Contains(*req.UserID, "(") || strings.Contains(*req.UserID, ")"))
		fmt.Printf("UpdateData: user_id contains brackets: %t\n", strings.Contains(*req.UserID, "[") || strings.Contains(*req.UserID, "]"))
		fmt.Printf("UpdateData: user_id contains braces: %t\n", strings.Contains(*req.UserID, "{") || strings.Contains(*req.UserID, "}"))
	} else {
		fmt.Println("UpdateData: user_id is nil")
	}

	response, err := h.service.UpdateData(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Internal server error",
		})
		return
	}

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
