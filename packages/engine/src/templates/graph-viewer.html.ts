// TODO: Port graph querying, traversal, or compilation to Go under internal/graph. Maintain 1:1 structural parity and add differential testing against TS output. | Porting Priority: HIGH (Leaf node, Depth: 0/10)
export const graphViewerTemplate = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SwarmVault Graph</title>
  <script>{{VIS_NETWORK_JS}}</script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; display: flex; height: 100vh; background: #0f172a; color: #e2e8f0; }
    #graph { flex: 1; }
    #sidebar { width: 320px; background: #1e293b; padding: 16px; overflow-y: auto; border-left: 1px solid #334155; display: none; }
    #sidebar.open { display: block; }
    #sidebar h2 { font-size: 16px; margin-bottom: 8px; color: #f8fafc; }
    #sidebar .field { margin-bottom: 6px; font-size: 13px; }
    #sidebar .label { color: #94a3b8; }
    #sidebar .value { color: #e2e8f0; }
    #sidebar .neighbors { margin-top: 12px; }
    #sidebar .neighbor { cursor: pointer; color: #38bdf8; text-decoration: underline; margin: 2px 0; font-size: 13px; }
    #search { position: absolute; top: 12px; left: 12px; z-index: 10; }
    #search input { padding: 8px 12px; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: #e2e8f0; width: 240px; font-size: 14px; }
    #legend { position: absolute; bottom: 12px; left: 12px; z-index: 10; background: #1e293b; padding: 10px 14px; border-radius: 8px; border: 1px solid #334155; }
    #legend .item { display: flex; align-items: center; gap: 6px; font-size: 12px; margin: 3px 0; }
    #legend .dot { width: 10px; height: 10px; border-radius: 50%; }
    #stats { position: absolute; top: 12px; right: 340px; z-index: 10; background: #1e293b; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #94a3b8; border: 1px solid #334155; }
    #tools { position: absolute; top: 52px; left: 12px; z-index: 10; width: 300px; background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155; max-height: calc(100vh - 80px); overflow-y: auto; }
    #tools h3 { font-size: 13px; color: #f8fafc; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    #tools .panel { border-top: 1px solid #334155; padding-top: 10px; margin-top: 10px; }
    #tools .panel:first-of-type { border-top: none; margin-top: 0; padding-top: 0; }
    #tools .row { display: flex; gap: 6px; margin-bottom: 6px; }
    #tools .row.radio { gap: 12px; font-size: 12px; color: #cbd5e1; }
    #tools input[type=text] { flex: 1; padding: 6px 8px; border-radius: 4px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; font-size: 12px; }
    #tools button { padding: 6px 10px; border-radius: 4px; border: 1px solid #475569; background: #334155; color: #e2e8f0; font-size: 12px; cursor: pointer; }
    #tools button:hover { background: #475569; }
    #tools .result { font-size: 12px; color: #cbd5e1; margin-top: 6px; line-height: 1.4; white-space: pre-wrap; }
    #tools .result .hdr { color: #f8fafc; font-weight: 600; margin-top: 6px; }
    #tools .result ol, #tools .result ul { padding-left: 18px; margin: 4px 0; }
    #tools .result .item { color: #38bdf8; cursor: pointer; text-decoration: underline; }
    #tools .result .relation { color: #94a3b8; font-size: 11px; }
    #tools .result .error { color: #f87171; }
  </style>
</head>
<body>
  <div id="search"><input type="text" placeholder="Search nodes..." id="searchInput"></div>
  <div id="stats"></div>
  <div id="graph"></div>
  <div id="sidebar">
    <h2 id="sidebarTitle"></h2>
    <div id="sidebarFields"></div>
    <div class="neighbors" id="sidebarNeighbors"></div>
  </div>
  <div id="tools" data-testid="graph-tools">
    <section class="panel" data-testid="graph-query-panel">
      <h3>Query</h3>
      <div class="row">
        <input type="text" id="queryInput" data-testid="graph-query-input" placeholder="Ask a question about the graph..." />
        <button type="button" id="queryRun" data-testid="graph-query-run">Run</button>
      </div>
      <div class="row radio">
        <label><input type="radio" name="queryTraversal" value="bfs" checked /> BFS</label>
        <label><input type="radio" name="queryTraversal" value="dfs" /> DFS</label>
      </div>
      <div class="result" id="queryResult" data-testid="graph-query-result"></div>
    </section>
    <section class="panel" data-testid="graph-path-panel">
      <h3>Path</h3>
      <div class="row">
        <input type="text" id="pathFrom" data-testid="graph-path-from" placeholder="From node id or label..." />
      </div>
      <div class="row">
        <input type="text" id="pathTo" data-testid="graph-path-to" placeholder="To node id or label..." />
      </div>
      <div class="row">
        <button type="button" id="pathFind" data-testid="graph-path-find">Find</button>
      </div>
      <div class="result" id="pathResult" data-testid="graph-path-result"></div>
    </section>
    <section class="panel" data-testid="graph-explain-panel">
      <h3>Explain</h3>
      <div class="row">
        <input type="text" id="explainInput" data-testid="graph-explain-input" placeholder="Node id or label..." />
        <button type="button" id="explainRun" data-testid="graph-explain-run">Explain</button>
      </div>
      <div class="result" id="explainResult" data-testid="graph-explain-result"></div>
    </section>
  </div>
  <div id="legend"></div>
  <script>
    var GRAPH_DATA = {{GRAPH_JSON}};

    var TYPE_COLORS = {
      source: "#f59e0b",
      module: "#fb7185",
      symbol: "#8b5cf6",
      rationale: "#14b8a6",
      concept: "#0ea5e9",
      entity: "#22c55e"
    };

    var COMMUNITY_COLORS = {};
    var palette = {{COMMUNITY_COLORS}};
    GRAPH_DATA.communities.forEach(function(c, i) {
      COMMUNITY_COLORS[c.id] = palette[i % palette.length];
    });

    var adjacency = {};
    GRAPH_DATA.nodes.forEach(function(n) { adjacency[n.id] = []; });
    GRAPH_DATA.edges.forEach(function(e) {
      if (adjacency[e.from]) adjacency[e.from].push({ id: e.to, relation: e.relation });
      if (adjacency[e.to]) adjacency[e.to].push({ id: e.from, relation: e.relation });
    });

    var nodeMap = {};
    GRAPH_DATA.nodes.forEach(function(n) { nodeMap[n.id] = n; });

    var visNodes = new vis.DataSet(GRAPH_DATA.nodes.map(function(n) {
      if (n.isHub) {
        // Hub nodes are viewer-only scaffolding — keep them small, dashed,
        // and painted with a secondary accent so they read as grouping
        // glue rather than first-class entities.
        return {
          id: n.id,
          label: n.label,
          shape: "dot",
          color: { background: "#0f172a", border: "#a78bfa" },
          size: 10,
          font: { color: "#c4b5fd", size: 10 },
          borderWidth: 2,
          borderWidthSelected: 3,
          shapeProperties: { borderDashes: [4, 3] }
        };
      }
      var size = 8 + Math.min(32, n.degree * 2);
      return {
        id: n.id,
        label: n.label,
        color: { background: TYPE_COLORS[n.type] || "#94a3b8", border: "#0f172a" },
        size: size,
        font: { color: "#e2e8f0", size: 11 },
        borderWidth: 2
      };
    }));

    var visEdges = new vis.DataSet(GRAPH_DATA.edges.map(function(e) {
      if (e.isHubEdge) {
        return {
          id: e.id,
          from: e.from,
          to: e.to,
          label: e.relation,
          font: { size: 9, color: "#94a3b8", align: "middle", strokeWidth: 2, strokeColor: "#0f172a" },
          color: { color: "#334155", highlight: "#94a3b8", hover: "#94a3b8" },
          dashes: [4, 3],
          arrows: { to: { enabled: true, scaleFactor: 0.5 } }
        };
      }
      return {
        id: e.id,
        from: e.from,
        to: e.to,
        label: e.relation,
        font: { size: 9, color: "#94a3b8", align: "middle", strokeWidth: 2, strokeColor: "#0f172a" },
        color: { color: "#475569", highlight: "#94a3b8", hover: "#94a3b8" },
        arrows: { to: { enabled: true, scaleFactor: 0.5 } }
      };
    }));

    var container = document.getElementById("graph");
    var network = new vis.Network(container, { nodes: visNodes, edges: visEdges }, {
      physics: {
        barnesHut: { gravitationalConstant: -10000, centralGravity: 0.1, springLength: 150, springConstant: 0.02, damping: 0.09, avoidOverlap: 0.2 },
        stabilization: { iterations: 150 }
      },
      interaction: { hover: true, tooltipDelay: 200 }
    });

    var legendHtml = Object.keys(TYPE_COLORS).map(function(type) {
      return "<div class="item"><div class="dot" style="background:" + TYPE_COLORS[type] + ""></div>" + type + "</div>";
    }).join("");
    document.getElementById("legend").innerHTML = legendHtml;

    document.getElementById("stats").textContent = GRAPH_DATA.nodes.length + " nodes, " + GRAPH_DATA.edges.length + " edges";

    var sidebar = document.getElementById("sidebar");
    var sidebarTitle = document.getElementById("sidebarTitle");
    var sidebarFields = document.getElementById("sidebarFields");
    var sidebarNeighbors = document.getElementById("sidebarNeighbors");

    network.on("click", function(params) {
      if (params.nodes.length === 0) {
        sidebar.classList.remove("open");
        return;
      }
      var nodeId = params.nodes[0];
      var node = nodeMap[nodeId];
      if (!node) return;

      sidebarTitle.textContent = node.label;
      var fieldsHtml = "";
      fieldsHtml += "<div class="field"><span class="label">ID:</span> <span class="value">" + node.id + "</span></div>";
      fieldsHtml += "<div class="field"><span class="label">Type:</span> <span class="value">" + node.type + "</span></div>";
      if (node.degree !== undefined) fieldsHtml += "<div class="field"><span class="label">Degree:</span> <span class="value">" + node.degree + "</span></div>";
      if (node.communityId) fieldsHtml += "<div class="field"><span class="label">Community:</span> <span class="value">" + node.communityId + "</span></div>";
      if (node.isHub) fieldsHtml += "<div class="field"><span class="label">Group Hub:</span> <span class="value">true</span></div>";
      sidebarFields.innerHTML = fieldsHtml;

      var nb = adjacency[nodeId] || [];
      var nbHtml = "";
      nb.slice(0, 100).forEach(function(rel) {
        var t = nodeMap[rel.id];
        if (t) nbHtml += "<div class="neighbor" data-node-id="" + t.id + "">" + rel.relation + " \u2192 " + t.label + "</div>";
      });
      if (nb.length > 100) nbHtml += "<div class="neighbor">... and " + (nb.length - 100) + " more</div>";
      sidebarNeighbors.innerHTML = nbHtml;
      sidebar.classList.add("open");
    });

    sidebarNeighbors.addEventListener("click", function(e) {
      var target = e.target;
      while (target && target !== sidebarNeighbors) {
        if (target.dataset && target.dataset.nodeId) {
          var nid = target.dataset.nodeId;
          network.selectNodes([nid]);
          network.focus(nid, { scale: 1.2, animation: { duration: 400 } });
          network.body.emitter.emit("click", { nodes: [nid] });
          return;
        }
        target = target.parentElement;
      }
    });

    document.getElementById("searchInput").addEventListener("input", function() {
      var query = this.value.toLowerCase().trim();
      if (!query) {
        visNodes.forEach(function(n) {
          visNodes.update({ id: n.id, opacity: 1.0, font: { color: "#e2e8f0", size: 11 } });
        });
        return;
      }
      visNodes.forEach(function(n) {
        var match = n.label.toLowerCase().indexOf(query) !== -1;
        visNodes.update({
          id: n.id,
          opacity: match ? 1.0 : 0.15,
          font: { color: match ? "#f8fafc" : "#475569", size: match ? 13 : 9 }
        });
      });
    });

    // ---------------------------------------------------------------------
    // Embedded graph query/path/explain runtime.
    //
    // Dependency-free port of the graph-query-core helpers that the live
    // graph serve / MCP surface uses. Operates only on the GRAPH_DATA.core
    // payload (real nodes/edges/pages/hyperedges/communities) so viewer-only
    // hub scaffolding never leaks into traversal. No network calls; no
    // provider-backed features.
    // ---------------------------------------------------------------------
    var CORE = GRAPH_DATA.core;
    var CORE_NODE_TYPE_PRIORITY = { concept: 6, entity: 5, source: 4, module: 3, symbol: 2, rationale: 1 };

    function coreNormalize(value) {
      if (value == null) return "";
      return String(value).replace(/\\s+/g, " ").trim().normalize("NFKD").replace(/[\\u0300-\\u036f]+/g, "").toLowerCase();
    }

    function coreScore(query, candidate) {
      var q = coreNormalize(query);
      var c = coreNormalize(candidate);
      if (!q || !c) return 0;
      if (c === q) return 100;
      if (c.indexOf(q) === 0) return 80;
      if (c.indexOf(q) !== -1) return 60;
      var qTokens = q.split(/\\s+/).filter(Boolean);
      var cTokens = {};
      c.split(/\\s+/).filter(Boolean).forEach(function(tok) { cTokens[tok] = true; });
      var overlap = 0;
      qTokens.forEach(function(tok) { if (cTokens[tok]) overlap++; });
      return overlap ? overlap * 10 : 0;
    }

    function coreUnique(values) {
      var seen = {};
      var out = [];
      for (var i = 0; i < values.length; i++) {
        var v = values[i];
        if (!v) continue;
        if (seen[v]) continue;
        seen[v] = true;
        out.push(v);
      }
      return out;
    }

    function coreBuildAdjacency() {
      var adj = {};
      function push(id, item) {
        if (!adj[id]) adj[id] = [];
        adj[id].push(item);
      }
      for (var i = 0; i < CORE.edges.length; i++) {
        var edge = CORE.edges[i];
        push(edge.source, { edge: edge, nodeId: edge.target, direction: "outgoing" });
        push(edge.target, { edge: edge, nodeId: edge.source, direction: "incoming" });
      }
      Object.keys(adj).forEach(function(nid) {
        adj[nid].sort(function(a, b) {
          return (b.edge.confidence - a.edge.confidence) || a.edge.relation.localeCompare(b.edge.relation);
        });
      });
      return adj;
    }

    var CORE_ADJ = coreBuildAdjacency();
    var CORE_NODE_BY_ID = {};
    CORE.nodes.forEach(function(n) { CORE_NODE_BY_ID[n.id] = n; });
    var CORE_PAGE_BY_ID = {};
    (CORE.pages || []).forEach(function(p) { CORE_PAGE_BY_ID[p.id] = p; });
    var CORE_COMM_BY_ID = {};
    (CORE.communities || []).forEach(function(c) { CORE_COMM_BY_ID[c.id] = c; });

    function coreCompareLabel(a, b) {
      var pa = CORE_NODE_TYPE_PRIORITY[a.type] || 0;
      var pb = CORE_NODE_TYPE_PRIORITY[b.type] || 0;
      if (pb !== pa) return pb - pa;
      var da = a.degree || 0;
      var db = b.degree || 0;
      if (db !== da) return db - da;
      return a.id.localeCompare(b.id);
    }

    function coreResolveNode(target) {
      if (CORE_NODE_BY_ID[target]) return CORE_NODE_BY_ID[target];
      var normalized = coreNormalize(target);
      var labelMatches = CORE.nodes.filter(function(n) {
        return coreNormalize(n.label) === normalized || coreNormalize(n.id) === normalized;
      });
      if (labelMatches.length) {
        return labelMatches.slice().sort(coreCompareLabel)[0];
      }
      var pageHit = (CORE.pages || [])
        .map(function(p) {
          return { page: p, score: Math.max(coreScore(target, p.title), coreScore(target, p.path)) };
        })
        .filter(function(item) { return item.score > 0; })
        .sort(function(left, right) {
          return (right.score - left.score) || left.page.title.localeCompare(right.page.title);
        })[0];
      if (pageHit) {
        var primary = CORE.nodes.filter(function(n) { return n.pageId === pageHit.page.id; })[0];
        if (primary) return primary;
      }
      var fuzzy = CORE.nodes
        .map(function(n) { return { node: n, score: Math.max(coreScore(target, n.label), coreScore(target, n.id)) }; })
        .filter(function(item) { return item.score > 0; })
        .sort(function(left, right) {
          return (right.score - left.score) || coreCompareLabel(left.node, right.node);
        })[0];
      return fuzzy ? fuzzy.node : undefined;
    }

    function coreUniqueMatches(matches) {
      var seen = {};
      var out = [];
      for (var i = 0; i < matches.length; i++) {
        var m = matches[i];
        var key = m.type + ":" + m.id;
        if (seen[key]) continue;
        seen[key] = true;
        out.push(m);
      }
      return out;
    }

    function runGraphQuery(question, traversalOpt, budgetOpt) {
      var traversal = traversalOpt === "dfs" ? "dfs" : "bfs";
      var budget = Math.max(3, Math.min((budgetOpt != null ? budgetOpt : 12), 50));
      var pageMatches = (CORE.pages || [])
        .map(function(p) { return { type: "page", id: p.id, label: p.title, score: Math.max(coreScore(question, p.title), coreScore(question, p.path)) }; })
        .filter(function(m) { return m.score > 0; });
      var nodeMatches = CORE.nodes
        .map(function(n) { return { type: "node", id: n.id, label: n.label, score: Math.max(coreScore(question, n.label), coreScore(question, n.id)) }; })
        .filter(function(m) { return m.score > 0; });
      var hyperMatches = (CORE.hyperedges || [])
        .map(function(h) { return { type: "hyperedge", id: h.id, label: h.label, score: Math.max(coreScore(question, h.label), coreScore(question, h.why || ""), coreScore(question, h.relation)) }; })
        .filter(function(m) { return m.score > 0; });
      var matches = coreUniqueMatches(pageMatches.concat(nodeMatches).concat(hyperMatches))
        .sort(function(a, b) { return (b.score - a.score) || a.label.localeCompare(b.label); })
        .slice(0, 12);

      var nodesByPageId = {};
      CORE.nodes.forEach(function(n) {
        if (!n.pageId) return;
        if (!nodesByPageId[n.pageId]) nodesByPageId[n.pageId] = [];
        nodesByPageId[n.pageId].push(n.id);
      });

      var seedList = [];
      matches.forEach(function(m) {
        if (m.type === "page") {
          (nodesByPageId[m.id] || []).forEach(function(id) { seedList.push(id); });
        } else if (m.type === "node") {
          seedList.push(m.id);
        } else if (m.type === "hyperedge") {
          var hy = (CORE.hyperedges || []).filter(function(h) { return h.id === m.id; })[0];
          if (hy) hy.nodeIds.forEach(function(id) { seedList.push(id); });
        }
      });
      var seeds = coreUnique(seedList);

      var visitedNodeIds = [];
      var visitedEdgeIds = {};
      var seen = {};
      var frontier = seeds.slice();
      while (frontier.length && visitedNodeIds.length < budget) {
        var current = traversal === "dfs" ? frontier.pop() : frontier.shift();
        if (!current || seen[current]) continue;
        seen[current] = true;
        visitedNodeIds.push(current);
        var adj = CORE_ADJ[current] || [];
        for (var i = 0; i < adj.length; i++) {
          var nb = adj[i];
          visitedEdgeIds[nb.edge.id] = true;
          if (!seen[nb.nodeId]) frontier.push(nb.nodeId);
          if (visitedNodeIds.length + frontier.length >= budget * 2) break;
        }
      }

      var pageIdsList = [];
      matches.forEach(function(m) { if (m.type === "page") pageIdsList.push(m.id); });
      visitedNodeIds.forEach(function(nid) {
        var n = CORE_NODE_BY_ID[nid];
        if (n && n.pageId) pageIdsList.push(n.pageId);
      });
      var pageIds = coreUnique(pageIdsList);
      var communities = coreUnique(
        visitedNodeIds.map(function(nid) { return CORE_NODE_BY_ID[nid] && CORE_NODE_BY_ID[nid].communityId; }).filter(Boolean)
      );
      var hyperedgeIds = coreUnique(
        (CORE.hyperedges || [])
          .filter(function(h) { return h.nodeIds.some(function(nid) { return visitedNodeIds.indexOf(nid) !== -1; }); })
          .map(function(h) { return h.id; })
      );
      var seedPageIds = coreUnique(matches.filter(function(m) { return m.type === "page"; }).map(function(m) { return m.id; }));
      var visitedEdgeIdList = Object.keys(visitedEdgeIds);

      var topMatchParts = matches.slice(0, 8).map(function(m) {
        var pagePath;
        if (m.type === "page") {
          pagePath = (CORE_PAGE_BY_ID[m.id] && CORE_PAGE_BY_ID[m.id].path) || m.id;
        } else if (m.type === "node") {
          var matchNode = CORE_NODE_BY_ID[m.id];
          var matchPageId = matchNode && matchNode.pageId;
          if (matchPageId) pagePath = (CORE_PAGE_BY_ID[matchPageId] && CORE_PAGE_BY_ID[matchPageId].path) || matchPageId;
        }
        return (m.label || m.id) + " (" + m.type + ", score " + m.score + (pagePath ? ", page " + pagePath : "") + ")";
      });
      var topMatchesLine = matches.length
        ? "Top matches: " + topMatchParts.join("; ") + (matches.length > 8 ? " (+" + (matches.length - 8) + " more)" : "")
        : "Top matches: none";
      var seedsLine = seeds.length
        ? "Seeds: " + seeds.slice(0, 15).join(", ") + (seeds.length > 15 ? " (+" + (seeds.length - 15) + " more)" : "")
        : "Seeds: none";
      var summary = [
        topMatchesLine,
        seedsLine,
        "Visited nodes: " + visitedNodeIds.length,
        "Visited edges: " + visitedEdgeIdList.length,
        "Touched group patterns: " + hyperedgeIds.length,
        "Communities: " + (communities.join(", ") || "none"),
        "Pages: " + (pageIds.join(", ") || "none")
      ].join("\\n");

      return {
        question: question,
        traversal: traversal,
        seedNodeIds: seeds,
        seedPageIds: seedPageIds,
        visitedNodeIds: visitedNodeIds,
        visitedEdgeIds: visitedEdgeIdList,
        hyperedgeIds: hyperedgeIds,
        pageIds: pageIds,
        communities: communities,
        matches: matches,
        summary: summary
      };
    }

    function runGraphPath(from, to) {
      var start = coreResolveNode(from);
      var end = coreResolveNode(to);
      if (!start || !end) {
        return {
          from: from,
          to: to,
          resolvedFromNodeId: start ? start.id : undefined,
          resolvedToNodeId: end ? end.id : undefined,
          found: false,
          nodeIds: [],
          edgeIds: [],
          pageIds: [],
          summary: "Could not resolve one or both graph targets."
        };
      }
      var queue = [start.id];
      var visited = {}; visited[start.id] = true;
      var previous = {};
      while (queue.length) {
        var current = queue.shift();
        if (current === end.id) break;
        var adj = CORE_ADJ[current] || [];
        for (var i = 0; i < adj.length; i++) {
          var nb = adj[i];
          if (visited[nb.nodeId]) continue;
          visited[nb.nodeId] = true;
          previous[nb.nodeId] = { nodeId: current, edgeId: nb.edge.id };
          queue.push(nb.nodeId);
        }
      }
      if (!visited[end.id]) {
        return {
          from: from,
          to: to,
          resolvedFromNodeId: start.id,
          resolvedToNodeId: end.id,
          found: false,
          nodeIds: [],
          edgeIds: [],
          pageIds: [],
          summary: "No path found between " + start.label + " and " + end.label + "."
        };
      }
      var nodeIds = [];
      var edgeIds = [];
      var cursor = end.id;
      while (cursor !== start.id) {
        nodeIds.push(cursor);
        var prev = previous[cursor];
        if (!prev) break;
        edgeIds.push(prev.edgeId);
        cursor = prev.nodeId;
      }
      nodeIds.push(start.id);
      nodeIds.reverse();
      edgeIds.reverse();
      var pageIds = coreUnique(nodeIds.map(function(nid) { return CORE_NODE_BY_ID[nid] && CORE_NODE_BY_ID[nid].pageId; }).filter(Boolean));
      var summary = nodeIds.map(function(nid) { return (CORE_NODE_BY_ID[nid] && CORE_NODE_BY_ID[nid].label) || nid; }).join(" -> ");
      return {
        from: from,
        to: to,
        resolvedFromNodeId: start.id,
        resolvedToNodeId: end.id,
        found: true,
        nodeIds: nodeIds,
        edgeIds: edgeIds,
        pageIds: pageIds,
        summary: summary
      };
    }

    function runGraphExplain(target) {
      var node = coreResolveNode(target);
      if (!node) return undefined;
      var neighbors = [];
      var adj = CORE_ADJ[node.id] || [];
      for (var i = 0; i < adj.length; i++) {
        var nb = adj[i];
        var t = CORE_NODE_BY_ID[nb.nodeId];
        if (!t) continue;
        neighbors.push({
          nodeId: t.id,
          label: t.label,
          type: t.type,
          pageId: t.pageId || undefined,
          relation: nb.edge.relation,
          direction: nb.direction,
          confidence: nb.edge.confidence,
          evidenceClass: nb.edge.evidenceClass
        });
      }
      neighbors.sort(function(a, b) { return (b.confidence - a.confidence) || a.label.localeCompare(b.label); });
      var page = node.pageId ? CORE_PAGE_BY_ID[node.pageId] : undefined;
      var community = node.communityId ? CORE_COMM_BY_ID[node.communityId] : undefined;
      var hyperedges = (CORE.hyperedges || [])
        .filter(function(h) { return h.nodeIds.indexOf(node.id) !== -1; })
        .slice()
        .sort(function(a, b) { return (b.confidence - a.confidence) || a.label.localeCompare(b.label); });
      var summary = [
        "Node: " + node.label,
        "Type: " + node.type,
        "Community: " + (node.communityId || "none"),
        "Neighbors: " + neighbors.length,
        "Group patterns: " + hyperedges.length,
        "Page: " + (page ? page.path : "none")
      ].join("\\n");
      return {
        target: target,
        node: node,
        page: page,
        community: community ? { id: community.id, label: community.label } : undefined,
        neighbors: neighbors,
        hyperedges: hyperedges,
        summary: summary
      };
    }

    // Expose helpers for test harnesses and browser console introspection.
    window.runGraphQuery = runGraphQuery;
    window.runGraphPath = runGraphPath;
    window.runGraphExplain = runGraphExplain;

    function focusNode(nodeId) {
      try {
        network.selectNodes([nodeId]);
        network.focus(nodeId, { scale: 1.2, animation: { duration: 300 } });
        network.body.emitter.emit("click", { nodes: [nodeId] });
      } catch (err) {
        // ignore — focus is best effort in static exports
      }
    }

    function renderList(parent, items, onClick) {
      items.forEach(function(entry) {
        var line = document.createElement("div");
        line.className = "item";
        line.textContent = entry.text;
        line.addEventListener("click", function() { if (onClick) onClick(entry.id); });
        parent.appendChild(line);
      });
    }

    function renderQueryPanel(result) {
      var host = document.getElementById("queryResult");
      host.textContent = "";
      if (!result) return;
      var summaryEl = document.createElement("div");
      summaryEl.textContent = result.summary;
      host.appendChild(summaryEl);
      if (result.visitedNodeIds.length) {
        var hdr = document.createElement("div");
        hdr.className = "hdr";
        hdr.textContent = "Visited (" + result.traversal.toUpperCase() + ")";
        host.appendChild(hdr);
        renderList(host, result.visitedNodeIds.map(function(nid, idx) {
          var n = CORE_NODE_BY_ID[nid];
          return { id: nid, text: (idx + 1) + ". " + ((n && n.label) || nid) };
        }), focusNode);
      }
    }

    function renderPathPanel(result) {
      var host = document.getElementById("pathResult");
      host.textContent = "";
      if (!result) return;
      var summaryEl = document.createElement("div");
      summaryEl.textContent = result.summary;
      host.appendChild(summaryEl);
      if (result.found && result.nodeIds.length) {
        var edgeById = {};
        CORE.edges.forEach(function(e) { edgeById[e.id] = e; });
        var ol = document.createElement("ol");
        for (var i = 0; i < result.nodeIds.length; i++) {
          var nid = result.nodeIds[i];
          var n = CORE_NODE_BY_ID[nid];
          var li = document.createElement("li");
          var btn = document.createElement("span");
          btn.className = "item";
          btn.textContent = (n && n.label) || nid;
          (function(targetId) { btn.addEventListener("click", function() { focusNode(targetId); }); })(nid);
          li.appendChild(btn);
          if (i < result.edgeIds.length) {
            var edge = edgeById[result.edgeIds[i]];
            if (edge) {
              var rel = document.createElement("span");
              rel.className = "relation";
              rel.textContent = "  -[" + edge.relation + "]-> ";
              li.appendChild(rel);
            }
          }
          ol.appendChild(li);
        }
        host.appendChild(ol);
      }
    }

    function renderExplainPanel(result, target) {
      var host = document.getElementById("explainResult");
      host.textContent = "";
      if (!result) {
        var err = document.createElement("div");
        err.className = "error";
        err.textContent = "Could not resolve graph target: " + target;
        host.appendChild(err);
        return;
      }
      var summaryEl = document.createElement("div");
      summaryEl.textContent = result.summary;
      host.appendChild(summaryEl);
      if (result.neighbors.length) {
        var byRel = {};
        result.neighbors.forEach(function(nb) {
          if (!byRel[nb.relation]) byRel[nb.relation] = [];
          byRel[nb.relation].push(nb);
        });
        Object.keys(byRel).sort().forEach(function(rel) {
          var hdr = document.createElement("div");
          hdr.className = "hdr";
          hdr.textContent = rel + " (" + byRel[rel].length + ")";
          host.appendChild(hdr);
          renderList(host, byRel[rel].map(function(nb) {
            var arrow = nb.direction === "incoming" ? "<- " : "-> ";
            return { id: nb.nodeId, text: arrow + nb.label + "  [" + nb.evidenceClass + ", " + nb.confidence.toFixed(2) + "]" };
          }), focusNode);
        });
      }
      if (result.community) {
        var ch = document.createElement("div");
        ch.className = "hdr";
        ch.textContent = "Community";
        host.appendChild(ch);
        var cb = document.createElement("div");
        cb.textContent = result.community.label;
        host.appendChild(cb);
      }
      if (result.hyperedges && result.hyperedges.length) {
        var hh = document.createElement("div");
        hh.className = "hdr";
        hh.textContent = "Group Patterns (" + result.hyperedges.length + ")";
        host.appendChild(hh);
        result.hyperedges.forEach(function(h) {
          var line = document.createElement("div");
          line.textContent = h.label + " [" + h.relation + ", " + h.confidence.toFixed(2) + "]";
          host.appendChild(line);
        });
      }
    }

    function runPanelQuery() {
      var question = document.getElementById("queryInput").value.trim();
      if (!question) {
        renderQueryPanel(null);
        return;
      }
      var radios = document.getElementsByName("queryTraversal");
      var traversal = "bfs";
      for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) { traversal = radios[i].value; break; }
      }
      renderQueryPanel(runGraphQuery(question, traversal));
    }

    function runPanelPath() {
      var from = document.getElementById("pathFrom").value.trim();
      var to = document.getElementById("pathTo").value.trim();
      if (!from || !to) {
        renderPathPanel(null);
        return;
      }
      renderPathPanel(runGraphPath(from, to));
    }

    function runPanelExplain() {
      var target = document.getElementById("explainInput").value.trim();
      if (!target) {
        renderExplainPanel(null, "");
        return;
      }
      renderExplainPanel(runGraphExplain(target), target);
    }

    document.getElementById("queryRun").addEventListener("click", runPanelQuery);
    document.getElementById("queryInput").addEventListener("keydown", function(e) { if (e.key === "Enter") runPanelQuery(); });
    document.getElementById("pathFind").addEventListener("click", runPanelPath);
    document.getElementById("pathFrom").addEventListener("keydown", function(e) { if (e.key === "Enter") runPanelPath(); });
    document.getElementById("pathTo").addEventListener("keydown", function(e) { if (e.key === "Enter") runPanelPath(); });
    document.getElementById("explainRun").addEventListener("click", runPanelExplain);
    document.getElementById("explainInput").addEventListener("keydown", function(e) { if (e.key === "Enter") runPanelExplain(); });
  </script>
</body>
</html>`;
