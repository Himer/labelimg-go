package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"strings"

	"github.com/labelimg/labelimg-go/libs"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct holds the application state.
type App struct {
	ctx        context.Context
	imgList    []string
	imgDir     string
	curIndex   int
	saveDir    string
	saveFormat string
	classList  []string
	settings   *libs.Settings
}

// NewApp creates a new App.
func NewApp() *App {
	return &App{
		saveFormat: libs.FormatYOLO,
		settings:   libs.NewSettings(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.settings.Load()
}

// FileInfo represents an image file entry.
type FileInfo struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	Index int    `json:"index"`
}

// ImageData is returned when loading an image.
type ImageData struct {
	Base64     string      `json:"base64"`
	Width      int         `json:"width"`
	Height     int         `json:"height"`
	Filename   string      `json:"filename"`
	Index      int         `json:"index"`
	Total      int         `json:"total"`
	Shapes     []ShapeJSON `json:"shapes"`
	SaveFormat string      `json:"saveFormat"`
}

// ShapeJSON represents an annotation shape for the frontend.
type ShapeJSON struct {
	Label     string       `json:"label"`
	Points    [][2]float64 `json:"points"`
	Difficult bool         `json:"difficult"`
}

// AnnotationData comes from the frontend when saving.
type AnnotationData struct {
	Shapes []ShapeJSON `json:"shapes"`
}

// SelectDirectory opens a native directory picker dialog.
func (a *App) SelectDirectory() string {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Image Directory",
	})
	if err != nil {
		return ""
	}
	return dir
}

// SelectSaveDirectory opens a native directory picker for save location.
func (a *App) SelectSaveDirectory() string {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Save Directory",
	})
	if err != nil {
		return ""
	}
	a.saveDir = dir
	return dir
}

// LoadClassFile opens a file dialog to select a classes.txt and loads it.
func (a *App) LoadClassFile() []string {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select classes.txt",
		Filters: []runtime.FileFilter{
			{DisplayName: "Text Files", Pattern: "*.txt"},
		},
	})
	if err != nil || filePath == "" {
		return a.classList
	}
	a.loadClassesFromFile(filePath)
	return a.classList
}

func (a *App) loadClassesFromFile(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	for _, line := range lines {
		label := strings.TrimSpace(line)
		if label != "" {
			a.addToClassList(label)
		}
	}
}

// OpenDirectory scans a directory for images and returns the file list.
func (a *App) OpenDirectory(dir string) []FileInfo {
	a.imgDir = dir
	a.imgList = nil
	a.curIndex = 0

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}

	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(e.Name()))
		if ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".bmp" || ext == ".gif" || ext == ".webp" {
			a.imgList = append(a.imgList, filepath.Join(dir, e.Name()))
		}
	}

	libs.NaturalSort(a.imgList)

	// Auto-load classes.txt from the image directory if present
	classesPath := filepath.Join(dir, "classes.txt")
	if _, err := os.Stat(classesPath); err == nil {
		a.loadClassesFromFile(classesPath)
	}

	var files []FileInfo
	for i, p := range a.imgList {
		files = append(files, FileInfo{
			Name:  filepath.Base(p),
			Path:  p,
			Index: i,
		})
	}
	return files
}

// LoadImage loads an image by index and returns its data + existing annotations.
func (a *App) LoadImage(index int) (*ImageData, error) {
	if index < 0 || index >= len(a.imgList) {
		return nil, fmt.Errorf("index out of range")
	}

	a.curIndex = index
	imgPath := a.imgList[index]

	// Read image file
	data, err := os.ReadFile(imgPath)
	if err != nil {
		return nil, err
	}

	// Detect MIME type from extension
	ext := strings.ToLower(filepath.Ext(imgPath))
	mime := "image/png"
	switch ext {
	case ".jpg", ".jpeg":
		mime = "image/jpeg"
	case ".gif":
		mime = "image/gif"
	case ".bmp":
		mime = "image/bmp"
	case ".webp":
		mime = "image/webp"
	}

	b64 := "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data)

	// Get image dimensions
	f, err := os.Open(imgPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	cfg, _, err := image.DecodeConfig(f)
	if err != nil {
		return nil, err
	}

	// Load existing annotations
	shapes := a.loadAnnotations(imgPath, cfg.Width, cfg.Height)

	return &ImageData{
		Base64:     b64,
		Width:      cfg.Width,
		Height:     cfg.Height,
		Filename:   filepath.Base(imgPath),
		Index:      index,
		Total:      len(a.imgList),
		Shapes:     shapes,
		SaveFormat: a.saveFormat,
	}, nil
}

// NextImage loads the next image.
func (a *App) NextImage() (*ImageData, error) {
	if a.curIndex+1 >= len(a.imgList) {
		return a.LoadImage(a.curIndex)
	}
	return a.LoadImage(a.curIndex + 1)
}

// PrevImage loads the previous image.
func (a *App) PrevImage() (*ImageData, error) {
	if a.curIndex-1 < 0 {
		return a.LoadImage(0)
	}
	return a.LoadImage(a.curIndex - 1)
}

// SaveAnnotations saves annotations for the current image.
func (a *App) SaveAnnotations(data AnnotationData) error {
	if a.curIndex < 0 || a.curIndex >= len(a.imgList) {
		return fmt.Errorf("no image loaded")
	}

	imgPath := a.imgList[a.curIndex]

	// Get image dimensions
	f, err := os.Open(imgPath)
	if err != nil {
		return err
	}
	cfg, _, err := image.DecodeConfig(f)
	f.Close()
	if err != nil {
		return err
	}

	saveDir := a.saveDir
	if saveDir == "" {
		saveDir = filepath.Dir(imgPath)
	}

	baseName := strings.TrimSuffix(filepath.Base(imgPath), filepath.Ext(imgPath))
	lf := libs.NewLabelFile()

	// Track labels
	for _, s := range data.Shapes {
		a.addToClassList(s.Label)
	}

	shapes := toShapeMaps(data.Shapes)

	switch a.saveFormat {
	case libs.FormatPascalVOC:
		savePath := filepath.Join(saveDir, baseName+".xml")
		return lf.SavePascalVocFormat(savePath, shapes, imgPath, cfg.Height, cfg.Width, 3)
	case libs.FormatCreateML:
		savePath := filepath.Join(saveDir, baseName+".json")
		cmlShapes := toCreateMLShapes(data.Shapes)
		return lf.SaveCreateMLFormat(savePath, cmlShapes, imgPath, cfg.Height, cfg.Width, 3)
	default: // YOLO
		savePath := filepath.Join(saveDir, baseName+".txt")
		return lf.SaveYoloFormat(savePath, shapes, imgPath, cfg.Height, cfg.Width, 3, a.classList)
	}
}

// GetClassList returns the known class labels.
func (a *App) GetClassList() []string {
	return a.classList
}

// SetSaveFormat sets the annotation save format.
func (a *App) SetSaveFormat(format string) {
	a.saveFormat = format
}

// GetSaveFormat returns the current save format.
func (a *App) GetSaveFormat() string {
	return a.saveFormat
}

// loadAnnotations loads existing annotations for an image based on current format.
func (a *App) loadAnnotations(imgPath string, imgWidth, imgHeight int) []ShapeJSON {
	dir := a.saveDir
	if dir == "" {
		dir = filepath.Dir(imgPath)
	}
	baseName := strings.TrimSuffix(filepath.Base(imgPath), filepath.Ext(imgPath))

	switch a.saveFormat {
	case libs.FormatPascalVOC:
		xmlPath := filepath.Join(dir, baseName+".xml")
		if _, err := os.Stat(xmlPath); err == nil {
			reader, err := libs.NewPascalVocReader(xmlPath)
			if err == nil {
				return convertShapes(reader.GetShapes())
			}
		}
	case libs.FormatCreateML:
		jsonPath := filepath.Join(dir, baseName+".json")
		if _, err := os.Stat(jsonPath); err == nil {
			reader, err := libs.NewCreateMLReader(jsonPath, imgPath)
			if err == nil {
				return convertShapes(reader.GetShapes())
			}
		}
	default: // YOLO
		txtPath := filepath.Join(dir, baseName+".txt")
		if _, err := os.Stat(txtPath); err == nil {
			reader, err := libs.NewYOLOReader(txtPath, imgHeight, imgWidth, 3, "")
			if err == nil {
				return convertShapes(reader.GetShapes())
			}
		}
	}

	return nil
}

func convertShapes(shapes []libs.ShapeData) []ShapeJSON {
	var result []ShapeJSON
	for _, s := range shapes {
		result = append(result, ShapeJSON{
			Label:     s.Label,
			Points:    s.Points,
			Difficult: s.Difficult,
		})
	}
	return result
}

func toShapeMaps(shapes []ShapeJSON) []map[string]interface{} {
	var result []map[string]interface{}
	for _, s := range shapes {
		result = append(result, map[string]interface{}{
			"label":     s.Label,
			"points":    s.Points,
			"difficult": s.Difficult,
		})
	}
	return result
}

func toCreateMLShapes(shapes []ShapeJSON) []libs.CreateMLShape {
	var result []libs.CreateMLShape
	for _, s := range shapes {
		result = append(result, libs.CreateMLShape{
			Label:  s.Label,
			Points: s.Points,
		})
	}
	return result
}

func (a *App) addToClassList(label string) {
	for _, c := range a.classList {
		if c == label {
			return
		}
	}
	a.classList = append(a.classList, label)
}
