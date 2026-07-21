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
  const metricCapex = document.getElementById('metricCapex');
  const metricCapexDesc = document.getElementById('metricCapexDesc');
  const metricLcoe = document.getElementById('metricLcoe');
  const metricLcoeDesc = document.getElementById('metricLcoeDesc');
  const metricSaved = document.getElementById('metricSaved');
  const metricSavedDesc = document.getElementById('metricSavedDesc');
  const metricDamageSaved = document.getElementById('metricDamageSaved');
  const metricDamageSavedDesc = document.getElementById('metricDamageSavedDesc');

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
  let isDragging = false;
  let activeDragId = null;

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
    renderPresets();
    applyPreset('bau');
    renderCompactEnergyRows();
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

  // --- Render Compact Energy Rows Layout: name [bar] percent lock ---
  function renderCompactEnergyRows() {
    slidersList.innerHTML = '';
    modelData.sources.forEach(s => {
      const val = currentValues[s.id] || 0;
      const row = document.createElement('div');
      row.className = 'compact-energy-row has-tooltip';
      row.id = `row_${s.id}`;
      row.dataset.id = s.id;
      row.setAttribute('data-tooltip', `${s.desc} (物理上限 ${s.maxCap}%)`);

      row.innerHTML = `
        <div class="energy-name-col" style="color:${s.color}">
          <i class="${s.icon}"></i> ${s.name.split(' ')[0]}
        </div>
        <div class="color-bar-col" id="bar_track_${s.id}">
          <div class="color-bar-fill" id="bar_fill_${s.id}" style="width:${val}%; background-color:${s.color};"></div>
        </div>
        <div class="energy-pct-col" id="pct_${s.id}">${val.toFixed(0)}%</div>
        <div class="energy-lock-col">
          <button class="lock-btn" id="lock_${s.id}" title="鎖定此能源比例">
            <i class="ri-lock-unlock-line"></i>
          </button>
        </div>
      `;

      slidersList.appendChild(row);

      // Interactive Click & Drag Bar Events
      const barTrack = row.querySelector(`#bar_track_${s.id}`);
      const lockBtn = row.querySelector(`#lock_${s.id}`);

      const handleBarPos = (e) => {
        const rect = barTrack.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const pct = Math.round((offsetX / rect.width) * 100);
        onSliderInput(s.id, pct);
      };

      barTrack.addEventListener('mousedown', (e) => {
        isDragging = true;
        activeDragId = s.id;
        handleBarPos(e);
      });

      barTrack.addEventListener('touchstart', (e) => {
        isDragging = true;
        activeDragId = s.id;
        handleBarPos(e);
      }, { passive: true });

      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        lockedState[s.id] = !lockedState[s.id];
        lockBtn.classList.toggle('locked', lockedState[s.id]);
        lockBtn.innerHTML = lockedState[s.id] ? '<i class="ri-lock-fill"></i>' : '<i class="ri-lock-unlock-line"></i>';
      });
    });

    // Global Mousemove & Mouseup for smooth bar dragging
    window.addEventListener('mousemove', (e) => {
      if (!isDragging || !activeDragId) return;
      const barTrack = document.getElementById(`bar_track_${activeDragId}`);
      if (barTrack) {
        const rect = barTrack.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const pct = Math.round((offsetX / rect.width) * 100);
        onSliderInput(activeDragId, pct);
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      activeDragId = null;
    });

    window.addEventListener('touchmove', (e) => {
      if (!isDragging || !activeDragId) return;
      const barTrack = document.getElementById(`bar_track_${activeDragId}`);
      if (barTrack) {
        const rect = barTrack.getBoundingClientRect();
        const clientX = e.touches[0].clientX;
        const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const pct = Math.round((offsetX / rect.width) * 100);
        onSliderInput(activeDragId, pct);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      isDragging = false;
      activeDragId = null;
    });
  }

  function updateSlidersUI() {
    modelData.sources.forEach(s => {
      const barFill = document.getElementById(`bar_fill_${s.id}`);
      const pct = document.getElementById(`pct_${s.id}`);
      const row = document.getElementById(`row_${s.id}`);
      const lockBtn = document.getElementById(`lock_${s.id}`);

      const val = currentValues[s.id] || 0;
      if (barFill) barFill.style.width = `${val}%`;
      if (pct) pct.textContent = `${val.toFixed(0)}%`;

      const isExceeded = val > s.maxCap;
      if (row) {
        row.classList.toggle('cap-exceeded', isExceeded);
        row.setAttribute('data-tooltip', isExceeded 
          ? `⚠️ 超過物理上限 (${s.maxCap}%)！ ${s.desc}`
          : `${s.desc} (物理上限 ${s.maxCap}%)`
        );
      }

      if (lockBtn) {
        lockBtn.classList.toggle('locked', !!lockedState[s.id]);
        lockBtn.innerHTML = lockedState[s.id] ? '<i class="ri-lock-fill"></i>' : '<i class="ri-lock-unlock-line"></i>';
      }
    });
  }

  // --- Auto-Balancing Slider Engine ---
  function onSliderInput(changedId, newVal) {
    const isAutoBalance = autoBalanceToggle.checked;

    if (!isAutoBalance) {
      currentValues[changedId] = newVal;
      updateSlidersUI();
      updateSimulation();
      return;
    }

    currentValues[changedId] = newVal;

    const cleanSourceIds = ['solar', 'wind', 'hydro', 'nuclear'];
    
    let fixedSum = 0;
    modelData.sources.forEach(s => {
      if (s.id === changedId || lockedState[s.id]) {
        fixedSum += currentValues[s.id];
      }
    });

    let remainder = Math.max(0, 100 - fixedSum);

    const availableTargets = cleanSourceIds.filter(id => id !== changedId && !lockedState[id]);

    if (availableTargets.length > 0) {
      const currentTargetSum = availableTargets.reduce((acc, id) => acc + currentValues[id], 0);

      if (currentTargetSum > 0) {
        availableTargets.forEach(id => {
          const sObj = modelData.sources.find(x => x.id === id);
          let share = Math.round((currentValues[id] / currentTargetSum) * remainder * 10) / 10;
          currentValues[id] = Math.min(sObj ? sObj.maxCap : 100, share);
        });
      } else {
        const equalShare = remainder / availableTargets.length;
        availableTargets.forEach(id => {
          const sObj = modelData.sources.find(x => x.id === id);
          currentValues[id] = Math.min(sObj ? sObj.maxCap : 100, Math.round(equalShare * 10) / 10);
        });
      }
    }

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

  // --- Physics & Economic Cost Simulation Engine (2100) ---
  function updateSimulation() {
    let totalDemand = 0;
    let weightedIntensity = 0;
    let cleanShare = 0;

    let totalLcoeSum = 0;
    let totalGdpShareSum = 0;

    modelData.sources.forEach(s => {
      const val = currentValues[s.id] || 0;
      totalDemand += val;
      weightedIntensity += (val / 100) * s.intensity;

      if (s.type === 'clean') {
        cleanShare += val;
      }

      totalLcoeSum += (val / 100) * s.lcoe;
      totalGdpShareSum += (val / 100) * (s.gdpShare || 0.5);
    });

    totalDemandVal.textContent = `${totalDemand.toFixed(1)}%`;
    totalDemandFill.style.width = `${Math.min(100, totalDemand)}%`;

    if (Math.abs(totalDemand - 100) < 0.5) {
      demandStatusText.className = 'demand-status-text';
      demandStatusText.innerHTML = `<i class="ri-checkbox-circle-fill"></i> 供需平衡：100% 需求完全滿足`;
    } else {
      demandStatusText.className = 'demand-status-text warning';
      demandStatusText.innerHTML = `<i class="ri-error-warning-fill"></i> 供需不平衡 (${totalDemand.toFixed(1)}%)，請調整或開啟自動平衡`;
    }

    const bauIntensity = 575;
    const intensityRatio = weightedIntensity / bauIntensity;

    const deltaTemp = Math.max(1.2, Math.min(5.0, 1.35 + (intensityRatio * 2.35)));
    const deltaSea = Math.max(22, Math.min(160, 24 + 48 * Math.pow(Math.max(0, deltaTemp - 1.0), 1.35)));

    const annualBauCO2 = 45;
    const currentAnnualCO2 = annualBauCO2 * intensityRatio;
    const savedGtCO2 = Math.max(0, (annualBauCO2 - currentAnnualCO2) * 75);

    const annualGdpInvestment = Math.max(1.0, totalGdpShareSum);

    const varRenewableShare = (currentValues['solar'] || 0) + (currentValues['wind'] || 0);
    const storagePenalty = varRenewableShare > 45 ? (varRenewableShare - 45) * 0.45 : 0;
    const relativeLcoeIndex = ((totalLcoeSum / 68.5) * 100) + storagePenalty;

    const gdpDamageLossPct = Math.max(1.5, Math.pow(deltaTemp / 1.35, 2.5) * 2.2);
    const gdpDamageSavedPct = Math.max(0, 18.0 - gdpDamageLossPct);

    metricTemp.textContent = `+${deltaTemp.toFixed(1)}°C`;
    metricSea.textContent = `${deltaSea.toFixed(1)} cm`;

    metricCapex.textContent = `${annualGdpInvestment.toFixed(1)} %`;
    metricCapexDesc.textContent = `每年全球 GDP 投入綠能建置與電網`;

    metricLcoe.textContent = `${relativeLcoeIndex.toFixed(1)}`;
    metricLcoeDesc.textContent = `相對發電成本指數 (BAU基準 100.0)`;

    metricSaved.textContent = `${Math.round(savedGtCO2)} Gt CO₂`;

    metricDamageSaved.textContent = `${gdpDamageSavedPct.toFixed(1)} % GDP`;
    metricDamageSavedDesc.textContent = `2100 年避開之全球氣候災難經濟損失`;

    if (deltaTemp <= 1.5) {
      metricTempDesc.textContent = "🟢 2100 達成巴黎協定 1.5°C 安全控制線";
    } else if (deltaTemp <= 2.0) {
      metricTempDesc.textContent = "🟠 2100 巴黎協定 2.0°C 上限控制線";
    } else {
      metricTempDesc.textContent = "🔴 2100 高風險氣候失控衝擊軌跡";
    }

    if (deltaSea <= 40) {
      metricSeaDesc.textContent = "🟢 2100 沿海防禦可控制範圍";
    } else {
      metricSeaDesc.textContent = "🔴 2100 沿海大都會與低窪島國淹沒風險";
    }

    const thermoPct = Math.min(100, Math.max(15, ((deltaTemp - 1.0) / 3.5) * 80 + 15));
    thermoFill.style.height = `${thermoPct}%`;

    const seaPct = Math.min(100, Math.max(15, ((deltaSea - 20) / 110) * 80 + 15));
    seaWaveFill.style.height = `${seaPct}%`;

    drawEnergyMixCanvas();
    drawTrajectoryCanvas(intensityRatio);
  }

  // --- Canvas Rendering 1: Stacked Energy Mix Bar ---
  function drawEnergyMixCanvas() {
    const width = energyMixCanvas.width;
    const height = energyMixCanvas.height;

    mixCtx.clearRect(0, 0, width, height);

    mixCtx.fillStyle = '#04060c';
    mixCtx.fillRect(0, 0, width, height);

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

      if (segmentWidth > 35) {
        mixCtx.fillStyle = s.type === 'fossil' && s.id !== 'gas' ? '#ffffff' : '#0f172a';
        mixCtx.font = 'bold 11px "JetBrains Mono", monospace';
        mixCtx.fillText(`${Math.round(val)}%`, currentX + 6, barY + 24);
      }

      currentX += segmentWidth;
    });

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

  // --- Canvas Rendering 2: 2025 - 2100 CO2 Trajectory ---
  function drawTrajectoryCanvas(intensityRatio) {
    const width = trajectoryCanvas.width;
    const height = trajectoryCanvas.height;

    trajCtx.clearRect(0, 0, width, height);

    trajCtx.fillStyle = '#04060c';
    trajCtx.fillRect(0, 0, width, height);

    for (let g = 0; g <= 60; g += 15) {
      const py = height - 25 - (g / 60) * (height - 45);
      trajCtx.beginPath();
      trajCtx.moveTo(45, py);
      trajCtx.lineTo(width - 25, py);
      trajCtx.strokeStyle = 'rgba(255,255,255,0.06)';
      trajCtx.stroke();

      trajCtx.fillStyle = 'rgba(255,255,255,0.3)';
      trajCtx.font = '10px "JetBrains Mono", monospace';
      trajCtx.fillText(`${g} Gt`, 12, py + 3);
    }

    const years = [2025, 2040, 2060, 2080, 2100];
    years.forEach(y => {
      const px = 45 + ((y - 2025) / 75) * (width - 70);
      trajCtx.fillStyle = 'rgba(255,255,255,0.4)';
      trajCtx.font = '10px "JetBrains Mono", monospace';
      trajCtx.fillText(`${y}`, px - 10, height - 8);
    });

    trajCtx.beginPath();
    trajCtx.setLineDash([5, 4]);
    for (let yr = 2025; yr <= 2100; yr += 2) {
      const px = 45 + ((yr - 2025) / 75) * (width - 70);
      const bauCO2 = 42 + ((yr - 2025) / 75) * 8;
      const py = height - 25 - (bauCO2 / 60) * (height - 45);
      if (yr === 2025) trajCtx.moveTo(px, py);
      else trajCtx.lineTo(px, py);
    }
    trajCtx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    trajCtx.lineWidth = 2;
    trajCtx.stroke();
    trajCtx.setLineDash([]);

    trajCtx.beginPath();
    for (let yr = 2025; yr <= 2100; yr += 2) {
      const px = 45 + ((yr - 2025) / 75) * (width - 70);
      const bauCO2 = 42 + ((yr - 2025) / 75) * 8;
      const transitionFactor = 1 - Math.min(1, ((yr - 2025) / 30)) * (1 - intensityRatio);
      const currentCO2 = Math.max(0, bauCO2 * transitionFactor);
      
      const py = height - 25 - (currentCO2 / 60) * (height - 45);
      if (yr === 2025) trajCtx.moveTo(px, py);
      else trajCtx.lineTo(px, py);
    }

    const strokeColor = intensityRatio <= 0.4 ? '#34d399' : (intensityRatio <= 0.75 ? '#38bdf8' : '#ef4444');
    trajCtx.strokeStyle = strokeColor;
    trajCtx.lineWidth = 3;
    trajCtx.stroke();

    trajCtx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    trajCtx.font = '11px "Outfit", sans-serif';
    trajCtx.fillText('-- 無介入現狀 (BAU)', width - 140, 25);

    trajCtx.fillStyle = strokeColor;
    trajCtx.font = 'bold 11px "Outfit", sans-serif';
    trajCtx.fillText('— 當前能源轉型軌跡', width - 140, 42);
  }
});
