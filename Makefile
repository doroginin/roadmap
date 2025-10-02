.PHONY: build run test clean docker-up docker-down migrate migrate-file migrate-status e2e

# Build the application
build:
	go build -o bin/roadmap cmd/service/main.go

# Run the application
run:
	go run cmd/service/main.go

# Run tests
test:
	go test -v ./...

# Run e2e tests
e2e:
	cd ./e2e && npm test && npx playwright show-report

# Clean build artifacts
clean:
	rm -rf bin/

# Start services with Docker Compose
docker-up:
	docker-compose up -d

# Stop services
docker-down:
	docker-compose down

# Run database migrations
migrate:
	@echo "Running database migrations..."
	@for sql_file in db/changelog/master/*.sql; do \
		echo "Executing $$sql_file..."; \
		docker-compose exec -T postgres psql -U user -d roadmap -f /docker-entrypoint-initdb.d/$$(basename $$sql_file) || exit 1; \
	done
	@echo "All migrations completed successfully!"

# Run specific migration
migrate-file:
	@if [ -z "$(FILE)" ]; then \
		echo "Usage: make migrate-file FILE=001_initial_schema.sql"; \
		exit 1; \
	fi
	@echo "Running migration: $(FILE)"
	@docker-compose exec -T postgres psql -U user -d roadmap -f /docker-entrypoint-initdb.d/$(FILE)

# Check migration status
migrate-status:
	@echo "Checking database connection and migration status..."
	@docker-compose exec -T postgres psql -U user -d roadmap -c "\dt" || echo "Database not accessible or no tables found"

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