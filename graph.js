const graphVisualizer = {
    svg: null,
    simulation: null,
    width: 0,
    height: 0,

    init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        this.width = container.clientWidth;
        this.height = container.clientHeight;

        // Clear existing
        d3.select(`#${containerId}`).selectAll('*').remove();

        this.svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .call(d3.zoom()
                .scaleExtent([0.1, 4])
                .on('zoom', (event) => {
                    this.svg.select('g').attr('transform', event.transform);
                }));

        // Add defs for gradients and filters
        const defs = this.svg.append('defs');
        
        // Glow filter
        const filter = defs.append('filter')
            .attr('id', 'glow')
            .attr('x', '-50%')
            .attr('y', '-50%')
            .attr('width', '200%')
            .attr('height', '200%');
        
        filter.append('feGaussianBlur')
            .attr('stdDeviation', '3')
            .attr('result', 'coloredBlur');
        
        const feMerge = filter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        this.svg.append('g').attr('class', 'graph-content');
    },

    async render(bookmarks) {
        if (!this.svg) return;

        const g = this.svg.select('.graph-content');
        g.selectAll('*').remove();

        // Build nodes and links from bookmarks
        const { nodes, links } = this.buildGraphData(bookmarks);

        if (nodes.length === 0) {
            this.renderEmptyState(g);
            return;
        }

        // Create force simulation
        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links)
                .id(d => d.id)
                .distance(100)
                .strength(0.5))
            .force('charge', d3.forceManyBody()
                .strength(-300)
                .distanceMax(400))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(d => d.radius + 5))
            .force('x', d3.forceX(this.width / 2).strength(0.05))
            .force('y', d3.forceY(this.height / 2).strength(0.05));

        // Draw links
        const link = g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('class', 'graph-link')
            .attr('stroke-width', d => Math.sqrt(d.strength || 1));

        // Draw nodes
        const node = g.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(nodes)
            .join('g')
            .attr('class', 'graph-node')
            .call(d3.drag()
                .on('start', (event, d) => this.dragStarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragEnded(event, d)));

        // Node circles
        node.append('circle')
            .attr('r', d => d.radius)
            .attr('fill', d => d.color)
            .attr('stroke', '#1a1a2e')
            .attr('stroke-width', 2)
            .style('filter', d => d.isVanguard ? 'url(#glow)' : 'none');

        // Vanguard indicator
        node.filter(d => d.isVanguard)
            .append('circle')
            .attr('r', d => d.radius + 4)
            .attr('fill', 'none')
            .attr('stroke', '#c44dff')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,2');

        // Node labels
        node.append('text')
            .text(d => d.label)
            .attr('x', 0)
            .attr('y', d => d.radius + 14)
            .attr('text-anchor', 'middle')
            .attr('fill', '#eaeaea')
            .attr('font-size', '10px')
            .attr('font-family', 'Inter, sans-serif')
            .style('opacity', 0);

        // Hover effects
        node.on('mouseover', function(event, d) {
            d3.select(this).select('circle')
                .transition()
                .duration(200)
                .attr('r', d.radius * 1.2);
            
            d3.select(this).select('text')
                .transition()
                .duration(200)
                .style('opacity', 1);
            
            // Highlight connected nodes
            const connectedIds = new Set();
            links.forEach(l => {
                if (l.source.id === d.id || l.target.id === d.id) {
                    connectedIds.add(l.source.id);
                    connectedIds.add(l.target.id);
                }
            });
            
            node.style('opacity', n => connectedIds.has(n.id) ? 1 : 0.3);
            link.style('opacity', l => 
                (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.1);
        })
        .on('mouseout', function() {
            d3.select(this).select('circle')
                .transition()
                .duration(200)
                .attr('r', d => d.radius);
            
            d3.select(this).select('text')
                .transition()
                .duration(200)
                .style('opacity', 0);
            
            node.style('opacity', 1);
            link.style('opacity', 1);
        })
        .on('click', (event, d) => {
            if (d.type === 'bookmark') {
                app.showBookmarkDetail(d.id);
            } else {
                app.filterByTopic(d.id);
            }
        });

        // Update positions on tick
        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });
    },

    buildGraphData(bookmarks) {
        const nodesMap = new Map();
        const links = [];

        // Topic colors
        const topicColors = {
            'Mathematics': '#e94560',
            'Computer Science': '#00d9ff',
            'Physics': '#7b2cbf',
            'Research': '#00c853',
            'Vanguard': '#c44dff'
        };

        // Add topic nodes
        const topics = new Set();
        bookmarks.forEach(bm => {
            if (bm.topics && bm.topics.length > 0) {
                bm.topics.forEach(topic => {
                    const mainTopic = topic.split(',')[0].trim();
                    topics.add(mainTopic);
                });
            }
        });

        topics.forEach(topic => {
            const color = topicColors[topic] || '#a29bfe';
            nodesMap.set(`topic_${topic}`, {
                id: `topic_${topic}`,
                type: 'topic',
                label: topic,
                color: color,
                radius: 25,
                isVanguard: topic.includes('Vanguard'),
                count: bookmarks.filter(bm => 
                    bm.topics?.some(t => t.includes(topic))
                ).length
            });
        });

        // Add bookmark nodes
        bookmarks.forEach(bm => {
            let color = '#4ecdc4';
            if (bm.topics && bm.topics.length > 0) {
                const mainTopic = bm.topics[0].split(',')[0].trim();
                color = topicColors[mainTopic] || color;
            }

            nodesMap.set(bm.id, {
                id: bm.id,
                type: 'bookmark',
                label: bm.title.substring(0, 20) + (bm.title.length > 20 ? '...' : ''),
                color: color,
                radius: bm.isVanguard ? 12 : 8,
                isVanguard: bm.isVanguard,
                bookmark: bm
            });
        });

        // Create links between bookmarks and topics
        bookmarks.forEach(bm => {
            if (bm.topics && bm.topics.length > 0) {
                bm.topics.forEach(topic => {
                    const mainTopic = topic.split(',')[0].trim();
                    const topicNodeId = `topic_${mainTopic}`;
                    
                    if (nodesMap.has(topicNodeId)) {
                        links.push({
                            source: bm.id,
                            target: topicNodeId,
                            strength: bm.isVanguard ? 2 : 1
                        });
                    }
                });
            }
        });

        // Create links between related bookmarks
        const typeGroups = {};
        bookmarks.forEach(bm => {
            const key = bm.type;
            if (!typeGroups[key]) typeGroups[key] = [];
            typeGroups[key].push(bm.id);
        });

        Object.values(typeGroups).forEach(group => {
            for (let i = 0; i < Math.min(group.length, 3); i++) {
                const source = group[i];
                for (let j = i + 1; j < group.length; j++) {
                    links.push({
                        source: source,
                        target: group[j],
                        strength: 0.3
                    });
                }
            }
        });

        return {
            nodes: Array.from(nodesMap.values()),
            links: links
        };
    },

    renderEmptyState(g) {
        g.append('text')
            .attr('x', this.width / 2)
            .attr('y', this.height / 2)
            .attr('text-anchor', 'middle')
            .attr('fill', '#6c757d')
            .attr('font-size', '16px')
            .text('No hay datos para visualizar');
    },

    dragStarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    },

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    },

    dragEnded(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    },

    updateSize() {
        const container = document.getElementById('graphContainer');
        if (container && this.svg) {
            this.width = container.clientWidth;
            this.height = container.clientHeight;
            this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
            if (this.simulation) {
                this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
                this.simulation.alpha(0.3).restart();
            }
        }
    }
};

// Resize handler
window.addEventListener('resize', () => {
    if (app.currentView === 'graph') {
        graphVisualizer.updateSize();
    }
});
