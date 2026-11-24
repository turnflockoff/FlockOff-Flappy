(function (global) {
  "use strict";

  /* ================= 5x7 PIXEL FONT ================= */
  var FONT = {
    A:["01110","10001","10001","11111","10001","10001","10001"],
    B:["11110","10001","10001","11110","10001","10001","11110"],
    C:["01110","10001","10000","10000","10000","10001","01110"],
    D:["11110","10001","10001","10001","10001","10001","11110"],
    E:["11111","10000","10000","11110","10000","10000","11111"],
    F:["11111","10000","10000","11110","10000","10000","10000"],
    G:["01110","10001","10000","10111","10001","10001","01111"],
    H:["10001","10001","10001","11111","10001","10001","10001"],
    I:["11111","00100","00100","00100","00100","00100","11111"],
    J:["00111","00010","00010","00010","00010","10010","01100"],
    K:["10001","10010","10100","11000","10100","10010","10001"],
    L:["10000","10000","10000","10000","10000","10000","11111"],
    M:["10001","11011","10101","10101","10001","10001","10001"],
    N:["10001","11001","10101","10011","10001","10001","10001"],
    O:["01110","10001","10001","10001","10001","10001","01110"],
    P:["11110","10001","10001","11110","10000","10000","10000"],
    Q:["01110","10001","10001","10001","10101","10010","01101"],
    R:["11110","10001","10001","11110","10100","10010","10001"],
    S:["01111","10000","10000","01110","00001","00001","11110"],
    T:["11111","00100","00100","00100","00100","00100","00100"],
    U:["10001","10001","10001","10001","10001","10001","01110"],
    V:["10001","10001","10001","10001","10001","01010","00100"],
    W:["10001","10001","10001","10101","10101","11011","10001"],
    X:["10001","10001","01010","00100","01010","10001","10001"],
    Y:["10001","10001","01010","00100","00100","00100","00100"],
    Z:["11111","00001","00010","00100","01000","10000","11111"],
    "0":["01110","10001","10011","10101","11001","10001","01110"],
    "1":["00100","01100","00100","00100","00100","00100","01110"],
    "2":["01110","10001","00001","00110","01000","10000","11111"],
    "3":["11110","00001","00001","01110","00001","00001","11110"],
    "4":["00010","00110","01010","10010","11111","00010","00010"],
    "5":["11111","10000","11110","00001","00001","10001","01110"],
    "6":["01110","10000","10000","11110","10001","10001","01110"],
    "7":["11111","00001","00010","00100","01000","01000","01000"],
    "8":["01110","10001","10001","01110","10001","10001","01110"],
    "9":["01110","10001","10001","01111","00001","00001","01110"],
    ".":["00000","00000","00000","00000","00000","01100","01100"],
    "!":["00100","00100","00100","00100","00100","00000","00100"],
    "-":["00000","00000","00000","01110","00000","00000","00000"],
    ":":["00000","01100","01100","00000","01100","01100","00000"],
    "/":["00001","00010","00100","00100","01000","10000","00000"],
    " ":["00000","00000","00000","00000","00000","00000","00000"]
  };

  function drawText(g, str, x, y, s, color) {
    g.fillStyle = color;
    str = String(str).toUpperCase();
    for (var i = 0; i < str.length; i++) {
      var gl = FONT[str[i]] || FONT[" "];
      for (var r = 0; r < 7; r++) {
        var row = gl[r];
        for (var c = 0; c < 5; c++) {
          if (row[c] === "1") g.fillRect(x + i * 6 * s + c * s, y + r * s, s, s);
        }
      }
    }
  }
  function textW(str, s) { return String(str).length * 6 * s - s; }

  /* ================= SHARED SPRITES ================= */
  var PAL = {
    K: "#101018", W: "#f4f4f8", w: "#c9cdd9", O: "#ff9020",
    N: "#d89a6a", M: "#4a3428", G: "#040408", E: "#ffffff"
  };

  // dove body, 22x13. E cells = lens interiors (pupils drawn dynamically)
  var DOVE = [
    "...........KKKKKKK....",
    "..........KWWWWWWWK...",
    ".........KGGGGWGGGGK..",
    ".........KGEEGGGEEGK..",
    ".........KGGGGWGGGGK..",
    "....KKKKKKWWWWNNWWWOOO",
    "...KWWWWWWWWMMMMMMWOO.",
    ".KKKWWWWWWWWWWWWWWKK..",
    "KWWWWWWWWWWWWWWWWWK...",
    "KWWwWWWWWWWWWWWWWK....",
    ".KwwWWWWWWWWWWWWK.....",
    "..KKwwwwwwwwwwKK......",
    "....KKKKKKKKKK........"
  ];
  // wing frames: [map, offsetX, offsetY]
  var WING_UP = [[".KKK...","KWWWK..","KWWWWK.",".KWWWWK","..KKKKK"], 3, 2];
  var WING_MID = [["KKKKKK.","KwwwwWK",".KKKKK."], 4, 7];
  var WING_DOWN = [[".KKKKK.","KWwwwK.",".KWwK..","..KK..."], 4, 8];
  var WINGS = [WING_UP, WING_MID, WING_DOWN];

  function paintMap(g, map, x, y, s) {
    for (var r = 0; r < map.length; r++) {
      var row = map[r];
      for (var c = 0; c < row.length; c++) {
        var ch = row[c];
        if (ch !== ".") {
          g.fillStyle = PAL[ch];
          g.fillRect(x + c * s, y + r * s, s, s);
        }
      }
    }
  }

  function makeCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  // 3 dove frames (22x13), no pupils painted (drawn dynamically per-frame)
  function buildDoveFrames() {
    var frames = [];
    for (var f = 0; f < 3; f++) {
      var c = makeCanvas(22, 13);
      var g = c.getContext("2d");
      paintMap(g, DOVE, 0, 0, 1);
      var wf = WINGS[f];
      paintMap(g, wf[0], wf[1], wf[2], 1);
      frames.push(c);
    }
    return frames;
  }
  // lens pupil cells in sprite coords: lensA x 11/12, lensB x 16/17, y=3
  function drawPupils(g, x, y, s, dirA, dirB) {
    g.fillStyle = "#101018";
    g.fillRect(x + (11 + dirA) * s, y + 3 * s, s, s);
    g.fillRect(x + (16 + dirB) * s, y + 3 * s, s, s);
  }

  // FLOUK camera head sprite, 24x14, facing left
  function buildFloukHead() {
    var c = makeCanvas(24, 14);
    var g = c.getContext("2d");
    // solar panel on top
    g.fillStyle = "#101018"; g.fillRect(5, 0, 12, 3);
    g.fillStyle = "#2e4a6e"; g.fillRect(6, 1, 4, 1); g.fillRect(11, 1, 4, 1);
    // housing
    g.fillStyle = "#101018"; g.fillRect(0, 3, 24, 11);
    g.fillStyle = "#b0b4bd"; g.fillRect(1, 4, 22, 9);
    g.fillStyle = "#8a90a0"; g.fillRect(1, 11, 22, 2);
    // black faceplate (left / front)
    g.fillStyle = "#14161c"; g.fillRect(1, 4, 8, 9);
    // red eye
    g.fillStyle = "#c81e1e"; g.fillRect(2, 6, 5, 5);
    g.fillStyle = "#ff5050"; g.fillRect(3, 7, 3, 3);
    g.fillStyle = "#ffb0b0"; g.fillRect(4, 8, 1, 1);
    return c;
  }

  var REDUCED = typeof window !== "undefined" && window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ================= PLAYABLE DEMO ================= */
  function mount(config) {
    config = config || {};
    var gameId = config.gameCanvasId || "game";
    var sndId = config.soundBtnId || "sndBtn";
    var storageKey = config.storageKey || "flocky_bird_best";

    var cv = document.getElementById(gameId);
    if (!cv) return null;
    var ctx = cv.getContext("2d");
    var W = cv.width, H = cv.height, GROUND = H - 16;

    var doveFrames = buildDoveFrames();
    var floukHead = buildFloukHead();

    var best = 0;
    try { best = parseInt(localStorage.getItem(storageKey) || "0", 10) || 0; } catch (e) {}
    function saveBest() {
      try { localStorage.setItem(storageKey, String(best)); } catch (e) {}
    }

    // background: seeded skyline
    function sr(seed) { // tiny deterministic prng
      return function () {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
    }
    var stars = [];
    (function () {
      var rnd = sr(7);
      for (var i = 0; i < 40; i++) stars.push([rnd() * W, rnd() * 90, rnd() < 0.2 ? 2 : 1]);
    })();

    // billboard texture: TURNFLOCKOFF.COM at 1px font
    var billTex = makeCanvas(textW("TURNFLOCKOFF.COM", 1) + 6, 13);
    (function () {
      var g = billTex.getContext("2d");
      g.fillStyle = "#14181f"; g.fillRect(0, 0, billTex.width, billTex.height);
      g.fillStyle = "#0c0f14"; g.fillRect(1, 1, billTex.width - 2, billTex.height - 2);
      drawText(g, "TURNFLOCKOFF.COM", 3, 3, 1, "#b08a2a");
    })();

    function buildingH(layer, i) {
      var rnd = sr(layer * 131 + i * 17 + 3);
      return 26 + Math.floor(rnd() * (layer === 0 ? 34 : 58));
    }

    function drawSkyline(scroll, layer, color, bw, camChance) {
      var speed = layer === 0 ? 0.22 : 0.5;
      var off = (scroll * speed) % bw;
      var n = Math.ceil(W / bw) + 2;
      var base = Math.floor((scroll * speed) / bw);
      var billboards = [];
      for (var i = 0; i < n; i++) {
        var bi = base + i;
        var h = buildingH(layer, bi);
        var x = Math.floor(i * bw - off);
        var y = GROUND - h;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, bw - 3, h);
        var rnd = sr(bi * 977 + layer);
        // lit windows
        if (layer === 1) {
          ctx.fillStyle = "rgba(255,208,64,0.16)";
          for (var wy = y + 5; wy < GROUND - 8; wy += 9) {
            for (var wx = x + 3; wx < x + bw - 8; wx += 7) {
              if (rnd() < 0.3) ctx.fillRect(wx, wy, 2, 3);
            }
          }
          // occasional TURNFLOCKOFF.COM billboard (drawn after all buildings)
          if (bi % 9 === 4 && h > 50) billboards.push([x, y]);
        }
        // tiny decorative rooftop cameras: smaller, darker, never obstacles
        if (rnd() < camChance) {
          ctx.fillStyle = "#1a1d26";
          ctx.fillRect(x + 4, y - 3, 4, 3);
          ctx.fillStyle = "rgba(200,30,30,0.35)";
          ctx.fillRect(x + 4, y - 2, 1, 1);
        }
      }
      for (var b = 0; b < billboards.length; b++) {
        var bx = billboards[b][0], by = billboards[b][1];
        ctx.fillStyle = color;
        ctx.fillRect(bx + Math.floor(bw / 2) - 1, by - 3, 2, 3);
        ctx.globalAlpha = 0.45;
        ctx.drawImage(billTex, bx + 2, by - 15);
        ctx.globalAlpha = 1;
      }
    }

    var state = "attract"; // attract | play | dead
    var bird, obstacles, scroll, score, speed, deadT, feathers, shakeT, hitstopT, flashT, glitchT, deadLock;
    var eyeA = 0, eyeB = 1, eyeNext = 0;

    function reset() {
      bird = { x: 72, y: 90, vy: 0, wing: 1, wingT: 0 };
      obstacles = [];
      scroll = 0; score = 0; speed = 70;
      feathers = [];
      shakeT = 0; hitstopT = 0; flashT = 0; glitchT = 0;
    }
    reset();

    function gapSize() { return Math.max(58, 78 - score * 0.7); }

    function spawn() {
      var lastX = obstacles.length ? obstacles[obstacles.length - 1].x : W + 20;
      while (lastX < W + 60) {
        lastX += 150;
        var gap = gapSize();
        var gy = 34 + Math.random() * (GROUND - 34 - 34 - gap);
        obstacles.push({ x: lastX, gapY: gy, gap: gap, scored: false, flashT: 0, phase: Math.random() * 6.28 });
      }
    }

    /* ---- audio ---- */
    var audioOn = true;
    var actx = null;
    function ac() {
      if (!actx) {
        try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { actx = null; }
      }
      if (actx && actx.state === "suspended") actx.resume();
      return actx;
    }
    function beep(freq1, freq2, dur, type, vol) {
      if (!audioOn) return;
      var a = ac();
      if (!a) return;
      var o = a.createOscillator(), gn = a.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq1, a.currentTime);
      o.frequency.exponentialRampToValueAtTime(freq2, a.currentTime + dur);
      gn.gain.setValueAtTime(vol || 0.06, a.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.connect(gn); gn.connect(a.destination);
      o.start(); o.stop(a.currentTime + dur);
    }
    function noise(dur, vol) {
      if (!audioOn) return;
      var a = ac();
      if (!a) return;
      var len = Math.floor(a.sampleRate * dur);
      var buf = a.createBuffer(1, len, a.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = a.createBufferSource(), gn = a.createGain();
      src.buffer = buf;
      gn.gain.value = vol || 0.12;
      src.connect(gn); gn.connect(a.destination);
      src.start();
    }
    var sndBtn = document.getElementById(sndId);
    if (sndBtn) {
      sndBtn.addEventListener("click", function () {
        audioOn = !audioOn;
        sndBtn.setAttribute("aria-pressed", String(audioOn));
        sndBtn.textContent = audioOn ? "SND ON" : "SND OFF";
      });
    }

    function flap() {
      bird.vy = -215;
      bird.wingT = 0.22;
      beep(520, 880, 0.07, "square", 0.05);
      for (var i = 0; i < 2; i++) {
        feathers.push({ x: bird.x - 8, y: bird.y + 4 + Math.random() * 4, vx: -30 - Math.random() * 25, vy: -10 + Math.random() * 30, life: 0.9 });
      }
    }

    function die() {
      state = "dead";
      deadT = 0;
      deadLock = 0.45;
      hitstopT = 0.12;
      shakeT = 0.34;
      flashT = 0.1;
      glitchT = 0.5;
      noise(0.28, 0.14);
      beep(300, 60, 0.3, "sawtooth", 0.08);
      if (score > best) { best = score; saveBest(); }
    }

    function input() {
      ac();
      if (state === "attract") {
        reset(); spawn(); state = "play"; flap();
      } else if (state === "play") {
        flap();
      } else if (state === "dead" && deadLock <= 0) {
        state = "attract";
        reset();
        draw(0); // fresh attract frame
      }
      ensureLoop();
    }

    cv.addEventListener("pointerdown", function (e) { e.preventDefault(); cv.focus({ preventScroll: true }); input(); });
    cv.addEventListener("keydown", function (e) {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "Enter") { e.preventDefault(); input(); }
      if (e.code === "KeyR" && state === "dead") { e.preventDefault(); deadLock = 0; input(); }
    });

    function update(dt) {
      if (state === "dead") {
        deadT += dt;
        deadLock -= dt;
        if (glitchT > 0) glitchT -= dt;
        if (shakeT > 0) shakeT -= dt;
        if (flashT > 0) flashT -= dt;
        // bird falls to ground
        if (bird.y < GROUND - 10) {
          bird.vy = Math.min(bird.vy + 900 * dt, 400);
          bird.y += bird.vy * dt;
        }
        return;
      }

      var t = performance.now();
      if (t > eyeNext) {
        eyeA = Math.random() < 0.5 ? 0 : 1;
        eyeB = Math.random() < 0.5 ? 0 : 1;
        eyeNext = t + 300 + Math.random() * 800;
      }

      if (state === "attract") {
        scroll += 14 * dt;
        bird.wingT += dt;
        bird.wing = ((Math.floor(bird.wingT * 7) % 3) + 3) % 3;
        bird.y = 90 + Math.sin(t / 400) * 7;
        return;
      }

      // playing
      if (hitstopT > 0) { hitstopT -= dt; return; }
      if (shakeT > 0) shakeT -= dt;
      if (flashT > 0) flashT -= dt;

      speed = Math.min(128, 70 + score * 1.3);
      scroll += speed * dt;

      bird.vy = Math.min(bird.vy + 780 * dt, 340);
      bird.y += bird.vy * dt;
      if (bird.y < 4) { bird.y = 4; bird.vy = 0; }

      if (bird.wingT > 0) {
        bird.wingT -= dt;
        bird.wing = bird.wingT > 0.11 ? 0 : 1;
      } else {
        bird.wing = bird.vy > 60 ? 2 : 1;
      }

      // feathers
      for (var i = feathers.length - 1; i >= 0; i--) {
        var p = feathers[i];
        p.life -= dt;
        p.x += (p.vx - speed * 0.6) * dt;
        p.y += p.vy * dt;
        p.vy += 60 * dt;
        if (p.life <= 0) feathers.splice(i, 1);
      }

      spawn();
      var bx = bird.x, by = bird.y;
      for (var j = obstacles.length - 1; j >= 0; j--) {
        var o = obstacles[j];
        o.x -= speed * dt;
        if (o.flashT > 0) o.flashT -= dt;
        else if (Math.random() < dt * 0.08) o.flashT = 0.12;
        if (!o.scored && o.x + 24 < bx) {
          o.scored = true;
          score++;
          beep(880, 1320, 0.09, "square", 0.045);
        }
        if (o.x < -40) obstacles.splice(j, 1);
      }

      // collision: bird box 12x9 centered at (bx, by+6ish)
      var bl = bx - 6, bt = by + 1, br = bx + 7, bb = by + 11;
      if (bb >= GROUND) { die(); return; }
      for (var k = 0; k < obstacles.length; k++) {
        var ob = obstacles[k];
        var cxm = ob.x, cxM = ob.x + 24; // head span
        var pl = ob.x + 5, pr = ob.x + 19; // pole span
        // top: pole 0..gapY-14, head gapY-14..gapY
        // bottom: head gapY+gap..gapY+gap+14, pole below
        var hit =
          (br > cxm && bl < cxM && bt < ob.gapY && bb > ob.gapY - 14) ||
          (br > pl && bl < pr && bt < ob.gapY - 14) ||
          (br > cxm && bl < cxM && bb > ob.gapY + ob.gap && bt < ob.gapY + ob.gap + 14) ||
          (br > pl && bl < pr && bb > ob.gapY + ob.gap + 14);
        if (hit) { die(); return; }
      }
    }

    function drawObstacle(o, t) {
      var x = Math.floor(o.x);
      // top pole
      ctx.fillStyle = "#3a3f4a"; ctx.fillRect(x + 8, 0, 8, Math.floor(o.gapY) - 14);
      ctx.fillStyle = "#20242e"; ctx.fillRect(x + 14, 0, 2, Math.floor(o.gapY) - 14);
      // battery box on top pole
      ctx.fillStyle = "#2a2e38"; ctx.fillRect(x + 5, 8, 14, 10);
      ctx.fillStyle = "#101018"; ctx.fillRect(x + 5, 8, 14, 1);
      // top head (at gap edge)
      ctx.drawImage(floukHead, x, Math.floor(o.gapY) - 14);
      // bottom head
      var byy = Math.floor(o.gapY + o.gap);
      ctx.drawImage(floukHead, x, byy);
      // bottom pole
      ctx.fillStyle = "#3a3f4a"; ctx.fillRect(x + 8, byy + 14, 8, GROUND - byy - 14);
      ctx.fillStyle = "#20242e"; ctx.fillRect(x + 14, byy + 14, 2, GROUND - byy - 14);
      ctx.fillStyle = "#2a2e38"; ctx.fillRect(x + 5, byy + 22, 14, 10);
      ctx.fillStyle = "#101018"; ctx.fillRect(x + 5, byy + 22, 14, 1);

      // sweeping scanner beam from bottom camera, upward into gap
      var ang = Math.sin(t / 900 + o.phase) * 0.45;
      var ex = x + 5, ey = byy + 8; // bottom eye
      ctx.fillStyle = "rgba(255,80,80,0.07)";
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.sin(ang - 0.14) * o.gap * 1.1, ey - Math.cos(ang - 0.14) * o.gap * 1.1);
      ctx.lineTo(ex + Math.sin(ang + 0.14) * o.gap * 1.1, ey - Math.cos(ang + 0.14) * o.gap * 1.1);
      ctx.closePath();
      ctx.fill();

      // eye glow + LED blink + capture flash on both heads
      var heads = [Math.floor(o.gapY) - 14, byy];
      for (var i = 0; i < 2; i++) {
        var hy = heads[i];
        ctx.fillStyle = "rgba(255,80,80,0.22)";
        ctx.fillRect(x - 1, hy + 3, 10, 11);
        if (Math.floor(t / 500 + o.phase * 3) % 2 === 0) {
          ctx.fillStyle = "#ffd040"; ctx.fillRect(x + 10, hy + 5, 1, 1);
        }
        if (o.flashT > 0) {
          ctx.fillStyle = "rgba(255,255,255," + (o.flashT * 6).toFixed(2) + ")";
          ctx.fillRect(x + 1, hy + 4, 8, 9);
        }
      }
    }

    function drawBird() {
      var a = state === "attract" ? Math.sin(performance.now() / 400) * 0.06
        : Math.max(-0.35, Math.min(1.05, bird.vy * 0.0024));
      ctx.save();
      ctx.translate(Math.floor(bird.x), Math.floor(bird.y) + 6);
      ctx.rotate(a);
      ctx.drawImage(doveFrames[bird.wing], -11, -7);
      drawPupils(ctx, -11, -7, 1, eyeA, eyeB);
      ctx.restore();
    }

    function draw(t) {
      ctx.save();
      if (shakeT > 0) {
        ctx.translate(Math.floor((Math.random() - 0.5) * 6), Math.floor((Math.random() - 0.5) * 6));
      }

      // sky
      ctx.fillStyle = "#0a0a14";
      ctx.fillRect(-8, -8, W + 16, H + 16);
      var sky = ctx.createLinearGradient(0, 0, 0, 96);
      sky.addColorStop(0, "#121527");
      sky.addColorStop(1, "#0a0a14");
      ctx.fillStyle = sky;
      ctx.fillRect(-8, -8, W + 16, 104);

      // stars
      ctx.fillStyle = "rgba(200,210,235,0.5)";
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        ctx.fillRect(Math.floor(s[0]), Math.floor(s[1]), s[2], s[2]);
      }

      drawSkyline(scroll, 0, "#141824", 46, 0.25);
      drawSkyline(scroll, 1, "#1c2230", 60, 0.4);

      // ground
      ctx.fillStyle = "#14161e"; ctx.fillRect(-8, GROUND, W + 16, H - GROUND + 8);
      ctx.fillStyle = "#232838"; ctx.fillRect(-8, GROUND, W + 16, 2);
      ctx.fillStyle = "#b08a2a";
      var dashOff = Math.floor(scroll % 24);
      for (var dx = -dashOff; dx < W; dx += 24) ctx.fillRect(dx, GROUND + 8, 10, 2);

      // obstacles
      for (var j = 0; j < obstacles.length; j++) drawObstacle(obstacles[j], t);

      // feathers
      for (var k = 0; k < feathers.length; k++) {
        var p = feathers[k];
        ctx.fillStyle = "rgba(244,244,248," + Math.max(0, p.life).toFixed(2) + ")";
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2);
      }

      drawBird();

      // HUD
      if (state === "play") {
        var sc = String(score);
        drawText(ctx, sc, Math.floor((W - textW(sc, 2)) / 2) + 1, 11, 2, "#101018");
        drawText(ctx, sc, Math.floor((W - textW(sc, 2)) / 2), 10, 2, "#ffd040");
      }

      if (state === "attract") {
        var blinkOn = REDUCED || Math.floor(t / 500) % 2 === 0;
        if (blinkOn) drawText(ctx, "TAP TO FLY", Math.floor((W - textW("TAP TO FLY", 2)) / 2), 132, 2, "#ffd040");
        var bl = "BEST " + best;
        drawText(ctx, bl, Math.floor((W - textW(bl, 1)) / 2), 152, 1, "#8a90a0");
      }

      if (state === "dead") {
        ctx.fillStyle = "rgba(8,9,15,0.55)";
        ctx.fillRect(0, 0, W, H);
        drawText(ctx, "SUBJECT LOST", Math.floor((W - textW("SUBJECT LOST", 2)) / 2) + 1, 63, 2, "#101018");
        drawText(ctx, "SUBJECT LOST", Math.floor((W - textW("SUBJECT LOST", 2)) / 2), 62, 2, "#ff5050");
        var l1 = "SCORE " + score + "   BEST " + best;
        drawText(ctx, l1, Math.floor((W - textW(l1, 1)) / 2), 92, 1, "#f4f4f8");
        if (deadLock <= 0 && (REDUCED || Math.floor(t / 500) % 2 === 0)) {
          drawText(ctx, "TAP TO RE-ENTER FEED", Math.floor((W - textW("TAP TO RE-ENTER FEED", 1)) / 2), 116, 1, "#ffd040");
        }
      }

      ctx.restore();

      // death glitch: slice-shift the frame
      if (glitchT > 0.3) {
        for (var gi = 0; gi < 5; gi++) {
          var sy = Math.floor(Math.random() * H);
          var sh = 3 + Math.floor(Math.random() * 10);
          var off = Math.floor((Math.random() - 0.5) * 26);
          ctx.drawImage(cv, 0, sy, W, sh, off, sy, W, sh);
        }
      }
      if (flashT > 0) {
        ctx.fillStyle = "rgba(255,255,255," + (flashT * 7).toFixed(2) + ")";
        ctx.fillRect(0, 0, W, H);
      }
    }

    var running = false, lastT = 0;
    function frame(t) {
      if (!running) return;
      var dt = Math.max(0.001, Math.min(0.033, (t - lastT) / 1000 || 0.016));
      lastT = t;
      update(dt);
      draw(t);
      // stop conditions: reduced motion + idle screens
      if (REDUCED && state !== "play" && glitchT <= 0 && shakeT <= 0 &&
          (state === "attract" || (state === "dead" && bird.y >= GROUND - 10 && deadLock <= 0))) {
        running = false;
        return;
      }
      requestAnimationFrame(frame);
    }
    function ensureLoop() {
      if (!running) {
        running = true;
        lastT = performance.now();
        requestAnimationFrame(frame);
      }
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) running = false;
      else if (!REDUCED || state === "play") ensureLoop();
    });

    // boot
    spawn();
    if (REDUCED) {
      update(0.016);
      draw(performance.now());
    } else {
      ensureLoop();
    }

    return { input: input };
  }

  global.FlockyBird = {
    drawText: drawText,
    textW: textW,
    makeCanvas: makeCanvas,
    paintMap: paintMap,
    buildDoveFrames: buildDoveFrames,
    drawPupils: drawPupils,
    buildFloukHead: buildFloukHead,
    mount: mount
  };
})(window);
