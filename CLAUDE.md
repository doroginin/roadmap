# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack roadmap planning application with a React/TypeScript frontend and Go backend. The application enables resource capacity planning and task scheduling with automatic versioning, optimistic locking, and auto-save functionality.

**Key Technologies:**
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS
- **Backend**: Go, Gin framework, PostgreSQL
- **Architecture**: REST API with optimistic locking and change tracking

## Important: Verification After Changes

**ALWAYS run these checks after making ANY code changes:**

1. **Build check**: `make dev` - Verify the application builds and runs (frontend + backend + database)
2. **Unit tests**: `make test` - Run Go unit tests (currently no tests, but check for errors)
3. **E2E tests**: `make e2e` - Run Playwright end-to-end tests

**When writing E2E tests:**
- Reference elements using `data-testid` attributes
- Add missing `data-testid` attributes to elements as needed
- Use Playwright MCP when appropriate

## Development Commands

### Frontend Development
```bash
npm run dev          # Start Vite development server
npm run build        # Build frontend (tsc + vite build)
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Backend Development
```bash
make run             # Run Go backend server
make build           # Build Go binary to bin/roadmap
go run cmd/service/main.go  # Alternative way to run backend
```

### Database
```bash
make dev             # Start full dev environment (PostgreSQL + frontend + backend)
make stop-dev        # Stop all development processes
make debug           # Start database + frontend only (for debugging backend separately)
make migrate         # Run all database migrations
make migrate-file FILE=001_initial_schema.sql  # Run specific migration
make migrate-status  # Check database status
```

### Testing
```bash
make test            # Run Go unit tests
make e2e             # Run end-to-end tests
make e2e-ui          # Run e2e tests with UI
```

### Code Quality
```bash
make fmt             # Format Go code
make lint            # Lint Go code (requires golangci-lint)
```

## Architecture Overview

### Backend Structure

The Go backend follows a clean layered architecture:

```
cmd/service/main.go              # Application entry point
internal/
  ├── api/handlers.go            # HTTP request handlers
  ├── config/config.go           # Configuration management
  ├── models/models.go           # Data models and types
  ├── repository/repository.go   # Database access layer
  └── service/service.go         # Business logic layer
db/changelog/master/             # SQL migrations (numbered)
```

**Key Backend Concepts:**
- All database operations use PostgreSQL transactions
- Automatic versioning via database triggers on every data change
- Change log tracks all modifications for diff API
- Optimistic locking prevents concurrent edit conflicts
- UUIDs used for all entity IDs

### Frontend Structure

The React frontend uses a component-based architecture with custom hooks for state management:

```
src/
  ├── components/          # React components
  │   ├── RoadmapPlan.tsx  # Main planning grid component
  │   ├── SaveStatus.tsx   # Auto-save status indicator
  │   └── ...
  ├── hooks/               # Custom React hooks
  │   ├── useAutoSave.ts   # Auto-save with 2-second delay
  │   ├── useChangeTracker.ts  # Track incremental changes
  │   └── useUserId.ts     # User identification
  ├── api/                 # API client functions
  │   ├── roadmapApi.ts    # API calls
  │   └── types.ts         # TypeScript types
  └── utils/               # Utility functions
      └── dataDiff.ts      # Calculate data changes
```

**Key Frontend Concepts:**
- Auto-save triggers 1-2 seconds after any data change (configurable delay)
- Change tracking system sends only modified data to backend, not full dataset
- Optimistic locking: client must send current version number with updates
- Version conflict handling: if server version differs, client must refetch

### Data Model

The application has two main entity types stored in separate database tables:

**Resources** (`kind: "resource"`):
- Represent available capacity for a team/function/employee
- Have weekly capacity values (array of numbers)
- Can have colors assigned to functions and employees

**Tasks** (`kind: "task"`):
- Represent work items to be scheduled
- Have status (Todo, Backlog, Cancelled)
- Can be auto-planned or manually edited
- Support dependencies via `blockerIds` (references to other tasks)
- Have weekly allocation values (array of numbers)

**Supporting Entities:**
- **Teams**: Groups with JIRA project integration
- **Sprints**: Time periods with start/end dates mapped to week numbers
- **Document Version**: Global version number incremented on any change
- **Change Log**: History of all changes for diff/sync operations

### API Endpoints

**Backend serves on port 8080:**
- `GET /api/v1/version` - Lightweight version check (for polling)
- `GET /api/v1/data` - Fetch all data with current version
- `GET /api/v1/data/diff/:fromVersion` - Get changes since version
- `PUT /api/v1/data` - Update data with version check (returns new version or 409 conflict)

**Frontend serves on port 5173** (Vite default)

### Auto-Save System

The auto-save system is a critical feature:

1. **Change Tracking** (`useChangeTracker`):
   - Tracks which entities (tasks, resources, teams, sprints) were created, updated, or deleted
   - Builds a change log with only modified data
   - Prevents unnecessary full-data saves

2. **Auto-Save Hook** (`useAutoSave`):
   - Monitors `changeTracker.hasUnsavedChanges` flag
   - Debounces saves with configurable delay (default 1-2 seconds)
   - Calls `saveRoadmapChanges()` with incremental changes only
   - Handles version conflicts automatically
   - Updates UI state through `SaveStatus` component

3. **Conflict Resolution**:
   - If version mismatch occurs (409), user sees error
   - Client can retry or refetch latest data
   - No automatic merge - user must resolve manually

### Key Business Logic

**Auto-Planning Algorithm** (see spec.md §6.2):
- Finds earliest continuous time slot for tasks respecting:
  - Blocker dependencies (task can't start until blockers finish)
  - Resource capacity constraints
  - Duration requirements (`planWeeks`)
  - Resource needs per week (`planEmpl`)

**Dependency Validation**:
- Blockers can only reference tasks appearing earlier in the display order
- Circular dependencies are prevented
- Dependencies use UUIDs stored in `blockerIds` array

**Week Calculation**:
- Week #1 starts at `sprints[0].start` date
- All weeks are 7-day periods from that baseline
- Sprint codes assigned to weeks based on date overlap
- `sprintsAuto` field auto-calculated from task's week range

## Important Development Notes

### When Modifying Data Models

1. **Backend**: Update `internal/models/models.go` with new fields
2. **Frontend**: Update `src/api/types.ts` to match
3. **Database**: Create new migration in `db/changelog/master/` with next number
4. **Change Tracking**: Update `src/utils/dataDiff.ts` if adding new entity types

### When Adding New API Endpoints

1. Add handler in `internal/api/handlers.go`
2. Add repository method in `internal/repository/repository.go`
3. Add API client function in `src/api/roadmapApi.ts`
4. Update types in `src/api/types.ts`

### Testing Strategy

- Go unit tests for business logic and repository layer
- E2E tests in `./e2e` directory for full user workflows
- Manual testing via `make dev` for integrated development

### Database Migrations

- Migrations are SQL files in `db/changelog/master/`
- Numbered sequentially: `001_initial_schema.sql`, `002_seed_data.sql`, etc.
- Run all migrations with `make migrate`
- Migrations include table definitions, triggers, and seed data
- PostgreSQL-specific features used (arrays, triggers, JSON functions)

### Environment Variables

**Backend** (from README.md):
- `DATABASE_URL`: PostgreSQL connection string (default: `postgres://user:password@localhost/roadmap?sslmode=disable`)
- `PORT`: Server port (default: `8080`)

**Frontend**:
- API base URL hardcoded to `http://localhost:8080` in `src/api/roadmapApi.ts`

### Docker Setup

- `docker-compose.yml` defines PostgreSQL service and app service
- Migrations automatically run on PostgreSQL init via volume mount
- Healthcheck ensures database is ready before starting app
- Use `make dev` or `docker-compose up` to start services

## Common Workflows

### Adding a New Field to Tasks

1. Update `Task` struct in `internal/models/models.go`
2. Update `TaskUpdate` struct for the update request format
3. Create migration file `db/changelog/master/00X_add_task_field.sql`
4. Update frontend types in `src/api/types.ts`
5. Update `RoadmapPlan.tsx` component to display/edit the field
6. Update change tracking in `useChangeTracker.ts` if field should trigger saves

### Debugging Version Conflicts

1. Check browser console for version numbers being sent
2. Check server logs for current version
3. Verify `useAutoSave.ts` is correctly tracking `currentVersionRef`
4. Ensure change tracker is properly clearing after successful saves
5. Look for race conditions in concurrent saves

### Adding New Auto-Calculations

Many fields are auto-calculated (marked as readonly in spec.md):
- `fact`: Sum of weekly values
- `startWeek`/`endWeek`: First/last week with non-zero value
- `sprintsAuto`: Sprint codes for weeks in task's range
- `weekBlockers`: Calculated from blocker dependencies

These should be calculated in business logic layer (`internal/service/service.go`) or via database triggers for consistency.
