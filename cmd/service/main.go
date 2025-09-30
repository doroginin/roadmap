package main

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"

	"roadmap/internal/api"
	"roadmap/internal/config"
	"roadmap/internal/repository"
	"roadmap/internal/service"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Connect to database
	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	// Initialize repositories
	repo := repository.New(db)

	// Initialize services
	svc := service.New(repo)

	// Initialize API handlers
	handlers := api.New(svc)

	// Setup Gin router
	r := gin.Default()

	// Add CORS middleware
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// API routes
	api := r.Group("/api/v1")
	{
		// Version endpoint - lightweight endpoint for checking current version
		api.GET("/version", handlers.GetVersion)

		// Data endpoints
		api.GET("/data", handlers.GetData)
		api.GET("/data/diff/:fromVersion", handlers.GetDataDiff)
		api.PUT("/data", handlers.UpdateData)
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Start server
	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server starting on port %s\n", port)
	log.Fatal(r.Run(":" + port))
}
