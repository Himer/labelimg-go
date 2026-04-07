package libs

import (
	"encoding/xml"
	"fmt"
	"os"
	"strconv"
	"strings"
)

const XMLExt = ".xml"

// ShapeData represents an annotation shape returned by readers.
// Fields: Label, Points (4 corners), LineColor, FillColor, Difficult
type ShapeData struct {
	Label     string
	Points    [][2]float64
	LineColor interface{}
	FillColor interface{}
	Difficult bool
}

// --- XML structures for marshaling ---

type vocAnnotation struct {
	XMLName   xml.Name    `xml:"annotation"`
	Verified  string      `xml:"verified,attr,omitempty"`
	Folder    string      `xml:"folder"`
	Filename  string      `xml:"filename"`
	Path      string      `xml:"path,omitempty"`
	Source    vocSource   `xml:"source"`
	Size      vocSize     `xml:"size"`
	Segmented string      `xml:"segmented"`
	Objects   []vocObject `xml:"object"`
}

type vocSource struct {
	Database string `xml:"database"`
}

type vocSize struct {
	Width  string `xml:"width"`
	Height string `xml:"height"`
	Depth  string `xml:"depth"`
}

type vocObject struct {
	Name      string  `xml:"name"`
	Pose      string  `xml:"pose"`
	Truncated string  `xml:"truncated"`
	Difficult string  `xml:"difficult"`
	BndBox    vocBBox `xml:"bndbox"`
}

type vocBBox struct {
	XMin string `xml:"xmin"`
	YMin string `xml:"ymin"`
	XMax string `xml:"xmax"`
	YMax string `xml:"ymax"`
}

// BndBox represents a bounding box annotation.
type BndBox struct {
	Name      string
	XMin      int
	YMin      int
	XMax      int
	YMax      int
	Difficult bool
}

// PascalVocWriter writes PASCAL VOC XML annotations.
type PascalVocWriter struct {
	FolderName   string
	Filename     string
	DatabaseSrc  string
	ImgSize      [3]int // [height, width, depth]
	LocalImgPath string
	Verified     bool
	BoxList      []BndBox
}

// NewPascalVocWriter creates a new PascalVocWriter.
func NewPascalVocWriter(folderName, filename string, imgSize [3]int) *PascalVocWriter {
	return &PascalVocWriter{
		FolderName:  folderName,
		Filename:    filename,
		DatabaseSrc: "Unknown",
		ImgSize:     imgSize,
	}
}

// AddBndBox adds a bounding box to the writer.
func (w *PascalVocWriter) AddBndBox(xMin, yMin, xMax, yMax int, name string, difficult bool) {
	w.BoxList = append(w.BoxList, BndBox{
		Name: name, XMin: xMin, YMin: yMin, XMax: xMax, YMax: yMax, Difficult: difficult,
	})
}

// Save writes the PASCAL VOC XML to the target file.
func (w *PascalVocWriter) Save(targetFile string) error {
	if w.Filename == "" || w.FolderName == "" {
		return fmt.Errorf("filename and folder_name are required")
	}

	ann := vocAnnotation{
		Folder:    w.FolderName,
		Filename:  w.Filename,
		Path:      w.LocalImgPath,
		Source:    vocSource{Database: w.DatabaseSrc},
		Segmented: "0",
		Size: vocSize{
			Width:  strconv.Itoa(w.ImgSize[1]),
			Height: strconv.Itoa(w.ImgSize[0]),
			Depth:  strconv.Itoa(w.ImgSize[2]),
		},
	}

	if w.Verified {
		ann.Verified = "yes"
	}

	for _, box := range w.BoxList {
		truncated := "0"
		if box.YMax == w.ImgSize[0] || box.YMin == 1 {
			truncated = "1"
		} else if box.XMax == w.ImgSize[1] || box.XMin == 1 {
			truncated = "1"
		}

		difficultStr := "0"
		if box.Difficult {
			difficultStr = "1"
		}

		obj := vocObject{
			Name:      Ustr(box.Name),
			Pose:      "Unspecified",
			Truncated: truncated,
			Difficult: difficultStr,
			BndBox: vocBBox{
				XMin: strconv.Itoa(box.XMin),
				YMin: strconv.Itoa(box.YMin),
				XMax: strconv.Itoa(box.XMax),
				YMax: strconv.Itoa(box.YMax),
			},
		}
		ann.Objects = append(ann.Objects, obj)
	}

	output, err := xml.MarshalIndent(ann, "", "  ")
	if err != nil {
		return err
	}

	// Replace spaces with tabs for indentation (matching Python lxml behavior)
	result := strings.ReplaceAll(string(output), "  ", "\t")
	// Add XML header
	xmlContent := xml.Header + result + "\n"

	filePath := targetFile
	if filePath == "" {
		filePath = w.Filename + XMLExt
	}

	return os.WriteFile(filePath, []byte(xmlContent), 0644)
}

// PascalVocReader reads PASCAL VOC XML annotations.
type PascalVocReader struct {
	FilePath string
	Shapes   []ShapeData
	Verified bool
}

// NewPascalVocReader creates a reader and parses the XML file.
func NewPascalVocReader(filePath string) (*PascalVocReader, error) {
	r := &PascalVocReader{
		FilePath: filePath,
	}
	err := r.parseXML()
	if err != nil {
		return r, err
	}
	return r, nil
}

// GetShapes returns the parsed shapes.
func (r *PascalVocReader) GetShapes() []ShapeData {
	return r.Shapes
}

func (r *PascalVocReader) parseXML() error {
	if !strings.HasSuffix(r.FilePath, XMLExt) {
		return fmt.Errorf("unsupported file format")
	}

	data, err := os.ReadFile(r.FilePath)
	if err != nil {
		return err
	}

	var ann vocAnnotation
	if err := xml.Unmarshal(data, &ann); err != nil {
		return err
	}

	if ann.Verified == "yes" {
		r.Verified = true
	}

	for _, obj := range ann.Objects {
		xMin, _ := strconv.ParseFloat(obj.BndBox.XMin, 64)
		yMin, _ := strconv.ParseFloat(obj.BndBox.YMin, 64)
		xMax, _ := strconv.ParseFloat(obj.BndBox.XMax, 64)
		yMax, _ := strconv.ParseFloat(obj.BndBox.YMax, 64)

		xMinI := int(xMin)
		yMinI := int(yMin)
		xMaxI := int(xMax)
		yMaxI := int(yMax)

		points := [][2]float64{
			{float64(xMinI), float64(yMinI)},
			{float64(xMaxI), float64(yMinI)},
			{float64(xMaxI), float64(yMaxI)},
			{float64(xMinI), float64(yMaxI)},
		}

		difficult := false
		if obj.Difficult != "" {
			d, err := strconv.Atoi(obj.Difficult)
			if err == nil && d != 0 {
				difficult = true
			}
		}

		r.Shapes = append(r.Shapes, ShapeData{
			Label:     obj.Name,
			Points:    points,
			Difficult: difficult,
		})
	}
	return nil
}
