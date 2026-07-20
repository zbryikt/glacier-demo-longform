document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const comparisonCard = document.getElementById('comparisonCard');
  const comparisonWrapper = document.getElementById('comparisonWrapper');
  const afterWrapper = document.getElementById('afterWrapper');
  const sliderHandle = document.getElementById('sliderHandle');
  const sideBySideWrapper = document.getElementById('sideBySideWrapper');

  // Images
  const beforeImg = document.getElementById('beforeImg');
  const afterImg = document.getElementById('afterImg');
  const sbsBeforeImg = document.getElementById('sbsBeforeImg');
  const sbsAfterImg = document.getElementById('sbsAfterImg');

  // Controls
  const modeButtons = document.querySelectorAll('.btn-segment[data-mode]');
  const btnHorizontal = document.getElementById('btnHorizontal');
  const btnVertical = document.getElementById('btnVertical');
  const directionGroup = document.getElementById('directionGroup');
  const opacityGroup = document.getElementById('opacityGroup');
  const opacityRange = document.getElementById('opacityRange');
  const opacityVal = document.getElementById('opacityVal');
  const btnSwap = document.getElementById('btnSwap');
  const btnReset = document.getElementById('btnReset');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const inputBefore = document.getElementById('inputBefore');
  const inputAfter = document.getElementById('inputAfter');

  // State Variables
  let sliderPos = 50; // percentage (0 - 100)
  let currentMode = 'slider'; // 'slider', 'fade', 'side', 'toggle'
  let isVertical = false;
  let isDragging = false;
  let isHolding = false;

  // Initialize
  updateSliderPosition(sliderPos);

  // --- Slider Positioning Logic ---
  function updateSliderPosition(pos) {
    sliderPos = Math.max(0, Math.min(100, pos));

    if (currentMode === 'slider') {
      if (!isVertical) {
        afterWrapper.style.clipPath = `inset(0 0 0 ${sliderPos}%)`;
        afterWrapper.style.opacity = '1';
        sliderHandle.style.left = `${sliderPos}%`;
        sliderHandle.style.top = '0';
      } else {
        afterWrapper.style.clipPath = `inset(${sliderPos}% 0 0 0)`;
        afterWrapper.style.opacity = '1';
        sliderHandle.style.top = `${sliderPos}%`;
        sliderHandle.style.left = '0';
      }
      sliderHandle.setAttribute('aria-valuenow', Math.round(sliderPos));
    } else if (currentMode === 'fade') {
      afterWrapper.style.clipPath = 'none';
      afterWrapper.style.opacity = sliderPos / 100;
      opacityRange.value = sliderPos;
      opacityVal.textContent = `${Math.round(sliderPos)}%`;
    }
  }

  // --- Pointer & Drag Handling ---
  function handlePointerMove(e) {
    if (!isDragging && currentMode !== 'toggle') return;

    const rect = comparisonWrapper.getBoundingClientRect();
    let percent = 50;

    if (!isVertical) {
      const x = e.clientX - rect.left;
      percent = (x / rect.width) * 100;
    } else {
      const y = e.clientY - rect.top;
      percent = (y / rect.height) * 100;
    }

    if (currentMode === 'slider' || currentMode === 'fade') {
      updateSliderPosition(percent);
    }
  }

  function startDrag(e) {
    if (currentMode === 'side') return;
    
    if (currentMode === 'toggle') {
      isHolding = true;
      afterWrapper.style.opacity = '0';
      return;
    }

    isDragging = true;
    sliderHandle.classList.add('active');
    handlePointerMove(e);
  }

  function stopDrag() {
    if (isHolding) {
      isHolding = false;
      afterWrapper.style.opacity = '1';
    }
    isDragging = false;
    sliderHandle.classList.remove('active');
  }

  // Event Listeners for Dragging
  comparisonWrapper.addEventListener('pointerdown', (e) => {
    comparisonWrapper.setPointerCapture(e.pointerId);
    startDrag(e);
  });

  comparisonWrapper.addEventListener('pointermove', handlePointerMove);

  comparisonWrapper.addEventListener('pointerup', (e) => {
    comparisonWrapper.releasePointerCapture(e.pointerId);
    stopDrag();
  });

  comparisonWrapper.addEventListener('pointercancel', stopDrag);

  // --- Mode Switching ---
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      modeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      currentMode = btn.dataset.mode;
      applyMode(currentMode);
    });
  });

  function applyMode(mode) {
    comparisonWrapper.classList.remove('hidden');
    sideBySideWrapper.classList.add('hidden');
    sliderHandle.classList.remove('hidden');
    directionGroup.classList.remove('hidden');
    opacityGroup.classList.add('hidden');

    if (mode === 'slider') {
      updateSliderPosition(sliderPos);
    } else if (mode === 'fade') {
      opacityGroup.classList.remove('hidden');
      sliderHandle.classList.add('hidden');
      directionGroup.classList.add('hidden');
      updateSliderPosition(opacityRange.value);
    } else if (mode === 'side') {
      comparisonWrapper.classList.add('hidden');
      sideBySideWrapper.classList.remove('hidden');
      directionGroup.classList.add('hidden');
    } else if (mode === 'toggle') {
      sliderHandle.classList.add('hidden');
      directionGroup.classList.add('hidden');
      afterWrapper.style.clipPath = 'none';
      afterWrapper.style.opacity = '1';
    }
  }

  // --- Direction Control ---
  btnHorizontal.addEventListener('click', () => {
    btnHorizontal.classList.add('active');
    btnVertical.classList.remove('active');
    isVertical = false;
    comparisonWrapper.classList.remove('vertical');
    comparisonWrapper.classList.add('horizontal');
    updateSliderPosition(sliderPos);
  });

  btnVertical.addEventListener('click', () => {
    btnVertical.classList.add('active');
    btnHorizontal.classList.remove('active');
    isVertical = true;
    comparisonWrapper.classList.remove('horizontal');
    comparisonWrapper.classList.add('vertical');
    updateSliderPosition(sliderPos);
  });

  // --- Opacity Slider Input ---
  opacityRange.addEventListener('input', (e) => {
    updateSliderPosition(e.target.value);
  });

  // --- Image Swap Action ---
  btnSwap.addEventListener('click', () => {
    const tempBeforeSrc = beforeImg.src;
    beforeImg.src = afterImg.src;
    afterImg.src = tempBeforeSrc;

    sbsBeforeImg.src = afterImg.src;
    sbsAfterImg.src = beforeImg.src;
  });

  // --- Reset Action ---
  btnReset.addEventListener('click', () => {
    updateSliderPosition(50);
  });

  // --- Fullscreen Toggle ---
  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      comparisonCard.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });

  // --- Keyboard Accessibility ---
  sliderHandle.addEventListener('keydown', (e) => {
    if (currentMode !== 'slider') return;

    let step = 1;
    if (e.shiftKey) step = 10;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      updateSliderPosition(sliderPos - step);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      updateSliderPosition(sliderPos + step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      updateSliderPosition(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      updateSliderPosition(100);
    }
  });

  // --- Custom File Upload Handlers ---
  function handleFileSelect(inputElement, targetImg1, targetImg2) {
    inputElement.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        targetImg1.src = url;
        if (targetImg2) targetImg2.src = url;
      }
    });
  }

  handleFileSelect(inputBefore, beforeImg, sbsBeforeImg);
  handleFileSelect(inputAfter, afterImg, sbsAfterImg);
});
