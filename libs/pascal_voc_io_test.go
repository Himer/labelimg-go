package libs

import (
	"os"
	"testing"
)

func TestPascalVocWriteRead(t *testing.T) {
	// Create writer matching Python test: PascalVocWriter('tests', 'test', (512, 512, 1))
	writer := NewPascalVocWriter("tests", "test", [3]int{512, 512, 1})
	writer.LocalImgPath = "tests/test.512.512.bmp"

	difficult := true
	writer.AddBndBox(60, 40, 430, 504, "person", difficult)
	writer.AddBndBox(113, 40, 450, 403, "face", difficult)

	tmpFile := "testdata/test.xml"
	if err := writer.Save(tmpFile); err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpFile)

	reader, err := NewPascalVocReader(tmpFile)
	if err != nil {
		t.Fatal(err)
	}

	shapes := reader.GetShapes()
	if len(shapes) != 2 {
		t.Fatalf("expected 2 shapes, got %d", len(shapes))
	}

	// Verify person bounding box
	personBox := shapes[0]
	if personBox.Label != "person" {
		t.Errorf("expected label 'person', got '%s'", personBox.Label)
	}
	expectedPerson := [][2]float64{{60, 40}, {430, 40}, {430, 504}, {60, 504}}
	for i, p := range personBox.Points {
		if p != expectedPerson[i] {
			t.Errorf("person point %d: expected %v, got %v", i, expectedPerson[i], p)
		}
	}

	// Verify face bounding box
	faceBox := shapes[1]
	if faceBox.Label != "face" {
		t.Errorf("expected label 'face', got '%s'", faceBox.Label)
	}
	expectedFace := [][2]float64{{113, 40}, {450, 40}, {450, 403}, {113, 403}}
	for i, p := range faceBox.Points {
		if p != expectedFace[i] {
			t.Errorf("face point %d: expected %v, got %v", i, expectedFace[i], p)
		}
	}
}
