// Markdown 渲染（markdown-it + highlight.js + KaTeX 数学公式）
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import katex from "katex";

// 行内公式 $...$
function inlineMath(text) {
  return text.replace(/\$([^$\n]+?)\$/g, (_, formula) => {
    try {
      return katex.renderToString(formula, { throwOnError: false, displayMode: false });
    } catch {
      return _;
    }
  });
}

// 块级公式 $$...$$
function blockMath(text) {
  return text.replace(/\$\$([^$]+?)\$\$/g, (_, formula) => {
    try {
      return katex.renderToString(formula, { throwOnError: false, displayMode: true });
    } catch {
      return _;
    }
  });
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang }).value}</code></pre>`;
      } catch {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`;
  },
});

export function renderMarkdown(text) {
  let html = md.render(text || "");
  html = blockMath(html);
  html = inlineMath(html);
  return html;
}
