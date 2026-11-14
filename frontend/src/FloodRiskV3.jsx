import { useEffect, useState } from 'preact/hooks';

const initialValues = {
  area: 'Kibera',
  rain_mm: '',
  rain_max_1h: '',
  rain_3d: '',
  rain_7d: '',
  rain_14d: '',
  soil_moisture: '',
  temp_c: '',
  humidity: '',
  discharge_m3s: '',
  discharge_change_1d: '',
  discharge_3d_mean: '',
  elevation_m: '1650',
  runoff_coef: '0.6',
};

const fields = [
  ['rain_mm', 'Rainfall since Nairobi midnight (mm)'],
  ['rain_max_1h', 'Maximum rainfall in 1 hour (mm)'],
  ['rain_3d', 'Rainfall total over 3 days (mm)'],
  ['rain_7d', 'Rainfall total over 7 days (mm)'],
  ['rain_14d', 'Rainfall total over 14 days (mm)'],
  ['soil_moisture', 'Soil moisture (model input scale)'],
  ['temp_c', 'Temperature (°C)'],
  ['humidity', 'Relative humidity (%)'],
  ['discharge_m3s', 'River discharge (m³/s)'],
  ['discharge_change_1d', 'Daily discharge change (m³/s)'],
  ['discharge_3d_mean', 'Mean discharge over 3 days (m³/s)'],
  ['elevation_m', 'Elevation (m)'],
  ['runoff_coef', 'Runoff coefficient (model input scale)'],
];

const riskColors = {
  Low: '#77797c',
  Moderate: '#b28745',
  High: '#d64b32',
  Critical: '#b81908',
};

export default function FloodRiskV3Page({ initialArea = 'Kibera' }) {
  const [values, setValues] = useState(() => ({ ...initialValues, area: initialArea }));
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [discharge, setDischarge] = useState(null);

  useEffect(() => {
    if (initialArea && initialArea !== values.area) changeArea(initialArea);
  }, [initialArea]);


  function updateField(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  function changeArea(area) {
    setValues((previous) => ({
      ...previous,
      area,
      rain_mm: '',
      rain_max_1h: '',
      rain_3d: '',
      rain_7d: '',
      rain_14d: '',
      soil_moisture: '',
      temp_c: '',
      humidity: '',
      discharge_m3s: '',
      discharge_change_1d: '',
      discharge_3d_mean: '',
      }));
    setWeather(null);
    setDischarge(null);
    setWeatherError('');
    setError('');
    setResult(null);
  }



async function fetchWeather() {
  setWeatherLoading(true);
  setWeatherError('');
  setError('');
  setResult(null);
  setWeather(null);
  setDischarge(null);

  // Clear previously fetched values to prevent stale data being reused.
  setValues((previous) => ({
    ...previous,
    rain_mm: '',
    rain_max_1h: '',
    rain_3d: '',
    rain_7d: '',
    rain_14d: '',
    soil_moisture: '',
    temp_c: '',
    humidity: '',
    discharge_m3s: '',
    discharge_change_1d: '',
    discharge_3d_mean: '',
  }));

  try {
    const area = encodeURIComponent(values.area);

    const [weatherResponse, dischargeResponse] = await Promise.all([
      fetch(`/api/weather?area=${area}`),
      fetch(`/api/discharge?area=${area}`),
    ]);

    const [weatherData, dischargeData] = await Promise.all([
      weatherResponse.json(),
      dischargeResponse.json(),
    ]);

    if (!weatherResponse.ok) {
      throw new Error(
        weatherData.error ||
          `Weather request failed (HTTP ${weatherResponse.status}).`
      );
    }

    if (!dischargeResponse.ok) {
      throw new Error(
        dischargeData.error ||
          `Discharge request failed (HTTP ${dischargeResponse.status}).`
      );
    }

    const weatherValues = {
      rain_mm: weatherData.rainfall?.sinceNairobiMidnightMm,
      rain_max_1h:
        weatherData.rainfall?.maximumHourlyPrecipitationLast24HoursMm,
      rain_3d: weatherData.rainfall?.last3DaysMm,
      rain_7d: weatherData.rainfall?.last7DaysMm,
      rain_14d: weatherData.rainfall?.last14DaysMm,
      soil_moisture: weatherData.weather?.soilMoisture0To7cm,
      temp_c: weatherData.weather?.temperatureC,
      humidity: weatherData.weather?.relativeHumidityPercent,
    };

    const dischargeValues = {
      discharge_m3s: dischargeData.discharge_m3s,
      discharge_change_1d: dischargeData.discharge_change_1d,
      discharge_3d_mean: dischargeData.discharge_3d_mean,
    };

    for (const [key, value] of Object.entries({
      ...weatherValues,
      ...dischargeValues,
    })) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`The API returned an invalid value for ${key}.`);
      }
    }

    setValues((previous) => {
      const updates = {};

      for (const [key, value] of Object.entries({
        ...weatherValues,
        ...dischargeValues,
      })) {
        updates[key] = String(value);
      }

      return { ...previous, ...updates };
      });

    setWeather(weatherData);
    setDischarge(dischargeData);
  } catch (err) {
    setWeather(null);
    setDischarge(null);
    setWeatherError(
      err.message || 'Could not retrieve weather and discharge data.'
    );
  } finally {
    setWeatherLoading(false);
  }
}

  async function submitPrediction(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    const payload = { area: values.area };

    for (const [key] of fields) {
      if (
        values[key].trim() === '' ||
        !Number.isFinite(Number(values[key]))
      ) {
        setError(`Please enter a valid number for "${key}".`);
        setLoading(false);
        return;
      }

      payload[key] = Number(values[key]);
    }

    try {
      const response = await fetch('/api/predict-risk-v3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
            `Prediction request failed (HTTP ${response.status}).`
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        `${err.message}. Check that the Node.js backend is running and that Vite proxies /api requests to port 3000.`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
<section class="section-block v3-page">      <div class="page-intro">
        <span class="eyebrow">RANDOM FOREST · V3</span>
        <h2>Flood risk prediction</h2>
        <p>
          Submit rainfall, environmental and discharge features to the deployed
          model. The prefilled values are examples for testing, not verified
          live measurements.
          </p>
      </div>

      <section
        class="panel"
        style={{ padding: '24px', marginBottom: '20px' }}
      >
        <form onSubmit={submitPrediction}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '18px',
            }}
          >
            <label style={{ display: 'grid', gap: '8px' }}>
              <span>Monitored area</span>
              <select
                value={values.area}
                onChange={(event) => changeArea(event.currentTarget.value)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  width: '100%',
                }}
              >
                {['Kibera', 'Mukuru', 'Nairobi West', 'South B'].map(
                  (area) => (
                    <option value={area} key={area}>
                      {area}
                    </option>
                  )
                )}
              </select>
            </label>

            {fields.map(([name, label]) => (
              <label
                key={name}
                style={{ display: 'grid', gap: '8px' }}
              >
                <span>{label}</span>
                <input
                  type="number"
                  step="any"
                  required
                  value={values[name]}
                  onInput={(event) =>
                    updateField(name, event.currentTarget.value)
                  }
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    width: '100%',
                  }}
                />
              </label>
            ))}
          </div>


          <div style={{ marginTop: '18px' }}>
            <button
              type="button"
              class="outline-button"
              onClick={fetchWeather}
              disabled={weatherLoading}
              style={{
                cursor: weatherLoading ? 'wait' : 'pointer',
                 }}
            >
              {weatherLoading? 'Fetching weather and discharge…' : 'Fetch latest weather & discharge'}            </button>

            {weatherError && (
              <p role="alert" style={{ marginTop: '12px' }}>
                <strong>Data retrieval:</strong> {weatherError}
              </p>
            )}

            {weather && (
              <div
                class="prediction-note"
                style={{
                  marginTop: '16px',
                  padding: '16px',
                  borderRadius: '10px',
                  overflowWrap: 'anywhere',
                }}
              >
                <h3 style={{ marginTop: 0 }}>Retrieved weather data</h3>
                <p><strong>Area:</strong> {weather.area}</p>
                <p><strong>Source:</strong> {weather.source}</p>
                <p>
                  <strong>Retrieved:</strong>{' '}
                  {new Date(weather.retrievedAt).toLocaleString()}
                </p>
                <p>
                  <strong>Temperature:</strong>{' '}
                  {weather.weather?.temperatureC ?? 'Unavailable'} °C
                </p>
                <p>
                  <strong>Humidity:</strong>{' '}
                  {weather.weather?.relativeHumidityPercent ?? 'Unavailable'}%
                </p>
                <p>
                  <strong>Soil moisture:</strong>{' '}
                  {weather.weather?.soilMoisture0To7cm ?? 'Unavailable'} m³/m³
                </p>
                <p>
                  <strong>Maximum hourly rainfall (last 24 hours):</strong>{' '}
                  {weather.rainfall?.maximumHourlyPrecipitationLast24HoursMm ?? 'Unavailable'} mm
                </p>
                <p>
                  <strong>Rainfall since Nairobi midnight:</strong>{' '}
                  {weather.rainfall?.sinceNairobiMidnightMm ?? 'Unavailable'} mm
                </p>
                 <p>
                  <strong>Last 3 days:</strong>{' '}
                  {weather.rainfall?.last3DaysMm ?? 'Unavailable'} mm
                </p>
                <p>
                  <strong>Last 7 days:</strong>{' '}
                  {weather.rainfall?.last7DaysMm ?? 'Unavailable'} mm
                </p>
                <p>
                  <strong>Last 14 days:</strong>{' '}
                  {weather.rainfall?.last14DaysMm ?? 'Unavailable'} mm
                </p>

                {weather.coverage?.missingHourlyTimestamps > 0 && (
                  <p role="alert">
                    <strong>Warning:</strong> The 14-day data contains
                    missing hourly timestamps. Verify coverage before using
                    the rainfall values.
                  </p>
                )}

                <p>
                  <strong>Important:</strong> Weather values are estimates
                  for approximate area coordinates, not local rain-gauge
                  measurements. Today's rainfall is a partial-day total.
                </p>
              </div>
            )}

            {discharge && (
              <div
                class="prediction-note"
                style={{
                  marginTop: '16px',
                  padding: '16px',
                  borderRadius: '10px',
                  overflowWrap: 'anywhere',
                }}
              >
                <h3 style={{ marginTop: 0 }}>Retrieved river-discharge data</h3>
                <p><strong>Area:</strong> {discharge.area || values.area}</p>
                <p><strong>Source:</strong> {discharge.source || 'Open-Meteo Flood API (GloFAS/modelled data)'}</p>
                <p><strong>Latest completed data date:</strong> {discharge.latestDate ?? 'Unavailable'}</p>
                <p><strong>Data age:</strong> {Number.isFinite(discharge.dataAgeDays) ? `${discharge.dataAgeDays} day(s)` : 'Unavailable'}</p>
                <p><strong>River discharge:</strong> {discharge.discharge_m3s ?? 'Unavailable'} m³/s</p>
                <p><strong>Daily discharge change:</strong> {discharge.discharge_change_1d ?? 'Unavailable'} m³/s</p>
                <p><strong>Three-day mean discharge:</strong> {discharge.discharge_3d_mean ?? 'Unavailable'} m³/s</p>
                {discharge.gridLocation && (
                  <p>
                    <strong>API grid location:</strong>{' '}
                    {discharge.gridLocation.latitude}, {discharge.gridLocation.longitude}
                  </p>
                )}
                {discharge.warning && <p><strong>Data note:</strong> {discharge.warning}</p>}
                <p>
                  <strong>Important:</strong> These are modelled discharge estimates,
                  not measurements from a river gauge. Different neighbourhoods may
                  share the same underlying API grid cell.
                </p>
              </div>
            )}
          </div>

          <p
            class="prediction-note"
            style={{ marginTop: '18px' }}
          >
            Use values in the units shown. Do not treat the example
            environmental and discharge inputs as current Nairobi measurements.
          </p>

          <button
          type="submit"
            class="outline-button"
            disabled={loading}
            style={{
              marginTop: '12px',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Predicting…' : 'Run V3 risk prediction'}
          </button>
        </form>
      </section>

      {error && (
        <section
          class="panel"
          role="alert"
          style={{ padding: '20px', marginBottom: '20px' }}
        >
          <strong>Prediction could not be completed</strong>
          <p>{error}</p>
        </section>
      )}

      {result && (
        <section
          class="panel"
          style={{ padding: '24px', marginBottom: '20px' }}
        >
          <span class="eyebrow">MODEL RESPONSE</span>
          <h2 style={{ marginTop: '10px' }}>
            {result.area || values.area}
          </h2>
          <p>Model: {result.model || 'V3'}</p>

          {/* Improved risk category and data mode display */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'stretch',
              gap: '16px',
              margin: '24px 0',
              padding: '18px',
              borderRadius: '12px',
              background: 'rgba(128, 128, 128, 0.08)',
            }}
          >
            <div style={{ display: 'grid', gap: '8px', flex: '1 1 200px' }}>
              <span
                style={{
                  fontSize: '12px',
                  letterSpacing: '0.06em',
                  opacity: 0.7,
                }}
              >
                PREDICTED RISK CATEGORY
              </span>

              <span
                style={{
                  background: riskColors[result.riskCategory] || '#555',
                  color: '#fff',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  display: 'inline-block',
                  width: 'fit-content',
                }}
              >
                {result.riskCategory || 'Category unavailable'} risk
              </span>
            </div>
             <div
              style={{
                display: 'grid',
                gap: '8px',
                flex: '1 1 200px',
                alignContent: 'start',
              }}
            >
              <span style={{ fontSize: '12px', letterSpacing: '0.06em', opacity: 0.7 }}>DATA SOURCE</span>
              <strong style={{ overflowWrap: 'anywhere' }}>{result.dataMode || result.model || 'Model response'}</strong>
            </div>
          </div>

          <h3>Model-class probabilities</h3>

          {Object.entries(result.probabilities || {}).map(
            ([label, probability]) => (
              <div key={label} style={{ margin: '16px 0' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px',
                  }}
                >
                  <span>{label}</span>
                  <strong>
                    {(Number(probability) * 100).toFixed(1)}%
                  </strong>
                </div>

                <div
                  style={{
                    height: '10px',
                    borderRadius: '8px',
                    background: '#343538',
                    overflow: 'hidden',
                    }}
                >
                  <div
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, Number(probability) * 100)
                      )}%`,
                      height: '100%',
                      borderRadius: '8px',
                      background: riskColors[label] || '#77797c',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )
          )}

          {result.thresholdNote && (
            <p
              class="prediction-note"
              style={{ marginTop: '24px' }}
              >
              <strong>Threshold note:</strong> {result.thresholdNote}
            </p>
          )}

          <p
            class="prediction-note"
            style={{
              marginTop: '16px',
              padding: '12px',
              borderLeft: '3px solid #b7791f',
            }}
          >
            These are model-class probabilities, not independently validated
            real-world flood probabilities or official warnings.
          </p>
        </section>
      )}
    </section>
  );
}
