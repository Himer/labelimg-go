package libs

import (
	"math"
	"path/filepath"
)

// LabelFileFormat represents the format for label files.
type LabelFileFormat int

const (
	FormatPascalVOCEnum LabelFileFormat = iota + 1
	FormatYOLOEnum
	FormatCreateMLEnum
)

// LabelFile manages label file operations.
type LabelFile struct {
	Shapes    []map[string]interface{}
	ImagePath string
	ImageData []byte
	Verified  bool
}

// NewLabelFile creates a new LabelFile.
func NewLabelFile() *LabelFile {
	return &LabelFile{}
}

// ToggleVerify toggles the verified flag.
func (lf *LabelFile) ToggleVerify() {
	lf.Verified = !lf.Verified
}

// SavePascalVocFormat saves annotations in PASCAL VOC XML format.
func (lf *LabelFile) SavePascalVocFormat(filename string, shapes []map[string]interface{}, imagePath string, imageHeight, imageWidth, imageDepth int) error {
	folderName := filepath.Base(filepath.Dir(imagePath))
	imgFileName := filepath.Base(imagePath)

	writer := NewPascalVocWriter(folderName, imgFileName, [3]int{imageHeight, imageWidth, imageDepth})
	writer.LocalImgPath = imagePath
	writer.Verified = lf.Verified

	for _, shape := range shapes {
		points := shape["points"].([][2]float64)
		label := shape["label"].(string)
		difficult := shape["difficult"].(bool)

		xMin, yMin, xMax, yMax := ConvertPointsToBndBox(points)
		writer.AddBndBox(xMin, yMin, xMax, yMax, label, difficult)
	}

	return writer.Save(filename)
}

// SaveYoloFormat saves annotations in YOLO format.
func (lf *LabelFile) SaveYoloFormat(filename string, shapes []map[string]interface{}, imagePath string, imageHeight, imageWidth, imageDepth int, classList []string) error {
	folderName := filepath.Base(filepath.Dir(imagePath))
	imgFileName := filepath.Base(imagePath)

	writer := NewYOLOWriter(folderName, imgFileName, [3]int{imageHeight, imageWidth, imageDepth})
	writer.LocalImgPath = imagePath
	writer.Verified = lf.Verified

	for _, shape := range shapes {
		points := shape["points"].([][2]float64)
		label := shape["label"].(string)
		difficult := shape["difficult"].(bool)

		xMin, yMin, xMax, yMax := ConvertPointsToBndBox(points)
		writer.AddBndBox(xMin, yMin, xMax, yMax, label, difficult)
	}

	return writer.Save(filename, classList)
}

// SaveCreateMLFormat saves annotations in CreateML JSON format.
func (lf *LabelFile) SaveCreateMLFormat(filename string, shapes []CreateMLShape, imagePath string, imageHeight, imageWidth, imageDepth int) error {
	folderName := filepath.Base(filepath.Dir(imagePath))
	imgFileName := filepath.Base(imagePath)

	writer := NewCreateMLWriter(folderName, imgFileName, [3]int{imageHeight, imageWidth, imageDepth}, shapes, filename)
	writer.LocalImgPath = imagePath
	writer.Verified = lf.Verified

	return writer.Write()
}

// ConvertPointsToBndBox converts corner points to a bounding box (xMin, yMin, xMax, yMax).
func ConvertPointsToBndBox(points [][2]float64) (xMin, yMin, xMax, yMax int) {
	xMinF := math.Inf(1)
	yMinF := math.Inf(1)
	xMaxF := math.Inf(-1)
	yMaxF := math.Inf(-1)

	for _, p := range points {
		xMinF = math.Min(xMinF, p[0])
		yMinF = math.Min(yMinF, p[1])
		xMaxF = math.Max(xMaxF, p[0])
		yMaxF = math.Max(yMaxF, p[1])
	}

	// Clamp minimum to 1 (matching Python behavior for faster-rcnn training)
	if xMinF < 1 {
		xMinF = 1
	}
	if yMinF < 1 {
		yMinF = 1
	}

	return int(xMinF), int(yMinF), int(xMaxF), int(yMaxF)
}

// IsLabelFile checks if a filename is a label file.
func IsLabelFile(filename string) bool {
	ext := filepath.Ext(filename)
	return ext == XMLExt
}
