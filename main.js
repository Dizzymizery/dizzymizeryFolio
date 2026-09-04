document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================================================
     1. カスタムマグネティックカーソル (PCのみ追従)
     ========================================================================== */
  const cursorDot = document.getElementById('cursorDot');
  const cursorRing = document.getElementById('cursorRing');
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;
  let isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (!isTouchDevice) {
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (cursorDot) {
        cursorDot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
      }
    });

    function renderCursor() {
      if (cursorRing) {
        ringX += (mouseX - ringX) * 0.15;
        ringY += (mouseY - ringY) * 0.15;
        cursorRing.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
      }
      requestAnimationFrame(renderCursor);
    }
    renderCursor();

    const interactives = document.querySelectorAll('a, button, .tilt-card, .interactive-hologram, .status-clickable');
    interactives.forEach(el => {
      el.addEventListener('mouseenter', () => {
        if (cursorRing) {
          cursorRing.style.width = '55px';
          cursorRing.style.height = '55px';
          cursorRing.style.borderColor = '#ffffff';
        }
      });
      el.addEventListener('mouseleave', () => {
        if (cursorRing) {
          cursorRing.style.width = '32px';
          cursorRing.style.height = '32px';
          cursorRing.style.borderColor = 'var(--border-mid)';
        }
      });
    });
  }

  /* ==========================================================================
     2. モノクローム・クロムリキッド WebGL シェーダー背景
     ========================================================================== */
  const canvas = document.getElementById('bgCanvas');
  if (canvas) {
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const vsSource = `
        attribute vec2 a_position;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      const fsSource = `
        precision highp float;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform vec2 u_mouse;
        uniform float u_inverted;

        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                            -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy) );
          vec2 x0 = v -   i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
                + i.x + vec3(0.0, i1.x, 1.0 ));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m ;
          m = m*m ;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          vec2 shift = vec2(100.0);
          mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
          for (int i = 0; i < 4; ++i) {
            v += a * snoise(p);
            p = rot * p * 2.0 + shift;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 st = gl_FragCoord.xy / u_resolution.xy;
          st.x *= u_resolution.x / u_resolution.y;

          vec2 m = u_mouse / u_resolution.xy;
          m.x *= u_resolution.x / u_resolution.y;
          
          float distToMouse = length(st - m);
          float mouseFactor = smoothstep(0.6, 0.0, distToMouse);

          vec2 q = vec2(0.0);
          q.x = fbm(st + 0.04 * u_time);
          q.y = fbm(st + vec2(1.0));

          vec2 r = vec2(0.0);
          r.x = fbm(st + 1.0 * q + vec2(1.7, 9.2) + 0.12 * u_time + mouseFactor * 0.4);
          r.y = fbm(st + 1.0 * q + vec2(8.3, 2.8) + 0.10 * u_time - mouseFactor * 0.3);

          float f = fbm(st + r);

          float chrome = smoothstep(-0.2, 0.9, f);
          chrome = pow(chrome, 2.2);

          float edge = smoothstep(0.4, 0.45, f) - smoothstep(0.45, 0.65, f);
          vec3 col = mix(vec3(0.03), vec3(0.95), chrome);
          col += vec3(edge * 0.4);

          if (u_inverted > 0.5) {
            col = 1.0 - col;
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `;

      function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
      }

      const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
      const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1, -1,  1,
        -1,  1,  1, -1,  1,  1,
      ]), gl.STATIC_DRAW);

      const positionLoc = gl.getAttribLocation(program, 'a_position');
      const resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
      const timeLoc = gl.getUniformLocation(program, 'u_time');
      const mouseLoc = gl.getUniformLocation(program, 'u_mouse');
      const invertedLoc = gl.getUniformLocation(program, 'u_inverted');

      let targetMouseX = window.innerWidth / 2;
      let targetMouseY = window.innerHeight / 2;
      let currentMouseX = targetMouseX;
      let currentMouseY = targetMouseY;

      window.addEventListener('mousemove', (e) => {
        targetMouseX = e.clientX;
        targetMouseY = window.innerHeight - e.clientY;
      });

      function resize() {
        canvas.width = window.innerWidth * 0.5;
        canvas.height = window.innerHeight * 0.5;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      window.addEventListener('resize', resize);
      resize();

      let startTime = performance.now();

      function render() {
        currentMouseX += (targetMouseX - currentMouseX) * 0.05;
        currentMouseY += (targetMouseY - currentMouseY) * 0.05;

        gl.useProgram(program);
        gl.enableVertexAttribArray(positionLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        const currentTime = (performance.now() - startTime) * 0.001;
        gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
        gl.uniform1f(timeLoc, currentTime);
        gl.uniform2f(mouseLoc, currentMouseX * 0.5, currentMouseY * 0.5);
        gl.uniform1f(invertedLoc, document.body.classList.contains('inverted-mode') ? 1.0 : 0.0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(render);
      }
      render();
    }
  }

  /* ==========================================================================
     3. Worksカードの3Dチルトギミック (PCのみ)
     ========================================================================== */
  if (!isTouchDevice) {
    const tiltCards = document.querySelectorAll('.tilt-card');
    tiltCards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = ((y - centerY) / centerY) * -5;
        const rotateY = ((x - centerX) / centerX) * 5;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)`;
      });
    });
  }

  /* ==========================================================================
     4. 幾何学ページトランジション & 同ページ内HUD演出
     ========================================================================== */
  const curtain = document.getElementById('pageCurtain');
  const transitionLinks = document.querySelectorAll('.transition-link, .logo-group-link');
  const inPageNavLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  if (curtain) {
    curtain.classList.remove('active');
  }

  transitionLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetUrl = link.getAttribute('href');
      if (!targetUrl || targetUrl.startsWith('#') || link.target === '_blank') return;

      e.preventDefault();
      
      if (curtain) {
        curtain.style.transformOrigin = 'right';
        curtain.classList.add('active');
        
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 400);
      } else {
        window.location.href = targetUrl;
      }
    });
  });

  inPageNavLinks.forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = anchor.getAttribute('href');
      const targetElem = document.querySelector(targetId);
      
      if (targetElem) {
        targetElem.scrollIntoView({ behavior: 'smooth' });
        targetElem.classList.add('hud-highlight');
        setTimeout(() => {
          targetElem.classList.remove('hud-highlight');
        }, 1200);
      }
    });
  });

  /* ==========================================================================
     5. GALLERY リアルタイムフィルター切り替え (3列対応)
     ========================================================================== */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const galleryBlocks = document.querySelectorAll('.gallery-block');

  if (filterBtns.length > 0 && galleryBlocks.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const targetFilter = btn.getAttribute('data-filter');

        galleryBlocks.forEach(block => {
          const blockCat = block.getAttribute('data-cat');
          if (targetFilter === 'all' || blockCat === targetFilter) {
            block.classList.remove('hide');
          } else {
            block.classList.add('hide');
          }
        });
      });
    });
  }

  /* ==========================================================================
     6. クリック / タップ波紋ショックウェーブ
     ========================================================================== */
  const triggerRipple = (clientX, clientY) => {
    const ripple = document.createElement('div');
    ripple.className = 'click-ripple';
    ripple.style.left = `${clientX}px`;
    ripple.style.top = `${clientY}px`;
    ripple.style.width = '80px';
    ripple.style.height = '80px';
    document.body.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  };

  window.addEventListener('click', (e) => {
    triggerRipple(e.clientX, e.clientY);
  });

  /* ==========================================================================
     7. 隠し要素①：KONAMIコマンド（Overdrive Chrome Mode）
     ========================================================================== */
  const konamiSequence = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'KeyB', 'KeyA'
  ];
  let konamiIndex = 0;

  window.addEventListener('keydown', (e) => {
    const key = e.code;
    if (key === konamiSequence[konamiIndex]) {
      konamiIndex++;
      if (konamiIndex === konamiSequence.length) {
        document.body.classList.toggle('overdrive-mode');
        alert('◈ OVERDRIVE CHROME MODE: TOGGLED ◈');
        konamiIndex = 0;
      }
    } else {
      konamiIndex = 0;
    }
  });

  /* ==========================================================================
     8. 隠し要素②：SYSTEM STATUS 3連打でターミナル起動
     ========================================================================== */
  const statusTrigger = document.getElementById('systemStatusTrigger');
  const secretTerminal = document.getElementById('secretTerminal');
  const terminalClose = document.getElementById('terminalClose');
  let clickCount = 0;
  let clickTimer = null;

  if (statusTrigger && secretTerminal) {
    statusTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      clickCount++;
      clearTimeout(clickTimer);
      
      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 800);

      if (clickCount >= 3) {
        secretTerminal.classList.add('open');
        
        if (!document.getElementById('mobileEasterBtns')) {
          const btnBox = document.createElement('div');
          btnBox.className = 'terminal-actions';
          btnBox.id = 'mobileEasterBtns';
          btnBox.innerHTML = `
            <button type="button" class="term-action-btn" id="toggleInvertBtn">> TOGGLE INVERT</button>
            <button type="button" class="term-action-btn" id="toggleOverdriveBtn">> TOGGLE OVERDRIVE</button>
            <button type="button" class="term-action-btn" id="toggleGlitchBtn">> TOGGLE GLITCH</button>
          `;
          secretTerminal.querySelector('.terminal-body').appendChild(btnBox);

          document.getElementById('toggleInvertBtn').addEventListener('click', (ev) => {
            ev.stopPropagation();
            document.body.classList.toggle('inverted-mode');
          });
          document.getElementById('toggleOverdriveBtn').addEventListener('click', (ev) => {
            ev.stopPropagation();
            document.body.classList.toggle('overdrive-mode');
          });
          document.getElementById('toggleGlitchBtn').addEventListener('click', (ev) => {
            ev.stopPropagation();
            document.body.classList.toggle('glitch-mode');
          });
        }

        clickCount = 0;
      }
    });

    if (terminalClose) {
      terminalClose.addEventListener('click', (e) => {
        e.stopPropagation();
        secretTerminal.classList.remove('open');
      });
    }
  }

  /* ==========================================================================
     9. 隠し要素③：タイピング「DIZMIZ」で GLITCH MATRIX MODE 起動
     ========================================================================== */
  const secretWord = 'dizmiz';
  let typedBuffer = '';

  window.addEventListener('keydown', (e) => {
    if (e.key.length === 1) {
      typedBuffer += e.key.toLowerCase();
      if (typedBuffer.length > secretWord.length) {
        typedBuffer = typedBuffer.slice(-secretWord.length);
      }
      if (typedBuffer === secretWord) {
        document.body.classList.toggle('glitch-mode');
        typedBuffer = '';
      }
    }
  });

  /* ==========================================================================
     10. 隠し要素④：キーボード「I」で ANTI-COLOR INVERSION (ネガポジ反転)
     ========================================================================== */
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'i' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      document.body.classList.toggle('inverted-mode');
    }
  });

  /* ==========================================================================
     11. HUD GRID RULER SLIDER (目盛り生成 & スクロール精密同期)
     ========================================================================== */
  const rulerTicks = document.getElementById('rulerTicks');
  const rulerThumb = document.getElementById('rulerThumb');
  const rulerCoordY = document.getElementById('rulerCoordY');
  const rulerSecTag = document.getElementById('rulerSecTag');

  if (rulerTicks && rulerThumb) {
    const totalTicks = 24;
    for (let i = 0; i <= totalTicks; i++) {
      const tick = document.createElement('div');
      tick.className = 'ruler-tick';
      if (i % 4 === 0) tick.classList.add('major');
      rulerTicks.appendChild(tick);
    }

    const allTicks = rulerTicks.querySelectorAll('.ruler-tick');
    const sections = [
      { id: 'hero', tag: 'SEC: 00 // HERO' },
      { id: 'about', tag: 'SEC: 01 // ABOUT' },
      { id: 'works', tag: 'SEC: 02 // WORKS' },
      { id: 'skills', tag: 'SEC: 03 // SKILLS' },
      { id: 'shop', tag: 'SEC: 04 // SHOP' },
      { id: 'contact', tag: 'SEC: 05 // CONTACT' }
    ];

    const updateRuler = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(Math.max(scrollY / docHeight, 0), 1) : 0;

      if (rulerCoordY) {
        rulerCoordY.textContent = `Y: ${String(Math.round(scrollY)).padStart(4, '0')}`;
      }

      const trackHeight = rulerTicks.clientHeight - 24;
      rulerThumb.style.transform = `translateY(${progress * trackHeight}px)`;

      const activeIndex = Math.round(progress * totalTicks);
      allTicks.forEach((tick, idx) => {
        if (idx === activeIndex) {
          tick.classList.add('active');
        } else {
          tick.classList.remove('active');
        }
      });

      let currentSection = sections[0].tag;
      sections.forEach(sec => {
        const el = document.getElementById(sec.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= window.innerHeight * 0.45) {
            currentSection = sec.tag;
          }
        }
      });
      if (rulerSecTag) {
        rulerSecTag.textContent = currentSection;
      }
    };

    window.addEventListener('scroll', updateRuler, { passive: true });
    updateRuler();
  }

});