.PHONY: build run test migrate migrate-file migrate-status e2e e2e-ui dev

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

# Start development environment (database + frontend)
dev:
	@docker-compose up -d postgres
	@npm run build
	@npm run dev

# Run the application
run:
	go run cmd/service/main.go
