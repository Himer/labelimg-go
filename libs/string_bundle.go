package libs

import (
	"bufio"
	"embed"
	"os"
	"regexp"
	"strings"
)

//go:embed strings/*.properties
var stringsFS embed.FS

// StringBundle manages i18n strings loaded from property files.
type StringBundle struct {
	idToMessage map[string]string
}

// GetBundle creates a StringBundle for the given locale.
// If locale is empty, it attempts to detect from environment.
func GetBundle(locale string) *StringBundle {
	if locale == "" {
		locale = detectLocale()
	}

	sb := &StringBundle{
		idToMessage: make(map[string]string),
	}

	paths := sb.createLookupFallbackList(locale)
	for _, path := range paths {
		sb.loadBundle(path)
	}

	return sb
}

// GetString retrieves a localized string by ID.
func (sb *StringBundle) GetString(stringID string) string {
	if msg, ok := sb.idToMessage[stringID]; ok {
		return msg
	}
	panic("Missing string id: " + stringID)
}

func detectLocale() string {
	// Try LC_ALL first, then LANG
	if lc := os.Getenv("LC_ALL"); lc != "" && lc != "UTF-8" && lc != "C" {
		return lc
	}
	if lang := os.Getenv("LANG"); lang != "" && lang != "UTF-8" && lang != "C" {
		return lang
	}
	return "en"
}

func (sb *StringBundle) createLookupFallbackList(locale string) []string {
	result := []string{"strings/strings.properties"}

	if locale == "" {
		return result
	}

	// Split locale into alpha-only tags: "zh-TW" -> ["zh", "TW"]
	re := regexp.MustCompile(`[^a-zA-Z]+`)
	tags := re.Split(locale, -1)

	current := "strings/strings"
	for _, tag := range tags {
		if tag == "" {
			continue
		}
		current = current + "-" + tag
		result = append(result, current+".properties")
	}

	return result
}

func (sb *StringBundle) loadBundle(path string) {
	data, err := stringsFS.ReadFile(path)
	if err != nil {
		return // File doesn't exist, skip silently
	}

	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, "=")
		if idx <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		value := strings.TrimSpace(line[idx+1:])
		value = strings.Trim(value, "\"")
		sb.idToMessage[key] = value
	}
}
