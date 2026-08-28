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
     2. 幾何学・ドットのインタラクティブ背景キャンバス (反転カラー対応)
     ========================================================================== */
  const canvas = document.getElementById('bgCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];

    function resizeCanvas() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 2 + 1;
        this.baseX = this.x;
        this.baseY = this.y;
        this.density = (Math.random() * 20) + 1;
        this.type = Math.floor(Math.random() * 3);
      }

      draw() {
        const isInverted = document.body.classList.contains('inverted-mode');
        ctx.fillStyle = isInverted ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.25)';
        ctx.strokeStyle = isInverted ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;

        if (this.type === 0) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.type === 1) {
          const len = 4;
          ctx.beginPath();
          ctx.moveTo(this.x - len, this.y);
          ctx.lineTo(this.x + len, this.y);
          ctx.moveTo(this.x, this.y - len);
          ctx.lineTo(this.x, this.y + len);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      update() {
        let dx = mouseX - this.x;
        let dy = mouseY - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        let maxDistance = 100;

        if (distance < maxDistance) {
          let forceDirectionX = dx / distance;
          let forceDirectionY = dy / distance;
          let force = (maxDistance - distance) / maxDistance;
          let directionX = forceDirectionX * force * this.density;
          let directionY = forceDirectionY * force * this.density;
          this.x -= directionX;
          this.y -= directionY;
        } else {
          if (this.x !== this.baseX) {
            let dx = this.x - this.baseX;
            this.x -= dx * 0.05;
          }
          if (this.y !== this.baseY) {
            let dy = this.y - this.baseY;
            this.y -= dy * 0.05;
          }
        }
      }
    }

    function initParticles() {
      particles = [];
      const count = Math.floor((width * height) / 20000);
      for (let i = 0; i < count; i++) {
        particles.push(new Particle());
      }
    }
    initParticles();
    window.addEventListener('resize', initParticles);

    function animateCanvas() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].draw();
        particles[i].update();
      }
      requestAnimationFrame(animateCanvas);
    }
    animateCanvas();
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

});