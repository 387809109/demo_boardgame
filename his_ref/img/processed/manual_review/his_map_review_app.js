(function () {
  "use strict";

  const payload = window.HIS_REVIEW_PAYLOAD;
  if (!payload || !payload.data) {
    document.body.textContent = "HIS review payload missing.";
    return;
  }

  const DATA = payload.data;
  const BASE_OVERRIDES = normalizeOverrides(payload.overrides || {});
  const META = payload.meta || {};
  const LAND_BASE = DATA.land_spaces || [];
  const EDGE_BASE = (DATA.topology_candidates && DATA.topology_candidates.land_edges) || [];
  const SEA_ZONES = DATA.sea_zones || [];
  const STORAGE_KEY = "his_map_review_overrides_v2";
  const CONTROLLER_VALUES = [
    "ottoman",
    "hapsburg",
    "england",
    "france",
    "papacy",
    "protestant",
    "independent",
    "genoa",
    "hungary",
    "scotland",
    "venice",
  ];

  const COLORS = {
    ottoman: "#ef4444",
    hapsburg: "#f59e0b",
    england: "#22c55e",
    france: "#3b82f6",
    papacy: "#f97316",
    protestant: "#8b5cf6",
    independent: "#9ca3af",
    genoa: "#14b8a6",
    hungary: "#84cc16",
    scotland: "#06b6d4",
    venice: "#eab308",
    unknown: "#6b7280",
    none: "#6b7280",
  };

  injectLayout();
  injectStyles();

  const state = {
    zoom: 1,
    showLabels: true,
    showSea: false,
    showConnection: true,
    showPass: true,
    onlyPorts: false,
    search: "",
    selectedNode: null,
    selectedEdgeKey: null,
    selectedControllers: new Set(),
    selectedLanguages: new Set(),
    effectiveLand: [],
    effectiveEdges: [],
    byName: new Map(),
  };

  let sessionOverrides = loadLocalOrBase();
  const ui = bindNodes();
  initEditorSelects(ui);
  renderFilterGroups(ui, state, LAND_BASE);
  populateSpaceInputs(ui, LAND_BASE);
  bindUiEvents(ui, state);
  renderAll(ui, state);
  setStatus(ui, "Ready. Click node/edge to edit.");

  function injectLayout() {
    const root = document.getElementById("his-map-review-root");
    root.innerHTML = `
<div class="app">
  <aside class="panel panel-left">
    <h1>HIS Final Review Map Editor</h1>
    <div class="small" id="statsLine"></div>
    <div class="status" id="statusLine"></div>

    <h2>Display</h2>
    <label class="line"><input type="checkbox" id="showLabels" checked> Show labels</label>
    <label class="line"><input type="checkbox" id="showSeaZones"> Show sea polygons</label>
    <label class="line"><input type="checkbox" id="showConnection" checked> Show connection</label>
    <label class="line"><input type="checkbox" id="showPass" checked> Show pass</label>
    <label class="line"><input type="checkbox" id="onlyPorts"> Only ports</label>
    <div class="field"><label>Zoom</label><input id="zoom" type="range" min="35" max="220" value="100"></div>
    <div class="field"><label>Search</label><input id="search" type="text" placeholder="Space name"></div>

    <h2>Controller Filter</h2>
    <div id="ctrlFilters"></div>
    <h2>Language Filter</h2>
    <div id="langFilters"></div>

    <h2>Selection</h2>
    <div class="small" id="selectionTitle">Click a node or edge.</div>
    <pre id="selectionDetail"></pre>
  </aside>

  <main class="main">
    <div class="mapWrap">
      <div id="mapRoot">
        <svg id="mapSvg" viewBox="0 0 ${META.canvas_width || 5000} ${META.canvas_height || 3300}">
          <image href="${META.image_name || "HereIStandMap.jpg"}" x="0" y="0" width="${META.canvas_width || 5000}" height="${META.canvas_height || 3300}" opacity="0.95"></image>
          <g id="seaLayer"></g>
          <g id="edgeLayer"></g>
          <g id="nodeLayer"></g>
          <g id="labelLayer"></g>
        </svg>
      </div>
    </div>
  </main>

  <aside class="panel panel-right">
    <h2>Edit Node</h2>
    <div class="card">
      <div class="small" id="nodeCurrent">Select node first.</div>
      <div class="field"><label>Controller</label><select id="nodeController"></select></div>
      <div class="field"><label>Language</label><select id="nodeLanguage"></select></div>
      <div class="field"><label>Port</label><select id="nodePort"></select></div>
      <div class="field"><label>Sea Mode</label><select id="nodeSeaMode"></select></div>
      <div class="field"><label>Connected Seas (|)</label><input id="nodeSeas" type="text"></div>
      <div class="field"><label>Fortress</label><select id="nodeFortress"></select></div>
      <div class="field"><label>Notes</label><input id="nodeNote" type="text"></div>
      <div class="row"><button id="saveNode" class="primary">Save Node</button><button id="clearNode" class="danger">Clear Node</button></div>
    </div>

    <h2>Edit Edge</h2>
    <div class="card">
      <div class="small" id="edgeCurrent">Select edge first.</div>
      <div class="field"><label>Decision</label><select id="edgeDecision"></select></div>
      <div class="field"><label>Type (keep=true)</label><select id="edgeType"></select></div>
      <div class="field"><label>Notes</label><input id="edgeNote" type="text"></div>
      <div class="row"><button id="saveEdge" class="primary">Save Edge</button><button id="clearEdge" class="danger">Clear Edge</button></div>
    </div>

    <h2>Add Edge</h2>
    <div class="card">
      <div class="small">Create a new edge even if it does not exist yet.</div>
      <div class="field"><label>Space A</label><input id="newEdgeA" list="edgeSpaceList" type="text" placeholder="e.g. Paris"></div>
      <div class="field"><label>Space B</label><input id="newEdgeB" list="edgeSpaceList" type="text" placeholder="e.g. Rouen"></div>
      <div class="field"><label>Type</label><select id="newEdgeType"></select></div>
      <div class="field"><label>Notes</label><input id="newEdgeNote" type="text" placeholder="optional note"></div>
      <div class="row"><button id="addEdge" class="primary">Add Edge</button></div>
      <datalist id="edgeSpaceList"></datalist>
    </div>

    <h2>Overrides</h2>
    <div class="card">
      <div class="row"><button id="saveLocal">Save Local</button><button id="loadLocal">Load Local</button><button id="resetLocal">Reset</button></div>
      <div class="row"><button id="copyJson" class="primary">Copy JSON</button><button id="downloadJson" class="primary">Download JSON</button></div>
      <textarea id="jsonPreview" class="mono" readonly></textarea>
    </div>
  </aside>
</div>`;
  }

  function injectStyles() {
    const css = `
body{margin:0;font-family:Segoe UI,Tahoma,sans-serif;background:#0f172a;color:#e5e7eb}
.app{display:grid;grid-template-columns:320px minmax(0,1fr) 380px;min-height:100vh}
.panel{padding:12px;background:#111827;overflow:auto}
.panel-left{border-right:1px solid #374151}
.panel-right{border-left:1px solid #374151}
.panel h1{font-size:18px;margin:0 0 8px}.panel h2{font-size:12px;margin:12px 0 6px;color:#9ca3af;text-transform:uppercase}
.line{display:block;margin:4px 0;font-size:12px}.field{margin:6px 0}.field label{display:block;font-size:12px;color:#cbd5e1;margin-bottom:3px}
input,select,textarea,button{font-family:inherit;font-size:12px}
input[type=text],input[type=number],select,textarea{width:100%;padding:6px 8px;background:#0b1220;border:1px solid #374151;color:#e5e7eb;border-radius:6px}
button{padding:6px 10px;border:1px solid #374151;background:#0b1220;color:#e5e7eb;border-radius:6px;cursor:pointer}
button.primary{border-color:#12586d;background:#0d2530}button.danger{border-color:#7f1d1d;background:#2c0b0b}
.small{font-size:12px;color:#9ca3af}.status{font-size:12px;color:#86efac;min-height:18px}.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.card{border:1px solid #374151;padding:8px;border-radius:8px;background:#0b1220}
pre{white-space:pre-wrap;word-break:break-word;background:#0b1220;border:1px solid #374151;border-radius:8px;padding:8px;max-height:220px;overflow:auto;font-size:12px}
.mono{font-family:Consolas,monospace;min-height:180px}.main{padding:10px;overflow:auto;min-width:0}.mapWrap{height:calc(100vh - 20px);border:1px solid #374151;border-radius:10px;overflow:auto;background:#0b1220}
#mapRoot{transform-origin:top left}
.sea{fill:rgba(34,211,238,.08);stroke:rgba(34,211,238,.35);stroke-width:2}
.edge{stroke:#94a3b8;stroke-width:3.6;opacity:.62}.edge.manual{stroke:#22d3ee;opacity:.92;stroke-width:4.4}.edge.pass{stroke:#f59e0b;stroke-width:5.2;stroke-dasharray:12 8;opacity:.99}.edge.sel{stroke:#f8fafc;opacity:1;stroke-width:6}
.edge-hit{stroke:transparent;stroke-width:16;cursor:pointer;pointer-events:stroke}
.node{stroke:#0b1220;stroke-width:1.2;cursor:pointer}.node.key{stroke:#fef3c7;stroke-width:2.5}.node.port{stroke:#93c5fd;stroke-width:2.2}.node.sel{stroke:#fff;stroke-width:3.6}
.label{fill:#e2e8f0;font-size:16px;pointer-events:none;paint-order:stroke;stroke:#111827;stroke-width:3px;stroke-linejoin:round}
@media (max-width:1520px){.app{grid-template-columns:280px minmax(0,1fr) 340px}}
@media (max-width:1180px){.app{grid-template-columns:1fr}.panel{border-right:0;border-left:0;border-bottom:1px solid #374151}.mapWrap{height:72vh}}
`;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function bindNodes() {
    const q = (id) => document.getElementById(id);
    return {
      stats: q("statsLine"),
      status: q("statusLine"),
      showLabels: q("showLabels"),
      showSea: q("showSeaZones"),
      showConnection: q("showConnection"),
      showPass: q("showPass"),
      onlyPorts: q("onlyPorts"),
      zoom: q("zoom"),
      search: q("search"),
      ctrlFilters: q("ctrlFilters"),
      langFilters: q("langFilters"),
      selectionTitle: q("selectionTitle"),
      selectionDetail: q("selectionDetail"),
      nodeCurrent: q("nodeCurrent"),
      nodeController: q("nodeController"),
      nodeLanguage: q("nodeLanguage"),
      nodePort: q("nodePort"),
      nodeSeaMode: q("nodeSeaMode"),
      nodeSeas: q("nodeSeas"),
      nodeFortress: q("nodeFortress"),
      nodeNote: q("nodeNote"),
      saveNode: q("saveNode"),
      clearNode: q("clearNode"),
      edgeCurrent: q("edgeCurrent"),
      edgeDecision: q("edgeDecision"),
      edgeType: q("edgeType"),
      edgeNote: q("edgeNote"),
      saveEdge: q("saveEdge"),
      clearEdge: q("clearEdge"),
      newEdgeA: q("newEdgeA"),
      newEdgeB: q("newEdgeB"),
      newEdgeType: q("newEdgeType"),
      newEdgeNote: q("newEdgeNote"),
      addEdge: q("addEdge"),
      edgeSpaceList: q("edgeSpaceList"),
      saveLocal: q("saveLocal"),
      loadLocal: q("loadLocal"),
      resetLocal: q("resetLocal"),
      copyJson: q("copyJson"),
      downloadJson: q("downloadJson"),
      jsonPreview: q("jsonPreview"),
      mapRoot: q("mapRoot"),
      seaLayer: q("seaLayer"),
      edgeLayer: q("edgeLayer"),
      nodeLayer: q("nodeLayer"),
      labelLayer: q("labelLayer"),
    };
  }

  function bindUiEvents(ui, s) {
    ui.showLabels.onchange = () => { s.showLabels = ui.showLabels.checked; renderAll(ui, s); };
    ui.showSea.onchange = () => { s.showSea = ui.showSea.checked; renderAll(ui, s); };
    ui.showConnection.onchange = () => { s.showConnection = ui.showConnection.checked; renderAll(ui, s); };
    ui.showPass.onchange = () => { s.showPass = ui.showPass.checked; renderAll(ui, s); };
    ui.onlyPorts.onchange = () => { s.onlyPorts = ui.onlyPorts.checked; renderAll(ui, s); };
    ui.search.oninput = () => { s.search = ui.search.value.trim(); renderAll(ui, s); };
    ui.zoom.oninput = () => { s.zoom = Number(ui.zoom.value) / 100; renderAll(ui, s); };
    ui.saveNode.onclick = () => saveNodeEdit(ui, s);
    ui.clearNode.onclick = () => clearNodeEdit(ui, s);
    ui.saveEdge.onclick = () => saveEdgeEdit(ui, s);
    ui.clearEdge.onclick = () => clearEdgeEdit(ui, s);
    ui.addEdge.onclick = () => addEdgeByInput(ui, s);
    ui.saveLocal.onclick = () => { saveLocal(sessionOverrides); setStatus(ui, "Saved local."); };
    ui.loadLocal.onclick = () => { sessionOverrides = loadLocalOrBase(); renderAll(ui, s); setStatus(ui, "Loaded local."); };
    ui.resetLocal.onclick = () => { sessionOverrides = normalizeOverrides(BASE_OVERRIDES); saveLocal(sessionOverrides); renderAll(ui, s); setStatus(ui, "Reset to base."); };
    ui.copyJson.onclick = async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(sessionOverrides, null, 2)); setStatus(ui, "Copied."); }
      catch (_e) { setStatus(ui, "Copy failed."); }
    };
    ui.downloadJson.onclick = () => {
      const blob = new Blob([JSON.stringify(sessionOverrides, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "his_vmod_map_overrides.edited.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus(ui, "Downloaded overrides.");
    };
  }

  function initEditorSelects(ui) {
    fillSelect(
      ui.nodeController,
      [["__keep__", "(keep)"], ["__null__", "unknown/null"]].concat(
        CONTROLLER_VALUES.map((v) => [v, v])
      )
    );
    fillSelect(ui.nodeLanguage, [["__keep__", "(keep)"], ["__null__", "unknown/null"], ["english", "english"], ["french", "french"], ["german", "german"], ["italian", "italian"], ["spanish", "spanish"], ["none", "none"]]);
    fillSelect(ui.nodePort, [["__keep__", "(keep)"], ["true", "true"], ["false", "false"], ["__null__", "unknown/null"]]);
    fillSelect(ui.nodeSeaMode, [["keep", "(keep)"], ["set", "set from input"]]);
    fillSelect(ui.nodeFortress, [["__keep__", "(keep)"], ["true", "true"], ["false", "false"], ["__null__", "unknown/null"]]);
    fillSelect(ui.edgeDecision, [["__keep__", "(no override)"], ["true", "keep edge"], ["false", "remove edge"]]);
    fillSelect(ui.edgeType, [["connection", "connection"], ["pass", "pass"]]);
    fillSelect(ui.newEdgeType, [["connection", "connection"], ["pass", "pass"]]);
  }

  function renderFilterGroups(ui, s, land) {
    const ctrls = Array.from(
      new Set(land.map((x) => safeController(x.initial_controller_1517)).concat(CONTROLLER_VALUES, ["unknown"]))
    ).sort();
    const langs = Array.from(new Set(land.map((x) => safeLanguage(x.language_zone_inferred)).concat(["unknown"]))).sort();
    if (s.selectedControllers.size === 0) ctrls.forEach((x) => s.selectedControllers.add(x));
    if (s.selectedLanguages.size === 0) langs.forEach((x) => s.selectedLanguages.add(x));
    ui.ctrlFilters.innerHTML = "";
    ctrls.forEach((v) => ui.ctrlFilters.appendChild(makeFilterCheckbox(v, s.selectedControllers, () => renderAll(ui, s))));
    ui.langFilters.innerHTML = "";
    langs.forEach((v) => ui.langFilters.appendChild(makeFilterCheckbox(v, s.selectedLanguages, () => renderAll(ui, s))));
  }

  function renderAll(ui, s) {
    s.effectiveLand = applyLandOverrides(LAND_BASE, sessionOverrides);
    s.byName = new Map(s.effectiveLand.map((x) => [x.name, x]));
    s.effectiveEdges = applyEdgeOverrides(EDGE_BASE, sessionOverrides);
    ui.jsonPreview.value = JSON.stringify(sessionOverrides, null, 2);
    ui.mapRoot.style.transform = `scale(${s.zoom})`;
    drawSea(ui, s);
    const visible = drawNodes(ui, s);
    drawEdges(ui, s, visible);
    ui.stats.textContent = `Spaces ${visible.size}/${s.effectiveLand.length} | Edges ${s.effectiveEdges.filter((e) => edgeVisible(e, visible, s)).length}/${s.effectiveEdges.length}`;
    refreshEditors(ui, s);
  }

  function drawSea(ui, s) {
    ui.seaLayer.innerHTML = "";
    if (!s.showSea) return;
    SEA_ZONES.forEach((z) => {
      const p = svg("polygon");
      p.setAttribute("class", "sea");
      p.setAttribute("points", (z.polygon || []).map((pt) => `${pt.x},${pt.y}`).join(" "));
      ui.seaLayer.appendChild(p);
    });
  }

  function drawNodes(ui, s) {
    ui.nodeLayer.innerHTML = "";
    ui.labelLayer.innerHTML = "";
    const visible = new Set();
    s.effectiveLand.forEach((space) => {
      if (!nodeVisible(space, s)) return;
      visible.add(space.name);
      const c = svg("circle");
      c.setAttribute("cx", space.x); c.setAttribute("cy", space.y); c.setAttribute("r", space.is_key_space ? 12 : 8);
      c.setAttribute("fill", COLORS[safeController(space.initial_controller_1517)] || COLORS.unknown);
      c.setAttribute("class", `node${space.is_key_space ? " key" : ""}${space.is_port ? " port" : ""}${s.selectedNode === space.name ? " sel" : ""}`);
      c.addEventListener("click", () => {
        s.selectedNode = space.name; s.selectedEdgeKey = null;
        setSelection(ui, space.name, space); renderAll(ui, s);
      });
      ui.nodeLayer.appendChild(c);
      if (space.is_port) {
        const i = svg("circle");
        i.setAttribute("cx", space.x); i.setAttribute("cy", space.y); i.setAttribute("r", space.is_key_space ? 7 : 4);
        i.setAttribute("fill", "#e0f2fe"); i.setAttribute("opacity", "0.85");
        ui.nodeLayer.appendChild(i);
      }
      if (s.showLabels) {
        const t = svg("text");
        t.setAttribute("x", String(space.x + 11)); t.setAttribute("y", String(space.y - 10)); t.setAttribute("class", "label");
        t.textContent = space.name; ui.labelLayer.appendChild(t);
      }
    });
    return visible;
  }

  function drawEdges(ui, s, visible) {
    ui.edgeLayer.innerHTML = "";
    s.effectiveEdges.forEach((edge) => {
      if (!edgeVisible(edge, visible, s)) return;
      const a = s.byName.get(edge.a); const b = s.byName.get(edge.b); if (!a || !b) return;
      const k = edgeKey(edge.a, edge.b);
      const onClick = () => {
        s.selectedEdgeKey = k; s.selectedNode = null;
        setSelection(ui, `${edge.a} <-> ${edge.b}`, edge); renderAll(ui, s);
      };

      const line = svg("line");
      line.setAttribute("x1", a.x); line.setAttribute("y1", a.y); line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
      line.setAttribute("class", `edge${isManualEdge(edge) ? " manual" : ""}${getEdgeType(edge) === "pass" ? " pass" : ""}${s.selectedEdgeKey === k ? " sel" : ""}`);
      line.addEventListener("click", onClick);
      ui.edgeLayer.appendChild(line);

      const hit = svg("line");
      hit.setAttribute("x1", a.x); hit.setAttribute("y1", a.y); hit.setAttribute("x2", b.x); hit.setAttribute("y2", b.y);
      hit.setAttribute("class", "edge-hit");
      hit.addEventListener("click", onClick);
      ui.edgeLayer.appendChild(hit);
    });
  }

  function refreshEditors(ui, s) {
    refreshNodeEditor(ui, s);
    refreshEdgeEditor(ui, s);
  }

  function refreshNodeEditor(ui, s) {
    if (!s.selectedNode) {
      ui.nodeCurrent.textContent = "Select node first.";
      ui.nodeController.value = "__keep__";
      ui.nodeLanguage.value = "__keep__";
      ui.nodePort.value = "__keep__";
      ui.nodeSeaMode.value = "keep";
      ui.nodeSeas.value = "";
      ui.nodeFortress.value = "__keep__";
      ui.nodeNote.value = "";
      return;
    }
    const space = s.byName.get(s.selectedNode);
    const patch = (sessionOverrides.land_space_overrides || {})[s.selectedNode] || {};
    ui.nodeCurrent.textContent = `Selected: ${s.selectedNode} | controller=${safeController(space.initial_controller_1517)} | language=${safeLanguage(space.language_zone_inferred)}`;
    ui.nodeController.value = tokenForSelect(patch.initial_controller_1517);
    ui.nodeLanguage.value = tokenForSelect(patch.language_zone_inferred);
    ui.nodePort.value = tokenForSelect(patch.is_port);
    ui.nodeFortress.value = tokenForSelect(patch.is_fortress);
    if (Array.isArray(patch.connected_sea_zones)) {
      ui.nodeSeaMode.value = "set";
      ui.nodeSeas.value = patch.connected_sea_zones.join("|");
    } else {
      ui.nodeSeaMode.value = "keep";
      ui.nodeSeas.value = "";
    }
    ui.nodeNote.value = patch.notes ? String(patch.notes) : "";
  }

  function refreshEdgeEditor(ui, s) {
    if (!s.selectedEdgeKey) {
      ui.edgeCurrent.textContent = "Select edge first.";
      ui.edgeDecision.value = "__keep__";
      ui.edgeType.value = "connection";
      ui.edgeNote.value = "";
      return;
    }
    const [a, b] = s.selectedEdgeKey.split("||");
    const removeSet = new Set((sessionOverrides.topology_overrides.remove_land_edges || []).map((x) => edgeKey(x[0], x[1])));
    const addMap = new Map((sessionOverrides.topology_overrides.add_land_edges || []).map((e) => [edgeKey(e.a, e.b), Object.assign({}, e)]));
    ui.edgeDecision.value = removeSet.has(s.selectedEdgeKey) ? "false" : (addMap.has(s.selectedEdgeKey) ? "true" : "__keep__");
    const addEdge = addMap.get(s.selectedEdgeKey);
    const edge = s.effectiveEdges.find((e) => edgeKey(e.a, e.b) === s.selectedEdgeKey);
    ui.edgeCurrent.textContent = `Selected: ${a} <-> ${b} | currentType=${edge ? getEdgeType(edge) : "unknown"}`;
    ui.edgeType.value = addEdge ? getEdgeType(addEdge) : (edge ? getEdgeType(edge) : "connection");
    ui.edgeNote.value = addEdge && addEdge.notes ? String(addEdge.notes) : "";
  }

  function saveNodeEdit(ui, s) {
    if (!s.selectedNode) return setStatus(ui, "Select node first.");
    const name = s.selectedNode;
    const patch = Object.assign({}, (sessionOverrides.land_space_overrides[name] || {}));
    applySelectPatch(patch, "initial_controller_1517", ui.nodeController.value);
    applySelectPatch(patch, "language_zone_inferred", ui.nodeLanguage.value);
    applySelectPatch(patch, "is_port", ui.nodePort.value);
    applySelectPatch(patch, "is_fortress", ui.nodeFortress.value);
    if (ui.nodeSeaMode.value === "set") patch.connected_sea_zones = parseSeaList(ui.nodeSeas.value); else delete patch.connected_sea_zones;
    const note = (ui.nodeNote.value || "").trim(); if (note) patch.notes = note; else delete patch.notes;
    if ("language_zone_inferred" in patch) { patch.language_zone_source = "manual_ui"; patch.language_zone_confidence = "high"; }
    if ("is_port" in patch) { patch.port_source = "manual_ui"; patch.port_confidence = "high"; }
    if (Object.keys(patch).length === 0) delete sessionOverrides.land_space_overrides[name]; else sessionOverrides.land_space_overrides[name] = patch;
    saveLocal(sessionOverrides); renderAll(ui, s); setStatus(ui, `Saved node ${name}`);
  }

  function clearNodeEdit(ui, s) {
    if (!s.selectedNode) return setStatus(ui, "Select node first.");
    delete sessionOverrides.land_space_overrides[s.selectedNode];
    saveLocal(sessionOverrides); renderAll(ui, s); setStatus(ui, `Cleared node ${s.selectedNode}`);
  }

  function saveEdgeEdit(ui, s) {
    if (!s.selectedEdgeKey) return setStatus(ui, "Select edge first.");
    const [a, b] = s.selectedEdgeKey.split("||");
    const decision = ui.edgeDecision.value;
    const removeSet = new Set((sessionOverrides.topology_overrides.remove_land_edges || []).map((x) => edgeKey(x[0], x[1])));
    const addMap = new Map((sessionOverrides.topology_overrides.add_land_edges || []).map((e) => [edgeKey(e.a, e.b), Object.assign({}, e)]));
    if (decision === "__keep__") { removeSet.delete(s.selectedEdgeKey); addMap.delete(s.selectedEdgeKey); }
    if (decision === "false") { addMap.delete(s.selectedEdgeKey); removeSet.add(s.selectedEdgeKey); }
    if (decision === "true") {
      removeSet.delete(s.selectedEdgeKey);
      const edge = { a, b, confidence: 1, method: "manual_ui" };
      if (ui.edgeType.value === "pass") edge.connection_type = "pass";
      const note = (ui.edgeNote.value || "").trim(); if (note) edge.notes = note;
      addMap.set(s.selectedEdgeKey, edge);
    }
    sessionOverrides.topology_overrides.remove_land_edges = Array.from(removeSet).map((k) => k.split("||")).sort((m, n) => (m[0] + m[1]).localeCompare(n[0] + n[1]));
    sessionOverrides.topology_overrides.add_land_edges = Array.from(addMap.values()).sort((m, n) => (m.a + m.b).localeCompare(n.a + n.b));
    saveLocal(sessionOverrides); renderAll(ui, s); setStatus(ui, `Saved edge ${a}<->${b}`);
  }

  function clearEdgeEdit(ui, s) {
    if (!s.selectedEdgeKey) return setStatus(ui, "Select edge first.");
    const removeSet = new Set((sessionOverrides.topology_overrides.remove_land_edges || []).map((x) => edgeKey(x[0], x[1])));
    const addMap = new Map((sessionOverrides.topology_overrides.add_land_edges || []).map((e) => [edgeKey(e.a, e.b), Object.assign({}, e)]));
    removeSet.delete(s.selectedEdgeKey); addMap.delete(s.selectedEdgeKey);
    sessionOverrides.topology_overrides.remove_land_edges = Array.from(removeSet).map((k) => k.split("||")).sort((m, n) => (m[0] + m[1]).localeCompare(n[0] + n[1]));
    sessionOverrides.topology_overrides.add_land_edges = Array.from(addMap.values()).sort((m, n) => (m.a + m.b).localeCompare(n.a + n.b));
    saveLocal(sessionOverrides); renderAll(ui, s); setStatus(ui, "Cleared edge override");
  }

  function addEdgeByInput(ui, s) {
    const aInput = String(ui.newEdgeA.value || "").trim();
    const bInput = String(ui.newEdgeB.value || "").trim();
    const edgeType = String(ui.newEdgeType.value || "connection");
    const note = String(ui.newEdgeNote.value || "").trim();

    const a = resolveSpaceName(aInput);
    const b = resolveSpaceName(bInput);

    if (!a || !b) {
      setStatus(ui, "Invalid space name. Pick both spaces from suggestions.");
      return;
    }
    if (a === b) {
      setStatus(ui, "Space A and Space B cannot be the same.");
      return;
    }

    const key = edgeKey(a, b);
    const removeSet = new Set((sessionOverrides.topology_overrides.remove_land_edges || []).map((x) => edgeKey(x[0], x[1])));
    const addMap = new Map((sessionOverrides.topology_overrides.add_land_edges || []).map((e) => [edgeKey(e.a, e.b), Object.assign({}, e)]));
    removeSet.delete(key);

    const edge = { a: canon(a, b)[0], b: canon(a, b)[1], confidence: 1, method: "manual_ui" };
    if (edgeType === "pass") edge.connection_type = "pass";
    if (note) edge.notes = note;
    addMap.set(key, edge);

    sessionOverrides.topology_overrides.remove_land_edges = Array.from(removeSet).map((k) => k.split("||")).sort((m, n) => (m[0] + m[1]).localeCompare(n[0] + n[1]));
    sessionOverrides.topology_overrides.add_land_edges = Array.from(addMap.values()).sort((m, n) => (m.a + m.b).localeCompare(n.a + n.b));

    s.selectedEdgeKey = key;
    s.selectedNode = null;
    saveLocal(sessionOverrides);
    renderAll(ui, s);
    setStatus(ui, `Added edge ${canon(a, b)[0]}<->${canon(a, b)[1]}`);
  }

  function applySelectPatch(patch, field, value) {
    if (value === "__keep__") return delete patch[field];
    if (value === "__null__") return patch[field] = null;
    if (value === "true") return patch[field] = true;
    if (value === "false") return patch[field] = false;
    patch[field] = value;
  }

  function applyLandOverrides(base, ov) {
    return base.map((s) => {
      const patch = (ov.land_space_overrides || {})[s.name];
      if (!patch) return Object.assign({}, s);
      const out = Object.assign({}, s);
      Object.keys(patch).forEach((k) => { if (k !== "notes") out[k] = patch[k]; });
      return out;
    });
  }

  function applyEdgeOverrides(base, ov) {
    const map = new Map();
    base.forEach((e) => { const [a, b] = canon(e.a, e.b); map.set(edgeKey(a, b), Object.assign({}, e, { a, b })); });
    (ov.topology_overrides.remove_land_edges || []).forEach((x) => map.delete(edgeKey(x[0], x[1])));
    (ov.topology_overrides.add_land_edges || []).forEach((e) => { const [a, b] = canon(e.a, e.b); map.set(edgeKey(a, b), Object.assign({}, e, { a, b })); });
    return Array.from(map.values()).sort((m, n) => (m.a + m.b).localeCompare(n.a + n.b));
  }

  function nodeVisible(space, s) {
    if (!s.selectedControllers.has(safeController(space.initial_controller_1517))) return false;
    if (!s.selectedLanguages.has(safeLanguage(space.language_zone_inferred))) return false;
    if (s.onlyPorts && space.is_port !== true) return false;
    if (s.search && !space.name.toLowerCase().includes(s.search.toLowerCase())) return false;
    return true;
  }

  function edgeVisible(edge, visible, s) {
    if (!visible.has(edge.a) || !visible.has(edge.b)) return false;
    const t = getEdgeType(edge);
    if (t === "pass" && !s.showPass) return false;
    if (t !== "pass" && !s.showConnection) return false;
    return true;
  }

  function isManualEdge(edge) {
    return edge.method === "manual_ui" || edge.method === "manual_review_csv" || edge.method === "manual_override";
  }

  function getEdgeType(edge) {
    const note = String((edge && edge.notes) || "").toLowerCase();
    const ctype = String((edge && edge.connection_type) || "").toLowerCase();
    if (ctype === "pass" || note.includes("pass")) return "pass";
    return "connection";
  }

  function canon(a, b) { return a <= b ? [a, b] : [b, a]; }
  function edgeKey(a, b) { const [x, y] = canon(String(a), String(b)); return `${x}||${y}`; }
  function safeController(v) { return (v === null || v === undefined || v === "") ? "unknown" : String(v); }
  function safeLanguage(v) { return (v === null || v === undefined || v === "") ? "unknown" : String(v); }
  function svg(tag) { return document.createElementNS("http://www.w3.org/2000/svg", tag); }
  function setSelection(ui, title, obj) { ui.selectionTitle.textContent = title; ui.selectionDetail.textContent = JSON.stringify(obj, null, 2); }
  function setStatus(ui, text) { ui.status.textContent = text || ""; }
  function fillSelect(el, options) { el.innerHTML = ""; options.forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; el.appendChild(o); }); }
  function makeFilterCheckbox(value, setRef, rerender) {
    const wrap = document.createElement("label"); wrap.className = "line";
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = setRef.has(value);
    cb.onchange = () => { if (cb.checked) setRef.add(value); else setRef.delete(value); rerender(); };
    wrap.appendChild(cb); wrap.appendChild(document.createTextNode(" " + value)); return wrap;
  }

  function populateSpaceInputs(ui, land) {
    ui.edgeSpaceList.innerHTML = "";
    const names = Array.from(new Set((land || []).map((s) => s.name))).sort((a, b) => a.localeCompare(b));
    names.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      ui.edgeSpaceList.appendChild(opt);
    });
  }

  function resolveSpaceName(input) {
    const raw = String(input || "").trim();
    if (!raw) return null;
    const exact = LAND_BASE.find((s) => s.name === raw);
    if (exact) return exact.name;
    const lower = raw.toLowerCase();
    const byLower = LAND_BASE.find((s) => String(s.name).toLowerCase() === lower);
    if (byLower) return byLower.name;
    return null;
  }

  function normalizeOverrides(raw) {
    const out = (raw && typeof raw === "object") ? JSON.parse(JSON.stringify(raw)) : {};
    out.land_space_overrides = out.land_space_overrides || {};
    out.topology_overrides = out.topology_overrides || {};
    out.topology_overrides.remove_land_edges = out.topology_overrides.remove_land_edges || [];
    out.topology_overrides.add_land_edges = out.topology_overrides.add_land_edges || [];
    return out;
  }

  function loadLocalOrBase() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeOverrides(BASE_OVERRIDES);
    try { return normalizeOverrides(JSON.parse(raw)); }
    catch (_e) { return normalizeOverrides(BASE_OVERRIDES); }
  }

  function saveLocal(obj) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeOverrides(obj)));
  }

  function tokenForSelect(value) {
    if (value === undefined) return "__keep__";
    if (value === null) return "__null__";
    if (value === true) return "true";
    if (value === false) return "false";
    if (String(value).toLowerCase() === "unknown") return "__null__";
    return String(value);
  }
})();
