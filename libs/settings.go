package libs

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Settings stores application settings with JSON-based persistence.
type Settings struct {
	data map[string]interface{}
	path string
}

// NewSettings creates a new Settings instance.
func NewSettings() *Settings {
	home, _ := os.UserHomeDir()
	return &Settings{
		data: make(map[string]interface{}),
		path: filepath.Join(home, ".labelImgSettings.json"),
	}
}

// Set stores a value.
func (s *Settings) Set(key string, value interface{}) {
	s.data[key] = value
}

// Get retrieves a value, returning defaultVal if key is not found.
func (s *Settings) Get(key string, defaultVal ...interface{}) interface{} {
	if val, ok := s.data[key]; ok {
		return val
	}
	if len(defaultVal) > 0 {
		return defaultVal[0]
	}
	return nil
}

// Save persists settings to disk as JSON.
func (s *Settings) Save() bool {
	if s.path == "" {
		return false
	}
	data, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		fmt.Println("Saving setting failed")
		return false
	}
	if err := os.WriteFile(s.path, data, 0644); err != nil {
		fmt.Println("Saving setting failed")
		return false
	}
	return true
}

// Load reads settings from disk.
func (s *Settings) Load() bool {
	if _, err := os.Stat(s.path); os.IsNotExist(err) {
		return false
	}
	data, err := os.ReadFile(s.path)
	if err != nil {
		fmt.Println("Loading setting failed")
		return false
	}
	if err := json.Unmarshal(data, &s.data); err != nil {
		fmt.Println("Loading setting failed")
		return false
	}
	return true
}

// Reset clears all settings and removes the file.
func (s *Settings) Reset() {
	if s.path != "" {
		if _, err := os.Stat(s.path); err == nil {
			os.Remove(s.path)
			fmt.Printf("Remove setting json file %s\n", s.path)
		}
	}
	s.data = make(map[string]interface{})
	s.path = ""
}
