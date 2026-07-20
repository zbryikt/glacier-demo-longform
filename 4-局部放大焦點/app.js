document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const afterWrapper = document.getElementById('afterWrapper');
  const sliderHandle = document.getElementById('sliderHandle');
  const progressBarFill = document.getElementById('progressBarFill');
  const narrativeCards = document.querySelectorAll('.narrative-card');
  const zoomCanvas = document.getElementById('zoomCanvas');
  const focusMarker = document.getElementById('focusMarker');
  const markerText = document.getElementById('markerText');

  // --- State Variables ---
  let barScreenPercent = 50; // Visual screen position of bar (0% - 100%)
  let currentScale = 1.0;
  let currentOriginY = 0.5; // 0.0 - 1.0
  let currentOriginX = 0.5; // 0.0 - 1.0
  let isDraggingBar = false;
  let sweepAnimId = null;

  // --- Focal Points & Bar Sweep Targets for Chapters ---
  const focalPoints = {
    1: { active: false, scale: 1.0, originX: 0.5, originY: 0.5, targetBar: 50 },
    2: { active: false, scale: 1.0, originX: 0.5, originY: 0.5, targetBar: 50 },
    3: { active: true, scale: 1.6, originX: 0.35, originY: 0.25, x: 35, y: 25, label: '🏔️ 高山雪線急劇後退 3.2 km', targetBar: 85 },
    4: { active: true, scale: 1.8, originX: 0.25, originY: 0.45, x: 25, y: 45, label: '💧 冰井融水深層滲漏點', targetBar: 15 },
    5: { active: true, scale: 1.7, originX: 0.45, originY: 0.75, x: 45, y: 75, label: '⚠️ 末日冰川接觸線掏空崩塌帶', targetBar: 85 },
    6: { active: true, scale: 1.5, originX: 0.2, originY: 0.6, x: 20, y: 60, label: '🔥 永凍土解凍與甲烷釋放點', targetBar: 20 },
    7: { active: true, scale: 1.75, originX: 0.4, originY: 0.35, x: 40, y: 35, label: '🌊 喜馬拉雅冰湖潰決高風險區', targetBar: 80 },
    8: { active: true, scale: 1.5, originX: 0.5, originY: 0.8, x: 50, y: 80, label: '🌐 海平面上升侵蝕沿海邊界', targetBar: 15 },
    9: { active: true, scale: 1.6, originX: 0.15, originY: 0.7, x: 15, y: 70, label: '🐾 北極海冰斷裂與棲地破碎點', targetBar: 85 },
    10: { active: false, scale: 1.0, originX: 0.5, originY: 0.5, targetBar: 50 }
  };

  /**
   * Precise coordinate conversion equation:
   * CanvasPos = OriginY + (BarScreenPos - OriginY) / Scale
   * Ensures the visual image clip boundary aligns 100% pixel-perfectly with sliderHandle on screen.
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

  // --- Smooth Automatic Bar Sweep to Opposite Side during Waypoint Translation ---
  function animateBarSweep(targetPercent, duration = 1200) {
    if (sweepAnimId) cancelAnimationFrame(sweepAnimId);

    const startPercent = barScreenPercent;
    const distance = targetPercent - startPercent;
    const startTime = performance.now();

    function step(now) {
      if (isDraggingBar) return; // User manual drag overrides auto sweep

      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Smooth easeInOutCubic easing
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      barScreenPercent = startPercent + distance * ease;
      applyClipPathAndBar();

      if (progress < 1) {
        sweepAnimId = requestAnimationFrame(step);
      }
    }

    sweepAnimId = requestAnimationFrame(step);
  }

  // --- Pointer Drag Handling for Bar ---
  function handlePointerMove(e) {
    if (!isDraggingBar) return;
    if (sweepAnimId) cancelAnimationFrame(sweepAnimId); // Cancel auto sweep on manual drag

    const y = e.clientY;
    const height = window.innerHeight;
    barScreenPercent = Math.max(0, Math.min(100, (y / height) * 100));
    applyClipPathAndBar();
  }

  sliderHandle.addEventListener('pointerdown', (e) => {
    isDraggingBar = true;
    if (sweepAnimId) cancelAnimationFrame(sweepAnimId);
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
      try {
        if (e.pointerId !== undefined) {
          sliderHandle.releasePointerCapture(e.pointerId);
        }
      } catch (err) {}
    }
  }

  window.addEventListener('pointerup', stopDrag);
  window.addEventListener('pointercancel', stopDrag);

  // Keyboard accessibility for bar
  sliderHandle.addEventListener('keydown', (e) => {
    if (sweepAnimId) cancelAnimationFrame(sweepAnimId);
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
    const config = focalPoints[stepNumber] || focalPoints[1];

    currentScale = config.scale;
    currentOriginX = config.originX;
    currentOriginY = config.originY;

    // Apply scale & origin transformation to zoomCanvas
    zoomCanvas.style.transformOrigin = `${currentOriginX * 100}% ${currentOriginY * 100}%`;
    zoomCanvas.style.transform = `scale(${currentScale})`;

    // Automatically sweep bar to the opposite side (e.g. 15% <-> 85%)
    if (config.targetBar !== undefined) {
      animateBarSweep(config.targetBar, 1200);
    }

    if (config.active) {
      focusMarker.style.left = `${config.x}%`;
      focusMarker.style.top = `${config.y}%`;
      markerText.textContent = config.label;
      focusMarker.classList.add('active');
    } else {
      focusMarker.classList.remove('active');
    }
  }

  // IntersectionObserver to detect active chapter and trigger zoom & sweep
  const observerOptions = {
    root: null,
    rootMargin: '-35% 0px -40% 0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        narrativeCards.forEach((card) => card.classList.remove('active'));
        entry.target.classList.add('active');

        const step = parseInt(entry.target.dataset.step, 10);
        triggerFocalPoint(step);
      }
    });
  }, observerOptions);

  narrativeCards.forEach((card) => observer.observe(card));

  // Initial calculation
  onScroll();
});
