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

  // --- Focal Points Map for Chapters ---
  const focalPoints = {
    1: { active: false, scale: 1.0, originX: 0.5, originY: 0.5 },
    2: { active: false, scale: 1.0, originX: 0.5, originY: 0.5 },
    3: { active: true, scale: 1.6, originX: 0.35, originY: 0.25, x: 35, y: 25, label: '🏔️ 高山雪線急劇後退 3.2 km' },
    4: { active: true, scale: 1.8, originX: 0.25, originY: 0.45, x: 25, y: 45, label: '💧 冰井融水深層滲漏點' },
    5: { active: true, scale: 1.7, originX: 0.45, originY: 0.75, x: 45, y: 75, label: '⚠️ 末日冰川接觸線掏空崩塌帶' },
    6: { active: true, scale: 1.5, originX: 0.2, originY: 0.6, x: 20, y: 60, label: '🔥 永凍土解凍與甲烷釋放點' },
    7: { active: true, scale: 1.75, originX: 0.4, originY: 0.35, x: 40, y: 35, label: '🌊 喜馬拉雅冰湖潰決高風險區' },
    8: { active: true, scale: 1.5, originX: 0.5, originY: 0.8, x: 50, y: 80, label: '🌐 海平面上升侵蝕沿海邊界' },
    9: { active: true, scale: 1.6, originX: 0.15, originY: 0.7, x: 15, y: 70, label: '🐾 北極海冰斷裂與棲地破碎點' },
    10: { active: false, scale: 1.0, originX: 0.5, originY: 0.5 }
  };

  /**
   * Recalculates the internal canvas clip percentage so that the visual boundary
   * on screen aligns EXACTLY with barScreenPercent regardless of zoom scale or transform-origin.
   */
  function applyClipPathAndBar(isAnimated = false) {
    // Math: ScreenPos = OriginY + Scale * (CanvasPos - OriginY)
    // Therefore: CanvasPos = OriginY + (ScreenPos - OriginY) / Scale
    const barFraction = barScreenPercent / 100;
    const clipFraction = currentOriginY + (barFraction - currentOriginY) / currentScale;
    const clipPercent = Math.max(0, Math.min(100, clipFraction * 100));

    if (isAnimated) {
      afterWrapper.style.transition = 'clip-path 1.2s cubic-bezier(0.25, 1, 0.5, 1)';
    } else {
      afterWrapper.style.transition = 'none';
    }

    afterWrapper.style.clipPath = `inset(${clipPercent}% 0 0 0)`;
    sliderHandle.style.top = `${barScreenPercent}%`;
  }

  // Initialize bar at center 50%
  applyClipPathAndBar(false);

  // --- Pointer Drag Handling for Bar ---
  function handlePointerMove(e) {
    if (!isDraggingBar) return;
    const y = e.clientY;
    const height = window.innerHeight;
    barScreenPercent = Math.max(0, Math.min(100, (y / height) * 100));
    applyClipPathAndBar(false);
  }

  sliderHandle.addEventListener('pointerdown', (e) => {
    isDraggingBar = true;
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
    let step = 2;
    if (e.shiftKey) step = 10;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      barScreenPercent = Math.max(0, barScreenPercent - step);
      applyClipPathAndBar(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      barScreenPercent = Math.min(100, barScreenPercent + step);
      applyClipPathAndBar(false);
    } else if (e.key === 'Home') {
      e.preventDefault();
      barScreenPercent = 0;
      applyClipPathAndBar(false);
    } else if (e.key === 'End') {
      e.preventDefault();
      barScreenPercent = 100;
      applyClipPathAndBar(false);
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

  // --- Trigger Focal Point Zoom & Precise Clip Alignment ---
  function triggerFocalPoint(stepNumber) {
    const config = focalPoints[stepNumber] || focalPoints[1];

    currentScale = config.scale;
    currentOriginX = config.originX;
    currentOriginY = config.originY;

    // Apply scale & origin transformation to zoomCanvas
    zoomCanvas.style.transformOrigin = `${currentOriginX * 100}% ${currentOriginY * 100}%`;
    zoomCanvas.style.transform = `scale(${currentScale})`;

    // Re-align image clip edge with bar line smoothly during zoom animation
    applyClipPathAndBar(true);

    if (config.active) {
      focusMarker.style.left = `${config.x}%`;
      focusMarker.style.top = `${config.y}%`;
      markerText.textContent = config.label;
      focusMarker.classList.add('active');
    } else {
      focusMarker.classList.remove('active');
    }
  }

  // IntersectionObserver to detect active chapter and trigger zoom
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
