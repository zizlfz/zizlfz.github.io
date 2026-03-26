import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import matter from 'gray-matter';
import { createHighlighter } from 'shiki';
import { renderMermaidSVG } from 'beautiful-mermaid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NOTES_DIR = path.join(__dirname, '..', 'notes');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const STYLE_PATH = path.join(__dirname, 'style.css');
const TEMPLATE_PATH = path.join(__dirname, 'template.html');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getTemplate() {
  return fs.readFileSync(TEMPLATE_PATH, 'utf-8');
}

function getStyle() {
  return fs.readFileSync(STYLE_PATH, 'utf-8');
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateIso(dateStr) {
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

function renderTags(tags) {
  if (!tags || tags.length === 0) return '';
  return '<div class="tags">' + tags.map(tag => `<span class="tag">${tag}</span>`).join('') + '</div>';
}

function createRenderer(highlighter) {
  const renderer = new marked.Renderer();
  
  renderer.code = function(code, language) {
    if (language === 'mermaid') {
      try {
        const svg = renderMermaidSVG(code, {
          bg: '#fff',
          fg: '#515151',
          transparent: true,
        });
        return `<div class="mermaid">${svg}</div>`;
      } catch (e) {
        return `<pre class="mermaid-error">Error rendering diagram: ${e.message}\n\n${code}</pre>`;
      }
    }
    
    const lang = language || 'text';
    try {
      const html = highlighter.codeToHtml(code, { 
        lang: lang,
        theme: 'github-light'
      });
      return html;
    } catch (e) {
      const escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
    }
  };
  
  return renderer;
}

function renderNote(template, content, frontmatter, cssPath, renderer) {
  const title = frontmatter.title || 'Untitled';
  const date = frontmatter.date || new Date().toISOString().split('T')[0];
  const description = content.slice(0, 160).replace(/[#*`\n]/g, '');
  const year = new Date().getFullYear();
  
  marked.use({ renderer });
  const htmlContent = marked(content);
  const tagsHtml = renderTags(frontmatter.tags);
  
  return template
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{description\}\}/g, description)
    .replace(/\{\{cssPath\}\}/g, cssPath)
    .replace(/\{\{siteTitle\}\}/g, 'zizlfz')
    .replace(/\{\{siteDescription\}\}/g, 'Notes')
    .replace(/\{\{homeLink\}\}/g, '../')
    .replace(/\{\{noteTitle\}\}/g, title)
    .replace(/\{\{dateIso\}\}/g, formatDateIso(date))
    .replace(/\{\{dateFormatted\}\}/g, formatDate(date))
    .replace(/\{\{year\}\}/g, year)
    .replace(/\{\{tags\}\}/g, tagsHtml)
    .replace(/\{\{content\}\}/g, htmlContent);
}

function buildHomepage(template) {
  const content = `
    <div class="homepage-message">
      <p>There is nothing on the homepage, please access by link directly.</p>
    </div>
  `;
  const year = new Date().getFullYear();
  
  const html = template
    .replace(/\{\{title\}\}/g, 'zizlfz')
    .replace(/\{\{description\}\}/g, 'Personal notes')
    .replace(/\{\{cssPath\}\}/g, 'assets/style.css')
    .replace(/\{\{siteTitle\}\}/g, 'zizlfz')
    .replace(/\{\{siteDescription\}\}/g, 'Notes')
    .replace(/\{\{homeLink\}\}/g, './')
    .replace(/\{\{noteTitle\}\}/g, '')
    .replace(/\{\{dateIso\}\}/g, '')
    .replace(/\{\{dateFormatted\}\}/g, '')
    .replace(/\{\{year\}\}/g, year)
    .replace(/\{\{tags\}\}/g, '')
    .replace(/\{\{content\}\}/g, content);
  
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html);
  console.log('✓ Built homepage');
}

function buildNotes(highlighter) {
  ensureDir(path.join(DIST_DIR, 'notes'));
  
  const template = getTemplate();
  const notes = fs.readdirSync(NOTES_DIR).filter(f => f.endsWith('.md'));
  const renderer = createRenderer(highlighter);
  
  notes.forEach(note => {
    const notePath = path.join(NOTES_DIR, note);
    const rawContent = fs.readFileSync(notePath, 'utf-8');
    const { data: frontmatter, content } = matter(rawContent);
    
    const html = renderNote(template, content, frontmatter, '../assets/style.css', renderer);
    const outputPath = path.join(DIST_DIR, 'notes', note.replace('.md', '.html'));
    
    fs.writeFileSync(outputPath, html);
    console.log(`✓ Built: notes/${note}`);
  });
  
  return notes.length;
}

async function main() {
  console.log('Building site...\n');
  
  ensureDir(DIST_DIR);
  ensureDir(path.join(DIST_DIR, 'assets'));
  ensureDir(path.join(DIST_DIR, 'notes'));
  
  const style = getStyle();
  fs.writeFileSync(path.join(DIST_DIR, 'assets', 'style.css'), style);
  console.log('✓ Copied style to assets');
  
  const highlighter = await createHighlighter({
    themes: ['github-light'],
    langs: ['javascript', 'typescript', 'python', 'css', 'html', 'json', 'bash', 'markdown', 'yaml', 'mermaid']
  });
  console.log('✓ Loaded Shiki highlighter');
  
  const template = getTemplate();
  buildHomepage(template);
  const noteCount = buildNotes(highlighter);
  
  console.log(`\nBuild complete! ${noteCount} note(s) processed.`);
  console.log(`Output: ${DIST_DIR}`);
}

main();