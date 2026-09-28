(function () {
  var THREE = window.THREE;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- cotes du projet (cm) ----------
  var DW = 37.2, DH = 241, TH = 1.9, UNIT = 75, GAP = 0.2, X0 = 1.9, TOT = 153.8, DEP = 61.9, CEIL = 250;
  var DOOR_Y = 7;
  var HINGES = [5.5, 92.1, 156, 223.4];

  var PAINTS = [
    { id: 'brut', name: 'MDF brut', c: '#c9a87c', f: '#dcc29c' },
    { id: 'blanc', name: 'Blanc cassé', c: '#e8e5de', f: '#f1efe9' },
    { id: 'sauge', name: 'Vert sauge', c: '#8a9c85', f: '#9aab95' },
    { id: 'bleu', name: 'Bleu nuit', c: '#33475f', f: '#41576f' },
    { id: 'prune', name: 'Prune', c: '#6a3b55', f: '#7a4a64' }
  ];

  var INFO = {
    P: function (n) { return { name: 'Porte ' + n, lines: ['MDF 19 mm', '241 × 37,2 cm', '4 perçages charnière Ø35'] }; },
    C: function (n) { return { name: "Cadre d'alcôve " + n, lines: ['MDF 5 mm collé sur la porte', '241 × 37,2 cm', "arche R 27,2 cm, creux de 5 mm"] }; },
    H: function (n) { return { name: 'Poignée ' + n, lines: ['Bois massif', '50 × 3 × 3 cm', 'évidement 42 × 2 cm au dos'] }; },
    LG: { name: 'Habillage gauche', lines: ['MDF 19 mm', '248 × 10 cm', 'profondeur 10 cm en façade'] },
    LD: { name: 'Habillage droit', lines: ['MDF 19 mm', '249 / 248,7 × 61,9 cm', 'encoche plinthe 10,2 × 1,2 cm'] },
    PB: { name: 'Planche du bas', lines: ['MDF 16 mm', '150 × 7 à 8 cm', 'le sol descend vers la droite'] },
    CUP: { name: 'Charnière à cuvette', lines: ['Ø 35 mm', 'porte en applique', '4 par porte, 16 au total'] },
    CAR: { name: 'Caisson IKEA (schéma)', lines: ['2 caissons de 75 cm', 'existants, non fournis'] }
  };

  // ---------- scène ----------
  var stage = document.getElementById('stage');
  var canvas = document.getElementById('view');
  var DPR0 = Math.min(window.devicePixelRatio || 1, 1.5);
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: DPR0 < 1.5, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR0);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  var dirty = 3, shadowDirty = true;
  function invalidate(sh) { dirty = 2; if (sh) shadowDirty = true; }

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 5, 3000);
  var controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.95;
  controls.minDistance = 80;
  controls.maxDistance = 1200;
  controls.autoRotateSpeed = 1.2;

  var VIEWS = {
    face: { p: [77, 126, 560], t: [77, 124, -25] },
    iso: { p: [290, 200, 470], t: [77, 122, -25] },
    side: { p: [560, 130, -20], t: [77, 124, -25] },
    top: { p: [77, 620, 40], t: [77, 124, -25] }
  };
  function setView(v) { camera.position.set(v.p[0], v.p[1], v.p[2]); controls.target.set(v.t[0], v.t[1], v.t[2]); }
  setView(VIEWS.iso);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xaab3bb, 0.62));
  var sun = new THREE.DirectionalLight(0xffffff, 0.5);
  sun.position.set(230, 400, 320);
  sun.target.position.set(77, 120, -30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0006;
  var sc = sun.shadow.camera;
  sc.left = -330; sc.right = 330; sc.top = 330; sc.bottom = -330; sc.near = 50; sc.far = 1200;
  scene.add(sun);
  scene.add(sun.target);

  // ---------- registre des objets affichables ----------
  var items = [];
  var pickables = [];
  var edgeLines = [];
  var paintTargets = [];
  var doorGroups = [];
  var edgeMat = new THREE.LineBasicMaterial({ color: 0x2a3038 });
  var accent = new THREE.Color('#d9531a');

  function reg(obj, cat, door) { items.push({ obj: obj, cat: cat, door: door === undefined ? null : door }); }

  function edged(mesh, thr) {
    var e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, thr || 25), edgeMat);
    mesh.add(e);
    edgeLines.push(e);
  }
  function pick(mesh, ref, info) {
    mesh.userData.ref = ref;
    mesh.userData.info = info;
    pickables.push(mesh);
  }
  function stdMat(color, rough) {
    return new THREE.MeshLambertMaterial({
      color: color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
  }
  function paintMesh(geo, kind) {
    var m = new THREE.Mesh(geo, stdMat(PAINTS[0].c));
    m.castShadow = true; m.receiveShadow = true;
    paintTargets.push({ mesh: m, kind: kind });
    return m;
  }
  function extrude(shape, depth) {
    return new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false, curveSegments: 24 });
  }

  // ---------- pièces ----------
  function frameShape() {
    var s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(DW, 0);
    s.lineTo(DW, 10);
    s.lineTo(10, 10);
    s.lineTo(10, 203.8);
    s.absarc(DW, 203.8, 27.2, Math.PI, Math.PI / 2, true);
    s.lineTo(DW, DH);
    s.lineTo(0, DH);
    s.lineTo(0, 0);
    return s;
  }
  function handleShape(withNotch) {
    var r = 2.8, ri = 0.9, s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(3 - r, 0);
    s.absarc(3 - r, r, r, -Math.PI / 2, 0, false);
    if (withNotch) {
      s.lineTo(3, 4);
      s.lineTo(1 + ri, 4);
      s.absarc(1 + ri, 4 + ri, ri, -Math.PI / 2, -Math.PI, true);
      s.lineTo(1, 46 - ri);
      s.absarc(1 + ri, 46 - ri, ri, Math.PI, Math.PI / 2, true);
      s.lineTo(3, 46);
    }
    s.lineTo(3, 50 - r);
    s.absarc(3 - r, 50 - r, r, 0, Math.PI / 2, false);
    s.lineTo(0, 50);
    s.lineTo(0, 0);
    return s;
  }
  var woodMats = [];
  function woodMesh(geo) {
    var m = new THREE.Mesh(geo, stdMat('#b78c56', 0.55));
    m.castShadow = true; m.receiveShadow = true;
    woodMats.push(m.material);
    return m;
  }

  var CUP_GEO = new THREE.CylinderGeometry(1.75, 1.75, 1.6, 20); CUP_GEO.rotateX(Math.PI / 2);
  var CUP_MAT = stdMat('#8b949c');
  function makeDoor(i, hingeX, mirror) {
    var n = i + 1;
    var g = new THREE.Group();
    g.position.set(hingeX, DOOR_Y, -0.5);
    if (mirror) g.scale.x = -1;
    g.userData.sign = mirror ? 1 : -1;
    g.userData.baseX = hingeX;

    var door = paintMesh(new THREE.BoxGeometry(DW, DH, TH), 'door');
    door.position.set(DW / 2, DH / 2, -TH / 2);
    pick(door, 'P' + n, INFO.P(n));
    edged(door);
    g.add(door); reg(door, 'doors', i);

    var frame = paintMesh(extrude(frameShape(), 0.5), 'frame');
    frame.position.z = 0;
    pick(frame, 'C' + n, INFO.C(n));
    edged(frame);
    g.add(frame); reg(frame, 'frames', i);

    var hg = new THREE.Group();
    var rearGeo = extrude(handleShape(true), 2); rearGeo.scale(-1, 1, 1);
    var plateGeo = extrude(handleShape(false), 1); plateGeo.scale(-1, 1, 1);
    var rear = woodMesh(rearGeo);
    var plate = woodMesh(plateGeo); plate.position.z = 2;
    [rear, plate].forEach(function (m) { pick(m, 'H' + n, INFO.H(n)); edged(m, 30); hg.add(m); });
    hg.position.set(DW - 0.1, 88, 0);
    g.add(hg); reg(hg, 'handles', i);

    var cups = new THREE.Group();
    HINGES.forEach(function (h) {
      var cm = new THREE.Mesh(CUP_GEO, CUP_MAT);
      cm.position.set(2.2, h, -TH);
      cm.castShadow = true;
      pick(cm, 'CUP', INFO.CUP);
      cups.add(cm);
    });
    g.add(cups); reg(cups, 'cups', i);

    g.userData.parts = { frame: frame, handle: hg, cups: cups };
    scene.add(g);
    doorGroups.push(g);
  }
  for (var u = 0; u < 2; u++) {
    var bx = X0 + u * UNIT;
    makeDoor(u * 2, bx + GAP, false);
    makeDoor(u * 2 + 1, bx + GAP + DW + GAP + DW, true);
  }

  // habillage gauche
  var lg = paintMesh(new THREE.BoxGeometry(TH, 248, 10), 'side');
  lg.position.set(TH / 2, 124, -5);
  pick(lg, 'LG', INFO.LG); edged(lg);
  scene.add(lg); reg(lg, 'lg');

  // habillage droit : profil vu de côté, extrudé sur 1,9 cm
  var ls = new THREE.Shape();
  ls.moveTo(0, -1);
  ls.lineTo(DEP - 1.2, -0.7);
  ls.lineTo(DEP - 1.2, 9.5);
  ls.lineTo(DEP, 9.5);
  ls.lineTo(DEP, 248);
  ls.lineTo(0, 248);
  ls.lineTo(0, -1);
  var ldGeo = extrude(ls, TH);
  ldGeo.rotateY(Math.PI / 2);
  var ld = paintMesh(ldGeo, 'side');
  ld.position.set(X0 + 150, 0, 0);
  pick(ld, 'LD', INFO.LD); edged(ld);
  scene.add(ld); reg(ld, 'ld');

  // planche du bas : trapèze 7 cm à gauche, 8 cm à droite
  var ps = new THREE.Shape();
  ps.moveTo(0, 0); ps.lineTo(150, -1); ps.lineTo(150, 7); ps.lineTo(0, 7); ps.lineTo(0, 0);
  var pb = paintMesh(extrude(ps, 1.6), 'side');
  pb.position.set(X0, 0, -2.1);
  pick(pb, 'PB', INFO.PB); edged(pb);
  scene.add(pb); reg(pb, 'pb');

  // caissons IKEA (schéma)
  var carGroup = new THREE.Group();
  for (var k = 0; k < 2; k++) {
    var cGeo = new THREE.BoxGeometry(UNIT, 236, 59.4);
    var car = new THREE.Mesh(cGeo, new THREE.MeshStandardMaterial({ color: '#7f92a6', transparent: true, opacity: 0.16, roughness: 1, depthWrite: false, side: THREE.DoubleSide }));
    car.position.set(X0 + UNIT / 2 + k * UNIT, 118, -2.5 - 59.4 / 2);
    pick(car, 'CAR', INFO.CAR);
    var ce = new THREE.LineSegments(new THREE.EdgesGeometry(cGeo), new THREE.LineBasicMaterial({ color: '#7f92a6' }));
    car.add(ce);
    carGroup.add(car);
  }
  scene.add(carGroup); reg(carGroup, 'carcass');

  // pièce : mur du fond, mur qui revient à gauche, parquet, plafond, plinthes
  var room = new THREE.Group();
  var wallMat = new THREE.MeshLambertMaterial({ color: '#dde2e6' });
  var floorMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  var ceilMat = new THREE.MeshBasicMaterial({ color: '#eef1f3' });
  var baseMat = new THREE.MeshLambertMaterial({ color: '#f2f2f0' });
  var SPUR = 140;                        // longueur du retour de mur devant le fond
  var wall = new THREE.Mesh(new THREE.PlaneGeometry(700, 420), wallMat);
  wall.position.set(77, 160, -DEP);
  wall.receiveShadow = true;
  room.add(wall);

  // parquet en lames (texture procédurale, une seule image qui se répète)
  function parquetTexture() {
    var S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
    var g = cv.getContext('2d'), seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var rows = 8, rh = S / rows;
    function plank(x0, x1, y, col) {
      function draw(a, b) {
        g.fillStyle = col; g.fillRect(a, y, b - a, rh);
        for (var k = 0; k < 9; k++) {
          var gy = y + 6 + rnd() * (rh - 12);
          g.strokeStyle = 'rgba(70,40,15,' + (0.05 + rnd() * 0.09).toFixed(3) + ')';
          g.lineWidth = 1 + rnd() * 1.5;
          g.beginPath(); g.moveTo(a, gy); g.bezierCurveTo(a + (b - a) * 0.3, gy + (rnd() - 0.5) * 8, a + (b - a) * 0.7, gy + (rnd() - 0.5) * 8, b, gy); g.stroke();
        }
        g.fillStyle = 'rgba(35,20,8,0.5)'; g.fillRect(a, y + rh - 2, b - a, 2);
        g.fillRect(a, y, 2, rh);
      }
      if (x1 > S) { draw(x0, S); draw(0, x1 - S); } else draw(x0, x1);
    }
    for (var r = 0; r < rows; r++) {
      var b1 = rnd() * S, len1 = S * (0.35 + rnd() * 0.3);
      var tone = function () { return 'hsl(' + (28 + rnd() * 6).toFixed(1) + ',' + (42 + rnd() * 10).toFixed(0) + '%,' + (50 + rnd() * 12).toFixed(0) + '%)'; };
      plank(b1, b1 + len1, r * rh, tone());
      plank(b1 + len1, b1 + S, r * rh, tone());
    }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(700 / 96, 500 / 96);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  floorMat.map = parquetTexture();
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(700, 500), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(77, -1.05, 190 - DEP);
  floor.receiveShadow = true;
  room.add(floor);

  var ceil = new THREE.Mesh(new THREE.PlaneGeometry(700, 500), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(77, CEIL, 190 - DEP);
  room.add(ceil);

  // mur qui revient à gauche du meuble (épaisseur 10 cm, face à x = 0)
  var spur = new THREE.Mesh(new THREE.BoxGeometry(10, CEIL + 1.05, SPUR + DEP), wallMat);
  spur.position.set(-5, (CEIL - 1.05) / 2, (SPUR - DEP) / 2);
  spur.castShadow = true; spur.receiveShadow = true;
  room.add(spur);

  // plinthes : fond, et retour de mur (de part et d'autre de l'habillage gauche)
  function baseboard(len, x, z, rotY) {
    var b = new THREE.Mesh(new THREE.BoxGeometry(len, 10.2, 1.2), baseMat);
    b.position.set(x, 4.1, z); b.rotation.y = rotY || 0; b.receiveShadow = true; room.add(b);
  }
  baseboard(700, 77, -DEP + 0.6);
  baseboard(SPUR, 0.6, SPUR / 2, Math.PI / 2);
  scene.add(room); reg(room, 'room');

  // cotes principales
  var dims = new THREE.Group();
  function label(text) {
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 72;
    var x = cv.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,0.94)';
    x.beginPath();
    if (x.roundRect) x.roundRect(4, 4, 248, 64, 14); else x.rect(4, 4, 248, 64);
    x.fill();
    x.strokeStyle = '#d9531a'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#1b2229'; x.font = '500 34px "IBM Plex Mono", ui-monospace, monospace';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 128, 38);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
    sp.scale.set(30, 8.4, 1);
    sp.renderOrder = 1000;
    return sp;
  }
  function dim(a, b, tick, text) {
    var lm = new THREE.LineBasicMaterial({ color: 0xd9531a, depthTest: false, transparent: true });
    function line(p, q) {
      var l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p[0], p[1], p[2]), new THREE.Vector3(q[0], q[1], q[2])]), lm);
      l.renderOrder = 999; dims.add(l);
    }
    line(a, b);
    line([a[0] - tick[0], a[1] - tick[1], a[2] - tick[2]], [a[0] + tick[0], a[1] + tick[1], a[2] + tick[2]]);
    line([b[0] - tick[0], b[1] - tick[1], b[2] - tick[2]], [b[0] + tick[0], b[1] + tick[1], b[2] + tick[2]]);
    var s = label(text);
    s.position.set((a[0] + b[0]) / 2 + tick[0] * 2.2, (a[1] + b[1]) / 2 + tick[1] * 2.2, (a[2] + b[2]) / 2 + tick[2] * 2.2);
    dims.add(s);
  }
  dim([0, 0.4, 16], [TOT, 0.4, 16], [0, 0, 4], '153,8');
  dim([-16, 0, 0], [-16, 248, 0], [4, 0, 0], '248');
  dim([TOT + 14, 0.4, 0], [TOT + 14, 0.4, -DEP], [4, 0, 0], '61,9');
  dim([X0 + GAP, 260, 0], [X0 + GAP + DW, 260, 0], [0, 4, 0], '37,2');
  scene.add(dims); reg(dims, 'dims');

  // ---------- état ----------
  var state = {
    doors: true, frames: true, handles: true, lg: true, ld: true, pb: true,
    cups: false, carcass: false, room: true, dims: false, edges: true,
    door: [true, true, true, true]
  };
  function isVisibleChain(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
  function refresh() {
    items.forEach(function (it) { it.obj.visible = !!state[it.cat] && (it.door === null || state.door[it.door]); });
    edgeLines.forEach(function (e) { e.visible = state.edges; });
    invalidate(true);
  }

  function setPaint(p) {
    var c = new THREE.Color(p.c), f = new THREE.Color(p.f);
    paintTargets.forEach(function (t) { t.mesh.material.color.copy(t.kind === 'frame' ? f : c); });
    document.getElementById('paintname').textContent = p.name; invalidate();
    Array.prototype.forEach.call(document.querySelectorAll('.sw'), function (b) { b.setAttribute('aria-pressed', b.dataset.id === p.id ? 'true' : 'false'); });
  }

  // ---------- thème ----------
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function applyTheme() {
    wallMat.color.set(css('--wall'));
    floorMat.color.set(css('--floor'));
    ceilMat.color.set(css('--ceil'));
    edgeMat.color.set(css('--edge'));
    accent.set(css('--accent'));
    invalidate();
  }
  applyTheme();
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', applyTheme);
  }
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------- interface ----------
  function addSwitch(host, id, text, code, checked) {
    var l = document.createElement('label'); l.className = 'row';
    var i = document.createElement('input'); i.type = 'checkbox'; i.id = 'sw-' + id; i.checked = checked;
    var s = document.createElement('span'); s.className = 'lbl'; s.textContent = text;
    l.appendChild(i); l.appendChild(s);
    if (code) { var c = document.createElement('span'); c.className = 'code'; c.textContent = code; l.appendChild(c); }
    i.addEventListener('change', function () { state[id] = i.checked; refresh(); });
    host.appendChild(l);
  }
  var gp = document.getElementById('g-parts');
  addSwitch(gp, 'doors', 'Portes', 'P1–P4', true);
  addSwitch(gp, 'frames', "Cadres d'alcôve 5 mm", 'C1–C4', true);
  addSwitch(gp, 'handles', 'Poignées', 'H1–H4', true);
  addSwitch(gp, 'lg', 'Habillage gauche', 'LG', true);
  addSwitch(gp, 'ld', 'Habillage droit', 'LD', true);
  addSwitch(gp, 'pb', 'Planche du bas', 'PB', true);
  var ga = document.getElementById('g-around');
  addSwitch(ga, 'cups', 'Charnières Ø35', '×16', false);
  addSwitch(ga, 'carcass', 'Caissons IKEA (schéma)', '', false);
  addSwitch(ga, 'room', 'Mur, sol, plafond', '', true);
  var gd = document.getElementById('g-display');
  addSwitch(gd, 'edges', 'Traits de contour', '', true);
  addSwitch(gd, 'dims', 'Cotes principales', '', false);

  var chips = document.getElementById('door-chips');
  ['P1', 'P2', 'P3', 'P4'].forEach(function (n, i) {
    var b = document.createElement('button'); b.className = 'chip'; b.textContent = n;
    b.setAttribute('aria-pressed', 'true'); b.title = 'Afficher ou masquer ' + n;
    b.addEventListener('click', function () {
      state.door[i] = !state.door[i];
      b.setAttribute('aria-pressed', state.door[i] ? 'true' : 'false');
      refresh();
    });
    chips.appendChild(b);
  });

  var sw = document.getElementById('swatches');
  PAINTS.forEach(function (p) {
    var b = document.createElement('button'); b.className = 'sw'; b.dataset.id = p.id;
    b.style.background = p.c; b.title = p.name; b.setAttribute('aria-label', p.name);
    b.addEventListener('click', function () { setPaint(p); });
    sw.appendChild(b);
  });

  // portes : angle demandé, limité par les butées (mur, portes voisines, poignées)
  var MAXDEG = 105;
  var openDeg = 0, doorCur = [0, 0, 0, 0], doorStart = [0, 0, 0, 0], limits = [MAXDEG, MAXDEG, MAXDEG, MAXDEG], why = ['', '', '', ''];
  var btnOpen = document.getElementById('btn-open');
  var slOpen = document.getElementById('openang'), outOpen = document.getElementById('openang-out'), stopNote = document.getElementById('stopnote');

  function footprints(g) {
    g.updateMatrixWorld(true);
    var rects = [[0, DW, -TH, 0], [1, DW, 0, 0.5], [DW - 3.1, DW - 0.1, 0, 3]];
    return rects.map(function (r) {
      return [[r[0], r[2]], [r[1], r[2]], [r[1], r[3]], [r[0], r[3]]].map(function (q) {
        var v = g.localToWorld(new THREE.Vector3(q[0], 0, q[1])); return [v.x, v.z];
      });
    });
  }
  function sat(A, B) {
    var P = [A, B];
    for (var p = 0; p < 2; p++) for (var i = 0; i < P[p].length; i++) {
      var Q = P[p], j = (i + 1) % Q.length, nx = Q[j][1] - Q[i][1], nz = Q[i][0] - Q[j][0];
      var a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9, d;
      A.forEach(function (q) { d = q[0] * nx + q[1] * nz; if (d < a0) a0 = d; if (d > a1) a1 = d; });
      B.forEach(function (q) { d = q[0] * nx + q[1] * nz; if (d < b0) b0 = d; if (d > b1) b1 = d; });
      if (a1 <= b0 || b1 <= a0) return false;
    }
    return true;
  }
  var WALL_POLY = [[-10, -DEP], [0, -DEP], [0, SPUR], [-10, SPUR]];
  function hitAt(i, deg) {
    doorGroups.forEach(function (g) { g.rotation.y = g.userData.sign * deg * Math.PI / 180; });
    var mine = footprints(doorGroups[i]), k, a, b;
    for (a = 0; a < mine.length; a++) if (sat(mine[a], WALL_POLY)) return 'le mur';
    for (k = 0; k < 4; k++) if (k !== i) {
      var o = footprints(doorGroups[k]);
      for (a = 0; a < mine.length; a++) for (b = 0; b < o.length; b++) if (sat(mine[a], o[b])) return 'P' + (k + 1);
    }
    return '';
  }
  (function computeLimits() {
    for (var i = 0; i < 4; i++) {
      var lim = MAXDEG, w = '';
      for (var d = 0; d <= MAXDEG; d += 0.25) {
        var h = hitAt(i, d);
        if (h) { lim = Math.max(0, d - 0.75); w = h; break; }
      }
      limits[i] = lim; why[i] = w;
    }
    // vérification de la configuration finale (chaque porte à sa butée)
    function finalHit() {
      doorGroups.forEach(function (g, n) { g.rotation.y = g.userData.sign * limits[n] * Math.PI / 180; });
      var F = doorGroups.map(footprints);
      for (var m = 0; m < 4; m++) for (var n = m + 1; n < 4; n++)
        for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) if (sat(F[m][a], F[n][b])) return [m, n];
      return null;
    }
    var fh, guard = 0;
    while ((fh = finalHit()) && guard++ < 200) {
      var big = limits[fh[0]] >= limits[fh[1]] ? fh[0] : fh[1];
      limits[big] = Math.max(0, limits[big] - 0.5); why[big] = 'P' + ((big === fh[0] ? fh[1] : fh[0]) + 1);
    }
    doorGroups.forEach(function (g) { g.rotation.y = 0; g.updateMatrixWorld(true); });
  })();
  window.__limits = limits;

  function targetOf(i) { return Math.min(openDeg, limits[i]) * Math.PI / 180; }
  function updateNote() {
    outOpen.textContent = openDeg + '°';
    var parts = [];
    for (var i = 0; i < 4; i++) if (openDeg > limits[i] + 0.01) parts.push('P' + (i + 1) + ' bloquée à ' + Math.round(limits[i]) + '° (' + (why[i] === 'le mur' ? 'mur' : 'contre ' + why[i]) + ')');
    stopNote.hidden = !parts.length;
    stopNote.textContent = parts.join(' · ');
  }
  function setOpen(deg, stagger) {
    openDeg = deg; slOpen.value = deg;
    btnOpen.setAttribute('aria-pressed', deg > 0 ? 'true' : 'false');
    btnOpen.textContent = deg > 0 ? 'Fermer les portes' : 'Ouvrir les portes';
    var now = performance.now(), delays = [0, 110, 110, 220];
    for (var i = 0; i < 4; i++) doorStart[i] = now + (reduce || !stagger ? 0 : delays[i]);
    if (reduce) for (var j = 0; j < 4; j++) doorCur[j] = targetOf(j);
    updateNote(); invalidate(true);
  }
  btnOpen.addEventListener('click', function () { setOpen(openDeg > 0 ? 0 : MAXDEG, true); });
  slOpen.addEventListener('input', function () { setOpen(+slOpen.value, false); });

  // éclaté
  var explodeTarget = 0, explodeCur = 0;
  var exSlider = document.getElementById('explode'), exOut = document.getElementById('explode-out');
  exSlider.addEventListener('input', function () {
    explodeTarget = exSlider.value / 100; invalidate(true);
    exOut.textContent = exSlider.value + ' %';
    if (reduce) explodeCur = explodeTarget;
  });
  var SPREAD = [-9, -3, 3, 9];
  function applyExplode(t) {
    doorGroups.forEach(function (g, i) {
      g.position.x = g.userData.baseX + SPREAD[i] * t;
      g.userData.parts.frame.position.z = 16 * t;
      g.userData.parts.handle.position.z = 44 * t;
      g.userData.parts.cups.position.z = -18 * t;
    });
    lg.position.x = TH / 2 - 42 * t;
    ld.position.x = X0 + 150 + 42 * t;
    pb.position.y = -26 * t;
    carGroup.position.z = -34 * t;
  }

  document.getElementById('spin').addEventListener('change', function (e) { controls.autoRotate = e.target.checked && !reduce; invalidate(); });

  // vues
  var tween = null;
  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
    b.addEventListener('click', function () {
      var v = VIEWS[b.dataset.view];
      if (reduce) { setView(v); controls.update(); return; }
      tween = {
        t0: performance.now(), dur: 800,
        fp: camera.position.clone(), ft: controls.target.clone(),
        tp: new THREE.Vector3(v.p[0], v.p[1], v.p[2]), tt: new THREE.Vector3(v.t[0], v.t[1], v.t[2])
      };
    });
  });
  canvas.addEventListener('pointerdown', function () { tween = null; });

  // survol et sélection
  var card = document.getElementById('card');
  var ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  var hovered = null, selected = null, downAt = null;
  function showCard(m) {
    if (!m) { card.innerHTML = '<p class="idle">Survolez ou touchez une pièce pour voir son repère et ses dimensions.</p>'; return; }
    var info = m.userData.info;
    card.innerHTML = '';
    var top = document.createElement('div');
    var r = document.createElement('span'); r.className = 'ref'; r.textContent = m.userData.ref;
    var n = document.createElement('span'); n.className = 'name'; n.textContent = info.name;
    top.appendChild(r); top.appendChild(n);
    var ul = document.createElement('ul');
    info.lines.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    card.appendChild(top); card.appendChild(ul);
  }
  showCard(null);
  function setGlow(m, on) {
    if (!m || !m.material || !m.material.emissive) return;
    if (on) m.material.emissive.copy(accent).multiplyScalar(0.32); else m.material.emissive.setRGB(0, 0, 0);
    invalidate();
  }
  function hit(ev) {
    var rc = canvas.getBoundingClientRect();
    mouse.x = ((ev.clientX - rc.left) / rc.width) * 2 - 1;
    mouse.y = -((ev.clientY - rc.top) / rc.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    var res = ray.intersectObjects(pickables, false);
    for (var i = 0; i < res.length; i++) if (isVisibleChain(res[i].object)) return res[i].object;
    return null;
  }
  function focusOn(m) {
    if (hovered !== m) { setGlow(hovered, false); hovered = m; setGlow(hovered, true); }
    showCard(m || selected);
  }
  var pendMove = null;
  canvas.addEventListener('pointermove', function (ev) { if (ev.buttons) return; pendMove = { clientX: ev.clientX, clientY: ev.clientY }; });
  canvas.addEventListener('pointerleave', function () { setGlow(hovered, false); hovered = null; showCard(selected); });
  canvas.addEventListener('pointerdown', function (ev) { downAt = { x: ev.clientX, y: ev.clientY }; });
  canvas.addEventListener('pointerup', function (ev) {
    if (!downAt) return;
    var moved = Math.abs(ev.clientX - downAt.x) + Math.abs(ev.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return;
    var m = hit(ev);
    setGlow(selected, false);
    selected = m;
    if (m) { setGlow(m, true); }
    hovered = m;
    showCard(m);
  });

  // taille
  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 44 : 32;
    camera.updateProjectionMatrix();
    invalidate();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  resize();

  // boucle
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  var last = performance.now();
  var slowN = 0, fastN = 0, dprNow = DPR0;
  function settle(cur, tgt) { return Math.abs(tgt - cur) < 0.0004; }
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var moving = false, i;
    for (i = 0; i < 4; i++) {
      var tg = targetOf(i);
      if (!settle(doorCur[i], tg) && now >= doorStart[i]) {
        doorCur[i] = reduce ? tg : doorCur[i] + (tg - doorCur[i]) * (1 - Math.exp(-dt * 5));
        if (settle(doorCur[i], tg)) doorCur[i] = tg;
        moving = true;
      } else if (!settle(doorCur[i], tg)) moving = true;
    }
    for (i = 0; i < 4; i++) doorGroups[i].rotation.y = doorGroups[i].userData.sign * doorCur[i];
    if (!settle(explodeCur, explodeTarget)) {
      explodeCur = reduce ? explodeTarget : explodeCur + (explodeTarget - explodeCur) * (1 - Math.exp(-dt * 8));
      if (settle(explodeCur, explodeTarget)) explodeCur = explodeTarget;
      applyExplode(explodeCur); moving = true;
    }
    if (tween) {
      var k = Math.min(1, (now - tween.t0) / tween.dur), e = ease(k);
      camera.position.lerpVectors(tween.fp, tween.tp, e);
      controls.target.lerpVectors(tween.ft, tween.tt, e);
      if (k >= 1) tween = null;
      moving = true;
    }
    if (pendMove) { var pm = pendMove; pendMove = null; focusOn(hit(pm)); }
    var cam = controls.update();
    if (moving) { dirty = 2; shadowDirty = true; }
    if (cam || controls.autoRotate) dirty = Math.max(dirty, 1);
    if (dirty <= 0) return;
    dirty--;
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    var t0 = performance.now();
    renderer.render(scene, camera);
    // qualité adaptative : si le rendu est lent, on baisse la résolution
    var ms = performance.now() - t0;
    if (dirty > 0 || cam || moving) {
      if (ms > 22) { slowN++; fastN = 0; } else { fastN++; slowN = 0; }
      if (slowN > 12 && dprNow > 1) { dprNow = 1; renderer.setPixelRatio(1); resize(); slowN = 0; }
    }
  }

  setPaint(PAINTS[1]);
  refresh();
  window.__dressing = { state: state, refresh: refresh, camera: camera, scene: scene, setOpen: setOpen, limits: limits, why: why };
  controls.addEventListener('change', function () { invalidate(); });
  requestAnimationFrame(tick);
})();
