package libs

import (
	"testing"
)

func TestLoadDefaultBundle_withoutError(t *testing.T) {
	bundle := GetBundle("en")

	result := bundle.GetString("openDir")
	if result != "Open Dir" {
		t.Errorf("Fail to load the default bundle: got '%s'", result)
	}
}

func TestFallback_withoutError(t *testing.T) {
	bundle := GetBundle("zh-TW")

	expected := "\u958B\u555F\u76EE\u9304" // 開啟目錄
	result := bundle.GetString("openDir")
	if result != expected {
		t.Errorf("Fail to load the zh-TW bundle: got '%s', expected '%s'", result, expected)
	}
}

func TestSetInvalidLocaleToEnv_fallsBackToDefault(t *testing.T) {
	// "UTF-8" is not a valid locale, should fall back to base strings (English)
	bundle := GetBundle("UTF-8")

	result := bundle.GetString("openDir")
	if result != "Open Dir" {
		t.Errorf("Fail to load the default bundle on invalid locale: got '%s'", result)
	}
}
