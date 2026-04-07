package libs

// Default colors matching Python's shape.py defaults.
var (
	DefaultLineColor        = NewColor(0, 255, 0, 128)
	DefaultFillColor        = NewColor(255, 0, 0, 128)
	DefaultSelectLineColor  = NewColor(255, 255, 255, 255)
	DefaultSelectFillColor  = NewColor(0, 128, 255, 155)
	DefaultVertexFillColor  = NewColor(0, 255, 0, 255)
	DefaultHVertexFillColor = NewColor(255, 0, 0, 255)
)

// Shape point types.
const (
	PSquare = iota
	PRound
)

// Shape highlight modes.
const (
	MoveVertex = iota
	NearVertex
)

// Point represents a 2D point.
type Point struct {
	X, Y float64
}

// Shape represents an annotation shape (bounding box).
type Shape struct {
	Label      string
	Points     []Point
	Fill       bool
	Selected   bool
	Difficult  bool
	PaintLabel bool
	LineColor  Color
	FillColor  Color

	PointType      int
	PointSize      float64
	Scale          float64
	LabelFontSize  int

	highlightIndex *int
	highlightMode  int
	closed         bool
}

// NewShape creates a new Shape.
func NewShape(label string, difficult bool) *Shape {
	return &Shape{
		Label:         label,
		Difficult:     difficult,
		LineColor:     DefaultLineColor,
		FillColor:     DefaultFillColor,
		PointType:     PRound,
		PointSize:     16,
		Scale:         1.0,
		LabelFontSize: 8,
		highlightMode: NearVertex,
	}
}

// Close marks the shape as closed.
func (s *Shape) Close() {
	s.closed = true
}

// ReachMaxPoints returns true if the shape has 4 or more points.
func (s *Shape) ReachMaxPoints() bool {
	return len(s.Points) >= 4
}

// AddPoint adds a point to the shape (max 4).
func (s *Shape) AddPoint(p Point) {
	if !s.ReachMaxPoints() {
		s.Points = append(s.Points, p)
	}
}

// PopPoint removes and returns the last point.
func (s *Shape) PopPoint() *Point {
	if len(s.Points) == 0 {
		return nil
	}
	p := s.Points[len(s.Points)-1]
	s.Points = s.Points[:len(s.Points)-1]
	return &p
}

// IsClosed returns whether the shape is closed.
func (s *Shape) IsClosed() bool {
	return s.closed
}

// SetOpen opens the shape.
func (s *Shape) SetOpen() {
	s.closed = false
}

// MoveBy moves all points by the given offset.
func (s *Shape) MoveBy(offset Point) {
	for i := range s.Points {
		s.Points[i].X += offset.X
		s.Points[i].Y += offset.Y
	}
}

// MoveVertexBy moves a specific vertex by the given offset.
func (s *Shape) MoveVertexBy(i int, offset Point) {
	s.Points[i].X += offset.X
	s.Points[i].Y += offset.Y
}

// HighlightVertex highlights a vertex at the given index.
func (s *Shape) HighlightVertex(i int, action int) {
	s.highlightIndex = &i
	s.highlightMode = action
}

// HighlightClear clears vertex highlighting.
func (s *Shape) HighlightClear() {
	s.highlightIndex = nil
}

// Copy creates a deep copy of the shape.
func (s *Shape) Copy() *Shape {
	newShape := &Shape{
		Label:         s.Label,
		Fill:          s.Fill,
		Selected:      s.Selected,
		Difficult:     s.Difficult,
		PaintLabel:    s.PaintLabel,
		LineColor:     s.LineColor,
		FillColor:     s.FillColor,
		PointType:     s.PointType,
		PointSize:     s.PointSize,
		Scale:         s.Scale,
		LabelFontSize: s.LabelFontSize,
		highlightMode: s.highlightMode,
		closed:        s.closed,
	}
	newShape.Points = make([]Point, len(s.Points))
	copy(newShape.Points, s.Points)
	return newShape
}

// Len returns the number of points.
func (s *Shape) Len() int {
	return len(s.Points)
}

// GetPoint returns the point at index i.
func (s *Shape) GetPoint(i int) Point {
	return s.Points[i]
}

// SetPoint sets the point at index i.
func (s *Shape) SetPoint(i int, p Point) {
	s.Points[i] = p
}
