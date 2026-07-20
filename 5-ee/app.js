document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const stageSections = document.querySelectorAll('.stage-section');

  const glacierCanvas = document.getElementById('glacierCanvas');
  const volumeChart = document.getElementById('volumeChart');
  const ctx = glacierCanvas.getContext('2d');
  const chartCtx = volumeChart.getContext('2d');

  // Metrics
  const metYear = document.getElementById('metYear');
  const metELA = document.getElementById('metELA');
  const metVol = document.getElementById('metVol');
  const metBalance = document.getElementById('metBalance');

  // Controls Stage 1
  const tempSlider1 = document.getElementById('tempSlider1');
  const tempVal1 = document.getElementById('tempVal1');
  const playBtn1 = document.getElementById('playBtn1');
  const resetBtn1 = document.getElementById('resetBtn1');
  const expText1 = document.getElementById('expText1');

  // Controls Stage 2
  const playBtn2 = document.getElementById('playBtn2');

  // Controls Stage 3
  const playBtn3 = document.getElementById('playBtn3');

  // Controls Stage 4
  const snowSlider4 = document.getElementById('snowSlider4');
  const snowVal4 = document.getElementById('snowVal4');
  const tempSlider4 = document.getElementById('tempSlider4');
  const tempVal4 = document.getElementById('tempVal4');
  const genMatrixBtn = document.getElementById('genMatrixBtn');
  const heatmapGrid = document.getElementById('heatmapGrid');

  // Controls Stage 5 Sandbox
  const sbTemp = document.getElementById('sbTemp');
  const sbTempVal = document.getElementById('sbTempVal');
  const sbSnow = document.getElementById('sbSnow');
  const sbSnowVal = document.getElementById('sbSnowVal');
  const sbFeedback = document.getElementById('sbFeedback');
  const sbSimulateBtn = document.getElementById('sbSimulateBtn');

  // --- Simulation State ---
  let currentStage = 1;
  let animId = null;

  let simParams = {
    temp: 1.0,           // delta T (°C)
    snow: 0,             // delta Snow (%)
    enableFeedback: true, // Height feedback
    maxYears: 100,
    tempScenario: null   // 'stage2_lag'
  };

  let simHistory = [];      // Array of volume % per year for main run
  let simHistoryAlt = [];   // Array of volume % for Model A (no feedback) comparison

  // Particle systems for snow and melt
  let particles = [];

  // --- Stage Navigation ---
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      stageSections.forEach(s => s.classList.remove('active'));

      btn.classList.add('active');
      const stageId = btn.dataset.stage;
      currentStage = parseInt(stageId, 10);
      document.getElementById(`stage${stageId}Section`).classList.add('active');

      resetToStageDefault(currentStage);
    });
  });

  function resetToStageDefault(stage) {
    if (animId) cancelAnimationFrame(animId);
    simHistoryAlt = [];
    particles = [];

    if (stage === 1) {
      simParams.temp = parseFloat(tempSlider1.value);
      simParams.snow = 0;
      simParams.enableFeedback = false;
      simParams.tempScenario = null;
    } else if (stage === 2) {
      simParams.temp = 2.0;
      simParams.snow = 0;
      simParams.enableFeedback = false;
      simParams.tempScenario = 'lag'; // Temp stops rising at yr 20
    } else if (stage === 3) {
      simParams.temp = 2.0;
      simParams.snow = 0;
      simParams.enableFeedback = true;
      simParams.tempScenario = null;
    } else if (stage === 4) {
      simParams.temp = parseFloat(tempSlider4.value);
      simParams.snow = parseFloat(snowSlider4.value);
      simParams.enableFeedback = true;
      simParams.tempScenario = null;
    } else if (stage === 5) {
      simParams.temp = parseFloat(sbTemp.value);
      simParams.snow = parseFloat(sbSnow.value);
      simParams.enableFeedback = sbFeedback.checked;
      simParams.tempScenario = null;
    }

    runSimulation(false);
  }

  // --- Input Event Listeners ---
  tempSlider1.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    tempVal1.textContent = `${val >= 0 ? '+' : ''}${val.toFixed(1)}°C`;
    simParams.temp = val;
    runSimulation(false);
  });

  snowSlider4.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    snowVal4.textContent = `${val >= 0 ? '+' : ''}${val}%`;
    simParams.snow = val;
    runSimulation(false);
  });

  tempSlider4.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    tempVal4.textContent = `${val >= 0 ? '+' : ''}${val.toFixed(1)}°C`;
    simParams.temp = val;
    runSimulation(false);
  });

  sbTemp.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    sbTempVal.textContent = `${val >= 0 ? '+' : ''}${val.toFixed(1)}°C`;
    simParams.temp = val;
  });

  sbSnow.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    sbSnowVal.textContent = `${val >= 0 ? '+' : ''}${val}%`;
    simParams.snow = val;
  });

  // Action Buttons
  playBtn1.addEventListener('click', () => runSimulation(true));
  resetBtn1.addEventListener('click', () => resetToStageDefault(1));
  playBtn2.addEventListener('click', () => runSimulation(true));
  playBtn3.addEventListener('click', () => runStage3Comparison());
  genMatrixBtn.addEventListener('click', () => generateHeatmapMatrix());
  sbSimulateBtn.addEventListener('click', () => {
    simParams.temp = parseFloat(sbTemp.value);
    simParams.snow = parseFloat(sbSnow.value);
    simParams.enableFeedback = sbFeedback.checked;
    runSimulation(true);
  });

  // Prediction Buttons
  document.querySelectorAll('.pred-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const parent = e.target.closest('.prediction-box');
      parent.querySelectorAll('.pred-btn').forEach(b => b.classList.remove('selected'));
      e.target.classList.add('selected');
    });
  });

  // --- Physics & Simulation Math Model ---
  function computeGlacierState(year, params) {
    let effectiveTemp = params.temp;

    // Stage 2 Lag Scenario: Temp ramps to 2.0°C in 20 yrs then STOPS climbing
    if (params.tempScenario === 'lag') {
      effectiveTemp = Math.min(2.0, (year / 20) * 2.0);
    }

    // Equilibrium Line Altitude (ELA)
    // Base ELA = 2000m at delta T = 0°C, 320m elevation shift per °C
    const ela = 2000 + effectiveTemp * 320 - (params.snow * 6);

    // Initial steady state volume at delta T = 0
    const baseVolume = 100;
    
    // Physics Volume Loss Calculation over time
    // Loss rate depends on ELA shift, time accumulation, and height feedback
    let volumePercent = 100;

    for (let y = 1; y <= year; y++) {
      let currentT = params.temp;
      if (params.tempScenario === 'lag') {
        currentT = Math.min(2.0, (y / 20) * 2.0);
      }

      const currentEla = 2000 + currentT * 320 - (params.snow * 6);
      const elaShift = (currentEla - 2000) / 1000; // in km

      // Mass balance imbalance factor
      let imbalance = elaShift * 1.45;

      // Height Feedback multiplier
      if (params.enableFeedback && volumePercent < 100) {
        const heightDropFactor = (100 - volumePercent) * 0.015;
        imbalance += heightDropFactor;
      }

      // Smooth lag response equation
      const annualLoss = imbalance * 1.1;
      volumePercent = Math.max(5, volumePercent - annualLoss);
    }

    // Annual Mass balance (Income - Expense)
    const currentT = params.tempScenario === 'lag' ? Math.min(2.0, (year / 20) * 2.0) : params.temp;
    const currentEla = 2000 + currentT * 320 - (params.snow * 6);
    const balanceVal = ((2000 - currentEla) / 500) + (params.snow / 50);

    return {
      year,
      ela: currentEla,
      volumePercent: Math.max(5, Math.min(120, volumePercent)),
      balance: balanceVal
    };
  }

  // --- Execute Simulation & Animation Loop ---
  function runSimulation(animated = true) {
    if (animId) cancelAnimationFrame(animId);
    simHistory = [];

    // Calculate full 100-year history curve
    for (let y = 0; y <= simParams.maxYears; y++) {
      const state = computeGlacierState(y, simParams);
      simHistory.push(state);
    }

    if (!animated) {
      const finalState = simHistory[0];
      updateMetrics(finalState);
      drawCanvas(finalState);
      drawChart(simHistory, 0);
      return;
    }

    // Animated Playback
    let currentYr = 0;
    const startTime = performance.now();
    const duration = 4000; // 4s playback for 100 years

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      currentYr = Math.floor(progress * simParams.maxYears);

      const currentState = simHistory[currentYr];
      updateMetrics(currentState);
      drawCanvas(currentState);
      drawChart(simHistory, currentYr);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    }

    animId = requestAnimationFrame(step);
  }

  // Stage 3 Dual Model Comparison Run (Model A: No Feedback vs Model B: With Feedback)
  function runStage3Comparison() {
    if (animId) cancelAnimationFrame(animId);

    // Compute Model B (With Feedback)
    simHistory = [];
    simParams.enableFeedback = true;
    for (let y = 0; y <= 100; y++) {
      simHistory.push(computeGlacierState(y, simParams));
    }

    // Compute Model A (No Feedback)
    simHistoryAlt = [];
    const altParams = { ...simParams, enableFeedback: false };
    for (let y = 0; y <= 100; y++) {
      simHistoryAlt.push(computeGlacierState(y, altParams));
    }

    // Animate comparison
    let currentYr = 0;
    const startTime = performance.now();
    const duration = 4000;

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      currentYr = Math.floor(progress * 100);

      const currentState = simHistory[currentYr];
      updateMetrics(currentState);
      drawCanvas(currentState);
      drawChartDual(simHistory, simHistoryAlt, currentYr);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    }

    animId = requestAnimationFrame(step);
  }

  // --- Generate Stage 4 Parameter Matrix Heatmap ---
  function generateHeatmapMatrix() {
    heatmapGrid.innerHTML = '';
    const temps = [0, 1.0, 2.0, 3.0];
    const snows = [-20, 0, 20, 40];

    temps.forEach(t => {
      snows.forEach(s => {
        const p = { temp: t, snow: s, enableFeedback: true, maxYears: 50 };
        const finalState = computeGlacierState(50, p);
        const vol = Math.round(finalState.volumePercent);

        let cellClass = 'cell-shrink';
        let status = '退縮';
        if (vol >= 95) {
          cellClass = 'cell-grow';
          status = '穩定/增長';
        } else if (vol >= 70) {
          cellClass = 'cell-bal';
          status = '微幅減少';
        }

        const cell = document.createElement('div');
        cell.className = `heatmap-cell ${cellClass}`;
        cell.title = `+${t}°C, 降雪 ${s >= 0 ? '+' : ''}${s}% ➔ 50年後剩餘 ${vol}%`;
        cell.innerHTML = `<div>+${t}°C</div><div>${s >= 0 ? '+' : ''}${s}%雪</div><div style="font-size:0.65rem; opacity:0.8">${vol}%</div>`;
        
        cell.addEventListener('click', () => {
          simParams.temp = t;
          simParams.snow = s;
          tempSlider4.value = t;
          snowSlider4.value = s;
          tempVal4.textContent = `+${t.toFixed(1)}°C`;
          snowVal4.textContent = `${s >= 0 ? '+' : ''}${s}%`;
          runSimulation(true);
        });

        heatmapGrid.appendChild(cell);
      });
    });
  }

  // --- Update Top Metrics UI ---
  function updateMetrics(state) {
    metYear.textContent = `Year ${state.year}`;
    metELA.textContent = `${Math.round(state.ela).toLocaleString()} m`;
    metVol.textContent = `${Math.round(state.volumePercent)} %`;
    
    const bal = state.balance;
    if (Math.abs(bal) < 0.1) {
      metBalance.textContent = `0.0 (動態平衡)`;
      metBalance.style.color = '#34d399';
    } else if (bal > 0) {
      metBalance.textContent = `+${bal.toFixed(1)} (順差: 積雪>融冰)`;
      metBalance.style.color = '#38bdf8';
    } else {
      metBalance.textContent = `${bal.toFixed(1)} (赤字: 融冰>積雪)`;
      metBalance.style.color = '#f43f5e';
    }
  }

  // --- Canvas 2D Mountain & Glacier Profile Rendering ---
  function drawCanvas(state) {
    const width = glacierCanvas.width;
    const height = glacierCanvas.height;

    ctx.clearRect(0, 0, width, height);

    // Background Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#04060c');
    skyGrad.addColorStop(1, '#0b1329');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Mountain Profile Geometry
    // Mountain top (x: 100, y: 50 -> 3800m), Valley floor (x: 750, y: 380 -> 200m)
    const mountainPoints = [
      { x: 50, y: 380 },
      { x: 140, y: 60 },   // Peak
      { x: 260, y: 150 },
      { x: 400, y: 220 },
      { x: 580, y: 300 },
      { x: 750, y: 380 }   // Valley floor
    ];

    // Draw Mountain Rock Polygon
    ctx.beginPath();
    ctx.moveTo(mountainPoints[0].x, mountainPoints[0].y);
    mountainPoints.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();

    const mtnGrad = ctx.createLinearGradient(0, 0, 0, height);
    mtnGrad.addColorStop(0, '#1e293b');
    mtnGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = mtnGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Map Altitude m to Canvas Y
    // 4000m -> Y: 40, 0m -> Y: 380
    function altToY(alt) {
      return 380 - (alt / 4000) * 340;
    }

    const elaY = altToY(state.ela);

    // Calculate Glacier Length & Thickness based on volumePercent
    const volFrac = state.volumePercent / 100;
    const terminusX = 140 + (750 - 140) * Math.min(1, Math.max(0.15, volFrac));
    const maxThickness = 45 * Math.sqrt(volFrac);

    // Draw Glacier Body Polygon
    ctx.beginPath();
    ctx.moveTo(140, 60); // Peak

    // Top surface of glacier
    ctx.quadraticCurveTo(
      (140 + terminusX) / 2, 
      (150 + 300) / 2 - maxThickness, 
      terminusX, 
      300 + (terminusX - 580) * 0.45
    );

    // Bed of glacier
    ctx.lineTo(terminusX, 300 + (terminusX - 580) * 0.45 + 5);
    ctx.quadraticCurveTo(
      (140 + terminusX) / 2, 
      (150 + 300) / 2, 
      140, 
      60
    );
    ctx.closePath();

    // Ice Gradient
    const iceGrad = ctx.createLinearGradient(140, 60, terminusX, 350);
    iceGrad.addColorStop(0, '#e0f2fe');  // Pure snow top
    iceGrad.addColorStop(0.5, '#38bdf8'); // Deep blue ice
    iceGrad.addColorStop(1, 'rgba(56, 189, 248, 0.4)');
    ctx.fillStyle = iceGrad;
    ctx.fill();
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Equilibrium Line Altitude (ELA) Dashed Line
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.moveTo(60, elaY);
    ctx.lineTo(width - 60, elaY);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // ELA Label
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText(`ELA: ${Math.round(state.ela)}m`, width - 130, elaY - 6);

    // Altitude Contour Labels on Left
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px "Outfit", sans-serif';
    ctx.fillText('3,000m', 15, altToY(3000));
    ctx.fillText('2,000m', 15, altToY(2000));
    ctx.fillText('1,000m', 15, altToY(1000));

    // Particle FX (Falling snow above ELA, Dripping water below ELA)
    updateAndDrawParticles(elaY, terminusX);
  }

  function updateAndDrawParticles(elaY, terminusX) {
    if (particles.length < 30) {
      particles.push({
        x: 100 + Math.random() * (terminusX - 100),
        y: 40 + Math.random() * 300,
        speed: 0.5 + Math.random() * 1.5,
        size: 2 + Math.random() * 2
      });
    }

    particles.forEach(p => {
      p.y += p.speed;
      if (p.y > 380) p.y = 50;

      ctx.beginPath();
      if (p.y < elaY) {
        // Snow above ELA
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      } else {
        // Water melt droplet below ELA
        ctx.fillStyle = 'rgba(244, 63, 94, 0.7)';
        ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
      }
      ctx.fill();
    });
  }

  // --- Real-time Volume Time Series Chart ---
  function drawChart(history, activeIndex) {
    const width = volumeChart.width;
    const height = volumeChart.height;

    chartCtx.clearRect(0, 0, width, height);

    if (history.length < 2) return;

    // Grid lines
    chartCtx.strokeStyle = 'rgba(255,255,255,0.06)';
    chartCtx.lineWidth = 1;
    for (let y = 0; y <= 100; y += 25) {
      const py = height - (y / 100) * (height - 20) - 10;
      chartCtx.beginPath();
      chartCtx.moveTo(40, py);
      chartCtx.lineTo(width - 20, py);
      chartCtx.stroke();
    }

    // Draw Main Curve (Volume %)
    chartCtx.beginPath();
    history.forEach((h, idx) => {
      const px = 40 + (h.year / 100) * (width - 60);
      const py = height - (h.volumePercent / 100) * (height - 20) - 10;
      if (idx === 0) chartCtx.moveTo(px, py);
      else chartCtx.lineTo(px, py);
    });

    chartCtx.strokeStyle = '#38bdf8';
    chartCtx.lineWidth = 3;
    chartCtx.stroke();

    // Active Year Point Highlight
    if (history[activeIndex]) {
      const activeState = history[activeIndex];
      const px = 40 + (activeState.year / 100) * (width - 60);
      const py = height - (activeState.volumePercent / 100) * (height - 20) - 10;

      chartCtx.beginPath();
      chartCtx.arc(px, py, 6, 0, Math.PI * 2);
      chartCtx.fillStyle = '#ffffff';
      chartCtx.fill();
      chartCtx.strokeStyle = '#38bdf8';
      chartCtx.lineWidth = 2;
      chartCtx.stroke();
    }
  }

  // Dual Model Chart Comparison (Stage 3)
  function drawChartDual(historyB, historyA, activeIndex) {
    drawChart(historyB, activeIndex);

    const width = volumeChart.width;
    const height = volumeChart.height;

    // Overlay Model A (No Feedback) as a dashed purple line
    chartCtx.beginPath();
    chartCtx.setLineDash([5, 4]);
    historyA.forEach((h, idx) => {
      const px = 40 + (h.year / 100) * (width - 60);
      const py = height - (h.volumePercent / 100) * (height - 20) - 10;
      if (idx === 0) chartCtx.moveTo(px, py);
      else chartCtx.lineTo(px, py);
    });

    chartCtx.strokeStyle = '#c084fc';
    chartCtx.lineWidth = 2.5;
    chartCtx.stroke();
    chartCtx.setLineDash([]);
  }

  // Initial Boot
  resetToStageDefault(1);
  generateHeatmapMatrix();
});
