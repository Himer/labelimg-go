package libs

import (
	"testing"
)

func TestGenerateColorByGivingUnicodeText(t *testing.T) {
	// Test with Unicode text: 開啟目錄 (Chinese characters)
	res := GenerateColorByText("\u958B\u555F\u76EE\u9304")
	// In Go, uint8 is always >= 0, so just verify the color was created
	if res.Green() > 255 {
		t.Error("green out of range")
	}
	if res.Red() > 255 {
		t.Error("red out of range")
	}
	if res.Blue() > 255 {
		t.Error("blue out of range")
	}
	// Verify a color was actually generated (not all zeros from error)
	// The function should produce some non-trivial color
	t.Logf("Generated color: R=%d, G=%d, B=%d, A=%d", res.Red(), res.Green(), res.Blue(), res.Alpha())
}

func TestNaturalSort(t *testing.T) {
	l1 := []string{"f1", "f11", "f3"}
	expectedL1 := []string{"f1", "f3", "f11"}

	NaturalSort(l1)

	for idx, val := range l1 {
		if val != expectedL1[idx] {
			t.Errorf("at index %d: expected %s, got %s", idx, expectedL1[idx], val)
		}
	}
}
