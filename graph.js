const graphVisualizer = {
    svg: null,
    simulation: null,
    width: 0,
    height: 0,
    container: null,

    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        d3.select(`#${containerId}`).selectAll('*').remove();

        this.svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${this.width} ${this.height}`);

        const defs = this.svg.append('defs');
        
        const glow = defs.append('filter').attr('id', 'glow');
        glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
        const merge = glow.append('feMerge');
        merge.append('feMergeNode').attr('in', 'coloredBlur');
        merge.append('feMergeNode').attr('in', 'SourceGraphic');

        this.svg.append('g').attr('class', 'links');
        this.svg.append('g').attr('class', 'nodes');
        this.svg.append('g').attr('class', 'labels');

        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.svg.select('.links').attr('transform', event.transform);
                this.svg.select('.nodes').attr('transform', event.transform);
                this.svg.select('.labels').attr('transform', event.transform);
            });

        this.svg.call(zoom);

        this.svg.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', 'transparent')
            .attr('cursor', 'grab');
    },

    async render(bookmarks) {
        if (!this.svg) return;

        const linksGroup = this.svg.select('.links');
        const nodesGroup = this.svg.select('.nodes');
        const labelsGroup = this.svg.select('.labels');

        linksGroup.selectAll('*').remove();
        nodesGroup.selectAll('*').remove();
        labelsGroup.selectAll('*').remove();

        if (bookmarks.length === 0) {
            this.renderEmptyState();
            return;
        }

        const { nodes, links } = this.buildGraphData(bookmarks);

        if (nodes.length === 0) {
            this.renderEmptyState();
            return;
        }

        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(d => d.type === 'topic' ? 150 : 80).strength(0.5))
            .force('charge', d3.forceManyBody().strength(d => d.type === 'topic' ? -400 : -100))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(d => d.radius + 20))
            .force('x', d3.forceX(this.width / 2).strength(0.03))
            .force('y', d3.forceY(this.height / 2).strength(0.03));

        linksGroup.selectAll('line')
            .data(links)
            .join('line')
            .attr('class', 'graph-link')
            .attr('stroke', '#333')
            .attr('stroke-opacity', 0.4)
            .attr('stroke-width', d => d.strength || 1);

        const nodeGroups = nodesGroup.selectAll('g')
            .data(nodes)
            .join('g')
            .attr('class', 'graph-node')
            .call(d3.drag()
                .on('start', (e, d) => this.dragStarted(e, d))
                .on('drag', (e, d) => this.dragged(e, d))
                .on('end', (e, d) => this.dragEnded(e, d)));

        nodeGroups.append('circle')
            .attr('r', d => d.radius)
            .attr('fill', d => d.color)
            .attr('stroke', '#1a1a1a')
            .attr('stroke-width', d => d.type === 'topic' ? 3 : 1.5)
            .attr('fill-opacity', d => d.type === 'topic' ? 0.9 : 0.7);

        nodeGroups.filter(d => d.type === 'topic')
            .append('circle')
            .attr('r', d => d.radius + 6)
            .attr('fill', 'none')
            .attr('stroke', d => d.color)
            .attr('stroke-width', 1)
            .attr('stroke-opacity', 0.4)
            .attr('stroke-dasharray', '4,4');

        nodeGroups.filter(d => d.type === 'bookmark' && d.isVanguard)
            .append('circle')
            .attr('r', d => d.radius + 3)
            .attr('fill', 'none')
            .attr('stroke', '#c44dff')
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.8);

        labelsGroup.selectAll('text')
            .data(nodes.filter(d => d.type === 'topic' || d.connections > 1))
            .join('text')
            .attr('class', 'node-label')
            .attr('text-anchor', 'middle')
            .attr('dy', d => d.radius + 14)
            .attr('fill', '#888')
            .attr('font-size', d => d.type === 'topic' ? '11px' : '9px')
            .attr('font-weight', d => d.type === 'topic' ? '500' : '400')
            .attr('pointer-events', 'none')
            .text(d => d.label);

        nodeGroups.on('mouseover', (e, d) => this.handleMouseOver(e, d, nodes, links))
            .on('mouseout', () => this.handleMouseOut(nodes, links))
            .on('click', (e, d) => this.handleClick(d));

        this.simulation.on('tick', () => {
            linksGroup.selectAll('line')
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            nodesGroup.selectAll('g').attr('transform', d => `translate(${d.x},${d.y})`);
            labelsGroup.selectAll('text').attr('x', d => d.x).attr('y', d => d.y);
        });
    },

    buildGraphData(bookmarks) {
        const nodesMap = new Map();
        const links = [];

        const topicColors = {
            'Mathematics': '#e94560',
            'Computer Science': '#00d9ff',
            'Machine Learning': '#4ecdc4',
            'Deep Learning': '#45b7d1',
            'NLP': '#96ceb4',
            'Physics': '#7b2cbf',
            'Algorithms': '#00d9ff',
            'Data Structures': '#4ecdc4',
            'Web Development': '#00c853',
            'Backend': '#54a0ff',
            'Databases': '#ff9f43',
            'DevOps': '#a29bfe',
            'Security': '#ff6b6b',
            'Networks': '#48dbfb',
            'Quantum Mechanics': '#ff9ff3',
            'Analysis': '#e94560',
            'Linear Algebra': '#ff6b6b',
            'Calculus': '#ff4757',
            'Research': '#00c853',
            'Courses': '#ffc107',
            'Books': '#795548',
            'Documentation': '#78909c',
            'Vanguard': '#c44dff',
            'Papers': '#00c853',
            'Methodology': '#795548',
            'Quantum Computing': '#ff9ff3',
            'Statistics': '#26de81',
            'Optimization': '#fd9644',
            'Computer Vision': '#00bcd4',
            'Reinforcement Learning': '#9c27b0'
        };

        const typeColors = {
            'video': '#ff6b6b',
            'pdf': '#ffc107',
            'article': '#4ecdc4',
            'blog': '#a29bfe',
            'tutorial': '#00d9ff'
        };

        const topicCounts = {};
        bookmarks.forEach(bm => {
            (bm.topics || []).forEach(topic => {
                topicCounts[topic] = (topicCounts[topic] || 0) + 1;
            });
        });

        Object.entries(topicCounts)
            .filter(([_, count]) => count >= 1)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .forEach(([topic, count]) => {
                nodesMap.set(`topic_${topic}`, {
                    id: `topic_${topic}`,
                    type: 'topic',
                    label: topic,
                    color: topicColors[topic] || '#a29bfe',
                    radius: Math.min(25 + count * 2, 50),
                    count: count,
                    connections: 0
                });
            });

        bookmarks.forEach(bm => {
            const topics = bm.topics || [];
            let color = typeColors[bm.type] || '#666';
            
            if (topics.length > 0) {
                const mainTopic = topics[0];
                color = topicColors[mainTopic] || color;
            }

            nodesMap.set(bm.id, {
                id: bm.id,
                type: 'bookmark',
                label: bm.title.length > 25 ? bm.title.substring(0, 22) + '...' : bm.title,
                color: color,
                radius: bm.isVanguard ? 10 : 6,
                isVanguard: bm.isVanguard,
                bookmark: bm,
                connections: topics.length
            });
        });

        bookmarks.forEach(bm => {
            (bm.topics || []).forEach(topic => {
                const topicNodeId = `topic_${topic}`;
                if (nodesMap.has(topicNodeId)) {
                    links.push({
                        source: bm.id,
                        target: topicNodeId,
                        strength: bm.isVanguard ? 3 : 1
                    });
                    const topicNode = nodesMap.get(topicNodeId);
                    topicNode.connections++;
                }
            });
        });

        const typeGroups = {};
        bookmarks.forEach(bm => {
            const key = bm.type || 'other';
            if (!typeGroups[key]) typeGroups[key] = [];
            typeGroups[key].push(bm.id);
        });

        Object.entries(typeGroups).forEach(([_, group]) => {
            for (let i = 0; i < Math.min(group.length, 3); i++) {
                for (let j = i + 1; j < Math.min(group.length, 3); j++) {
                    if (nodesMap.has(group[i]) && nodesMap.has(group[j])) {
                        links.push({
                            source: group[i],
                            target: group[j],
                            strength: 0.3
                        });
                    }
                }
            }
        });

        return {
            nodes: Array.from(nodesMap.values()),
            links: links
        };
    },

    renderEmptyState() {
        this.svg.append('text')
            .attr('x', this.width / 2)
            .attr('y', this.height / 2)
            .attr('text-anchor', 'middle')
            .attr('fill', '#555')
            .attr('font-size', '14px')
            .text('Importa marcadores para ver el grafo');
    },

    handleMouseOver(e, d, nodes, links) {
        d3.select(e.currentTarget).select('circle:first-child')
            .transition().duration(200)
            .attr('r', d.radius * 1.3)
            .attr('stroke-width', d.type === 'topic' ? 4 : 2);

        const connectedIds = new Set([d.id]);
        links.forEach(l => {
            const srcId = typeof l.source === 'object' ? l.source.id : l.source;
            const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
            if (srcId === d.id) connectedIds.add(tgtId);
            if (tgtId === d.id) connectedIds.add(srcId);
        });

        this.svg.select('.nodes').selectAll('g')
            .style('opacity', n => connectedIds.has(n.id) ? 1 : 0.2);
        
        this.svg.select('.links').selectAll('line')
            .style('opacity', l => {
                const srcId = typeof l.source === 'object' ? l.source.id : l.source;
                const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
                return srcId === d.id || tgtId === d.id ? 1 : 0.1;
            });

        this.svg.select('.labels').selectAll('text')
            .style('opacity', n => connectedIds.has(n.id) ? 1 : 0.3);
    },

    handleMouseOut(nodes, links) {
        this.svg.select('.nodes').selectAll('g')
            .style('opacity', 1);
        this.svg.select('.links').selectAll('line')
            .style('opacity', 0.4);
        this.svg.select('.labels').selectAll('text')
            .style('opacity', 1);

        this.svg.select('.nodes').selectAll('circle:first-child')
            .transition().duration(200)
            .attr('r', d => d.radius);
    },

    handleClick(d) {
        if (d.type === 'topic') {
            app.filterByTopic(d.label);
        } else if (d.bookmark) {
            app.showBookmarkDetail(d.id);
        }
    },

    dragStarted(e, d) {
        if (!e.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    },

    dragged(e, d) {
        d.fx = e.x;
        d.fy = e.y;
    },

    dragEnded(e, d) {
        if (!e.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    },

    updateSize() {
        if (this.container) {
            this.width = this.container.clientWidth;
            this.height = this.container.clientHeight;
            this.svg?.attr('viewBox', `0 0 ${this.width} ${this.height}`);
            if (this.simulation) {
                this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
                this.simulation.alpha(0.3).restart();
            }
        }
    }
};

window.addEventListener('resize', () => {
    if (app.currentView === 'graph') {
        graphVisualizer.updateSize();
    }
});
