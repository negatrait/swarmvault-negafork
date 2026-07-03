const { parseMarkdownNodes } = require('./packages/engine/dist/markdown-ast.js');
const text = `# Title
Some text with *italic* and **bold**.
![alt text](image.png)
- list item 1
- list item 2
> blockquote
`;
console.log(JSON.stringify(parseMarkdownNodes(text), null, 2));
