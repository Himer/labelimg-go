package libs

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
)

const JSONExt = ".json"

// CreateMLCoordinates represents center-based coordinates.
type CreateMLCoordinates struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// CreateMLAnnotation represents a single annotation in CreateML format.
type CreateMLAnnotation struct {
	Label       string              `json:"label"`
	Coordinates CreateMLCoordinates `json:"coordinates"`
}

// CreateMLImage represents annotations for one image.
type CreateMLImage struct {
	Image       string               `json:"image"`
	Verified    bool                 `json:"verified"`
	Annotations []CreateMLAnnotation `json:"annotations"`
}

// CreateMLShape represents a shape input for the writer.
type CreateMLShape struct {
	Label  string
	Points [][2]float64 // 4 corner points
}

// CreateMLWriter writes CreateML JSON format annotations.
type CreateMLWriter struct {
	FolderName   string
	Filename     string
	ImgSize      [3]int
	Shapes       []CreateMLShape
	OutputFile   string
	LocalImgPath string
	Verified     bool
}

// NewCreateMLWriter creates a new CreateMLWriter.
func NewCreateMLWriter(folderName, filename string, imgSize [3]int, shapes []CreateMLShape, outputFile string) *CreateMLWriter {
	return &CreateMLWriter{
		FolderName: folderName,
		Filename:   filename,
		ImgSize:    imgSize,
		Shapes:     shapes,
		OutputFile: outputFile,
	}
}

// Write outputs the CreateML JSON file.
func (w *CreateMLWriter) Write() error {
	var outputDict []CreateMLImage

	// Read existing file if it exists
	if data, err := os.ReadFile(w.OutputFile); err == nil {
		_ = json.Unmarshal(data, &outputDict)
	}

	outputImage := CreateMLImage{
		Image:    w.Filename,
		Verified: w.Verified,
	}

	for _, shape := range w.Shapes {
		x1 := shape.Points[0][0]
		y1 := shape.Points[0][1]
		x2 := shape.Points[1][0]
		y2 := shape.Points[2][1]

		height, width, x, y := CalculateCoordinates(x1, x2, y1, y2)

		ann := CreateMLAnnotation{
			Label: shape.Label,
			Coordinates: CreateMLCoordinates{
				X:      x,
				Y:      y,
				Width:  width,
				Height: height,
			},
		}
		outputImage.Annotations = append(outputImage.Annotations, ann)
	}

	// Check if image already exists in output
	exists := false
	for i := range outputDict {
		if outputDict[i].Image == outputImage.Image {
			exists = true
			outputDict[i] = outputImage
			break
		}
	}
	if !exists {
		outputDict = append(outputDict, outputImage)
	}

	data, err := json.Marshal(outputDict)
	if err != nil {
		return err
	}

	// Ensure directory exists
	dir := filepath.Dir(w.OutputFile)
	if dir != "" {
		os.MkdirAll(dir, 0755)
	}

	return os.WriteFile(w.OutputFile, data, 0644)
}

// CalculateCoordinates converts corner points to center-based coordinates.
func CalculateCoordinates(x1, x2, y1, y2 float64) (height, width, x, y float64) {
	xMin := math.Min(x1, x2)
	xMax := math.Max(x1, x2)
	yMin := math.Min(y1, y2)
	yMax := math.Max(y1, y2)

	width = xMax - xMin
	if width < 0 {
		width = -width
	}
	height = yMax - yMin

	// x and y from center of rect
	x = xMin + width/2
	y = yMin + height/2
	return
}

// CreateMLReader reads CreateML JSON format annotations.
type CreateMLReader struct {
	JSONPath string
	Filename string
	Shapes   []ShapeData
	Verified bool
}

// NewCreateMLReader creates a reader and parses the JSON file.
func NewCreateMLReader(jsonPath, filePath string) (*CreateMLReader, error) {
	r := &CreateMLReader{
		JSONPath: jsonPath,
		Filename: filepath.Base(filePath),
	}
	err := r.parseJSON()
	if err != nil {
		return r, err
	}
	return r, nil
}

// GetShapes returns the parsed shapes.
func (r *CreateMLReader) GetShapes() []ShapeData {
	return r.Shapes
}

func (r *CreateMLReader) parseJSON() error {
	data, err := os.ReadFile(r.JSONPath)
	if err != nil {
		return err
	}

	var outputList []CreateMLImage
	if err := json.Unmarshal(data, &outputList); err != nil {
		return err
	}

	if len(outputList) > 0 {
		r.Verified = outputList[0].Verified
	}

	r.Shapes = nil
	for _, image := range outputList {
		if image.Image == r.Filename {
			for _, ann := range image.Annotations {
				r.addShape(ann.Label, ann.Coordinates)
			}
		}
	}

	return nil
}

func (r *CreateMLReader) addShape(label string, coords CreateMLCoordinates) {
	xMin := coords.X - (coords.Width / 2)
	yMin := coords.Y - (coords.Height / 2)
	xMax := coords.X + (coords.Width / 2)
	yMax := coords.Y + (coords.Height / 2)

	points := [][2]float64{
		{xMin, yMin},
		{xMax, yMin},
		{xMax, yMax},
		{xMin, yMax},
	}

	r.Shapes = append(r.Shapes, ShapeData{
		Label:     label,
		Points:    points,
		Difficult: true,
	})
}
