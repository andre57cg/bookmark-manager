# Bookmark Manager - Especificación

## 1. Concepto & Visión

Un gestor de marcadores inteligente que transforma la organización de enlaces en un sistema de conocimiento interconectado. Combina la simplicidad de guardar URLs con la potencia de un mapa mental navegable, diferenciando entre recursos, temas académicos e investigaciones de vanguardia.

## 2. Design Language

### Aesthetic Direction
Inspirado en Obsidian + Notion: interfaces oscuras con acentos vibrantes, tipografía clara y espaciado generoso. Aspecto de "cuaderno de investigación digital".

### Color Palette
```
--bg-primary: #1a1a2e
--bg-secondary: #16213e
--bg-tertiary: #0f3460
--accent-primary: #e94560
--accent-secondary: #00d9ff
--accent-tertiary: #7b2cbf
--text-primary: #eaeaea
--text-secondary: #a0a0a0
--success: #00c853
--warning: #ffc107
--node-math: #ff6b6b
--node-tech: #4ecdc4
--node-research: #ffe66d
--node-vanguard: #c44dff
```

### Typography
- Headings: Inter (700, 600)
- Body: Inter (400, 500)
- Code/Tags: JetBrains Mono

### Motion Philosophy
- Transiciones suaves 200-300ms ease-out
- Grafos con física realista
- Feedback inmediato en interacciones

## 3. Layout & Structure

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Search    [Import] [Export] [Notion] [Obsidian]  ⚙️     │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  📁 Categories│           Main View                          │
│  ───────────│  ┌─────────────────────────────────────────┐ │
│  🎥 Videos   │  │  Bookmarks Grid / Graph View / List     │ │
│  📝 Articles │  │                                         │ │
│  📄 PDFs     │  │                                         │ │
│  💻 Blogs   │  │                                         │ │
│  ───────────│  └─────────────────────────────────────────┘ │
│  🏷️ Tags     │                                              │
│  ───────────│  ┌─────────────────────────────────────────┐ │
│  #math       │  │  Bookmark Detail Panel                  │ │
│  #physics    │  │  - URL, Title, Tags, Notes             │ │
│  #research   │  │  - Related bookmarks                   │ │
│  ───────────│  │  - Graph visualization                  │ │
│  🔬 Vanguard │  └─────────────────────────────────────────┘ │
│  ───────────│                                              │
│  🌐 Topics   │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

## 4. Features & Interactions

### 4.1 Importación de Marcadores
- **Importar desde archivo HTML** (Chrome, Firefox, Edge, Safari)
- **Drag & drop** de archivos HTML
- **Pegar URL manual** confetch automático de título y descripción
- **Detección automática de tipo** (video, pdf, artículo, blog)
- **Auto-etiquetado inteligente** por palabras clave y análisis de dominio

### 4.2 Sistema de Etiquetas Jerárquicas (Automático)
Los temas se generan automáticamente después de importar marcadores, basándose en el análisis del contenido de cada URL:
- Título, URL y descripción se analizan con patrones predefinidos
- Se detectan temas como: Mathematics, Machine Learning, Physics, etc.
- Los subtemas se generan jerárquicamente (ej: Mathematics > Analysis > Calculus)
- El usuario puede agregar temas manualmente en Configuración

### 4.3 Diferenciación de Recursos
- **🎥 Video**: youtube.com, vimeo.com, coursera, udemy
- **📄 PDF**: Scholar papers, libros técnicos
- **📝 Artículo**: Medium, dev.to, blogs técnicos
- **💻 Blog**: Personal blogs, tutorials
- **📚 Tutorial**: Documentation, guides

### 4.4 Sistema de Vanguardia
- Tag especial `🔬 vanguard` para investigaciones de frontera
- Filtro temporal "últimas 24h/semana/mes" para papers
- Indicador visual distintivo (borde púrpura)

### 4.5 Grafo de Relaciones
- Nodos por tema con tamaño según cantidad de marcadores
- Aristas que muestran relaciones temáticas
- Click en nodo = filtra marcadores relacionados
- Hover = preview de conexiones
- Zoom y pan para navegación

### 4.6 Exportación
- **Notion**: Crea página con título, URL, tags, notas
- **Obsidian**: Genera nota Markdown con frontmatter
- **JSON/HTML**: Backup completo

## 5. Component Inventory

### BookmarkCard
- Thumbnail (si disponible)
- Título truncado
- Dominio + fecha
- Tags como chips
- Indicador de tipo (icono)
- Hover: elevación + preview

### TagChip
- Color según categoría
- Hover: muestra count
- Click: filtra por tag

### GraphNode
- Círculo con color de categoría
- Tamaño proporcional a conexiones
- Label visible en hover
- Drag para reposicionar

### SidebarItem
- Icono + nombre
- Contador de items
- Expand/collapse para categorías

## 6. Technical Approach

### Stack
- **Frontend**: HTML5 + CSS3 + Vanilla JS (ES6+)
- **Storage**: IndexedDB (navegador) + Export JSON
- **Graph**: D3.js para visualización
- **Parsing**: DOMParser para HTML de marcadores

### Data Model
```javascript
Bookmark {
  id: string,
  url: string,
  title: string,
  description: string,
  favicon: string,
  type: 'video' | 'pdf' | 'article' | 'blog' | 'tutorial',
  tags: string[],
  topics: string[], // jerárquico
  isVanguard: boolean,
  createdAt: Date,
  updatedAt: Date,
  notes: string,
  relations: string[] // IDs de bookmarks relacionados
}

Tag {
  id: string,
  name: string,
  color: string,
  parent: string | null,
  count: number
}

Topic {
  id: string,
  name: string,
  path: string[], // ["Mathematics", "Analysis"] - generado automáticamente
  parent: string | null, // ID del tema padre
  color: string,
  count: number // cantidad de marcadores en este tema
}
```

### Auto-tagging Rules
```javascript
const rules = [
  { pattern: /arxiv\.org|g Scholar/i, tags: ['research', 'academic'] },
  { pattern: /youtube\.com|vimeo\.com/i, type: 'video' },
  { pattern: /\.pdf$/i, type: 'pdf' },
  { pattern: /medium\.com|dev\.to|article/i, type: 'article' },
  { pattern: /math|analysis|algebra|topology/i, topics: ['Mathematics'] },
  { pattern: /quantum|physics|relativity/i, topics: ['Physics'] },
  { pattern: /gpt|llm|neural|transformer/i, tags: ['AI', 'ML'] },
  { pattern: /frontier|state-of-the-art|breakthrough/i, isVanguard: true }
];
```
