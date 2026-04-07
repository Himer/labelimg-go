package libs

import (
	"bufio"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
)

const TXTExt = ".txt"

// YOLOWriter writes YOLO format annotations.
type YOLOWriter struct {
	FolderName   string
	Filename     string
	DatabaseSrc  string
	ImgSize      [3]int // [height, width, depth]
	LocalImgPath string
	Verified     bool
	BoxList      []BndBox
}

// NewYOLOWriter creates a new YOLOWriter.
func NewYOLOWriter(folderName, filename string, imgSize [3]int) *YOLOWriter {
	return &YOLOWriter{
		FolderName:  folderName,
		Filename:    filename,
		DatabaseSrc: "Unknown",
		ImgSize:     imgSize,
	}
}

// AddBndBox adds a bounding box.
func (w *YOLOWriter) AddBndBox(xMin, yMin, xMax, yMax int, name string, difficult bool) {
	w.BoxList = append(w.BoxList, BndBox{
		Name: name, XMin: xMin, YMin: yMin, XMax: xMax, YMax: yMax, Difficult: difficult,
	})
}

// BndBoxToYOLOLine converts a bounding box to YOLO format values.
func (w *YOLOWriter) BndBoxToYOLOLine(box BndBox, classList *[]string) (classIndex int, xCenter, yCenter, width, height float64) {
	xCenter = float64(box.XMin+box.XMax) / 2 / float64(w.ImgSize[1])
	yCenter = float64(box.YMin+box.YMax) / 2 / float64(w.ImgSize[0])
	width = float64(box.XMax-box.XMin) / float64(w.ImgSize[1])
	height = float64(box.YMax-box.YMin) / float64(w.ImgSize[0])

	// Find or add class
	boxName := box.Name
	classIndex = -1
	for i, c := range *classList {
		if c == boxName {
			classIndex = i
			break
		}
	}
	if classIndex == -1 {
		*classList = append(*classList, boxName)
		classIndex = len(*classList) - 1
	}
	return
}

// Save writes the YOLO txt file and classes.txt.
func (w *YOLOWriter) Save(targetFile string, classList []string) error {
	filePath := targetFile
	if filePath == "" {
		filePath = w.Filename + TXTExt
	}

	dir := filepath.Dir(filepath.Clean(filePath))
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	outFile, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer outFile.Close()

	for _, box := range w.BoxList {
		classIndex, xCenter, yCenter, width, height := w.BndBoxToYOLOLine(box, &classList)
		fmt.Fprintf(outFile, "%d %.6f %.6f %.6f %.6f\n", classIndex, xCenter, yCenter, width, height)
	}

	// Write classes.txt
	classesFile := filepath.Join(dir, "classes.txt")
	cf, err := os.Create(classesFile)
	if err != nil {
		return err
	}
	defer cf.Close()

	for _, c := range classList {
		fmt.Fprintln(cf, c)
	}

	return nil
}

// YOLOReader reads YOLO format annotations.
type YOLOReader struct {
	FilePath      string
	ClassListPath string
	Classes       []string
	ImgSize       [3]int
	Shapes        []ShapeData
	Verified      bool
}

// NewYOLOReader creates a reader and parses the YOLO format file.
func NewYOLOReader(filePath string, imgHeight, imgWidth, imgDepth int, classListPath string) (*YOLOReader, error) {
	r := &YOLOReader{
		FilePath: filePath,
		ImgSize:  [3]int{imgHeight, imgWidth, imgDepth},
	}

	if classListPath == "" {
		dir := filepath.Dir(filePath)
		r.ClassListPath = filepath.Join(dir, "classes.txt")
	} else {
		r.ClassListPath = classListPath
	}

	// Read classes
	classData, err := os.ReadFile(r.ClassListPath)
	if err != nil {
		return nil, err
	}
	classes := strings.TrimSpace(string(classData))
	r.Classes = strings.Split(classes, "\n")
	for i := range r.Classes {
		r.Classes[i] = strings.TrimSpace(r.Classes[i])
	}

	if err := r.parseYOLOFormat(); err != nil {
		return nil, err
	}

	return r, nil
}

// GetShapes returns the parsed shapes.
func (r *YOLOReader) GetShapes() []ShapeData {
	return r.Shapes
}

func (r *YOLOReader) yoloLineToShape(classIndex int, xCenter, yCenter, w, h float64) (label string, xMin, yMin, xMax, yMax int) {
	label = r.Classes[classIndex]

	xMinF := math.Max(xCenter-w/2, 0)
	xMaxF := math.Min(xCenter+w/2, 1)
	yMinF := math.Max(yCenter-h/2, 0)
	yMaxF := math.Min(yCenter+h/2, 1)

	xMin = int(math.Round(float64(r.ImgSize[1]) * xMinF))
	xMax = int(math.Round(float64(r.ImgSize[1]) * xMaxF))
	yMin = int(math.Round(float64(r.ImgSize[0]) * yMinF))
	yMax = int(math.Round(float64(r.ImgSize[0]) * yMaxF))
	return
}

func (r *YOLOReader) parseYOLOFormat() error {
	f, err := os.Open(r.FilePath)
	if err != nil {
		return err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		parts := strings.Split(line, " ")
		if len(parts) != 5 {
			continue
		}

		classIndex := 0
		fmt.Sscanf(parts[0], "%d", &classIndex)

		var xCenter, yCenter, w, h float64
		fmt.Sscanf(parts[1], "%f", &xCenter)
		fmt.Sscanf(parts[2], "%f", &yCenter)
		fmt.Sscanf(parts[3], "%f", &w)
		fmt.Sscanf(parts[4], "%f", &h)

		label, xMin, yMin, xMax, yMax := r.yoloLineToShape(classIndex, xCenter, yCenter, w, h)

		points := [][2]float64{
			{float64(xMin), float64(yMin)},
			{float64(xMax), float64(yMin)},
			{float64(xMax), float64(yMax)},
			{float64(xMin), float64(yMax)},
		}
		r.Shapes = append(r.Shapes, ShapeData{
			Label:     label,
			Points:    points,
			Difficult: false, // difficult flag is discarded in YOLO format
		})
	}
	return scanner.Err()
}
