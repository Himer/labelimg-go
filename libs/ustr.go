package libs

// Ustr returns the string unchanged. Go strings are UTF-8 natively,
// so no conversion is needed (unlike the Python 2/3 compatibility helper).
func Ustr(s string) string {
	return s
}
