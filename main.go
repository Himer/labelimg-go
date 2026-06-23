package main

import (
	"embed"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend
var assets embed.FS

func main() {
	app := NewApp()

	// Optional CLI arg: a directory to auto-open on startup.
	// Usage: labelimg-go [dir]
	if dir := parseDirArg(os.Args); dir != "" {
		app.SetInitialDir(dir)
	}

	err := wails.Run(&options.App{
		Title:  "LabelImg",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: app.startup,
		Bind: []interface{}{
			app,
		},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}

// parseDirArg returns the first argument that resolves to an existing
// directory. Skips flags starting with "-" (so future flags don't collide).
func parseDirArg(args []string) string {
	for i := 1; i < len(args); i++ {
		a := args[i]
		if a == "" || a[0] == '-' {
			continue
		}
		abs, err := filepath.Abs(a)
		if err != nil {
			continue
		}
		info, err := os.Stat(abs)
		if err == nil && info.IsDir() {
			return abs
		}
	}
	return ""
}
