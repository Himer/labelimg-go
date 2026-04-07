package libs

import (
	"testing"
)

func TestSettingsBasic(t *testing.T) {
	settings := NewSettings()

	settings.Set("test0", "hello")
	settings.Set("test1", 10)
	settings.Set("test2", []int{0, 2, 3})

	// Test default value
	if settings.Get("test3", 3) != 3 {
		t.Error("default value not returned")
	}

	// Test save
	if !settings.Save() {
		t.Error("save failed")
	}

	// Test load
	settings.Load()
	if settings.Get("test0") != "hello" {
		t.Errorf("test0 not loaded correctly: got %v", settings.Get("test0"))
	}
	// JSON unmarshals numbers as float64
	if settings.Get("test1") != float64(10) {
		t.Errorf("test1 not loaded correctly: got %v (type %T)", settings.Get("test1"), settings.Get("test1"))
	}

	// Clean up
	settings.Reset()
}
