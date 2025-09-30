package api

import (
	"net/http"
	"strconv"

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
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
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
