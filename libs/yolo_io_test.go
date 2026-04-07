package libs

import (
	"os"
	"path/filepath"
	"testing"
)

func TestYOLOWriteRead(t *testing.T) {
	writer := NewYOLOWriter("tests", "test", [3]int{512, 512, 1})
	writer.AddBndBox(60, 40, 430, 504, "person", false)
	writer.AddBndBox(113, 40, 450, 403, "face", false)

	tmpFile := "testdata/test_yolo.txt"
	classList := []string{}
	if err := writer.Save(tmpFile, classList); err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpFile)
	defer os.Remove(filepath.Join("testdata", "classes.txt"))

	reader, err := NewYOLOReader(tmpFile, 512, 512, 1, "")
	if err != nil {
		t.Fatal(err)
	}

	shapes := reader.GetShapes()
	if len(shapes) != 2 {
		t.Fatalf("expected 2 shapes, got %d", len(shapes))
	}

	if shapes[0].Label != "person" {
		t.Errorf("expected 'person', got '%s'", shapes[0].Label)
	}
	if shapes[1].Label != "face" {
		t.Errorf("expected 'face', got '%s'", shapes[1].Label)
	}
}
