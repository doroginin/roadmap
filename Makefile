.PHONY: build run test migrate migrate-file migrate-status e2e e2e-ui dev stop-dev

# Build the application
build:
	go build -o bin/roadmap cmd/service/main.go

# Run tests
test:
	go test -v ./...

# Run e2e tests
e2e:
	cd ./e2e && npm test

# Run e2e tests ui
e2e-ui:
	cd ./e2e && npm run test:ui

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

# Format code
fmt:
	go fmt ./...

# Lint code (requires golangci-lint)
lint:
	golangci-lint run

# Start development environment (database + frontend + backend)
dev:
	@echo "Starting development environment..."
	@$(MAKE) stop-dev
	@echo "Starting database..."
	@docker-compose build
	@docker-compose up -d
	@echo "Building frontend..."
	@npm run build
	@echo "Starting frontend in background..."
	@npm run dev &
	@echo "Development environment started!"
	@echo "Frontend is running in background. Use 'make stop-dev' to stop all processes."

# Stop development environment
stop-dev:
	@echo "Stopping development environment..."
	@pkill -f "vite" || true
	@docker-compose down || true
	@echo "Development environment stopped!"


# Start debug environment (database + frontend)
debug:
	@echo "Starting development environment..."
	@$(MAKE) stop-dev
	@echo "Starting database..."
	@docker-compose up -d postgres
	@echo "Building frontend..."
	@npm run build
	@echo "Starting frontend in background..."
	@npm run dev &
	@echo "Development environment started!"
	@echo "Frontend is running in background. Use 'make stop-dev' to stop all processes."

# Stop development environment
stop-debug:
	@echo "Stopping development environment..."
	@pkill -f "vite" || true
	@docker-compose down || true
	@echo "Development environment stopped!"

# Run the application
run:
	go run cmd/service/main.go
