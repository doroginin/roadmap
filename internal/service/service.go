package service

import (
	"fmt"

	"roadmap/internal/models"
	"roadmap/internal/repository"
)

type Service struct {
	repo *repository.Repository
}

func New(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// GetCurrentVersion returns the current document version
func (s *Service) GetCurrentVersion() (*models.VersionResponse, error) {
	version, err := s.repo.GetCurrentVersion()
	if err != nil {
		return nil, fmt.Errorf("failed to get current version: %w", err)
	}

	return &models.VersionResponse{Version: version}, nil
}

// GetAllData returns all data with the current version
func (s *Service) GetAllData() (*models.DataResponse, error) {
	data, err := s.repo.GetAllData()
	if err != nil {
		return nil, fmt.Errorf("failed to get all data: %w", err)
	}

	return data, nil
}

// GetDataDiff returns changes since the specified version
func (s *Service) GetDataDiff(fromVersion int64) (*models.DiffResponse, error) {
	currentVersion, err := s.repo.GetCurrentVersion()
	if err != nil {
		return nil, fmt.Errorf("failed to get current version: %w", err)
	}

	changes, err := s.repo.GetChangesSince(fromVersion)
	if err != nil {
		return nil, fmt.Errorf("failed to get changes since version %d: %w", fromVersion, err)
	}

	return &models.DiffResponse{
		Version: currentVersion,
		Changes: changes,
	}, nil
}

// UpdateData updates data in the database with optimistic locking
func (s *Service) UpdateData(req *models.UpdateRequest) (*models.UpdateResponse, error) {
	fmt.Printf("Service: UpdateData called with %d tasks\n", len(req.Tasks))

	// Start transaction
	tx, err := s.repo.BeginTransaction()
	if err != nil {
		fmt.Printf("Service: Failed to start transaction: %v\n", err)
		return &models.UpdateResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to start transaction: %v", err),
		}, nil
	}
	defer tx.Rollback() // Will be ignored if tx.Commit() succeeds

	// Check current version for optimistic locking
	currentVersion, err := s.repo.GetCurrentVersion()
	if err != nil {
		fmt.Printf("Service: Failed to get current version: %v\n", err)
		return &models.UpdateResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to get current version: %v", err),
		}, nil
	}

	fmt.Printf("Service: Version check - client: %d, server: %d\n", req.Version, currentVersion)
	if req.Version != currentVersion {
		fmt.Printf("Service: Version conflict detected\n")
		return &models.UpdateResponse{
			Success: false,
			Error:   fmt.Sprintf("Version conflict: client version %d, server version %d", req.Version, currentVersion),
		}, nil
	}

	// Update data
	fmt.Printf("Service: Calling repository UpdateData\n")
	err = s.repo.UpdateData(tx, req)
	if err != nil {
		fmt.Printf("Service: Repository UpdateData failed: %v\n", err)
		return &models.UpdateResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to update data: %v", err),
		}, nil
	}
	fmt.Printf("Service: Repository UpdateData succeeded\n")

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return &models.UpdateResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to commit transaction: %v", err),
		}, nil
	}

	// Get new version after commit
	newVersion, err := s.repo.GetCurrentVersion()
	if err != nil {
		return &models.UpdateResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to get new version: %v", err),
		}, nil
	}

	return &models.UpdateResponse{
		Version: newVersion,
		Success: true,
	}, nil
}
