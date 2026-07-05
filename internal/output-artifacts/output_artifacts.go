package outputartifacts

import (
	"fmt"
	"math"
	"strings"
)

func escapeXml(value string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;", "'", "&apos;")
	return replacer.Replace(value)
}

func getChartBounds(spec ChartSpec) (float64, float64) {
	maxValue := 1.0
	minValue := 0.0
	if len(spec.Data) > 0 {
		maxValue = spec.Data[0].Value
		minValue = spec.Data[0].Value
		for _, item := range spec.Data {
			if item.Value > maxValue {
				maxValue = item.Value
			}
			if item.Value < minValue {
				minValue = item.Value
			}
		}
		if 1.0 > maxValue {
			maxValue = 1.0
		}
		if 0.0 < minValue {
			minValue = 0.0
		}
	}

	domainMin := math.Min(0, minValue)
	domainMax := maxValue
	if maxValue <= domainMin {
		domainMax = domainMin + 1
	}
	return domainMin, domainMax
}

type Point struct {
	Label   string
	Value   float64
	CenterX float64
	Y       float64
}

func getPoints(spec ChartSpec, marginLeft, step float64, projectY func(float64) float64) []Point {
	points := make([]Point, len(spec.Data))
	for i, item := range spec.Data {
		centerX := marginLeft + step*float64(i) + step/2
		y := projectY(item.Value)
		points[i] = Point{Label: item.Label, Value: item.Value, CenterX: centerX, Y: y}
	}
	return points
}

func renderBars(points []Point, zeroY, barWidth float64) string {
	barsArr := make([]string, len(points))
	for i, point := range points {
		top := point.Y
		if zeroY < top {
			top = zeroY
		}
		barHeight := math.Abs(zeroY - point.Y)
		if 8 > barHeight {
			barHeight = 8
		}
		barsArr[i] = fmt.Sprintf(`<rect x="%g" y="%g" width="%g" height="%g" rx="12" fill="#0ea5e9" opacity="0.92" />`, point.CenterX-barWidth/2, top, barWidth, barHeight) +
			fmt.Sprintf(`<text x="%g" y="%g" text-anchor="middle" font-size="13" fill="#0f172a">%s</text>`, point.CenterX, top-10, escapeXml(fmt.Sprintf("%.0f", point.Value)))
	}
	return strings.Join(barsArr, "")
}

func renderLineMarks(points []Point) string {
	linePathArr := make([]string, len(points))
	for i, point := range points {
		if i == 0 {
			linePathArr[i] = fmt.Sprintf("M %g %g", point.CenterX, point.Y)
		} else {
			linePathArr[i] = fmt.Sprintf("L %g %g", point.CenterX, point.Y)
		}
	}
	linePath := strings.Join(linePathArr, " ")
	lineMarksArr := []string{
		fmt.Sprintf(`<path d="%s" fill="none" stroke="#0ea5e9" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />`, linePath),
	}
	for _, point := range points {
		lineMarksArr = append(lineMarksArr, fmt.Sprintf(`<circle cx="%g" cy="%g" r="8" fill="#f8fafc" stroke="#0ea5e9" stroke-width="4" />
               <text x="%g" y="%g" text-anchor="middle" font-size="13" fill="#0f172a">%s</text>`, point.CenterX, point.Y, point.CenterX, point.Y-18, escapeXml(fmt.Sprintf("%.0f", point.Value))))
	}
	return strings.Join(lineMarksArr, "")
}

func renderGridLines(tickValues []float64, projectY func(float64) float64, marginLeft, width, marginRight float64) string {
	gridLinesArr := make([]string, len(tickValues))
	for i, value := range tickValues {
		y := projectY(value)
		gridLinesArr[i] = fmt.Sprintf(`<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="#dbe4ec" stroke-width="1" />`, marginLeft, y, width-marginRight, y) +
			fmt.Sprintf(`<text x="%g" y="%g" text-anchor="end" font-size="14" fill="#475569">%s</text>`, marginLeft-16, y+4, escapeXml(fmt.Sprintf("%.0f", value)))
	}
	return strings.Join(gridLinesArr, "")
}

func renderLabels(points []Point, height, marginBottom float64) string {
	labelsArr := make([]string, len(points))
	for i, point := range points {
		labelsArr[i] = fmt.Sprintf(`<text x="%g" y="%g" text-anchor="middle" font-size="14" fill="#334155">%s</text>`, point.CenterX, height-marginBottom+28, escapeXml(point.Label))
	}
	return strings.Join(labelsArr, "")
}

func renderNotes(notes *[]string, marginLeft, height float64) string {
	if notes == nil {
		return ""
	}
	notesArr := make([]string, len(*notes))
	for i, note := range *notes {
		notesArr[i] = fmt.Sprintf(`<text x="%g" y="%g" font-size="13" fill="#475569">%s</text>`, marginLeft, height-26-float64(i)*18, escapeXml(note))
	}
	return strings.Join(notesArr, "")
}

func RenderChartSvg(spec ChartSpec) ChartResult {
	width := 1200.0
	height := 720.0
	marginTop := 110.0
	marginRight := 80.0
	marginBottom := 110.0
	marginLeft := 110.0
	chartWidth := width - marginLeft - marginRight
	chartHeight := height - marginTop - marginBottom

	domainMin, domainMax := getChartBounds(spec)

	ticks := 5.0
	tickValues := make([]float64, int(ticks)+1)
	for i := 0; i <= int(ticks); i++ {
		tickValues[i] = domainMin + ((domainMax-domainMin)*float64(i))/ticks
	}

	projectY := func(value float64) float64 {
		denom := domainMax - domainMin
		if denom == 0 {
			denom = 1
		}
		return marginTop + chartHeight - ((value-domainMin)/denom)*chartHeight
	}

	zeroY := projectY(0)
	dataLength := float64(len(spec.Data))
	if dataLength < 1 {
		dataLength = 1
	}
	step := chartWidth / dataLength
	barWidth := step * 0.6
	if 84 < barWidth {
		barWidth = 84
	}

	points := getPoints(spec, marginLeft, step, projectY)

	gridLines := renderGridLines(tickValues, projectY, marginLeft, width, marginRight)

	bars := ""
	if spec.Kind == "bar" || spec.Kind == "" { // default is bar
		bars = renderBars(points, zeroY, barWidth)
	}

	lineMarks := ""
	if spec.Kind == "line" {
		lineMarks = renderLineMarks(points)
	}

	labels := renderLabels(points, height, marginBottom)

	notes := renderNotes(spec.Notes, marginLeft, height)

	var svgParts []string
	svgParts = append(svgParts, fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%g" height="%g" viewBox="0 0 %g %g" role="img" aria-label="%s">`, width, height, width, height, escapeXml(spec.Title)))
	svgParts = append(svgParts, `<rect width="100%" height="100%" fill="#f8fafc" />`)
	svgParts = append(svgParts, fmt.Sprintf(`<text x="%g" y="56" font-size="34" font-weight="700" fill="#0f172a">%s</text>`, marginLeft, escapeXml(spec.Title)))

	if spec.Subtitle != nil && *spec.Subtitle != "" {
		svgParts = append(svgParts, fmt.Sprintf(`<text x="%g" y="86" font-size="18" fill="#475569">%s</text>`, marginLeft, escapeXml(*spec.Subtitle)))
	}
	svgParts = append(svgParts, gridLines)
	svgParts = append(svgParts, fmt.Sprintf(`<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="#0f172a" stroke-width="2" />`, marginLeft, zeroY, width-marginRight, zeroY))
	svgParts = append(svgParts, fmt.Sprintf(`<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="#0f172a" stroke-width="2" />`, marginLeft, marginTop, marginLeft, height-marginBottom))
	if bars != "" {
		svgParts = append(svgParts, bars)
	}
	if lineMarks != "" {
		svgParts = append(svgParts, lineMarks)
	}
	svgParts = append(svgParts, labels)

	if spec.XLabel != nil && *spec.XLabel != "" {
		svgParts = append(svgParts, fmt.Sprintf(`<text x="%g" y="%g" text-anchor="middle" font-size="15" fill="#475569">%s</text>`, marginLeft+chartWidth/2, height-46, escapeXml(*spec.XLabel)))
	}
	if spec.YLabel != nil && *spec.YLabel != "" {
		svgParts = append(svgParts, fmt.Sprintf(`<text x="34" y="%g" text-anchor="middle" font-size="15" fill="#475569" transform="rotate(-90 34 %g)">%s</text>`, marginTop+chartHeight/2, marginTop+chartHeight/2, escapeXml(*spec.YLabel)))
	}
	if spec.SeriesLabel != nil && *spec.SeriesLabel != "" {
		svgParts = append(svgParts, fmt.Sprintf(`<text x="%g" y="56" text-anchor="end" font-size="15" fill="#475569">%s</text>`, width-marginRight, escapeXml(*spec.SeriesLabel)))
	}
	if notes != "" {
		svgParts = append(svgParts, notes)
	}
	svgParts = append(svgParts, "</svg>")

	return ChartResult{Svg: strings.Join(svgParts, ""), Width: width, Height: height}
}
