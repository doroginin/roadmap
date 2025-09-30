.PHONY: build run test clean docker-up docker-down migrate

# Build the application
build:
	go build -o bin/roadmap cmd/service/main.go

# Run the application
run:
	go run cmd/service/main.go

# Run tests
test:
	go test -v ./...

# Clean build artifacts
clean:
	rm -rf bin/

# Start services with Docker Compose
docker-up:
	docker-compose up -d

# Stop services
docker-down:
	docker-compose down

# Run database migrations manually
migrate:
	@echo "Run the following SQL files in order:"
	@echo "1. db/changelog/master/001_initial_schema.sql"
	@echo "2. db/changelog/master/002_seed_data.sql"
	@echo "3. db/changelog/master/003_migrate_test_tasks.sql"

# Install dependencies
deps:
	go mod download
	go mod tidy

# Format code
fmt:
	go fmt ./...

# Lint code (requires golangci-lint)
lint:
	golangci-lint run

# Development setup
dev-setup: deps
	@echo "Development environment setup complete"
	@echo "1. Copy .env.example to .env and configure your database"
	@echo "2. Run 'make docker-up' to start PostgreSQL"
	@echo "3. Run database migrations manually"
	@echo "4. Run 'make run' to start the server"