package parser

import (
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

const (
	typeParagraph = "paragraph"
	typeText      = "text"
	typeLink      = "link"
	typeUnknown   = "unknown"
)

// MarkdownNode represents a node in the Markdown AST, matching the TS mdast-util-from-markdown output.
type MarkdownNode struct {
	Type     string         `json:"type"`
	Depth    *int           `json:"depth,omitempty"`
	Value    *string        `json:"value,omitempty"`
	Alt      *string        `json:"alt,omitempty"`
	Children []MarkdownNode `json:"children,omitempty"`
}

// ParseMarkdownNodes parses a markdown string into a flat list of top-level MarkdownNodes.
func ParseMarkdownNodes(src string) []MarkdownNode {
	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
	)

	b := []byte(src)
	doc := md.Parser().Parse(text.NewReader(b))

	var children []MarkdownNode
	for child := doc.FirstChild(); child != nil; child = child.NextSibling() {
		if node := walkASTNode(child, b); node != nil {
			children = append(children, *node)
		}
	}
	if children == nil {
		return make([]MarkdownNode, 0)
	}
	return children
}

func walkASTNode(n ast.Node, source []byte) *MarkdownNode {
	if n == nil {
		return nil
	}

	node := &MarkdownNode{
		Children: make([]MarkdownNode, 0),
	}

	mapASTNodeType(n, source, node)

	if node.Type == "inlineCode" || node.Type == "code" {
		node.Children = nil
		return node
	}

	for child := n.FirstChild(); child != nil; child = child.NextSibling() {
		if childNode := walkASTNode(child, source); childNode != nil {
			if childNode.Type == typeUnknown {
				node.Children = append(node.Children, childNode.Children...)
			} else {
				node.Children = append(node.Children, *childNode)
			}
		}
	}

	if len(node.Children) == 0 {
		node.Children = nil
	} else if node.Type == typeParagraph || node.Type == "heading" || node.Type == "strong" || node.Type == "emphasis" || node.Type == typeLink {
		node.Children = mergeAdjacentTextNodes(node.Children)
	}

	if node.Type == "image" {
		altText := flattenText(node.Children)
		node.Alt = &altText
		node.Children = nil
	}

	if node.Type == typeUnknown {
		return node
	}

	return node
}

func mapASTNodeType(n ast.Node, source []byte, node *MarkdownNode) {
	switch v := n.(type) {
	case *ast.Heading:
		node.Type = "heading"
		depth := v.Level
		node.Depth = &depth
	case *ast.Paragraph:
		node.Type = typeParagraph
	case *ast.Text:
		node.Type = typeText
		val := string(v.Segment.Value(source))
		if v.HardLineBreak() || v.SoftLineBreak() {
			val += "\n"
		}
		node.Value = &val
	case *ast.String:
		node.Type = typeText
		val := string(v.Value)
		node.Value = &val
	case *ast.Emphasis:
		if v.Level == 2 {
			node.Type = "strong"
		} else {
			node.Type = "emphasis"
		}
	case *ast.Image:
		node.Type = "image"
	case *ast.List:
		node.Type = "list"
	case *ast.ListItem:
		node.Type = "listItem"
	case *ast.Blockquote:
		node.Type = "blockquote"
	case *ast.CodeBlock, *ast.FencedCodeBlock:
		node.Type = "code"
		val := extractBlockText(n, source)
		val = strings.TrimSuffix(val, "\n")
		node.Value = &val
	case *ast.CodeSpan:
		node.Type = "inlineCode"
		var val string
		for child := n.FirstChild(); child != nil; child = child.NextSibling() {
			if textNode, ok := child.(*ast.Text); ok {
				val += string(textNode.Segment.Value(source))
			} else if stringNode, ok := child.(*ast.String); ok {
				val += string(stringNode.Value)
			}
		}
		node.Value = &val
	case *ast.ThematicBreak:
		node.Type = "thematicBreak"
	case *ast.Link:
		node.Type = typeLink
	case *ast.AutoLink:
		node.Type = typeLink
	case *ast.TextBlock:
		node.Type = typeParagraph
	default:
		node.Type = typeUnknown
	}
}

func extractBlockText(n ast.Node, source []byte) string {
	var val string
	if n.Type() == ast.TypeBlock {
		lines := n.Lines()
		for i := 0; i < lines.Len(); i++ {
			line := lines.At(i)
			val += string(line.Value(source))
		}
	}
	return val
}

func flattenText(children []MarkdownNode) string {
	var result string
	for _, c := range children {
		if c.Value != nil {
			result += *c.Value
		}
		if c.Children != nil {
			result += flattenText(c.Children)
		}
	}
	return result
}

func mergeAdjacentTextNodes(nodes []MarkdownNode) []MarkdownNode {
	if len(nodes) <= 1 {
		return nodes
	}
	var merged []MarkdownNode
	for _, node := range nodes {
		if node.Type == typeText && len(merged) > 0 && merged[len(merged)-1].Type == typeText {
			prev := merged[len(merged)-1]
			if prev.Value != nil && node.Value != nil {
				newVal := *prev.Value + *node.Value
				merged[len(merged)-1].Value = &newVal
				continue
			}
		}
		merged = append(merged, node)
	}
	return merged
}
