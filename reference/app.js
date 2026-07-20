document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const comparisonWrapper = document.getElementById('comparisonWrapper');
  const afterWrapper = document.getElementById('afterWrapper');
  const sliderHandle = document.getElementById('sliderHandle');
  const progressBarFill = document.getElementById('progressBarFill');
  const narrativeCards = document.querySelectorAll('.narrative-card');
  const zoomCanvas = document.getElementById('zoomCanvas');
  const focusMarker = document.getElementById('focusMarker');
  const markerText = document.getElementById('markerText');

  // --- State Variables ---
  let barPosPercent = 50; // Default centered at 50%
  let isDraggingBar = false;

  // --- Focal Points Map for Chapters ---
  // Coordinates are in percentages relative to the screen canvas (x%, y%)
  const focalPoints = {
    1: { active: false, scale: 1.0, origin: '50% 50%' },
    2: { active: false, scale: 1.0, origin: '50% 50%' },
    3: { active: true, scale: 1.6, origin: '35% 25%', x: 35, y: 25, label: '🏔️ 高山雪線急劇後退 3.2 km' },
    4: { active: true, scale: 1.8, origin: '25% 45%', x: 25, y: 45, label: '💧 冰井融水深層滲漏點' },
    5: { active: true, scale: 1.7, origin: '45% 75%', x: 45, y: 75, label: '⚠️ 末日冰川接觸線掏空崩塌帶' },
    6: { active: true, scale: 1.5, origin: '20% 60%', x: 20, y: 60, label: '🔥 永凍土解凍與甲烷釋放點' },
    7: { active: true, scale: 1.75, origin: '40% 35%', x: 40, y: 35, label: '🌊 喜馬拉雅冰湖潰決高風險區' },
    8: { active: true, scale: 1.5, origin: '50% 80%', x: 50, y: 80, label: '🌐 海平面上升侵蝕沿海邊界' },
    9: { active: true, scale: 1.6, origin: '15% 70%', x: 15, y: 70, label: '🐾 北極海冰斷裂與棲地破碎點' },
    10: { active: false, scale: 1.0, origin: '50% 50%' }
  };

  // --- 1. Draggable Divider Bar Logic (Independent of scroll, default 50%) ---
  function updateBarPosition(percent) {
    barPosPercent = Math.max(0, Math.min(100, percent));
    afterWrapper.style.clipPath = `inset(${barPosPercent}% 0 0 0)`;
    sliderHandle.style.top = `${barPosPercent}%`;
  }

  // Initialize bar at center 50%
  updateBarPosition(50);

  function handlePointerMove(e) {
    if (!isDraggingBar) return;
    const rect = comparisonWrapper.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percent = (y / rect.height) * 100;
    updateBarPosition(percent);
  }

  comparisonWrapper.addEventListener('pointerdown', (e) => {
    isDraggingBar = true;
    comparisonWrapper.setPointerCapture(e.pointerId);
    handlePointerMove(e);
  });

  comparisonWrapper.addEventListener('pointermove', handlePointerMove);

  function stopDrag(e) {
    if (isDraggingBar) {
      isDraggingBar = false;
      try {
        comparisonWrapper.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  }

  comparisonWrapper.addEventListener('pointerup', stopDrag);
  comparisonWrapper.addEventListener('pointercancel', stopDrag);

  // --- 2. Scroll Progress & Navigation Bar ---
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

  // --- 3. Focal Point Zoom & Red Ring Marker Triggering ---
  function triggerFocalPoint(stepNumber) {
    const config = focalPoints[stepNumber] || focalPoints[1];

    // Apply smooth localized zoom onto background canvas
    zoomCanvas.style.transformOrigin = config.origin;
    zoomCanvas.style.transform = `scale(${config.scale})`;

    if (config.active) {
      // Position red circle marker & update text
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
