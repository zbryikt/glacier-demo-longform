document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const shortPresetContainer = document.getElementById('shortPresetContainer');
  const totalDemandVal = document.getElementById('totalDemandVal');
  const demandStackedBar = document.getElementById('demandStackedBar');
  const demandStatusText = document.getElementById('demandStatusText');
  const autoBalanceToggle = document.getElementById('autoBalanceToggle');
  const slidersList = document.getElementById('slidersList');

  // Embedded Live Metric Elements
  const metricCapex = document.getElementById('metricCapex');
  const thermoLiveVal = document.getElementById('thermoLiveVal');
  const seaLiveVal = document.getElementById('seaLiveVal');

  // Gauge & City Submersion Elements
  const thermoFill = document.getElementById('thermoFill');
  const cityWaterFill = document.getElementById('cityWaterFill');
  const cityMarkersList = document.getElementById('cityMarkersList');

  // Canvas Elements
  const trajectoryCanvas = document.getElementById('trajectoryCanvas');
  const trajCtx = trajectoryCanvas.getContext('2d');

  // Data Model State
  let modelData = null;
  let currentValues = {};
  let lockedState = {};
  let isDragging = false;
  let activeDragId = null;

  // Iconic Coastal Cities Elevations & Inundation Risk Thresholds (cm of 2100 sea level rise)
  const iconicCities = [
    { id: 'maldives', name: '🏝️ 馬爾地夫', threshold: 25 },
    { id: 'venice', name: '🌊 威尼斯', threshold: 45 },
    { id: 'amsterdam', name: '🏛️ 阿姆斯特丹', threshold: 60 },
    { id: 'taipei', name: '🏙️ 台北盆地/淡水河口', threshold: 75 },
    { id: 'newyork', name: '🗽 紐約曼哈頓沿岸', threshold: 95 },
    { id: 'tokyo', name: '<ctrl42> 東京灣/江東區', threshold: 115 },
    { id: 'shanghai', name: '🌉 上海/長江口', threshold: 135 }
  ];

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
    bindShortPresets();
    applyPreset('bau');
    renderCompactEnergyRows();
    updateSimulation();
  }

  // --- Bind Shortened Preset Buttons ---
  function bindShortPresets() {
    if (!shortPresetContainer) return;
    const btns = shortPresetContainer.querySelectorAll('.short-preset-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyPreset(btn.dataset.id);
      });
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

  // --- Render Compact Energy Rows Layout: name [info-icon] [bar] percent lock ---
  function renderCompactEnergyRows() {
    slidersList.innerHTML = '';
    modelData.sources.forEach(s => {
      const val = currentValues[s.id] || 0;
      const row = document.createElement('div');
      row.className = 'compact-energy-row';
      row.id = `row_${s.id}`;
      row.dataset.id = s.id;

      row.innerHTML = `
        <div class="energy-name-col" style="color:${s.color}">
          <i class="${s.icon}"></i> ${s.name.split(' ')[0]}
          <i class="ri-information-line info-icon has-tooltip" id="info_${s.id}" data-tooltip="${s.desc} (上限 ${s.maxCap}%)"></i>
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
      const infoIcon = document.getElementById(`info_${s.id}`);
      const row = document.getElementById(`row_${s.id}`);
      const lockBtn = document.getElementById(`lock_${s.id}`);

      const val = currentValues[s.id] || 0;
      if (barFill) barFill.style.width = `${val}%`;
      if (pct) pct.textContent = `${val.toFixed(0)}%`;

      const isExceeded = val > s.maxCap;
      if (row) row.classList.toggle('cap-exceeded', isExceeded);
      if (infoIcon) {
        infoIcon.setAttribute('data-tooltip', isExceeded 
          ? `⚠️ 超過物理上限 (${s.maxCap}%)！ ${s.desc}`
          : `${s.desc} (物理上限 ${s.maxCap}%)`
        );
      }

      if (lockBtn) {
        lockBtn.classList.toggle('locked', !!lockedState[s.id]);
        lockBtn.innerHTML = lockedState[s.id] ? '<i class="ri-lock-fill"></i>' : '<i class="ri-lock-unlock-line"></i>';
      }
    });

    updateDemandStackedBar();
  }

  // --- Render Integrated Multi-Color Stacked Energy Mix Bar inside Demand Meter ---
  function updateDemandStackedBar() {
    if (!demandStackedBar || !modelData) return;
    demandStackedBar.innerHTML = '';

    modelData.sources.forEach(s => {
      const val = currentValues[s.id] || 0;
      if (val <= 0) return;

      const seg = document.createElement('div');
      seg.className = 'demand-segment';
      seg.style.width = `${val}%`;
      seg.style.backgroundColor = s.color;
      seg.title = `${s.name}: ${val.toFixed(0)}%`;
      demandStackedBar.appendChild(seg);
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
    let totalGdpShareSum = 0;

    modelData.sources.forEach(s => {
      const val = currentValues[s.id] || 0;
      totalDemand += val;
      weightedIntensity += (val / 100) * s.intensity;
      totalGdpShareSum += (val / 100) * (s.gdpShare || 0.5);
    });

    totalDemandVal.textContent = `${totalDemand.toFixed(1)}%`;

    if (Math.abs(totalDemand - 100) < 0.5) {
      demandStatusText.className = 'demand-status-text';
      demandStatusText.innerHTML = `<i class="ri-checkbox-circle-fill"></i> 供需平衡：100% 需求滿足`;
    } else {
      demandStatusText.className = 'demand-status-text warning';
      demandStatusText.innerHTML = `<i class="ri-error-warning-fill"></i> 不平衡 (${totalDemand.toFixed(1)}%)`;
    }

    const bauIntensity = 575;
    const intensityRatio = weightedIntensity / bauIntensity;

    const deltaTemp = Math.max(1.2, Math.min(5.0, 1.35 + (intensityRatio * 2.35)));
    const deltaSea = Math.max(22, Math.min(160, 24 + 48 * Math.pow(Math.max(0, deltaTemp - 1.0), 1.35)));

    const annualGdpInvestment = Math.max(1.0, totalGdpShareSum);

    // Embedded Live Metrics
    if (thermoLiveVal) thermoLiveVal.textContent = `+${deltaTemp.toFixed(1)}°C`;
    if (seaLiveVal) seaLiveVal.textContent = `${deltaSea.toFixed(1)} cm`;
    if (metricCapex) metricCapex.textContent = `${annualGdpInvestment.toFixed(1)}% GDP`;

    // Update Thermometer Fill (2100 Scale)
    const thermoPct = Math.min(100, Math.max(15, ((deltaTemp - 1.0) / 3.5) * 80 + 15));
    if (thermoFill) thermoFill.style.height = `${thermoPct}%`;

    // Update City Submersion Vertical Scale Bar
    updateCitySubmersionScale(deltaSea);

    drawTrajectoryCanvas(intensityRatio);
  }

  // --- Render City Submersion Vertical Bar Scale ---
  function updateCitySubmersionScale(deltaSea) {
    if (!cityMarkersList || !cityWaterFill) return;

    const waterFillPct = Math.min(100, Math.max(10, ((deltaSea - 20) / 130) * 85 + 10));
    cityWaterFill.style.height = `${waterFillPct}%`;

    cityMarkersList.innerHTML = '';

    iconicCities.forEach(city => {
      const isSubmerged = deltaSea >= city.threshold;
      const item = document.createElement('div');
      item.className = `city-marker-item ${isSubmerged ? 'submerged' : ''}`;

      item.innerHTML = `
        <div class="city-name-group">
          <span class="city-name">${city.name}</span>
          <span class="city-thresh">(${city.threshold}cm)</span>
        </div>
        <div>
          ${isSubmerged 
            ? `<span class="badge-submerged"><i class="ri-alarm-warning-fill"></i> 淹沒警告</span>` 
            : `<span class="badge-safe"><i class="ri-checkbox-circle-fill"></i> 安全</span>`
          }
        </div>
      `;

      cityMarkersList.appendChild(item);
    });
  }

  // --- Canvas Rendering: 2025 - 2100 CO2 Trajectory ---
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
    trajCtx.fillText('-- 無介入現況 (BAU)', width - 140, 25);

    trajCtx.fillStyle = strokeColor;
    trajCtx.font = 'bold 11px "Outfit", sans-serif';
    trajCtx.fillText('— 當前能源轉型軌跡', width - 140, 42);
  }
});
