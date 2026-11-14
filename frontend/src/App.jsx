import { useEffect, useRef, useState } from 'preact/hooks';
import FloodRiskV3Page from './FloodRiskV3.jsx';
import WaterBackground from './WaterBackground.jsx';
import RealRiskMap from './RealRiskMap.jsx';

const API_BASE = 'http://localhost:3000/api';
const API_URL = `${API_BASE}/dashboard`;

const areaIcons = {
  'South B': 'building',
  'Nairobi West': 'home',
  Kibera: 'pin',
  Mukuru: 'waves',
};
const navGroups = [
  {
    label: 'MONITOR',
    items: [
      { label: 'Dashboard', icon: 'grid' },
      { label: 'Analytics', icon: 'chart' },
      { label: 'V3 Risk Prediction', icon: 'water' },
    ],
  },
  {
    label: 'MANAGE',
    items: [
      { label: 'Alerts', icon: 'bell' },
      { label: 'Settings', icon: 'settings' },
    ],
  },
];

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 3 6-7" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15m6-12v15" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z" transform="translate(-1 -2) scale(1.08)" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    rain: <><path d="M20 16.2A4.5 4.5 0 0 0 18 7.5a6 6 0 0 0-11.6 1.8A3.5 3.5 0 0 0 7 16h13Z" /><path d="m8 19-1 2m6-2-1 2m6-2-1 2" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    waves: <><path d="M2 8c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" /><path d="M2 13c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" /><path d="M2 18c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" /></>,
    water: <><path d="M12 3s7 7.2 7 12a7 7 0 0 1-14 0c0-4.8 7-12 7-12Z" /><path d="M9 16a3 3 0 0 0 3 2" /></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3" /></>,
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}

function RiskBadge({ risk }) {
  const label = risk === 'UNKNOWN' ? 'Risk unassessed' : risk;
  return <span class={`risk-badge risk-${risk.toLowerCase()}`}><i />{label}</span>;
}

function displayMetric(value) {
  return value == null || value === '' ? '—' : value;
}

function SectionTitle({ eyebrow, title, action }) {
  return <div class="section-title"><div><span class="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>;
}

const rainfallSeriesColors = ['#e06446', '#9b8bd2', '#79b9d0', '#d9ae63'];

function RainChart({ compact = false, trend = [], areaTrends = [] }) {
  const series = areaTrends.length ? areaTrends : [{ name: 'Rainfall', trend }];
  const values = series.flatMap((item) => (item.trend || []).map((point) => Number(typeof point === 'number' ? point : point?.precipitationMm))).filter(Number.isFinite);
  const chartMax = Math.max(5, Math.ceil(Math.max(...values, 0) / 5) * 5);
  const paths = series.map((item) => {
    const points = (item.trend || []).map((point, index) => ({
      value: Number(typeof point === 'number' ? point : point?.precipitationMm),
      x: 34 + (index * 605) / Math.max((item.trend || []).length - 1, 1),
    })).filter((point) => Number.isFinite(point.value)).map((point) => ({ ...point, y: 166 - (point.value / chartMax) * 142 }));
    const path = points.reduce((result, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1];
      const before = points[index - 2] || previous;
      const after = points[index + 1] || point;
      return `${result} C ${previous.x + (point.x - before.x) / 6} ${previous.y + (point.y - before.y) / 6}, ${point.x - (after.x - previous.x) / 6} ${point.y - (after.y - previous.y) / 6}, ${point.x} ${point.y}`;
    }, '');
    return { ...item, path };
  });
  const hasTrend = paths.some((item) => item.path);
  const yLabels = [chartMax, chartMax * 0.75, chartMax * 0.5, chartMax * 0.25].map((value) => `${Number(value.toFixed(1))} mm`);
  return (
    <div class={`chart-wrap ${compact ? 'chart-compact' : ''}`}>
      <div class="chart-y-labels">{yLabels.map((label) => <span key={label}>{label}</span>)}</div>
      <svg class="rain-chart" viewBox="0 0 650 190" preserveAspectRatio="none" role="img" aria-label={hasTrend ? 'Hourly rainfall curve from weather observations' : 'Rainfall curve will appear when readings are available'}>
        {[22, 66, 110, 154].map((y) => <line key={y} x1="25" x2="640" y1={y} y2={y} class="chart-gridline" />)}
        {paths.map((item) => item.path && <path key={item.name} d={item.path} class="chart-curve" style={{ stroke: item.color }} />)}
      </svg>
      {!compact && <div class="chart-x-labels"><span>Earlier</span><span>Hourly rainfall · last 24 hours</span><span>Latest</span></div>}
    </div>
  );
}

function AreaCard({ area }) {
  const risk = area.riskLevel;
  const rainfall24h = area.rainfallLast24HoursMm == null ? null : Number(area.rainfallLast24HoursMm);
  const rainfallIntensity = area.rainfallIntensityMmPerHour == null ? null : Number(area.rainfallIntensityMmPerHour);
  const progress = rainfall24h == null ? 0 : Math.min((rainfall24h / 35) * 100, 100);
  return (
    <article class="area-card">
      <div class="area-top"><div class="area-icon"><Icon name={areaIcons[area.name] || 'pin'} size={19} /></div><RiskBadge risk={risk} /></div>
      <h3>{area.name}</h3><p class="area-zone">{area.zone}</p>
      <div class="area-level"><span>Rainfall · last 24h</span><strong>{rainfall24h == null ? '--' : `${rainfall24h.toFixed(1)} mm`}</strong></div>
      <div class="area-progress"><span class={`progress-${risk.toLowerCase()}`} style={{ width: `${progress}%` }} /></div>
      <div class="area-footer"><span><Icon name="rain" size={14} /> Intensity</span><span class="rainfall-intensity">{rainfallIntensity == null ? '—' : `${rainfallIntensity.toFixed(1)} mm/h`}</span></div>
    </article>
  );
}

function AlertRow({ alert }) {
  const risk = alert.riskLevel;
  const location = alert.areaName || alert.location || 'Monitored area';
  const time = alert.timeLabel || alert.time || 'Time unavailable';
  return (
    <div class="alert-row"><div class={`alert-icon alert-${risk.toLowerCase()}`}><Icon name="rain" size={17} /></div><div class="alert-copy"><h3>{alert.title}</h3><p>{location}</p></div><div class="alert-meta"><RiskBadge risk={risk} /><span>{time}</span></div></div>
  );
}


function DashboardPage({ data }) {
  const { summary, areas } = data;

  const readingCount = areas.filter((area) => area.rainfallLast12HoursMm != null).length;

  return (
    <>
      <section class="hero-card">
        <div class="hero-copy">
          <div class="hero-kicker">
            FLOOD MONITORING <span class="hero-divider" /> NAIROBI COUNTY
          </div>

          <h2>
            Flood monitoring <em>{areas.length ? 'across' : 'awaiting setup'}</em>
            <br />
              {areas.length ? `${areas.length} test areas · ${readingCount} with current readings` : 'No monitored areas configured'}
          </h2>

          <p>
              {areas.length ? 'Track site locations and compare rainfall observations across Nairobi.' : 'Configure monitoring locations to bring site conditions into this workspace.'}
          </p>

          <div class="hero-meta">
            <span><Icon name="clock" size={15} /> Dashboard reporting period</span>
            <span class="hero-confidence">
              <Icon name="check" size={15} />
              Live dashboard
            </span>
          </div>
        </div>

        <div class="hero-score">
          <div class="score-ring">
            <div>
              <strong>{displayMetric(summary.riskIndex)}</strong>
              <span>/ 100</span>
            </div>
          </div>

          <span class="score-label">RISK INDEX</span>

          <div class="score-status">
            <span /> {readingCount ? `${summary.overallRiskLevel} RISK` : 'AWAITING DATA'}
          </div>
        </div>

        <div class="hero-ornament hero-orb-one" />
        <div class="hero-ornament hero-orb-two" />
      </section>

      <section class="rainfall-overview" aria-label="Rainfall measurements by monitored area">
        <div class="rainfall-overview-heading"><div><span class="eyebrow">FOUR-SITE SNAPSHOT</span><h2>Rainfall across your locations</h2></div><span>Weather model estimates</span></div>
        <div class="stats-grid">
          {[
            { label: 'Rainfall today', field: 'rainfallTodayMm', unit: 'mm', icon: 'rain' },
            { label: 'Last 6 hours', field: 'rainfallLast6HoursMm', unit: 'mm', icon: 'rain' },
            { label: 'Last 24 hours', field: 'rainfallLast24HoursMm', unit: 'mm', icon: 'waves' },
            { label: 'Peak intensity', field: 'rainfallIntensityMmPerHour', unit: 'mm/h', icon: 'water' },
          ].map((metric, metricIndex) => (
            <article class={`stat-card rainfall-metric-card rainfall-metric-${metricIndex}`} key={metric.field}>
              <div class="stat-heading"><span class="stat-icon teal"><Icon name={metric.icon} /></span></div>
              <span class="stat-label">{metric.label}</span>
              <div class="rainfall-site-list">
                {areas.map((area, index) => {
                  const value = area[metric.field];
                  return <div class="rainfall-site-row" key={area.id || area.name}><span><i style={{ background: rainfallSeriesColors[index % rainfallSeriesColors.length] }} />{area.name}</span><strong>{value == null ? '--' : `${Number(value).toFixed(1)} ${metric.unit}`}</strong></div>;
                })}
              </div>
              <span class="stat-foot">By monitored area</span>
            </article>
          ))}
        </div>
      </section>

    </>
  );
}


function AnalyticsPage({ data }) {
  const { areas } = data;

  return (
    <>
      <section class="page-intro">
        <span class="eyebrow">RAINFALL ANALYSIS</span>
        <h2>Analytics</h2>
        <p>
          Examine rainfall patterns and compare precipitation
          across monitored Nairobi areas.
        </p>
      </section>

      <section class="panel rainfall-panel analytics-chart">
        <SectionTitle
          eyebrow="PRECIPITATION HISTORY"
          title="Rainfall trend"
        />

        <RainChart areaTrends={data.rainfallTrendByArea || []} trend={data.rainfallTrend || []} />

        <div class="chart-legend">
          {(data.rainfallTrendByArea || []).map((item) => <span class="chart-series-label" key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}
          <span class="chart-source">
            {data.rainfallTrendByArea?.length
              ? 'Hourly weather-model estimates · 24 hours'
              : 'Hourly rainfall data is unavailable right now.'}
          </span>
        </div>
      </section>

      <section class="section-block">
        <SectionTitle
          eyebrow="COMPARATIVE ANALYSIS"
          title="Rainfall by area"
        />

        <div class="area-grid">
          {areas.map((area) => (
            <AreaCard key={area.id || area.name} area={area} />
          ))}
        </div>
      </section>
    </>
  );
}

function AlertsPage({ data }) {
  const [filter, setFilter] = useState('All alerts');

  const alerts = data.recentAlerts || [];

  const visibleAlerts =
    filter === 'All alerts'
      ? alerts
      : alerts.filter(
          (alert) =>
            alert.riskLevel?.toUpperCase() === filter.toUpperCase()
        );

  return (
    <>
      <section class="page-intro">
        <span class="eyebrow">FLOOD NOTIFICATIONS</span>
        <h2>Alerts</h2>
        <p>
          View flood-risk notifications and updates
          for your monitored Nairobi areas.
        </p>
      </section>

      <div class="alert-filters">
        {['All alerts', 'Critical', 'High', 'Moderate', 'Low'].map((item) => (
          <button
            class={filter === item ? 'filter-active' : ''}
            onClick={() => setFilter(item)}
            key={item}
          >
            {item}
            {item === 'All alerts' && <span>{alerts.length}</span>}
          </button>
        ))}
      </div>

      <section class="panel alerts-panel full-alerts">
        {visibleAlerts.length ? (
          visibleAlerts.map((alert) => (
            <AlertRow
              key={alert.id || alert.title}
              alert={alert}
            />
          ))
        ) : (
          <div class="empty-alerts">
            <Icon name="check" size={20} />
            <p>
              {alerts.length
                ? `No ${filter.toLowerCase()} alerts currently available.`
                : 'No risk notifications are available for this period.'}
            </p>
          </div>
        )}
      </section>

    </>
  );
}

function SettingsPage({ data, currentUser }) {
  const [settings, setSettings] = useState({
    phoneNumber: '',
    smsEnabled: false,
    subscribedAreas: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testingSms, setTestingSms] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Load settings belonging to the currently logged-in user.
  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(
          `${API_BASE}/notifications/settings`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          throw new Error('Could not load your notification settings.');
        }

        const result = await response.json();

        if (!cancelled) {
          setSettings(result.settings);
          setSettingsSaved(true);
}
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  // Toggle an area in the subscription list.
  function toggleArea(areaName) {
    setSettingsSaved(false);
    setSettings((previous) => {
      const selected = previous.subscribedAreas.includes(areaName);

      return {
        ...previous,
        subscribedAreas: selected
          ? previous.subscribedAreas.filter(
              (area) => area !== areaName
            )
          : [...previous.subscribedAreas, areaName],
      };
    });
  }

  // Save settings against the authenticated user's account.
  async function saveSettings() {
    try {
      setSaving(true);
      setMessage('');
      setError('');

      const response = await fetch(
        `${API_BASE}/notifications/settings`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to save notification settings.'
        );
      }

      setSettings(result.settings);
      setSettingsSaved(true);
      setMessage('Your notification settings have been saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Send a real test SMS through Africa's Talking.
async function testSms() {
  try {
    setTestingSms(true);
    setMessage('');
    setError('');

    const response = await fetch(
      `${API_BASE}/notifications/test`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || 'Unable to send test SMS.'
      );
    }

    setMessage(
      result.message || 'Test SMS request submitted successfully.'
    );
  } catch (err) {
    setError(err.message || 'Test SMS failed.');
  } finally {
    setTestingSms(false);
  }
}

  return (
    <>
      <section class="page-intro">
        <span class="eyebrow">PREFERENCES</span>
        <h2>Settings</h2>
        <p>
          Manage your notification preferences and monitored areas.
        </p>
        <p class="settings-account">
          Signed in as <b>{currentUser?.email || currentUser?.name}</b>
        </p>
      </section>

      <div class="settings-layout">
        <section class="panel settings-panel">
          <SectionTitle
            eyebrow="PREFERENCES"
            title="SMS Notifications"
          />

          {loading ? (
            <p class="settings-feedback">Loading your settings...</p>
          ) : (
            <>
              <div class="settings-phone-field">
                <label for="notification-phone">
                  Mobile phone number
                </label>

                <input
                  id="notification-phone"
                  type="tel"
                  placeholder="e.g. 0712345678"
                  value={settings.phoneNumber}
                  onInput={(event) => {
                    setSettingsSaved(false);
                    setSettings((previous) => ({
                      ...previous,
                      phoneNumber: event.currentTarget.value,
                    }));
                  }}
                />

                <small>
                  Enter the number where you want to receive flood alerts.
                </small>
              </div>

              <div class="setting-row">
                <div class="setting-symbol">
                  <Icon name="bell" />
                </div>

                <div>
                  <b>SMS alerts</b>
                  <span>
                    Receive critical flood risk updates by SMS.
                  </span>
                </div>

                <button
                  type="button"
                  class={`toggle ${
                    settings.smsEnabled ? 'toggle-on' : ''
                  }`}
                  role="switch"
                  aria-label="SMS alerts"
                  aria-checked={settings.smsEnabled}
                  onClick={() => {
                    setSettingsSaved(false);
                    setSettings((previous) => ({
                      ...previous,
                      smsEnabled: !previous.smsEnabled,
                    }));
                  }}
                >
                  <i />
                </button>
              </div>

            </>
          )}
        </section>

        <section class="panel settings-panel">
          <SectionTitle
            eyebrow="MONITORING"
            title="Areas to monitor"
          />

          <p class="settings-description">
            Choose the Nairobi areas for which you want to receive SMS
            alerts.
          </p>

          <div class="settings-areas">
            {data.areas.map((area) => {
              const selected =
                settings.subscribedAreas.includes(area.name);

              return (
                <label
                  class="setting-row settings-area-option"
                  key={area.id || area.name}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleArea(area.name)}
                  />

                  <div class="area-icon">
                    <Icon
                      name={areaIcons[area.name] || 'pin'}
                      size={17}
                    />
                  </div>

                  <div>
                    <b>{area.name}</b>
                    <span>{area.zone}</span>
                  </div>

                  <RiskBadge risk={area.riskLevel} />
                </label>
              );
            })}
          </div>
        </section>

        {error && (
          <p class="settings-error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p class="settings-success" role="status">
            {message}
          </p>
        )}

        <button
          type="button"
          class="settings-save-button"
          onClick={saveSettings}
          disabled={loading || saving}
        >
          {saving ? 'Saving...' : 'Save notification settings'}
        </button>

        <button
  type="button"
  class="outline-button settings-test-button"
  onClick={testSms}
  disabled={
    loading ||
    saving ||
    testingSms ||
    !settingsSaved ||
    !settings.smsEnabled ||
    !settings.phoneNumber.trim()
  }
>
  {testingSms ? 'Sending test SMS...' : 'Send Test SMS'}
</button>

<p class="settings-description">
  Save your notification settings before sending a test message.
  The test will be sent to your saved mobile number.
</p>

      </div>
    </>
  );
}

function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? 'login' : 'register';
      const body = mode === 'login'
        ? { email, password, rememberMe }
        : { name, email, password };

      const response = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Authentication failed.');
      }

      if (mode === 'register') {
        setMode('login');
        setPassword('');
        setError('');
        alert('Account created successfully. Please log in.');
        return;
      }

      // Confirm the session cookie works before opening the dashboard.
      const meResponse = await fetch(`${API_BASE}/auth/me`, {
        credentials: 'include',
      });

      const meResult = await meResponse.json();

      if (!meResponse.ok) {
        throw new Error('Login succeeded, but the session could not be verified.');
      }

      onAuthenticated(meResult.user || meResult.data?.user || meResult);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main class="auth-screen">
      <section class="auth-card">
        <div class="auth-brand">
          <img class="brand-logo brand-logo-auth" src="/logo.png" alt="FloodWatch logo" />          <span>Flood<span>Watch</span></span>
        </div>

        <div class="auth-heading">
          <span class="eyebrow">NAIROBI COUNTY FLOOD MONITORING</span>
          <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p>
            {mode === 'login'
              ? 'Sign in to access your flood monitoring dashboard.'
              : 'Register to access the FloodWatch monitoring system.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} class="auth-form">
          {mode === 'register' && (
            <label>
              Full name
              <input
                type="text"
                value={name}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="Enter your full name"
                required
                minLength={2}
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onInput={(e) => setEmail(e.currentTarget.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder="Enter your password"
              required
              minLength={8}
            />
          </label>

          {mode === 'login' && (
            <label class="remember-option">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.currentTarget.checked)}
              />
              <span>Remember me for 30 days</span>
            </label>
          )}

          {error && <p class="auth-error" role="alert">{error}</p>}

          <button class="auth-submit" type="submit" disabled={loading}>
            {loading
              ? 'Please wait...'
              : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p class="auth-switch">
          {mode === 'login' ? "Don't have an account?" : 'Already registered?'}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        <p class="auth-security">Secure access · FloodWatch Nairobi</p>
      </section>
    </main>
  );
}

const pageContent = {
  Dashboard: DashboardPage,
  Analytics: AnalyticsPage,
  'V3 Risk Prediction': FloodRiskV3Page,
  Alerts: AlertsPage,
  Settings: SettingsPage,
};

async function loadAreaWeather(payload, signal) {
  const results = await Promise.allSettled(payload.areas.map(async (area) => {
    const response = await fetch(`${API_BASE}/weather?area=${encodeURIComponent(area.name)}`, {
      signal,
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`Weather data unavailable for ${area.name}.`);
    return { area, weather: await response.json() };
  }));

  const weatherById = new Map();
  const hourlyByTime = new Map();
  const totals = { today: [], sixHours: [], twentyFourHours: [], twelveHours: [], intensity: [] };
  const rainfallTrendByArea = [];

  results.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    const { area, weather } = result.value;
    const rainfall = weather.rainfall || {};
    weatherById.set(area.id, {
      ...area,
      rainfallTodayMm: rainfall.sinceNairobiMidnightMm,
      rainfallLast6HoursMm: rainfall.last6HoursMm,
      rainfallLast24HoursMm: rainfall.last24HoursMm,
      rainfallLast12HoursMm: rainfall.last12HoursMm,
      rainfallIntensityMmPerHour: rainfall.maximumHourlyPrecipitationLast24HoursMm,
    });
    rainfallTrendByArea.push({
      name: area.name,
      color: rainfallSeriesColors[payload.areas.findIndex((item) => item.id === area.id) % rainfallSeriesColors.length],
      trend: weather.rainfallTrend || [],
    });
    if (rainfall.sinceNairobiMidnightMm != null) totals.today.push(rainfall.sinceNairobiMidnightMm);
    if (rainfall.last6HoursMm != null) totals.sixHours.push(rainfall.last6HoursMm);
    if (rainfall.last24HoursMm != null) totals.twentyFourHours.push(rainfall.last24HoursMm);
    if (rainfall.last12HoursMm != null) totals.twelveHours.push(rainfall.last12HoursMm);
    if (rainfall.maximumHourlyPrecipitationLast24HoursMm != null) totals.intensity.push(rainfall.maximumHourlyPrecipitationLast24HoursMm);
    (weather.rainfallTrend || []).forEach((point) => {
      if (point.precipitationMm == null) return;
      const values = hourlyByTime.get(point.time) || [];
      values.push(point.precipitationMm);
      hourlyByTime.set(point.time, values);
    });
  });

  const average = (values) => values.length
    ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
    : null;
  const rainfallTrend = [...hourlyByTime.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([time, values]) => ({ time, precipitationMm: average(values) }));

  return {
    ...payload,
    areas: payload.areas.map((area) => weatherById.get(area.id) || area),
    rainfallTrend,
    rainfallTrendByArea,
    summary: {
      ...payload.summary,
      rainfallTodayMm: average(totals.today),
      rainfallLast6HoursMm: average(totals.sixHours),
      rainfallLast24HoursMm: average(totals.twentyFourHours),
      rainfallLast12HoursMm: average(totals.twelveHours),
      rainfallIntensityMmPerHour: average(totals.intensity),
    },
  };
}

function AppContent() {  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [activePage, setActivePage] = useState('Dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [predictionArea, setPredictionArea] = useState('Kibera');
  const [requestState, setRequestState] = useState('loading');
  const [requestError, setRequestError] = useState('');
  const [dashboardRetry, setDashboardRetry] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const dashboardDataRef = useRef(dashboardData);
  dashboardDataRef.current = dashboardData;

  const Page = pageContent[activePage] || DashboardPage;

  // 1. Check whether the user already has a valid login session.
  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
        });

        if (!response.ok) {
          setAuthenticated(false);
          return;
        }

        const result = await response.json();
        const user = result.user || result.data?.user || result;

        setCurrentUser(user);
        setAuthenticated(true);
      } catch (error) {
        console.error('Session check failed:', error);
        setAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    }

    checkSession();
  }, []);

  // 2. Load dashboard information only after authentication succeeds.
  useEffect(() => {
    if (authLoading || !authenticated) return;

    const controller = new AbortController();

    async function loadDashboard() {
      try {
        if (!dashboardDataRef.current) setRequestState('loading');
        else setRefreshing(true);

        const response = await fetch(API_URL, {
          signal: controller.signal,
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(
            `Dashboard API returned HTTP ${response.status}.`
          );
        }

        const payload = await response.json();

        if (
          !payload?.summary ||
          !payload?.prediction ||
          !Array.isArray(payload.areas) ||
          !Array.isArray(payload.recentAlerts)
        ) {
          throw new Error(
            'The dashboard API returned an unexpected response.'
          );
        }

        setDashboardData(payload);
        setRequestError('');
        setRequestState('success');

        const enrichedPayload = await loadAreaWeather(payload, controller.signal);
        if (!controller.signal.aborted) {
          setDashboardData(enrichedPayload);
          setLastUpdated(new Date());
          setRefreshing(false);
        }
      } catch (error) {
        if (error.name === 'AbortError') return;

        console.error('Dashboard loading failed:', error);

        setRequestError(
          error instanceof TypeError
            ? 'Could not reach the dashboard API. Check that the backend is running at localhost:3000 and that CORS allows this frontend.'
            : error.message
        );

        setRefreshing(false);
        setRequestState(dashboardDataRef.current ? 'success' : 'error');
      }
    }

    loadDashboard();
    const refreshTimer = window.setInterval(loadDashboard, 15 * 60 * 1000);

    return () => {
      controller.abort();
      window.clearInterval(refreshTimer);
    };
  }, [authenticated, authLoading, dashboardRetry]);

  // 3. Log out the current user.
  async function handleLogout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      setCurrentUser(null);
      setAuthenticated(false);
      setDashboardData(null);
      setActivePage('Dashboard');
    }
  }

  // 4. Navigation helper.
  const navigate = (label) => {
    setActivePage(label);
    if (label === 'Dashboard' && dashboardDataRef.current) {
      setDashboardRetry((value) => value + 1);
    }
    setMobileMenuOpen(false);
  };

  // 5. Show a loading screen while checking the login session.
  if (authLoading) {
    return (
      <main class="auth-screen">
        <p>Checking your session...</p>
      </main>
    );
  }

  // 6. Show login/signup if the user is not authenticated.
  if (!authenticated) {
    return (
      <AuthPage
        onAuthenticated={(user) => {
          setCurrentUser(user);
          setAuthenticated(true);
        }}
      />
    );
  }

  // 7. Main application layout.
  return (
    <div class="app-shell">
      <aside class={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <a
          class="brand"
          href="#dashboard"
          onClick={(event) => {
            event.preventDefault();
            navigate('Dashboard');
          }}
        >
          <img class="brand-logo" src="/logo.png" alt="FloodWatch logo" />

          <span>
            flood<span class="brand-light">watch</span>
            <small>NAIROBI MONITOR</small>
          </span>
        </a>

        <div class="sidebar-section-label">WORKSPACE</div>

        {navGroups.map((group) => (
          <div class="nav-group" key={group.label}>
            <span class="nav-group-label">{group.label}</span>

            {group.items.map((item) => (
              <button
                key={item.label}
                class={`nav-item ${
                  activePage === item.label ? 'nav-active' : ''
                }`}
                onClick={() => navigate(item.label)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.count && (
                  <b class="nav-count">{item.count}</b>
                )}
              </button>
            ))}
          </div>
        ))}

        <div class="sidebar-bottom">
          <div class="data-status">
            <span class="data-source-icon">
              <Icon name="grid" size={13} />
            </span>

            <div>
              <b>
                {requestState === 'loading'
                  ? 'Loading API data'
                  : requestState === 'error'
                    ? 'API unavailable'
                    : 'Dashboard API ready'}
              </b>

              <small>
                {dashboardData ? 'Dashboard response received' : 'Waiting for dashboard response'}
              </small>
            </div>
          </div>

          <div class="user-profile">
            <span class="user-avatar">
              {(currentUser?.name || currentUser?.email || 'U')
                .slice(0, 1)
                .toUpperCase()}
            </span>

            <span>
              <b>{currentUser?.name || 'FloodWatch User'}</b>
              <small>{currentUser?.role || 'Community Monitor'}</small>
            </span>

            <button
              type="button"
              class="logout-button"
              title="Log out"
              aria-label="Log out"
              onClick={handleLogout}
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div class="main-column">
        <header class="topbar">
          <div class="topbar-title">
            <button
              class="mobile-menu-button"
              aria-label="Open navigation"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Icon name="menu" />
            </button>

            <span class="breadcrumb">
              Nairobi County <Icon name="chevron" size={14} />
              <b>
                {activePage === 'Dashboard' ? 'Overview' : activePage}
              </b>
            </span>
          </div>

          <div class="topbar-actions">
            <div class="status-label">
              {requestState === 'loading' ? 'LOADING DATA' : requestState === 'error' ? 'API UNAVAILABLE' : 'DASHBOARD READY'}
              <span />
              {requestState === 'success'
                ? 'FROM API'
                : requestState === 'error'
                  ? 'UNAVAILABLE'
                  : 'CONNECTING'}
            </div>

            <button
              class="top-icon-button notification-button"
              aria-label="View alerts"
              onClick={() => navigate('Alerts')}
            >
              <Icon name="bell" />
              {dashboardData?.recentAlerts?.length > 0 && <i />}
            </button>

            <button
              class="top-avatar"
              aria-label="Open profile"
              onClick={() => navigate('Settings')}
            >
              {(currentUser?.name || currentUser?.email || 'U')
                .slice(0, 1)
                .toUpperCase()}
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div class="mobile-menu">
            {navGroups
              .flatMap((group) => group.items)
              .map((item) => (
                <button
                  class={
                    activePage === item.label
                      ? 'mobile-nav-active'
                      : ''
                  }
                  onClick={() => navigate(item.label)}
                  key={item.label}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </button>
              ))}
          </div>
        )}

        <main class="main-content">
          {activePage === 'Dashboard' && (
  <div class="page-heading">
    <div>
      <span class="eyebrow">
        {'DASHBOARD OVERVIEW'}
        <i class="heading-weather">
          <Icon name="rain" size={13} /> NAIROBI
        </i>
      </span>

      <h1>{`Welcome, ${(currentUser?.name || 'there').split(' ')[0]}`}</h1>

      <p>Your Nairobi County flood monitoring overview.</p>
    </div>

    <button class="outline-button" onClick={() => setDashboardRetry((value) => value + 1)} disabled={refreshing || requestState === 'loading'}>
      <Icon name="clock" size={15} /> {refreshing || requestState === 'loading' ? 'Updating readings…' : 'Refresh readings'}
    </button>
    {requestError && <span class="dashboard-refresh-error" role="status" title={requestError}>Refresh issue</span>}
    {lastUpdated && <span class="dashboard-updated">Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
  </div>
)}

          {activePage === 'Dashboard' && (
            <section class="dashboard-map-panel panel">
              <div class="map-toolbar"><div><strong>Nairobi County</strong><span>Four monitored locations</span></div><span class="map-count">{dashboardData?.areas?.length || 4} locations</span></div>
              <RealRiskMap
                areas={dashboardData?.areas || []}
                onRunModel={(area) => {
                  setPredictionArea(area);
                  navigate('V3 Risk Prediction');
                }}
              />
            </section>
          )}

          {requestState === 'loading' && (
            <section class="panel prediction-panel" role="status">
              Loading dashboard information...
            </section>
          )}

          {requestState === 'error' && (
            <section class="panel prediction-panel" role="alert">
              <strong>Dashboard data could not be loaded.</strong>
              <p class="prediction-note">{requestError}</p>
              <button
              class="outline-button"onClick={() => setDashboardRetry((value) => value + 1)}
              >
                Retry dashboard
              </button>
            </section>
          )}

          {requestState === 'success' && dashboardData && (
            <Page
              data={dashboardData}
              currentUser={currentUser}
              onNavigate={navigate}
              initialArea={predictionArea}
            />
          )}

          <footer class="page-footer">
            <span>
              FloodWatch <b>·</b> Community monitoring dashboard
            </span>

            <span>
              Dashboard readings
              <i />
              {requestState === 'error'
                ? 'API unavailable'
                : requestState === 'loading'
                  ? 'Waiting for API'
                  : 'Received from API'}
            </span>
          </footer>
        </main>

        <nav class="mobile-bottom-nav" aria-label="Mobile navigation">
          {[
            { label: 'Dashboard', icon: 'grid' },
            { label: 'Analytics', icon: 'chart' },
            { label: 'Alerts', icon: 'bell' },
            { label: 'Settings', icon: 'settings' },
          ].map((item) => (
            <button
              class={
                activePage === item.label ? 'bottom-nav-active' : ''
              }
              key={item.label}
              onClick={() => navigate(item.label)}
            >
              <Icon name={item.icon} size={19} />
              <span>
                {item.label === 'Settings'
                  ? 'Profile'
                  : item.label}
              </span>
              {item.label === 'Alerts' && (
                <i class="bottom-alert-dot" />
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <>
      <WaterBackground />
      <AppContent />
    </>
  );
}
