document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const presetContainer = document.getElementById('presetContainer');
  const totalDemandVal = document.getElementById('totalDemandVal');
  const totalDemandFill = document.getElementById('totalDemandFill');
  const demandStatusText = document.getElementById('demandStatusText');
  const autoBalanceToggle = document.getElementById('autoBalanceToggle');
  const slidersList = document.getElementById('slidersList');

  // Metric Elements
  const metricTemp = document.getElementById('metricTemp');
  const metricTempDesc = document.getElementById('metricTempDesc');
  const metricSea = document.getElementById('metricSea');
  const metricSeaDesc = document.getElementById('metricSeaDesc');
  const metricSaved = document.getElementById('metricSaved');
  const metricCleanShare = document.getElementById('metricCleanShare');

  // Gauge Fills
  const thermoFill = document.getElementById('thermoFill');
  const seaWaveFill = document.getElementById('seaWaveFill');

  // Canvas Elements
  const energyMixCanvas = document.getElementById('energyMixCanvas');
  const trajectoryCanvas = document.getElementById('trajectoryCanvas');
  const mixCtx = energyMixCanvas.getContext('2d');
  const trajCtx = trajectoryCanvas.getContext('2d');

  // Data Model State
  let modelData = null;
  let currentValues = {};
  let lockedState = {};

  // --- Load Model Data ---
  try {
    const res = await fetch('energy_model.json');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    modelData = await res.json();
    initApp();
  } catch (err) {
    console.error('Failed to load energy_model.json:', err);
    slidersList.innerHTML = `<div class="error-msg">載入能源模型數據失敗。</div>`;
    return;
  }

  function initApp() {
    // 1. Render Presets
    renderPresets();

    // 2. Initialize Values from Default Preset (BAU)
    applyPreset('bau');

    // 3. Render Sliders UI
    renderSliders();

    // 4. Update Simulation
    updateSimulation();
  }

  // --- Render Preset Buttons ---
  function renderPresets() {
    modelData.presets.forEach(p => {
      const btn = document.createElement('button');
      btn.className = `preset-btn ${p.id === 'bau' ? 'active' : ''}`;
      btn.dataset.id = p.id;
      btn.textContent = p.name;
      btn.title = p.desc;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyPreset(p.id);
      });
      presetContainer.appendChild(btn);
    });
  }

  function applyPreset(presetId) {
    const preset = modelData.presets.find(p => p.id === presetId);
    if (!preset) return;

    modelData.sources.forEach(s => {
      currentValues[s.id] = preset.values[s.id] !== undefined ? preset.values[s.id] : 0;
      lockedState[s.id] = false;
    });

    updateSlidersUI();
    updateSimulation();
  }

  // --- Render Sliders List ---
  function renderSliders() {
    slidersList.innerHTML = '';
    modelData.sources.forEach(s => {
      const item = document.createElement('div');
      item.className = 'slider-item';
      item.dataset.id = s.id;
      item.innerHTML = `
        <div class="slider-header">
          <span class="slider-title" style="color:${s.color}">
            <i class="${s.icon}"></i> ${s.name}
          </span>
          <div class="slider-val-box">
            <span class="slider-pct" id="pct_${s.id}">${currentValues[s.id]}%</span>
            <button class="lock-btn" id="lock_${s.id}" title="鎖定此能源比例">
              <i class="ri-lock-unlock-line"></i>
            </button>
          </div>
        </div>
        <input type="range" class="slider-track" id="track_${s.id}" min="0" max="100" step="1" value="${currentValues[s.id]}">
        <span class="slider-desc">${s.desc}</span>
      `;

      slidersList.appendChild(item);

      // Event Listeners
      const track = item.querySelector(`#track_${s.id}`);
      const lockBtn = item.querySelector(`#lock_${s.id}`);

      track.addEventListener('input', (e) => {
        onSliderInput(s.id, parseFloat(e.target.value));
      });

      lockBtn.addEventListener('click', () => {
        lockedState[s.id] = !lockedState[s.id];
        lockBtn.classList.toggle('locked', lockedState[s.id]);
        lockBtn.innerHTML = lockedState[s.id] ? '<i class="ri-lock-fill"></i>' : '<i class="ri-lock-unlock-line"></i>';
      });
    });
  }

  function updateSlidersUI() {
    modelData.sources.forEach(s => {
      const track = document.getElementById(`track_${s.id}`);
      const pct = document.getElementById(`pct_${s.id}`);
      const lockBtn = document.getElementById(`lock_${s.id}`);
      if (track) track.value = currentValues[s.id];
      if (pct) pct.textContent = `${currentValues[s.id].toFixed(0)}%`;
      if (lockBtn) {
        lockBtn.classList.toggle('locked', !!lockedState[s.id]);
        lockBtn.innerHTML = lockedState[s.id] ? '<i class="ri-lock-fill"></i>' : '<i class="ri-lock-unlock-line"></i>';
      }
    });
  }

  // --- Auto-Balancing Slider Math Engine ---
  function onSliderInput(changedId, newVal) {
    const isAutoBalance = autoBalanceToggle.checked;

    if (!isAutoBalance) {
      currentValues[changedId] = newVal;
      updateSlidersUI();
      updateSimulation();
      return;
    }

    // Auto-Balance Enabled Mode
    currentValues[changedId] = newVal;

    // Identify clean/renewable sources for auto distribution
    const cleanSourceIds = ['solar', 'wind', 'hydro', 'nuclear'];
    
    // Calculate total sum of locked sources and changed source
    let fixedSum = 0;
    modelData.sources.forEach(s => {
      if (s.id === changedId || lockedState[s.id]) {
        fixedSum += currentValues[s.id];
      }
    });

    // Remainder needed to achieve 100% total
    let remainder = Math.max(0, 100 - fixedSum);

    // List of unlocked clean sources available to absorb remainder
    const availableTargets = cleanSourceIds.filter(id => id !== changedId && !lockedState[id]);

    if (availableTargets.length > 0) {
      const currentTargetSum = availableTargets.reduce((acc, id) => acc + currentValues[id], 0);

      if (currentTargetSum > 0) {
        availableTargets.forEach(id => {
          currentValues[id] = Math.round((currentValues[id] / currentTargetSum) * remainder * 10) / 10;
        });
      } else {
        // Equal split if all were 0
        const equalShare = remainder / availableTargets.length;
        availableTargets.forEach(id => {
          currentValues[id] = Math.round(equalShare * 10) / 10;
        });
      }
    }

    // Adjust rounding error to ensure exact 100%
    let finalSum = modelData.sources.reduce((acc, s) => acc + currentValues[s.id], 0);
    if (finalSum !== 100 && availableTargets.length > 0) {
      const diff = 100 - finalSum;
      currentValues[availableTargets[0]] = Math.max(0, Math.round((currentValues[availableTargets[0]] + diff) * 10) / 10);
    }

    updateSlidersUI();
    updateSimulation();
  }

  autoBalanceToggle.addEventListener('change', () => {
    updateSimulation();
  });

  // --- Physics Simulation & Climate Metric Calculation Engine ---
  function updateSimulation() {
    // 1. Calculate Total Demand & Check Balance
    let totalDemand = 0;
    let weightedIntensity = 0;
    let cleanShare = 0;

    modelData.sources.forEach(s => {
      const val = currentValues[s.id] || 0;
      totalDemand += val;
      weightedIntensity += (val / 100) * s.intensity;

      if (s.type === 'clean') {
        cleanShare += val;
      }
    });

    // Update Demand Meter UI
    totalDemandVal.textContent = `${totalDemand.toFixed(1)}%`;
    totalDemandFill.style.width = `${Math.min(100, totalDemand)}%`;

    if (Math.abs(totalDemand - 100) < 0.5) {
      demandStatusText.className = 'demand-status-text';
      demandStatusText.innerHTML = `<i class="ri-checkbox-circle-fill"></i> 供需平衡：100% 需求完全滿足`;
    } else {
      demandStatusText.className = 'demand-status-text warning';
      demandStatusText.innerHTML = `<i class="ri-error-warning-fill"></i> 供需不平衡 (目前 ${totalDemand.toFixed(1)}%)，請調整或開啟自動平衡`;
    }

    // 2. Calculate Climate Outcomes for 2050
    // Baseline BAU average carbon intensity = 575 g CO2/kWh
    const bauIntensity = 575;
    const intensityRatio = weightedIntensity / bauIntensity;

    // 2050 Earth Mean Temp Rise (delta T)
    // BAU = +3.2°C, Net-Zero = +1.4°C
    const deltaTemp = Math.max(1.2, Math.min(4.5, 1.3 + (intensityRatio * 1.9)));

    // 2050 Global Sea Level Rise (delta SL in cm)
    // BAU = 65 cm, Net-Zero = 24 cm
    const deltaSea = Math.max(18, Math.min(95, 20 + 22 * Math.pow(Math.max(0, deltaTemp - 1.0), 1.3)));

    // Cumulative Gt CO2 Saved (2025 - 2050)
    // BAU Annual Emission ~42 Gt CO2/yr, total 25-yr BAU sum ~1050 Gt
    const annualBauCO2 = 42;
    const currentAnnualCO2 = annualBauCO2 * intensityRatio;
    const savedGtCO2 = Math.max(0, (annualBauCO2 - currentAnnualCO2) * 25);

    // Update Metrics UI
    metricTemp.textContent = `+${deltaTemp.toFixed(1)}°C`;
    metricSea.textContent = `${deltaSea.toFixed(1)} cm`;
    metricSaved.textContent = `${Math.round(savedGtCO2)} Gt CO₂`;
    metricCleanShare.textContent = `${cleanShare.toFixed(0)} %`;

    // Alert colors
    if (deltaTemp <= 1.5) {
      metricTempDesc.textContent = "🟢 達成巴黎協定 1.5°C 安全控制線";
    } else if (deltaTemp <= 2.0) {
      metricTempDesc.textContent = "🟠 巴黎協定 2.0°C 上限控制線";
    } else {
      metricTempDesc.textContent = "🔴 無介入高風險氣候災難軌跡";
    }

    if (deltaSea <= 30) {
      metricSeaDesc.textContent = "🟢 沿海防禦可控制範圍";
    } else {
      metricSeaDesc.textContent = "🔴 沿海大都會與島國淹沒高風險";
    }

    // Update Thermometer & Sea Wave Fills
    // Thermometer 1.0°C - 4.0°C mapped to 20% - 95%
    const thermoPct = Math.min(100, Math.max(15, ((deltaTemp - 1.0) / 3.0) * 80 + 15));
    thermoFill.style.height = `${thermoPct}%`;

    // Sea level 20cm - 80cm mapped to 20% - 95%
    const seaPct = Math.min(100, Math.max(15, ((deltaSea - 20) / 60) * 80 + 15));
    seaWaveFill.style.height = `${seaPct}%`;

    // Render Canvas Visualizations
    drawEnergyMixCanvas();
    drawTrajectoryCanvas(intensityRatio);
  }

  // --- Canvas Rendering 1: Stacked Energy Mix Bar ---
  function drawEnergyMixCanvas() {
    const width = energyMixCanvas.width;
    const height = energyMixCanvas.height;

    mixCtx.clearRect(0, 0, width, height);

    // Background
    mixCtx.fillStyle = '#04060c';
    mixCtx.fillRect(0, 0, width, height);

    // Draw Stacked Horizontal Bar
    let currentX = 20;
    const barY = 25;
    const barHeight = 40;
    const totalBarWidth = width - 40;

    modelData.sources.forEach(s => {
      const val = currentValues[s.id] || 0;
      if (val <= 0) return;

      const segmentWidth = (val / 100) * totalBarWidth;

      mixCtx.fillStyle = s.color;
      mixCtx.fillRect(currentX, barY, segmentWidth, barHeight);

      // Label inside bar if wide enough
      if (segmentWidth > 35) {
        mixCtx.fillStyle = s.type === 'fossil' && s.id !== 'gas' ? '#ffffff' : '#0f172a';
        mixCtx.font = 'bold 11px "JetBrains Mono", monospace';
        mixCtx.fillText(`${Math.round(val)}%`, currentX + 6, barY + 24);
      }

      currentX += segmentWidth;
    });

    // Legend items below bar
    let legendX = 20;
    const legendY = 92;

    modelData.sources.forEach(s => {
      const val = currentValues[s.id] || 0;
      if (val <= 0) return;

      mixCtx.fillStyle = s.color;
      mixCtx.fillRect(legendX, legendY - 8, 10, 10);

      mixCtx.fillStyle = 'rgba(255,255,255,0.7)';
      mixCtx.font = '11px "Outfit", sans-serif';
      mixCtx.fillText(`${s.name.split(' ')[0]}: ${Math.round(val)}%`, legendX + 14, legendY);

      legendX += 105;
    });
  }

  // --- Canvas Rendering 2: 2025 - 2050 CO2 Trajectory ---
  function drawTrajectoryCanvas(intensityRatio) {
    const width = trajectoryCanvas.width;
    const height = trajectoryCanvas.height;

    trajCtx.clearRect(0, 0, width, height);

    // Background
    trajCtx.fillStyle = '#04060c';
    trajCtx.fillRect(0, 0, width, height);

    // Grid lines
    trajCtx.strokeStyle = 'rgba(255,255,255,0.06)';
    trajCtx.lineWidth = 1;
    for (let g = 0; g <= 50; g += 10) {
      const py = height - 25 - (g / 50) * (height - 45);
      trajCtx.beginPath();
      trajCtx.moveTo(45, py);
      trajCtx.lineTo(width - 25, py);
      trajCtx.stroke();

      trajCtx.fillStyle = 'rgba(255,255,255,0.3)';
      trajCtx.font = '10px "JetBrains Mono", monospace';
      trajCtx.fillText(`${g} Gt`, 12, py + 3);
    }

    // X-axis years
    const years = [2025, 2030, 2035, 2040, 2045, 2050];
    years.forEach(y => {
      const px = 45 + ((y - 2025) / 25) * (width - 70);
      trajCtx.fillStyle = 'rgba(255,255,255,0.4)';
      trajCtx.font = '10px "JetBrains Mono", monospace';
      trajCtx.fillText(`${y}`, px - 10, height - 8);
    });

    // 1. BAU Baseline Trajectory (Dashed Red Line)
    trajCtx.beginPath();
    trajCtx.setLineDash([5, 4]);
    for (let yr = 2025; yr <= 2050; yr++) {
      const px = 45 + ((yr - 2025) / 25) * (width - 70);
      const bauCO2 = 40 + ((yr - 2025) / 25) * 5; // 40 -> 45 Gt
      const py = height - 25 - (bauCO2 / 50) * (height - 45);
      if (yr === 2025) trajCtx.moveTo(px, py);
      else trajCtx.lineTo(px, py);
    }
    trajCtx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    trajCtx.lineWidth = 2;
    trajCtx.stroke();
    trajCtx.setLineDash([]);

    // 2. Current User Energy Mix Trajectory (Solid Blue/Green Line)
    trajCtx.beginPath();
    for (let yr = 2025; yr <= 2050; yr++) {
      const px = 45 + ((yr - 2025) / 25) * (width - 70);
      const bauCO2 = 40 + ((yr - 2025) / 25) * 5;
      
      // Trajectory transition curves towards 2050 target
      const transitionFactor = 1 - ((yr - 2025) / 25) * (1 - intensityRatio);
      const currentCO2 = Math.max(0, bauCO2 * transitionFactor);
      
      const py = height - 25 - (currentCO2 / 50) * (height - 45);
      if (yr === 2025) trajCtx.moveTo(px, py);
      else trajCtx.lineTo(px, py);
    }

    const strokeColor = intensityRatio <= 0.4 ? '#34d399' : (intensityRatio <= 0.75 ? '#38bdf8' : '#ef4444');
    trajCtx.strokeStyle = strokeColor;
    trajCtx.lineWidth = 3;
    trajCtx.stroke();

    // Chart Legend Labels
    trajCtx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    trajCtx.font = '11px "Outfit", sans-serif';
    trajCtx.fillText('-- 無介入現狀 (BAU)', width - 140, 25);

    trajCtx.fillStyle = strokeColor;
    trajCtx.font = 'bold 11px "Outfit", sans-serif';
    trajCtx.fillText('— 當前能源轉型軌跡', width - 140, 42);
  }
});
