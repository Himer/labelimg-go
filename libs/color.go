package libs

// Color represents an RGBA color.
type Color struct {
	R, G, B, A uint8
}

// NewColor creates a new Color.
func NewColor(r, g, b, a uint8) Color {
	return Color{R: r, G: g, B: b, A: a}
}

// Red returns the red component.
func (c Color) Red() uint8 { return c.R }

// Green returns the green component.
func (c Color) Green() uint8 { return c.G }

// Blue returns the blue component.
func (c Color) Blue() uint8 { return c.B }

// Alpha returns the alpha component.
func (c Color) Alpha() uint8 { return c.A }
