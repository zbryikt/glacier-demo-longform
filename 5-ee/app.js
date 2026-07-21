document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const afterWrapper = document.getElementById('afterWrapper');
  const sliderHandle = document.getElementById('sliderHandle');
  const progressBarFill = document.getElementById('progressBarFill');
  const zoomCanvas = document.getElementById('zoomCanvas');
  const focusMarker = document.getElementById('focusMarker');
  const markerText = document.getElementById('markerText');
  const heroContainer = document.getElementById('heroContainer');
  const narrativeStream = document.getElementById('narrativeStream');

  // Configure marked parser if available
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      gfm: true,
      breaks: true
    });
  }

  // --- State Variables ---
  let barScreenPercent = 50; // Visual screen position of bar (0% - 100%)
  let currentScale = 1.0;
  let currentOriginY = 0.5; // 0.0 - 1.0
  let currentOriginX = 0.5; // 0.0 - 1.0
  let isDraggingBar = false;

  let dragStartY = 0;
  let dragStartTime = 0;
  let animId = null;
  let focalPoints = {};

  // --- 1. Load Data directly from story.md ---
  try {
    const res = await fetch('story.md');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const mdText = await res.text();
    const data = parseMarkdownStory(mdText);
    renderContent(data);
  } catch (err) {
    console.error('Failed to load story.md:', err);
    narrativeStream.innerHTML = `<div class="error-msg">載入故事檔案 story.md 失敗，請重新整理頁面。</div>`;
    return;
  }

  // --- Markdown & Frontmatter Story Parser ---
  function parseMarkdownStory(mdText) {
    let meta = {};
    let contentText = mdText;

    // Extract Frontmatter between --- and ---
    const frontmatterMatch = mdText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (frontmatterMatch) {
      const yamlLines = frontmatterMatch[1].split(/\r?\n/);
      yamlLines.forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const key = line.substring(0, colonIdx).trim();
          const val = line.substring(colonIdx + 1).trim();
          meta[key] = val;
        }
      });
      contentText = frontmatterMatch[2];
    }

    // Split chapters by '## Chapter ' or '---'
    const rawSections = contentText.split(/\r?\n---\r?\n|\r?\n(?=## Chapter )/);
    const chapters = [];

    rawSections.forEach((sec) => {
      const trimmed = sec.trim();
      if (!trimmed) return;

      // Match header line: ## Chapter XX: Title
      const headerMatch = trimmed.match(/^##\s+(Chapter\s+\d+):\s*(.*?)(\r?\n|$)/i);
      let badge = `Chapter ${String(chapters.length + 1).padStart(2, '0')}`;
      let title = '';
      let body = trimmed;

      if (headerMatch) {
        badge = headerMatch[1].trim();
        title = headerMatch[2].trim();
        body = trimmed.substring(headerMatch[0].length).trim();
      }

      // Extract focalPoint comment: <!-- focalPoint: {...} -->
      let focalPoint = { active: false, scale: 1.0, originX: 0.5, originY: 0.5, targetBar: 50 };
      const fpMatch = body.match(/<!--\s*focalPoint:\s*(\{[\s\S]*?\})\s*-->/);
      if (fpMatch) {
        try {
          focalPoint = JSON.parse(fpMatch[1]);
        } catch (e) {}
        body = body.replace(fpMatch[0], '').trim();
      }

      chapters.push({
        id: chapters.length + 1,
        badge: badge,
        title: title,
        content: body,
        focalPoint: focalPoint
      });
    });

    return { meta, chapters };
  }

  // --- 2. Dynamic Content Rendering from Markdown Data ---
  function renderContent(data) {
    // Render Hero Card
    if (data.meta) {
      heroContainer.innerHTML = `
        <section class="hero-section">
          <header class="hero-card">
            <span class="hero-tag">${escapeHtml(data.meta.tag)}</span>
            <h1>${escapeHtml(data.meta.title)}</h1>
            <p class="hero-desc">${escapeHtml(data.meta.subtitle)}</p>
            <div class="scroll-down-hint">
              <span>向下滾動開始探索</span>
              <span class="animated-arrow">↓</span>
            </div>
          </header>
        </section>
      `;
    }

    // Render Chapters & Build Focal Points Map
    if (Array.isArray(data.chapters)) {
      narrativeStream.innerHTML = '';
      data.chapters.forEach((chap) => {
        // Build Focal Point Map
        focalPoints[chap.id] = chap.focalPoint || {
          active: false,
          scale: 1.0,
          originX: 0.5,
          originY: 0.5,
          targetBar: 50
        };

        // Render Markdown content to HTML
        const htmlContent = (typeof marked !== 'undefined' && chap.content) 
          ? marked.parse(chap.content) 
          : `<p>${escapeHtml(chap.content)}</p>`;

        // Create Chapter Card Element
        const card = document.createElement('article');
        card.className = `narrative-card ${chap.id === 1 ? 'active' : ''}`;
        card.dataset.step = chap.id;
        card.innerHTML = `
          <span class="step-badge">${escapeHtml(chap.badge)}</span>
          <h2>${escapeHtml(chap.title)}</h2>
          <div class="chapter-content markdown-body">${htmlContent}</div>
        `;
        narrativeStream.appendChild(card);
      });

      // Render Waypoints Navigation Box at the bottom of the stream
      renderWaypointsNav(data.chapters);

      // Bind Intersection Observer to dynamically generated cards
      bindObserver();
    }
  }

  // --- Render Waypoints Navigation Box at Bottom ---
  function renderWaypointsNav(chapters) {
    const navBox = document.createElement('div');
    navBox.className = 'waypoints-footer-nav';
    navBox.id = 'waypointsFooterNav';

    navBox.innerHTML = `
      <div class="waypoints-nav-header">
        <i class="ri-compass-3-line"></i> 快速探索焦點章節 (Waypoints Quick Jump)
      </div>
      <div class="waypoints-buttons-grid">
        ${chapters.map(chap => `
          <button class="waypoint-btn ${chap.id === 1 ? 'active' : ''}" data-step="${chap.id}" title="${escapeHtml(chap.title)}">
            <span class="wp-num">${escapeHtml(chap.badge.replace(/Chapter\s*/i, ''))}</span>
            <span class="wp-title">${escapeHtml(chap.title)}</span>
          </button>
        `).join('')}
      </div>
    `;

    narrativeStream.appendChild(navBox);

    // Bind Click Events on Waypoint Buttons
    navBox.querySelectorAll('.waypoint-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.dataset.step, 10);
        const targetCard = document.querySelector(`.narrative-card[data-step="${step}"]`);
        
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          triggerFocalPoint(step);
          
          // Highlight active button
          navBox.querySelectorAll('.waypoint-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  /**
   * Exact screen-to-canvas clip conversion equation:
   * CanvasPos = OriginY + (BarScreenPos - OriginY) / Scale
   * Guarantees 100% pixel-perfect alignment between image clip boundary and bar line.
   */
  function applyClipPathAndBar() {
    const barFraction = barScreenPercent / 100;
    const clipFraction = currentOriginY + (barFraction - currentOriginY) / currentScale;
    const clipPercent = Math.max(0, Math.min(100, clipFraction * 100));

    afterWrapper.style.transition = 'none';
    afterWrapper.style.clipPath = `inset(${clipPercent}% 0 0 0)`;
    sliderHandle.style.top = `${barScreenPercent}%`;
  }

  // Initialize bar at center 50%
  applyClipPathAndBar();

  // --- Smooth Bar Animation Helper ---
  function animateBarTo(targetPercent, duration = 1000) {
    if (animId) cancelAnimationFrame(animId);

    const startPercent = barScreenPercent;
    const distance = targetPercent - startPercent;
    const startTime = performance.now();

    function step(now) {
      if (isDraggingBar) return;

      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      barScreenPercent = startPercent + distance * ease;
      applyClipPathAndBar();

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    }

    animId = requestAnimationFrame(step);
  }

  function toggleBarToOppositeSide() {
    const target = barScreenPercent >= 50 ? 15 : 85;
    animateBarTo(target, 850);
  }

  // --- Pointer Drag & Click Handling ---
  function handlePointerMove(e) {
    if (!isDraggingBar) return;
    if (animId) cancelAnimationFrame(animId);

    const y = e.clientY;
    const height = window.innerHeight;
    barScreenPercent = Math.max(0, Math.min(100, (y / height) * 100));
    applyClipPathAndBar();
  }

  sliderHandle.addEventListener('pointerdown', (e) => {
    isDraggingBar = true;
    dragStartY = e.clientY;
    dragStartTime = Date.now();
    if (animId) cancelAnimationFrame(animId);

    sliderHandle.classList.add('dragging');
    try {
      sliderHandle.setPointerCapture(e.pointerId);
    } catch (err) {}
    handlePointerMove(e);
  });

  window.addEventListener('pointermove', handlePointerMove);

  function stopDrag(e) {
    if (isDraggingBar) {
      isDraggingBar = false;
      sliderHandle.classList.remove('dragging');

      const deltaY = Math.abs(e.clientY - dragStartY);
      const elapsed = Date.now() - dragStartTime;

      if (deltaY < 6 && elapsed < 350) {
        toggleBarToOppositeSide();
      }

      try {
        if (e.pointerId !== undefined) {
          sliderHandle.releasePointerCapture(e.pointerId);
        }
      } catch (err) {}
    }
  }

  window.addEventListener('pointerup', stopDrag);
  window.addEventListener('pointercancel', stopDrag);

  // Keyboard accessibility
  sliderHandle.addEventListener('keydown', (e) => {
    if (animId) cancelAnimationFrame(animId);
    let step = 2;
    if (e.shiftKey) step = 10;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      barScreenPercent = Math.max(0, barScreenPercent - step);
      applyClipPathAndBar();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      barScreenPercent = Math.min(100, barScreenPercent + step);
      applyClipPathAndBar();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleBarToOppositeSide();
    } else if (e.key === 'Home') {
      e.preventDefault();
      barScreenPercent = 0;
      applyClipPathAndBar();
    } else if (e.key === 'End') {
      e.preventDefault();
      barScreenPercent = 100;
      applyClipPathAndBar();
    }
  });

  // --- Scroll Progress Bar ---
  function onScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;

    if (scrollHeight <= 0) return;

    const progress = Math.max(0, Math.min(1, scrollTop / scrollHeight));
    progressBarFill.style.width = `${Math.round(progress * 100)}%`;
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  });

  // --- Trigger Focal Point Zoom & Automatic Bar Sweep ---
  function triggerFocalPoint(stepNumber) {
    const config = focalPoints[stepNumber] || { scale: 1.0, originX: 0.5, originY: 0.5 };

    currentScale = config.scale;
    currentOriginX = config.originX;
    currentOriginY = config.originY;

    // Apply scale & origin transformation to zoomCanvas
    zoomCanvas.style.transformOrigin = `${currentOriginX * 100}% ${currentOriginY * 100}%`;
    zoomCanvas.style.transform = `scale(${currentScale})`;

    // Automatically sweep bar to opposite side for chapter waypoint
    if (config.targetBar !== undefined) {
      animateBarTo(config.targetBar, 1200);
    }

    if (config.active) {
      focusMarker.style.left = `${config.x}%`;
      focusMarker.style.top = `${config.y}%`;
      markerText.textContent = config.label || '焦點區域';
      focusMarker.classList.add('active');
    } else {
      focusMarker.classList.remove('active');
    }
  }

  // Bind IntersectionObserver to rendered cards
  function bindObserver() {
    const cards = document.querySelectorAll('.narrative-card');
    const wpBtns = document.querySelectorAll('.waypoint-btn');

    const observerOptions = {
      root: null,
      rootMargin: '-35% 0px -40% 0px',
      threshold: 0.15
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          cards.forEach((card) => card.classList.remove('active'));
          entry.target.classList.add('active');

          const step = parseInt(entry.target.dataset.step, 10);
          triggerFocalPoint(step);

          // Update active state of Waypoint buttons
          wpBtns.forEach(btn => {
            const btnStep = parseInt(btn.dataset.step, 10);
            btn.classList.toggle('active', btnStep === step);
          });
        }
      });
    }, observerOptions);

    cards.forEach((card) => observer.observe(card));
  }

  // Initial calculation
  onScroll();
});
