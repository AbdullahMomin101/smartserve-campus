(() => {
  const STORAGE_KEY = 'smartCanteenPrototype_v1';

  // These are the sample values restored by the demo reset button.
  function createDefaultState() {
    return {
      page: 'landing',
      logged: false,
      theme: 'light',
      settings: {
        name: 'Greenfork Campus Canteen',
        wasteThreshold: 8,
        tempThreshold: 32,
        binCapacity: 90,
        notifications: true,
      },
      sensors: {
        students: 742,
        prepared: 85,
        consumed: 77.6,
        waste: 7.4,
        level: 62,
        temp: 27.3,
        online: true,
        updated: Date.now(),
      },
      foods: [
        { id: 1, name: 'Rice', prepared: 30, consumed: 27, waste: 2, recommend: 28 },
        { id: 2, name: 'Dal', prepared: 16, consumed: 14.6, waste: 1.1, recommend: 15 },
        { id: 3, name: 'Vegetables', prepared: 14, consumed: 12.2, waste: 1.6, recommend: 13 },
        { id: 4, name: 'Chapati', prepared: 12, consumed: 11.4, waste: 0.6, recommend: 12 },
        { id: 5, name: 'Chicken', prepared: 9, consumed: 8.3, waste: 0.5, recommend: 9 },
        { id: 6, name: 'Salad', prepared: 4, consumed: 3.1, waste: 1.6, recommend: 3 },
      ],
      alerts: [],
      history: [
        { label: 'Mon', actual: 72, pred: 75, waste: 6.4 },
        { label: 'Tue', actual: 76, pred: 78, waste: 7.1 },
        { label: 'Wed', actual: 69, pred: 73, waste: 5.8 },
        { label: 'Thu', actual: 81, pred: 79, waste: 7.2 },
        { label: 'Fri', actual: 77.6, pred: 79, waste: 7.4 },
        { label: 'Sat', actual: 63, pred: 66, waste: 5.4 },
        { label: 'Sun', actual: 70, pred: 72, waste: 6.1 },
      ],
      simulation: false,
      range: '7',
      prediction: null,
    };
  }

  // Load a saved demo safely. A damaged or missing record starts with fresh data.
  function loadState() {
    try {
      const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (savedState?.settings && Array.isArray(savedState.foods) && savedState.sensors) {
        return {
          ...createDefaultState(),
          ...savedState,
          page: 'landing',
          logged: false,
          settings: {
            ...createDefaultState().settings,
            ...savedState.settings,
          },
        };
      }
    } catch (error) {
      // Start clean when browser storage contains invalid JSON.
    }
    return createDefaultState();
  }

  let appState = loadState();
  let simulationTimer = null;
  let chartInstances = {};
  const appRoot = document.getElementById('app');

  function escapeHtml(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character],
    );
  }

  function formatNumber(value, digits = 1) {
    return Number(value || 0).toFixed(digits);
  }

  function formatCount(value) {
    return Number(value).toLocaleString('en-IN');
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (error) {
      toast('Browser storage is unavailable. Changes may not persist.');
    }
  }

  function toast(message) {
    const toastElement = document.getElementById('toast');
    toastElement.textContent = message;
    toastElement.className = 'toast show';
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => {
      toastElement.className = 'toast';
    }, 2500);
  }

  const navItems = [
    ['dashboard', '▦', 'Dashboard'],
    ['sensors', '⌁', 'IoT Sensors'],
    ['prediction', '◈', 'AI Prediction'],
    ['food', '◫', 'Food Management'],
    ['analytics', '▤', 'Waste Analytics'],
    ['alerts', '♧', 'Alerts'],
    ['recommendations', '✳', 'AI Recommendations'],
    ['how', '⇣', 'How It Works'],
    ['settings', '⚙', 'Settings'],
  ];

  function go(page) {
    appState.page = page;
    saveState();
    render();
  }

  // Transparent browser-based demand estimate; this is a prototype heuristic, not trained ML.
  function runPrediction(input = {}) {
    const sensors = appState.sensors;
    const dayIndex = input.day ?? new Date().getDay();
    const expectedStudents = Number(
      input.students ?? Math.min(1000, Math.max(300, Math.round(sensors.students * 1.04))),
    );
    const historicalConsumption = Number(
      input.consumption ??
        appState.history.reduce((total, day) => total + day.actual, 0) /
          Math.max(1, appState.history.length),
    );
    const previousWaste = Number(input.prevWaste ?? sensors.waste);
    const currentStudents = Number(input.current ?? sensors.students);
    const specialEvent = input.event ?? 'no';
    const weather = input.weather ?? 'clear';

    const dayFactors = [0.94, 0.99, 1.01, 1.02, 1.06, 0.85, 0.8];
    const dayFactor = dayFactors[Number(dayIndex)] ?? 1;
    const weatherFactors = { clear: 1, rain: 0.97, hot: 1.025, cold: 1.015 };
    const weatherFactor = weatherFactors[weather] || 1;
    const eventFactor = specialEvent === 'yes' ? 1.08 : 1;
    const attendanceFactor = Math.max(0.72, Math.min(1.25, expectedStudents / 742));
    const liveFactor = Math.max(0.9, Math.min(1.12, 1 + ((currentStudents - 742) / 742) * 0.16));
    const wasteFactor = Math.max(0.96, Math.min(1.04, 1 - (previousWaste - 6) / 100));

    const demand =
      historicalConsumption *
      attendanceFactor *
      dayFactor *
      weatherFactor *
      eventFactor *
      liveFactor *
      wasteFactor;
    const preparation = demand * 1.015;
    const expectedConsumption = demand * 0.955;
    const expectedWaste = Math.max(0.6, preparation - expectedConsumption);
    const estimatedFoodSaved = Math.max(0, previousWaste - expectedWaste);
    const daysOfWeek = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    return {
      demand,
      prep: preparation,
      consumption: expectedConsumption,
      waste: expectedWaste,
      saved: estimatedFoodSaved,
      why: {
        students: expectedStudents,
        day: daysOfWeek[dayIndex],
        hist: historicalConsumption,
        prevWaste: previousWaste,
        current: currentStudents,
        event: specialEvent === 'yes',
        weather,
        dayFactor,
        weatherFactor,
        eventFactor,
        attendanceFactor,
      },
    };
  }
  function currentPred() {
    return (
      appState.prediction ||
      runPrediction({
        students: Math.round(appState.sensors.students * 1.04),
        current: appState.sensors.students,
      })
    );
  }

  function updateAlerts() {
    if (!appState.settings.notifications) return;
    const a = appState.alerts;
    const add = (type, msg, severity, key) => {
      if (!a.some((x) => x.key === key && !x.resolved))
        a.unshift({
          id: Date.now() + Math.random(),
          type,
          message: msg,
          severity,
          key,
          time: Date.now(),
          resolved: false,
        });
    };
    if (appState.sensors.waste > appState.settings.wasteThreshold)
      add('HIGH FOOD WASTE', 'Food waste has exceeded the recommended threshold.', 'high', 'waste');
    if (appState.sensors.temp > appState.settings.tempThreshold)
      add(
        'TEMPERATURE WARNING',
        'Food storage temperature is above the preferred range.',
        'high',
        'temp',
      );
    if (appState.sensors.level >= appState.settings.binCapacity)
      add('BIN CAPACITY WARNING', 'Waste container is nearing capacity.', 'medium', 'bin');
    if (appState.sensors.students > 800)
      add(
        'HIGH DEMAND',
        'Student attendance is above the usual canteen baseline. Consider preparing a small additional batch.',
        'medium',
        'demand',
      );
  }

  function shell(body) {
    document.body.classList.toggle('dark', appState.theme === 'dark');
    document.body.classList.toggle('pres-mode', appState.page === 'presentation');
    appRoot.innerHTML = `<div class="app">
<aside class="sidebar">
<div class="brand">
<span class="logo">♧</span>
<span>Smart Canteen<small>FOOD INTELLIGENCE</small>
</span>
</div>
<div class="nav-label">Workspace</div>
<nav class="nav">${navItems
      .map(
        ([
          id,
          icon,
          label,
        ]) => `<button data-page="${id}" class="${appState.page === id ? 'active' : ''}">
<span class="ico">${icon}</span>
<span>${label}</span>
</button>`,
      )
      .join('')}</nav>
<div class="sidebar-bottom">
<div class="nav">
<button data-page="presentation">
<span class="ico">▣</span>
<span>Presentation Mode</span>
</button>
</div>
<div class="prototype-chip">● SIMULATED IoT DATA<br>College project prototype<br>Browser-based demonstration</div>
</div>
</aside>
<main class="main">
<header class="topbar">
<div class="row">
<button class="btn outline small mobile-menu" data-action="mobile-nav" aria-label="Open navigation">☰</button>
<span class="top-title">${appState.settings.name}</span>
</div>
<div class="top-right">
<span class="live-pill">
<i class="dot" style="background:${appState.simulation ? '#32ae6b' : '#9aaa9f'}">
</i>${appState.simulation ? 'Simulation active' : 'IoT simulation ready'}</span>
<span style="font-size:12px;color:var(--muted)">Demo Admin</span>
<span class="avatar">A</span>
<button class="btn outline small" data-action="logout">Logout</button>
</div>
</header>
<section class="content">${body}</section>
</main>
</div>`;
    wireCharts();
  }

  function head(title, desc, extra = '') {
    return `<div class="page-head">
<div>
<div class="eyebrow">Smart Canteen</div>
<h1>${title}</h1>
<div class="sub">${desc}</div>
</div>${extra}</div>`;
  }

  function stat(label, value, foot, icon = '◉') {
    return `<div class="card">
<div class="stat-label">
<span>${label}</span>
<span class="green">${icon}</span>
</div>
<div class="stat-value">${value}</div>
<div class="stat-foot">${foot}</div>
</div>`;
  }

  function chartCard(title, id, extra = '') {
    return `<div class="card">
<div class="row" style="justify-content:space-between;margin-bottom:10px">
<h3 class="section-title" style="margin:0">${title}</h3>${extra}</div>
<div class="chart-wrap">
<canvas id="${id}">
</canvas>
</div>
</div>`;
  }

  function dashboard() {
    const s = appState.sensors,
      p = currentPred(),
      remaining = Math.max(0, s.prepared - s.consumed),
      pct = s.prepared ? (100 * s.waste) / s.prepared : 0;
    return `${head(
      'Good morning, Admin',
      'Here’s what’s happening at your canteen today.',
      `<button class="btn primary" data-page="sensors">⌁ &nbsp;Open live monitoring</button>`,
    )}<div class="banner">
<div>
<div class="eyebrow" style="color:#a8e2bf">AI & IoT FOOD INTELLIGENCE</div>
<h2>Smarter prep. Less waste.</h2>
<p>Live simulated sensor data and transparent demand prediction help your team make better food planning decisions.</p>
</div>
<button class="btn" data-page="presentation">▣ &nbsp;Presentation mode</button>
</div>
<div class="grid stats">${stat(
      'Students Today',
      formatCount(s.students),
      'Current simulated attendance',
      '♙',
    )}${stat('Food Prepared', formatNumber(s.prepared) + ' kg', 'Across today’s menu', '◫')}${stat(
      'Food Consumed',
      formatNumber(s.consumed) + ' kg',
      `${formatNumber(remaining)} kg remaining`,
      '↗',
    )}${stat(
      'Food Wasted',
      formatNumber(s.waste) + ' kg',
      `${formatNumber(pct)}% of prepared food`,
      '♲',
    )}${stat(
      'AI Predicted Demand',
      formatNumber(p.demand) + ' kg',
      'AI Prediction Prototype',
      '◈',
    )}</div>
<div class="grid two">
<div class="grid">${chartCard('Demand trend', 'dashChart')}<div class="grid three">${stat(
      'Food Remaining',
      formatNumber(remaining) + ' kg',
      'Prepared minus consumed',
      '◫',
    )}${stat(
      'Temperature',
      formatNumber(s.temp, 1) + ' °C',
      s.temp > appState.settings.tempThreshold
        ? 'Above preferred range'
        : 'Storage conditions normal',
      '♨',
    )}${stat(
      'Waste Percentage',
      formatNumber(pct) + '%',
      'Target under ' + appState.settings.wasteThreshold + '%',
      '♲',
    )}</div>
</div>
<div class="card">
<h3 class="section-title">Sensor health <span class="badge">5 / 5 online</span>
</h3>${sensorMini('Student Counter', formatCount(s.students), 'students')}${sensorMini(
      'Food Weight',
      formatNumber(remaining),
      'kg remaining',
    )}${sensorMini('Container Level', formatNumber(s.level, 0), '% full')}${sensorMini(
      'Waste Weight',
      formatNumber(s.waste),
      'kg',
    )}${sensorMini(
      'Temperature',
      formatNumber(s.temp, 1),
      '°C',
    )}<div class="stat-foot" style="margin-top:12px">Last updated ${ago(s.updated)}</div>
</div>
</div>
<p class="sub" style="font-size:11px;margin-top:18px">Prototype uses simulated IoT sensor data. AI Prediction Prototype uses a transparent browser-based algorithm.</p>`;
  }

  function sensorMini(name, v, unit) {
    return `<div class="sensor-mini">
<div>
<div class="sensor-name">
<i class="dot">
</i>${name}</div>
<div class="sensor-meta">ONLINE · Updated ${ago(appState.sensors.updated)}</div>
</div>
<div class="sensor-value">${v} <small style="font:500 11px 'DM Sans';color:var(--muted)">${unit}</small>
</div>
</div>`;
  }

  function ago(t) {
    const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
    return sec < 3 ? 'just now' : sec < 60 ? `${sec} sec ago` : `${Math.floor(sec / 60)} min ago`;
  }

  function sensors() {
    const s = appState.sensors;
    const cards = [
      ['♙', 'STUDENT COUNTER', formatCount(s.students), 'students', '300–1,000 students'],
      [
        '◫',
        'FOOD WEIGHT SENSOR',
        formatNumber(Math.max(0, s.prepared - s.consumed)) + ' kg',
        'remaining',
        'Prepared food minus consumption',
      ],
      [
        '▤',
        'FOOD CONTAINER LEVEL SENSOR',
        formatNumber(s.level, 0) + '%',
        'capacity',
        'Waste bin fill level',
      ],
      [
        '♲',
        'WASTE WEIGHT SENSOR',
        formatNumber(s.waste) + ' kg',
        'waste',
        'Today’s measured waste',
      ],
      [
        '♨',
        'TEMPERATURE SENSOR',
        formatNumber(s.temp, 1) + ' °C',
        'ambient',
        'Canteen storage area',
      ],
    ];
    return `${head(
      'IoT Sensors',
      'Monitor simulated, browser-generated sensor readings. No physical hardware is connected.',
    )}<div class="sim-banner">
<div>
<b>
<i class="dot" style="background:${appState.simulation ? '#32ae6b' : '#9aaa9f'}">
</i>${appState.simulation ? 'LIVE SIMULATION ACTIVE' : 'SIMULATION PAUSED'}</b>
<div class="stat-foot">SIMULATED IoT DATA · Last update ${ago(s.updated)}</div>
</div>
<div class="row">
<button class="btn primary small" data-action="start" ${appState.simulation ? 'disabled' : ''}>${appState.simulation ? '✓ Simulation running' : '▶ Start live simulation'}</button>
<button class="btn outline small" data-action="pause">Ⅱ Pause</button>
<button class="btn outline small" data-action="sensor-update">↻ Simulate sensor update</button>
<button class="btn outline small" data-action="sensor-reset">Reset</button>
</div>
</div>
<div class="grid sensor-grid">${cards
      .map(
        ([ico, name, val, unit, caption]) => `<div class="card sensor-card">
<div class="sensor-symbol">${ico}</div>
<h3>${name}</h3>
<div class="big">${val}</div>
<div class="row">
<span class="badge">
<i class="dot">
</i>ONLINE</span>
<span class="foot">${unit}</span>
</div>
<div class="foot" style="margin-top:11px">${caption} · Updated ${ago(s.updated)}</div>
</div>`,
      )
      .join('')}</div>
<div class="card" style="margin-top:17px">
<h3 class="section-title">How simulation values change</h3>
<p class="sub">Attendance drifts gradually within 300–1,000 students. Consumption increments deplete remaining food, while a realistic share contributes to waste. Container level follows waste volume; temperature drifts slowly between 20–35 °C.</p>
</div>`;
  }

  function prediction() {
    const p = currentPred(),
      w = p.why;
    return `${head(
      'AI Food Demand Prediction',
      'Estimate demand and recommended preparation from historical data, attendance, weekday, events, and weather.',
    )}<div class="grid two">
<div class="card">
<h3 class="section-title">Prediction inputs</h3>
<form id="prediction-form" class="form-grid">
<div class="field">
<label>Expected Students</label>
<input name="students" type="number" min="300" max="1000" value="${Math.round(appState.sensors.students * 1.04)}" required>
</div>
<div class="field">
<label>Day of Week</label>
<select name="day">${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      .map(
        (x, i) =>
          `<option value="${i}" ${i === new Date().getDay() ? 'selected' : ''}>${x}</option>`,
      )
      .join('')}</select>
</div>
<div class="field">
<label>Previous Food Consumption (kg)</label>
<input name="consumption" type="number" min="0" max="200" step=".1" value="${formatNumber(
      appState.history.reduce((a, x) => a + x.actual, 0) / appState.history.length,
    )}" required>
</div>
<div class="field">
<label>Previous Food Waste (kg)</label>
<input name="prevWaste" type="number" min="0" max="100" step=".1" value="${formatNumber(appState.sensors.waste)}" required>
</div>
<div class="field">
<label>Current Student Count</label>
<input name="current" type="number" min="0" max="1000" value="${appState.sensors.students}" required>
</div>
<div class="field">
<label>Special Event</label>
<select name="event">
<option value="no">No</option>
<option value="yes">Yes — event or festival</option>
</select>
</div>
<div class="field">
<label>Weather Condition</label>
<select name="weather">
<option value="clear">Clear / mild</option>
<option value="rain">Rainy</option>
<option value="hot">Hot</option>
<option value="cold">Cold</option>
</select>
</div>
<div class="field" style="align-self:end">
<button class="btn primary" type="submit">◈ &nbsp;Run AI prediction</button>
</div>
</form>
<p id="prediction-error" class="red" style="font-size:12px">
</p>
</div>
<div class="card">
<h3 class="section-title">Historical Demand vs AI Predicted Demand</h3>
<div class="chart-wrap">
<canvas id="predChart">
</canvas>
</div>
</div>
</div>
<div class="grid pred-results" style="margin-top:16px">${[
      ['AI Predicted Demand', p.demand, 'kg'],
      ['Recommended Preparation', p.prep, 'kg'],
      ['Expected Consumption', p.consumption, 'kg'],
      ['Expected Waste', p.waste, 'kg'],
      ['Estimated Food Saved', p.saved, 'kg'],
    ]
      .map(
        ([a, b, c]) => `<div class="card">
<div class="stat-label">${a}</div>
<div class="pred-number ${a.includes('Saved') ? 'green' : ''}">${formatNumber(b)} <small style="font:500 12px 'DM Sans'">${c}</small>
</div>
</div>`,
      )
      .join('')}</div>
<div class="grid two" style="margin-top:16px">
<div class="card">
<h3 class="section-title">Why did AI make this prediction?</h3>
<div class="why">Base consumption of <b>${formatNumber(w.hist)} kg</b> was adjusted for expected attendance (<b>${w.students}</b>), current attendance (<b>${w.current}</b>), the weekday (<b>${w.day}</b>, ×${formatNumber(
      w.dayFactor,
      2,
    )}), weather (<b>${w.weather}</b>, ×${formatNumber(
      w.weatherFactor,
      2,
    )}), ${w.event ? 'a special event (×1.08)' : 'no special event'}, and previous waste (<b>${formatNumber(w.prevWaste)} kg</b>). Recommended prep adds a small buffer; expected consumption and waste use a conservative 95.5% consumption estimate.</div>
</div>
<div class="card">
<h3 class="section-title">Prototype Note</h3>
<p class="sub">This version uses a transparent prediction algorithm based on simulated IoT and historical data. A production version could use a trained machine-learning model.</p>
</div>
</div>`;
  }

  function food() {
    return `${head(
      'Food Management',
      'Track prepared, consumed, remaining, and waste quantities for every menu item.',
      `<button class="btn primary" data-action="food-add">＋ Add food item</button>`,
    )}<div class="card">
<div class="row" style="justify-content:space-between;margin-bottom:14px">
<h3 class="section-title" style="margin:0">Today’s menu</h3>
<input id="food-search" placeholder="Search food…" style="max-width:220px;padding:9px 11px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)">
</div>
<div class="table-wrap">
<table>
<thead>
<tr>
<th>FOOD ITEM</th>
<th>PREPARED</th>
<th>CONSUMED</th>
<th>REMAINING</th>
<th>WASTE</th>
<th>AI RECOMMENDATION</th>
<th>ACTIONS</th>
</tr>
</thead>
<tbody id="food-rows">${foodRows()}</tbody>
</table>
</div>
<p class="stat-foot">Quantities in kg · Changes update dashboard, analytics, and recommendations.</p>
</div>`;
  }

  function foodRows(query = '') {
    const f = appState.foods.filter((x) => x.name.toLowerCase().includes(query.toLowerCase()));
    if (!f.length)
      return '<tr><td colspan="7"><div class="empty">No matching food items.</div></td></tr>';
    return f
      .map(
        (x) => `<tr>
<td class="food-name">${escapeHtml(x.name)}</td>
<td>${formatNumber(x.prepared)} kg</td>
<td>${formatNumber(x.consumed)} kg</td>
<td>${formatNumber(Math.max(0, x.prepared - x.consumed))} kg</td>
<td>
<span class="pill ${x.waste > 2 ? 'red' : ''}">${formatNumber(x.waste)} kg</span>
</td>
<td>
<span class="pill">${formatNumber(x.recommend)} kg</span>
</td>
<td>
<button class="btn outline small" data-action="food-edit" data-id="${x.id}">Edit</button> <button class="btn danger small" data-action="food-delete" data-id="${x.id}">Delete</button>
</td>
</tr>`,
      )
      .join('');
  }

  function analytics() {
    const days =
      appState.range === '1'
        ? appState.history.slice(-1)
        : appState.range === '30'
          ? Array.from(
              {
                length: 30,
              },
              (_, i) => ({
                label: `D${i + 1}`,
                actual: appState.history[i % 7].actual,
                pred: appState.history[i % 7].pred,
                waste: appState.history[i % 7].waste,
              }),
            )
          : appState.history;
    const total = days.reduce((a, x) => a + x.waste, 0),
      money = total * 75;
    return `${head(
      'Waste Analytics',
      'Understand waste patterns, food demand, and the impact of better preparation.',
      `<div class="tabs">${[
        ['1', 'Today'],
        ['7', 'Last 7 days'],
        ['30', 'Last 30 days'],
      ]
        .map(
          ([v, l]) =>
            `<button data-range="${v}" class="${appState.range === v ? 'active' : ''}">${l}</button>`,
        )
        .join('')}</div>`,
    )}<div class="grid stats">${stat(
      'Daily Food Waste',
      formatNumber(appState.sensors.waste) + ' kg',
      'Measured today',
      '♲',
    )}${stat(
      'Selected Period Waste',
      formatNumber(total) + ' kg',
      `${days.length} day${days.length === 1 ? '' : 's'} selected`,
      '▤',
    )}${stat(
      'Monthly Food Waste',
      formatNumber((appState.history.reduce((a, x) => a + x.waste, 0) * 30) / 7) + ' kg',
      'Estimated from weekly trend',
      '▤',
    )}${stat(
      'Waste Percentage',
      formatNumber(
        appState.sensors.prepared ? (appState.sensors.waste / appState.sensors.prepared) * 100 : 0,
      ) + '%',
      'Today’s prepared quantity',
      '%',
    )}${stat(
      'Estimated Money Lost',
      '₹' + formatCount(Math.round(money)),
      'Estimated at ₹75 per kg',
      '₹',
    )}</div>
<div class="grid two">${chartCard(
      'Actual Food Demand vs AI Predicted Demand',
      'analyticsDemand',
    )}${chartCard('Daily Food Waste', 'dailyWaste')}${chartCard(
      'Weekly Waste Trend',
      'weeklyWaste',
    )}${chartCard('Food-wise Waste', 'foodWaste')}</div>
<div class="card" style="margin-top:16px">
<h3 class="section-title">Estimated Food Saved</h3>
<div class="stat-value green">${formatNumber(Math.max(0, currentPred().saved))} kg</div>
<p class="sub">Estimated reduction against previous measured waste if recommended quantities are followed.</p>
</div>`;
  }

  function alerts() {
    return `${head(
      'Alerts',
      'Threshold-based notices from the simulated sensor environment.',
      `<button class="btn outline" data-action="check-alerts">↻ Check thresholds</button>`,
    )}${
      appState.alerts.length
        ? appState.alerts
            .map(
              (a) => `<div class="card alert-item ${a.severity} ${a.resolved ? 'resolved' : ''}">
<div class="row" style="justify-content:space-between">
<div class="alert-title">${escapeHtml(a.type)} &nbsp; <span class="badge">${a.resolved ? 'RESOLVED' : a.severity.toUpperCase()}</span>
</div>
<span class="alert-meta">${new Date(a.time).toLocaleString()}</span>
</div>
<div class="alert-copy">${escapeHtml(a.message)}</div>
<div class="row">${!a.resolved ? `<button class="btn secondary small" data-action="alert-resolve" data-id="${a.id}">✓ Mark as resolved</button>` : ''}<button class="btn danger small" data-action="alert-delete" data-id="${a.id}">Delete</button>
</div>
</div>`,
            )
            .join('')
        : '<div class="card empty">No active alerts. Sensor thresholds are currently within range.</div>'
    }`;
  }

  function recommendations() {
    const s = appState.sensors,
      items = [];
    const rice = appState.foods.find((x) => x.name.toLowerCase() === 'rice');
    if (rice && rice.waste > 1)
      items.push([
        'Reduce tomorrow’s rice preparation by approximately ' +
          Math.min(15, Math.round((rice.waste / rice.prepared) * 100)) +
          '%.',
        `${formatNumber(rice.waste)} kg rice waste was recorded against ${formatNumber(rice.prepared)} kg prepared.`,
        'Potentially reduce rice waste by ' + formatNumber(rice.waste * 0.2) + ' kg',
      ]);
    if (s.students > 800)
      items.push([
        'Plan for higher student attendance tomorrow.',
        `Current attendance is ${formatCount(s.students)}, above the usual baseline of 742.`,
        'Avoid stock-outs during peak service',
      ]);
    if (appState.foods.some((x) => x.name === 'Vegetables' && x.waste > 1.5)) {
      const v = appState.foods.find((x) => x.name === 'Vegetables');
      items.push([
        'Prepare vegetables in smaller batches.',
        `Vegetable wastage is ${formatNumber(v.waste)} kg; smaller batches allow replenishment as needed.`,
        'Reduce end-of-service leftovers',
      ]);
    }
    if (s.waste / s.prepared > 0.07)
      items.push([
        'Review serving sizes and batch timing.',
        `Current food waste is ${formatNumber((s.waste / s.prepared) * 100)}% of preparation.`,
        'Move toward the ' + appState.settings.wasteThreshold + '% waste target',
      ]);
    if (!items.length)
      items.push([
        'Maintain the current preparation plan.',
        'Waste and attendance are within typical ranges.',
        'Continue monitoring simulated sensor readings',
      ]);
    return `${head(
      'AI Recommendations',
      'Practical actions based on current simulated attendance, food quantities, and measured waste.',
    )}<div class="grid three">${items
      .map(
        (
          [title, reason, impact],
          i,
        ) => `<div class="card rec-item" style="margin:0;border-left-color:${i === 0 ? 'var(--green)' : 'var(--amber)'}">
<span class="badge">RECOMMENDATION ${i + 1}</span>
<h3 style="font-size:15px;margin:13px 0 7px">${escapeHtml(title)}</h3>
<p class="sub" style="font-size:12px">
<b>Reason</b>
<br>${escapeHtml(reason)}</p>
<p class="sub" style="font-size:12px">
<b>Expected impact</b>
<br>${escapeHtml(impact)}</p>
</div>`,
      )
      .join('')}</div>
<div class="card" style="margin-top:16px">
<h3 class="section-title">AI Prediction Prototype</h3>
<p class="sub">Recommendations are derived from current data with clear rule-based logic. This prototype does not use a trained ML model or external AI service.</p>
</div>`;
  }

  function how() {
    const steps = [
      [
        '01',
        'SIMULATED IoT SENSORS',
        'Browser logic generates attendance, food weight, container level, waste, and temperature readings.',
      ],
      [
        '02',
        'REAL-TIME SENSOR DATA',
        'Values update gradually during a live simulation and persist in this browser.',
      ],
      [
        '03',
        'DATA ANALYSIS',
        'Current conditions are combined with historical consumption and waste data.',
      ],
      [
        '04',
        'AI FOOD DEMAND PREDICTION',
        'A transparent algorithm estimates demand using attendance, weekday, events, weather, and prior data.',
      ],
      [
        '05',
        'FOOD PREPARATION RECOMMENDATION',
        'The system suggests an appropriate preparation quantity and estimates consumption and waste.',
      ],
      [
        '06',
        'REDUCED FOOD WASTE',
        'Canteen staff can use the estimate to plan smaller, more informed batches.',
      ],
    ];
    return `${head(
      'How It Works',
      'A clear path from simulated IoT readings to practical food preparation decisions.',
    )}<div class="card" style="margin-bottom:16px">
<div class="recommendation-flow">${steps
      .map(
        ([num, title, copy], i) => `${i ? '<div class="arrow">↓</div>' : ''}<div class="flow-step">
<span class="badge">${num}</span>
<b>${title}</b>
<span>${copy}</span>
</div>`,
      )
      .join('')}</div>
</div>
<div class="grid two">
<div class="card">
<h3 class="section-title">The project challenge</h3>
<p class="sub">
<b>Problem:</b> Canteens often prepare food based on estimation, which can result in unnecessary food waste.</p>
<p class="sub">
<b>Solution:</b> Use IoT-style sensor data and AI-based demand prediction to estimate appropriate preparation quantities.</p>
<p class="sub">
<b>Benefits:</b> Reduced waste, better planning, data-driven decisions, condition monitoring, and improved resource use.</p>
</div>
<div class="card">
<h3 class="section-title">Future Implementation</h3>
<p class="sub">A real deployment could replace the simulated sensor layer with an ESP32, loadState cells for food and waste weighing, ultrasonic sensors for bin levels, and temperature sensors. Sensor readings could then feed a trained forecasting model.</p>
<span class="badge">CURRENT PROJECT: WEBSITE-ONLY PROTOTYPE</span>
</div>
</div>`;
  }

  function settings() {
    const s = appState.settings;
    return `${head(
      'Settings',
      'Configure thresholds, notifications, theme, and your demo environment.',
    )}<div class="grid two">
<div class="card">
<h3 class="section-title">Canteen configuration</h3>
<form id="settings-form" class="form-grid">
<div class="field full">
<label>Canteen Name</label>
<input name="name" maxlength="60" value="${escapeHtml(s.name)}" required>
</div>
<div class="field">
<label>Food Waste Threshold (kg)</label>
<input name="wasteThreshold" type="number" min="0.1" max="100" step=".1" value="${s.wasteThreshold}" required>
</div>
<div class="field">
<label>Temperature Threshold (°C)</label>
<input name="tempThreshold" type="number" min="20" max="35" step=".1" value="${s.tempThreshold}" required>
</div>
<div class="field">
<label>Waste Bin Capacity (%)</label>
<input name="binCapacity" type="number" min="50" max="100" value="${s.binCapacity}" required>
</div>
<div class="field full">
<button class="btn primary">Save settings</button>
</div>
</form>
<div class="switch-line">
<span>
<b>Notifications</b>
<div class="stat-foot">Generate threshold alerts from sensor readings</div>
</span>
<div class="switch ${s.notifications ? 'on' : ''}" data-action="notifications">
</div>
</div>
<div class="switch-line">
<span>
<b>Dark Mode</b>
<div class="stat-foot">Change dashboard appearance</div>
</span>
<div class="switch ${appState.theme === 'dark' ? 'on' : ''}" data-action="theme">
</div>
</div>
</div>
<div class="card">
<h3 class="section-title">Demo data</h3>
<p class="sub">Restore the original sensors, food menu, alerts, and sample analytics. This clears changes saved by this prototype in this browser.</p>
<button class="btn danger" data-action="reset-demo">Reset demo data</button>
<hr style="border:0;border-top:1px solid var(--line);margin:24px 0">
<h3 class="section-title">Prototype details</h3>
<p class="sub">All data is stored locally in this browser. No backend, API key, physical hardware, or external AI service is used.</p>
<span class="badge">SIMULATED IoT DATA</span>
</div>
</div>`;
  }

  function presentation() {
    const s = appState.sensors,
      p = currentPred();
    return `<div class="presentation-title">${head(
      'Project Demonstration',
      `<b>${appState.settings.name}</b> · AI & IoT Based Food Waste Prediction and Management System`,
      `<button class="btn outline" data-page="dashboard">Exit presentation</button>`,
    )}</div>
<div class="banner">
<div>
<div class="eyebrow" style="color:#a8e2bf">COLLEGE PROJECT PROTOTYPE</div>
<h2>Smart Canteen</h2>
<p>Combining simulated IoT data with AI-based food demand prediction to help canteens prepare appropriate quantities of food and reduce food waste.</p>
</div>
<button class="btn" data-action="pres-start">${appState.simulation ? 'Ⅱ Pause demo' : '▶ Start demo'}</button>
</div>
<div class="recommendation-flow">
<div class="flow-step">
<span class="badge">01 · IoT STATUS</span>
<b>
<i class="dot">
</i>${appState.simulation ? 'LIVE' : 'READY'}</b>
<span>5 simulated sensors online</span>
</div>
<div class="arrow">↓</div>
<div class="flow-step">
<span class="badge">02 · CANTEEN DATA</span>
<b>${formatCount(s.students)} Students</b>
<span>${formatNumber(s.prepared - s.consumed)} kg food remaining · ${formatNumber(s.waste)} kg waste · ${formatNumber(
      s.temp,
      1,
    )} °C</span>
</div>
<div class="arrow">↓</div>
<div class="flow-step">
<span class="badge">03 · AI PREDICTION</span>
<b>${formatNumber(p.demand)} kg</b>
<span>Predicted food demand using historical and simulated data</span>
</div>
<div class="arrow">↓</div>
<div class="flow-step">
<span class="badge">04 · RECOMMENDATION</span>
<b>Prepare ${formatNumber(p.prep)} kg</b>
<span>Recommended preparation quantity</span>
</div>
<div class="arrow">↓</div>
<div class="flow-step">
<span class="badge">05 · WASTE REDUCTION</span>
<b>${formatNumber(p.waste)} kg expected waste</b>
<span>${formatNumber(p.saved)} kg estimated food saved</span>
</div>
</div>
<div class="grid two" style="margin-top:18px">${chartCard(
      'Demand trend',
      'presChart',
    )}<div class="card">
<h3 class="section-title">Live sensor summary</h3>${sensorMini(
      'Student Counter',
      formatCount(s.students),
      'students',
    )}${sensorMini('Food Remaining', formatNumber(s.prepared - s.consumed), 'kg')}${sensorMini(
      'Waste Weight',
      formatNumber(s.waste),
      'kg',
    )}${sensorMini(
      'Temperature',
      formatNumber(s.temp, 1),
      '°C',
    )}<p class="sub" style="font-size:11px;margin-top:12px">AI Prediction Prototype · Prototype uses simulated IoT sensor data.</p>
</div>
</div>`;
  }

  function landing() {
    document.body.classList.toggle('dark', appState.theme === 'dark');
    appRoot.innerHTML = `<div class="landing">
<nav class="land-nav">
<div class="brand">
<span class="logo">♧</span>
<span>Smart Canteen<small>FOOD INTELLIGENCE</small>
</span>
</div>
<div class="row">
<button class="btn outline" data-page="how">How it works</button>
<button class="btn outline" data-action="login-page">Log in</button>
<button class="btn primary" data-action="demo-login">Open demo dashboard →</button>
</div>
</nav>
<main class="hero">
<div>
<div class="eyebrow">AI + IOT · SUSTAINABLE CAMPUS</div>
<h1>Smart Canteen</h1>
<h2 style="font-size:clamp(17px,2vw,23px);margin-top:14px">AI & IoT Based Food Waste Prediction and Management System</h2>
<p>Smart Canteen uses simulated IoT sensor data and AI-based food demand prediction to help canteens prepare appropriate quantities of food and reduce unnecessary food waste.</p>
<div class="row" style="margin-top:22px">
<button class="btn primary" data-action="demo-login">View Dashboard &nbsp;→</button>
<button class="btn outline" data-page="how">Explore How It Works</button>
</div>
<p class="sub" style="font-size:11px;margin-top:18px">● College Project Prototype — Simulated IoT Environment</p>
</div>
<div class="hero-visual">
<div class="row" style="justify-content:space-between;margin-bottom:6px">
<b>Today at a glance</b>
<span class="badge">
<i class="dot">
</i>SIMULATED</span>
</div>
<div class="hero-tile">
<span>Student attendance</span>
<b>742 students</b>
</div>
<div class="hero-tile">
<span>AI predicted demand</span>
<b>79.2 kg</b>
</div>
<div class="hero-tile">
<span>Food waste today</span>
<b>7.4 kg</b>
</div>
<div class="hero-tile">
<span>Potential food saved</span>
<b>3.9 kg</b>
</div>
<div class="stat-foot">Illustrative current demo values · update live in dashboard</div>
</div>
</main>
<section class="feature-section">
<div class="eyebrow">ONE CONNECTED WORKFLOW</div>
<h2 style="font-size:28px;margin:8px 0 20px">Better decisions at every serving</h2>
<div class="grid feature-grid">
<div class="card feature-card">
<div class="sensor-symbol">⌁</div>
<h3>IoT Monitoring</h3>
<p>Monitor simulated real-time canteen sensor data, from student attendance to food and waste weights.</p>
</div>
<div class="card feature-card">
<div class="sensor-symbol">◈</div>
<h3>AI Prediction</h3>
<p>Predict future food demand using historical consumption and simulated sensor inputs.</p>
</div>
<div class="card feature-card">
<div class="sensor-symbol">♲</div>
<h3>Waste Analytics</h3>
<p>Track food waste and identify clear opportunities to reduce over-preparation.</p>
</div>
</div>
</section>
<footer class="land-footer">
<span>© Smart Canteen · College engineering project</span>
<span>Website-only prototype · Simulated IoT environment</span>
</footer>
</div>`;
  }

  function login() {
    appRoot.innerHTML = `<div class="login-wrap">
<div class="login-card">
<div class="brand" style="padding:0">
<span class="logo">♧</span>
<span>Smart Canteen<small>FOOD INTELLIGENCE</small>
</span>
</div>
<h1>Welcome back</h1>
<p class="sub">Sign in to your canteen dashboard.</p>
<form id="login-form" class="form-grid" style="margin-top:22px">
<div class="field full">
<label>Email</label>
<input name="email" type="email" placeholder="admin@smartcanteen.edu" required>
</div>
<div class="field full">
<label>Password</label>
<input name="password" type="password" placeholder="Enter your password" required>
</div>
<p id="login-error" class="red full" style="font-size:12px;margin:0">
</p>
<button class="btn primary full">Login</button>
</form>
<button class="btn secondary full" data-action="demo-login" style="margin-top:10px">Demo Login — continue without authentication</button>
<div class="login-note">Demo credentials: <b>admin@smartcanteen.edu</b> / <b>canteen123</b>
<br>Or choose Demo Login for immediate access.</div>
<button class="btn outline full" data-action="home">← Back to home</button>
</div>
</div>`;
  }

  function render() {
    if (appState.page === 'landing') {
      landing();
      return;
    }
    if (appState.page === 'login') {
      login();
      return;
    }
    const f =
      {
        dashboard,
        sensors,
        prediction,
        food,
        analytics,
        alerts,
        recommendations,
        how,
        settings,
        presentation,
      }[appState.page] || dashboard;
    shell(f());
  }

  // Draw charts without a dependency when the Chart.js CDN is unavailable.
  function fallbackSvg(id, labels, datasets, type) {
    const old = document.getElementById(id);
    if (!old) return;
    const wrap = old.parentElement;
    const W = 640,
      H = 250,
      L = 42,
      R = 12,
      T = 12,
      B = 38,
      plotW = W - L - R,
      plotH = H - T - B;
    const values = datasets.flatMap((d) => d.data).filter(Number.isFinite);
    const max = Math.max(1, ...values) * 1.12;
    const color = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#738077',
      grid = getComputedStyle(document.body).getPropertyValue('--line').trim() || '#e5ece6';
    let svg = `<svg id="${id}" class="fallback-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(datasets.map((d) => d.label).join(' and '))} chart" preserveAspectRatio="none">
<rect width="${W}" height="${H}" fill="transparent"/>`;
    for (let i = 0; i <= 4; i++) {
      const y = T + (plotH * i) / 4,
        val = max * (1 - i / 4);
      svg += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="${grid}"/>
<text x="${L - 7}" y="${y + 4}" text-anchor="end" fill="${color}" font-size="10">${val.toFixed(0)}</text>`;
    }
    if (type === 'bar') {
      const d = datasets[0],
        slot = plotW / Math.max(1, labels.length),
        bw = Math.min(32, slot * 0.58);
      d.data.forEach((v, i) => {
        const h = Math.max(1, (v / max) * plotH),
          x = L + i * slot + (slot - bw) / 2,
          y = T + plotH - h;
        svg += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="4" fill="${d.color}" opacity=".88">
<title>${escapeHtml(labels[i])}: ${Number(v).toFixed(1)} kg</title>
</rect>`;
      });
    } else
      datasets.forEach((d) => {
        const pts = d.data.map((v, i) => [
          L + (labels.length <= 1 ? plotW / 2 : (i * plotW) / (labels.length - 1)),
          T + plotH - (Math.max(0, v) / max) * plotH,
        ]);
        if (!pts.length) return;
        svg += `<polyline fill="none" stroke="${d.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${pts.map((p) => p.join(',')).join(' ')}"/>`;
        pts.forEach(
          (p, i) =>
            (svg += `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${d.color}">
<title>${escapeHtml(labels[i])}: ${Number(d.data[i]).toFixed(1)} kg</title>
</circle>`),
        );
      });
    const stride = Math.max(1, Math.ceil(labels.length / 8));
    labels.forEach((lab, i) => {
      if (i % stride === 0 || i === labels.length - 1) {
        const x =
          type === 'bar'
            ? L + ((i + 0.5) * plotW) / Math.max(1, labels.length)
            : L + (labels.length <= 1 ? plotW / 2 : (i * plotW) / (labels.length - 1));
        svg += `<text x="${x}" y="${H - 14}" text-anchor="middle" fill="${color}" font-size="10">${escapeHtml(lab)}</text>`;
      }
    });
    if (type !== 'bar') {
      let lx = L;
      datasets.forEach((d) => {
        svg += `<line x1="${lx}" y1="${H - 2}" x2="${lx + 14}" y2="${H - 2}" stroke="${d.color}" stroke-width="3"/>
<text x="${lx + 19}" y="${H + 1}" fill="${color}" font-size="10">${escapeHtml(d.label)}</text>`;
        lx += Math.min(180, d.label.length * 6 + 45);
      });
    }
    svg += '</svg>';
    wrap.innerHTML = svg;
  }

  function wireCharts() {
    Object.values(chartInstances).forEach((c) => c.destroy());
    chartInstances = {};
    const line = (id, labels, a, b, la, lb) => {
      const el = document.getElementById(id);
      if (!el) return;
      const sets = [
        {
          label: la,
          data: a,
          color: '#16804f',
          borderColor: '#16804f',
          backgroundColor: '#16804f16',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        },
        {
          label: lb,
          data: b,
          color: '#d69b3e',
          borderColor: '#d69b3e',
          backgroundColor: '#d69b3e12',
          fill: false,
          tension: 0.35,
          pointRadius: 3,
        },
      ];
      if (!window.Chart || el.tagName.toLowerCase() !== 'canvas') {
        fallbackSvg(id, labels, sets, 'line');
        return;
      }
      Chart.defaults.font.family = "'DM Sans', sans-serif";
      Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--muted');
      chartInstances[id] = new Chart(el, {
        type: 'line',
        data: {
          labels,
          datasets: sets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: getComputedStyle(document.body).getPropertyValue('--line'),
              },
            },
            x: {
              grid: {
                display: false,
              },
            },
          },
        },
      });
    };
    const hist =
      appState.range === '30'
        ? Array.from(
            {
              length: 30,
            },
            (_, i) => ({
              label: `${i + 1}`,
              actual: appState.history[i % 7].actual,
              pred: appState.history[i % 7].pred,
              waste: appState.history[i % 7].waste,
            }),
          )
        : appState.range === '1'
          ? appState.history.slice(-1)
          : appState.history;
    line(
      'dashChart',
      appState.history.map((x) => x.label),
      appState.history.map((x) => x.actual),
      appState.history.map((x) => x.pred),
      'Actual consumption',
      'AI predicted',
    );
    line(
      'predChart',
      appState.history.map((x) => x.label),
      appState.history.map((x) => x.actual),
      [...appState.history.slice(0, -1).map((x) => x.pred), currentPred().demand],
      'Historical demand',
      'AI predicted',
    );
    line(
      'analyticsDemand',
      hist.map((x) => x.label),
      hist.map((x) => x.actual),
      hist.map((x) => x.pred),
      'Actual demand',
      'AI predicted',
    );
    const bars = (id, labels, data, color = '#20a064') => {
      const el = document.getElementById(id);
      if (!el) return;
      const sets = [
        {
          label: 'Food waste (kg)',
          data,
          color,
          backgroundColor: color,
          borderRadius: 6,
        },
      ];
      if (!window.Chart || el.tagName.toLowerCase() !== 'canvas') {
        fallbackSvg(id, labels, sets, 'bar');
        return;
      }
      chartInstances[id] = new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: sets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: getComputedStyle(document.body).getPropertyValue('--line'),
              },
            },
            x: {
              grid: {
                display: false,
              },
            },
          },
        },
      });
    };
    bars(
      'dailyWaste',
      hist.map((x) => x.label),
      hist.map((x) => x.waste),
    );
    bars(
      'weeklyWaste',
      appState.history.map((x) => x.label),
      appState.history.map((x) => x.waste),
      '#e0a447',
    );
    bars(
      'foodWaste',
      appState.foods.map((x) => x.name),
      appState.foods.map((x) => x.waste),
      '#3e9eb0',
    );
  }
  function modal(html) {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="modal-back" id="modal">
<div class="modal">${html}</div>
</div>`,
    );
    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') e.target.remove();
    });
  }

  function foodModal(item) {
    const x = item || {
      name: '',
      prepared: '',
      consumed: '',
      waste: '',
      recommend: '',
    };
    modal(`<h2>${item ? 'Edit food item' : 'Add food item'}</h2>
<form id="food-form" class="form-grid">
<input type="hidden" name="id" value="${x.id || ''}">
<div class="field full">
<label>Food name</label>
<input name="name" maxlength="40" value="${escapeHtml(x.name)}" required>
</div>
<div class="field">
<label>Prepared quantity (kg)</label>
<input name="prepared" type="number" min="0" max="500" step=".1" value="${x.prepared}" required>
</div>
<div class="field">
<label>Consumed quantity (kg)</label>
<input name="consumed" type="number" min="0" max="500" step=".1" value="${x.consumed}" required>
</div>
<div class="field">
<label>Waste quantity (kg)</label>
<input name="waste" type="number" min="0" max="500" step=".1" value="${x.waste}" required>
</div>
<div class="field">
<label>AI recommendation (kg)</label>
<input name="recommend" type="number" min="0" max="500" step=".1" value="${x.recommend}" required>
</div>
<p class="sub full" style="font-size:11px;margin:0">Remaining quantity is calculated from prepared minus consumed.</p>
<div id="food-error" class="red full" style="font-size:12px">
</div>
<div class="modal-actions full">
<button type="button" class="btn outline" data-action="modal-close">Cancel</button>
<button class="btn primary">Save food item</button>
</div>
</form>`);
  }

  // Advance simulated sensor readings by one realistic time step.
  function tick() {
    const s = appState.sensors;
    if (!appState.simulation) return;
    s.students = Math.max(300, Math.min(1000, s.students + Math.round(Math.random() * 10 - 3)));
    const rem = Math.max(0, s.prepared - s.consumed);
    const eat = Math.min(rem, +(Math.random() * 0.3 + 0.08).toFixed(2));
    s.consumed = +(s.consumed + eat).toFixed(2);
    s.waste = +Math.max(0.1, Math.min(15, s.waste + eat * (0.025 + Math.random() * 0.055))).toFixed(
      2,
    );
    s.level = Math.min(100, +(s.level + eat * 0.16).toFixed(1));
    s.temp = Math.max(20, Math.min(35, +(s.temp + (Math.random() - 0.48) * 0.22).toFixed(1)));
    s.updated = Date.now();
    appState.prediction = runPrediction({
      students: Math.round(s.students * 1.04),
      current: s.students,
    });
    updateAlerts();
    appState.history[appState.history.length - 1] = {
      ...appState.history.at(-1),
      actual: s.consumed,
      pred: appState.prediction.demand,
      waste: s.waste,
    };
    saveState();
    render();
  }

  function start() {
    if (simulationTimer) return;
    appState.simulation = true;
    tick();
    simulationTimer = setInterval(tick, 2500);
    toast('Live simulation started');
  }

  function pause() {
    if (simulationTimer) {
      clearInterval(simulationTimer);
      simulationTimer = null;
    }
    appState.simulation = false;
    saveState();
    render();
    toast('Simulation paused');
  }

  function resetSensors() {
    if (simulationTimer) {
      clearInterval(simulationTimer);
      simulationTimer = null;
    }
    const d = createDefaultState();
    appState.sensors = d.sensors;
    appState.simulation = false;
    appState.prediction = null;
    saveState();
    render();
    toast('Sensor readings reset');
  }

  function doSensorUpdate() {
    const old = appState.simulation;
    appState.simulation = true;
    tick();
    appState.simulation = old;
    if (!old) {
      saveState();
      render();
    }
    toast('Sensor readings updated');
  }

  function resetDemo() {
    if (!confirm('Reset all saved demo data, settings, sensors, alerts, and food items?')) return;
    if (simulationTimer) {
      clearInterval(simulationTimer);
      simulationTimer = null;
    }
    const d = createDefaultState();
    appState = {
      ...d,
      logged: true,
      page: 'dashboard',
    };
    saveState();
    render();
    toast('Demo data restored');
  }

  appRoot.addEventListener('click', (e) => {
    const pg = e.target.closest('[data-page]');
    if (pg) {
      if (pg.dataset.page === 'presentation') {
        appState.page = 'presentation';
        saveState();
        render();
        return;
      }
      if (['landing', 'how'].includes(pg.dataset.page) && !appState.logged) {
        appState.page = pg.dataset.page === 'landing' ? 'landing' : 'how';
        render();
        return;
      }
      if (!appState.logged && pg.dataset.page !== 'login') {
        appState.page = 'login';
        render();
        return;
      }
      go(pg.dataset.page);
      return;
    }
    const range = e.target.closest('[data-range]');
    if (range) {
      appState.range = range.dataset.range;
      saveState();
      render();
      return;
    }
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    switch (a) {
      case 'demo-login':
        appState.logged = true;
        go('dashboard');
        break;
      case 'mobile-nav':
        document.querySelector('.sidebar').classList.toggle('mobile-open');
        break;
      case 'login-page':
        appState.page = 'login';
        render();
        break;
      case 'home':
        appState.page = 'landing';
        render();
        break;
      case 'logout':
        pause();
        appState.logged = false;
        appState.page = 'landing';
        render();
        break;
      case 'start':
        start();
        break;
      case 'pause':
        pause();
        break;
      case 'pres-start':
        appState.simulation ? pause() : start();
        break;
      case 'sensor-reset':
        resetSensors();
        break;
      case 'sensor-update':
        doSensorUpdate();
        break;
      case 'food-add':
        foodModal();
        break;
      case 'food-edit':
        foodModal(appState.foods.find((x) => String(x.id) === b.dataset.id));
        break;
      case 'food-delete': {
        const x = appState.foods.find((x) => String(x.id) === b.dataset.id);
        if (x && confirm(`Delete ${x.name}?`)) {
          appState.foods = appState.foods.filter((y) => y.id !== x.id);
          appState.sensors.prepared = +appState.foods
            .reduce((a, y) => a + y.prepared, 0)
            .toFixed(2);
          appState.sensors.consumed = +appState.foods
            .reduce((a, y) => a + y.consumed, 0)
            .toFixed(2);
          appState.sensors.waste = +appState.foods.reduce((a, y) => a + y.waste, 0).toFixed(2);
          appState.prediction = runPrediction();
          saveState();
          render();
          toast('Food item deleted');
        }
        break;
      }
      case 'modal-close':
        document.getElementById('modal')?.remove();
        break;
      case 'alert-resolve': {
        const x = appState.alerts.find((x) => String(x.id) === b.dataset.id);
        if (x) x.resolved = true;
        saveState();
        render();
        toast('Alert marked resolved');
        break;
      }
      case 'alert-delete':
        appState.alerts = appState.alerts.filter((x) => String(x.id) !== b.dataset.id);
        saveState();
        render();
        toast('Alert deleted');
        break;
      case 'check-alerts':
        updateAlerts();
        saveState();
        render();
        toast('Sensor thresholds checked');
        break;
      case 'theme':
        appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
        saveState();
        render();
        break;
      case 'notifications':
        appState.settings.notifications = !appState.settings.notifications;
        saveState();
        render();
        break;
      case 'reset-demo':
        resetDemo();
        break;
    }
  });
  appRoot.addEventListener('input', (e) => {
    if (e.target.id === 'food-search') {
      const body = document.getElementById('food-rows');
      if (body) body.innerHTML = foodRows(e.target.value);
    }
  });
  appRoot.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target),
      v = Object.fromEntries(fd.entries());
    if (e.target.id === 'login-form') {
      if (v.email.toLowerCase() === 'admin@smartcanteen.edu' && v.password === 'canteen123') {
        appState.logged = true;
        go('dashboard');
      } else
        document.getElementById('login-error').textContent =
          'Email or password is incorrect. Try the displayed demo credentials or Demo Login.';
    } else if (e.target.id === 'food-form') {
      const vals = ['prepared', 'consumed', 'waste', 'recommend'].map((k) => Number(v[k]));
      if (
        !v.name.trim() ||
        vals.some((x) => !Number.isFinite(x) || x < 0) ||
        Number(v.consumed) > Number(v.prepared)
      ) {
        document.getElementById('food-error').textContent =
          'Enter a name, non-negative quantities, and consumed quantity no greater than prepared.';
        return;
      }
      const item = {
        id: v.id ? Number(v.id) : Date.now(),
        name: v.name.trim(),
        prepared: vals[0],
        consumed: vals[1],
        waste: vals[2],
        recommend: vals[3],
      };
      const i = appState.foods.findIndex((x) => x.id === item.id);
      if (i >= 0) appState.foods[i] = item;
      else appState.foods.push(item);
      appState.sensors.prepared = +appState.foods.reduce((a, x) => a + x.prepared, 0).toFixed(2);
      appState.sensors.consumed = +appState.foods.reduce((a, x) => a + x.consumed, 0).toFixed(2);
      appState.sensors.waste = +appState.foods.reduce((a, x) => a + x.waste, 0).toFixed(2);
      appState.prediction = runPrediction();
      saveState();
      document.getElementById('modal').remove();
      render();
      toast(i >= 0 ? 'Food item updated' : 'Food item added');
    } else if (e.target.id === 'settings-form') {
      if (
        !v.name.trim() ||
        Number(v.wasteThreshold) <= 0 ||
        Number(v.tempThreshold) < 20 ||
        Number(v.tempThreshold) > 35 ||
        Number(v.binCapacity) < 50 ||
        Number(v.binCapacity) > 100
      ) {
        toast('Check the values and enter valid settings');
        return;
      }
      appState.settings = {
        ...appState.settings,
        name: v.name.trim(),
        wasteThreshold: Number(v.wasteThreshold),
        tempThreshold: Number(v.tempThreshold),
        binCapacity: Number(v.binCapacity),
      };
      saveState();
      render();
      toast('Settings saved');
    } else if (e.target.id === 'prediction-form') {
      const fields = ['students', 'consumption', 'prevWaste', 'current'];
      if (
        fields.some((k) => !Number.isFinite(Number(v[k])) || Number(v[k]) < 0) ||
        Number(v.students) < 300 ||
        Number(v.students) > 1000 ||
        Number(v.current) > 1000
      ) {
        document.getElementById('prediction-error').textContent =
          'Use valid non-negative values; expected students must be 300–1,000 and current count at most 1,000.';
        return;
      }
      appState.prediction = runPrediction({
        students: +v.students,
        day: +v.day,
        consumption: +v.consumption,
        prevWaste: +v.prevWaste,
        current: +v.current,
        event: v.event,
        weather: v.weather,
      });
      saveState();
      render();
      toast('AI prediction calculated');
    }
  });
  if (appState.simulation) {
    appState.simulation = false;
    saveState();
  }
  render();
})();
