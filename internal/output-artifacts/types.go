package outputartifacts

type ChartDatum struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
}

type ChartSpec struct {
	Kind        string       `json:"kind"`
	Title       string       `json:"title"`
	Subtitle    *string      `json:"subtitle,omitempty"`
	XLabel      *string      `json:"xLabel,omitempty"`
	YLabel      *string      `json:"yLabel,omitempty"`
	SeriesLabel *string      `json:"seriesLabel,omitempty"`
	Data        []ChartDatum `json:"data"`
	Notes       *[]string    `json:"notes,omitempty"`
}

type ChartResult struct {
	Svg    string  `json:"svg"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}
