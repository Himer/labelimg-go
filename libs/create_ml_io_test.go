package libs

import (
	"encoding/json"
	"os"
	"testing"
)

func TestCreateMLWrite(t *testing.T) {
	person := CreateMLShape{
		Label:  "person",
		Points: [][2]float64{{65, 45}, {420, 45}, {420, 512}, {65, 512}},
	}
	face := CreateMLShape{
		Label:  "face",
		Points: [][2]float64{{245, 250}, {350, 250}, {350, 365}, {245, 365}},
	}

	// Expected calculations for face:
	// width = 350-245 = 105
	// height = 365-250 = 115
	// x = 245 + 105/2 = 297.5
	// y = 250 + 115/2 = 307.5
	expectedWidth := 105.0
	expectedHeight := 115.0
	expectedX := 297.5
	expectedY := 307.5

	outputFile := "testdata/tests.json"
	writer := NewCreateMLWriter("tests", "test.512.512.bmp", [3]int{512, 512, 1},
		[]CreateMLShape{person, face}, outputFile)
	writer.Verified = true
	writer.LocalImgPath = "tests/test.512.512.bmp"

	if err := writer.Write(); err != nil {
		t.Fatal(err)
	}
	defer os.Remove(outputFile)

	// Read and verify JSON
	data, err := os.ReadFile(outputFile)
	if err != nil {
		t.Fatal(err)
	}

	var dataList []CreateMLImage
	if err := json.Unmarshal(data, &dataList); err != nil {
		t.Fatal(err)
	}

	if len(dataList) == 0 {
		t.Fatal("output file is empty")
	}

	dataDict := dataList[0]
	if !dataDict.Verified {
		t.Error("verified tag not reflected")
	}
	if dataDict.Image != "test.512.512.bmp" {
		t.Errorf("filename not correct in .json: got %s", dataDict.Image)
	}
	if len(dataDict.Annotations) != 2 {
		t.Errorf("output file contains too few annotations: got %d", len(dataDict.Annotations))
	}

	faceAnn := dataDict.Annotations[1]
	if faceAnn.Label != "face" {
		t.Errorf("label name is wrong: got %s", faceAnn.Label)
	}
	if faceAnn.Coordinates.Width != expectedWidth {
		t.Errorf("calculated width is wrong: expected %f, got %f", expectedWidth, faceAnn.Coordinates.Width)
	}
	if faceAnn.Coordinates.Height != expectedHeight {
		t.Errorf("calculated height is wrong: expected %f, got %f", expectedHeight, faceAnn.Coordinates.Height)
	}
	if faceAnn.Coordinates.X != expectedX {
		t.Errorf("calculated x is wrong: expected %f, got %f", expectedX, faceAnn.Coordinates.X)
	}
	if faceAnn.Coordinates.Y != expectedY {
		t.Errorf("calculated y is wrong: expected %f, got %f", expectedY, faceAnn.Coordinates.Y)
	}
}

func TestCreateMLRead(t *testing.T) {
	// First write a file to read
	person := CreateMLShape{
		Label:  "person",
		Points: [][2]float64{{65, 45}, {420, 45}, {420, 512}, {65, 512}},
	}
	face := CreateMLShape{
		Label:  "face",
		Points: [][2]float64{{245, 250}, {350, 250}, {350, 365}, {245, 365}},
	}

	outputFile := "testdata/tests_read.json"
	writer := NewCreateMLWriter("tests", "test.512.512.bmp", [3]int{512, 512, 1},
		[]CreateMLShape{person, face}, outputFile)
	writer.Verified = true
	if err := writer.Write(); err != nil {
		t.Fatal(err)
	}
	defer os.Remove(outputFile)

	// Now read it back
	reader, err := NewCreateMLReader(outputFile, "tests/test.512.512.bmp")
	if err != nil {
		t.Fatal(err)
	}

	shapes := reader.GetShapes()
	if len(shapes) != 2 {
		t.Fatalf("shape count is wrong: expected 2, got %d", len(shapes))
	}

	faceShape := shapes[1]
	if faceShape.Label != "face" {
		t.Errorf("label is wrong: expected 'face', got '%s'", faceShape.Label)
	}

	faceCoords := faceShape.Points
	xMin := faceCoords[0][0]
	xMax := faceCoords[1][0]
	yMin := faceCoords[0][1]
	yMax := faceCoords[2][1]

	if xMin != 245 {
		t.Errorf("xmin is wrong: expected 245, got %f", xMin)
	}
	if xMax != 350 {
		t.Errorf("xmax is wrong: expected 350, got %f", xMax)
	}
	if yMin != 250 {
		t.Errorf("ymin is wrong: expected 250, got %f", yMin)
	}
	if yMax != 365 {
		t.Errorf("ymax is wrong: expected 365, got %f", yMax)
	}
}
