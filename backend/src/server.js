import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import database from './database.js';
import { sendSms } from './services/smsService.js';
import {
  register,
  login,
  requireAuth,
  getCurrentUser,
  logout,
} from './auth.js';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
const monitoredAreas = [
  { id: 'south-b', name: 'South B', zone: 'Industrial Area', latitude: -1.323, longitude: 36.833, riskLevel: 'UNKNOWN', rainfallLast12HoursMm: null, rainfallIntensityMmPerHour: null },
  { id: 'nairobi-west', name: 'Nairobi West', zone: 'Madaraka', latitude: -1.316, longitude: 36.817, riskLevel: 'UNKNOWN', rainfallLast12HoursMm: null, rainfallIntensityMmPerHour: null },
  { id: 'kibera', name: 'Kibera', zone: 'Laini Saba', latitude: -1.313, longitude: 36.787, riskLevel: 'UNKNOWN', rainfallLast12HoursMm: null, rainfallIntensityMmPerHour: null },
  { id: 'mukuru', name: 'Mukuru', zone: 'Kwa Njenga', latitude: -1.316, longitude: 36.881, riskLevel: 'UNKNOWN', rainfallLast12HoursMm: null, rainfallIntensityMmPerHour: null },
];

const emptyDashboard = {
  summary: {
    rainfallTodayMm: null,
    rainfallLast6HoursMm: null,
    rainfallLast12HoursMm: null,
    rainfallIntensityMmPerHour: null,
    overallRiskLevel: 'UNKNOWN',
    riskIndex: null,
  },
  prediction: {},
  areas: monitoredAreas,
  recentAlerts: [],
};

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'smart-flood-monitor-api' });
});

app.get('/api/areas', (_request, response) => {
  response.json({ areas: monitoredAreas });
});

app.get('/api/dashboard', (_request, response) => {
  try {
    const predictionRows = database.prepare(`
      SELECT id, location_name, predicted_at, risk_level, probability
      FROM risk_predictions
      ORDER BY predicted_at DESC, id DESC
    `).all();
    const latestByArea = new Map();
    predictionRows.forEach((row) => {
      const key = row.location_name.toLowerCase();
      if (!latestByArea.has(key)) latestByArea.set(key, row);
    });

    const alertRows = database.prepare(`
      SELECT id, location_name, message, status, created_at
      FROM alert_records
      ORDER BY created_at DESC, id DESC
      LIMIT 30
    `).all();
    const recentAlerts = alertRows.map((row) => {
      const match = row.message.match(/\[V3:(HIGH|CRITICAL)\]/i);
      const riskLevel = match ? match[1][0] + match[1].slice(1).toLowerCase() : 'Unknown';
      const timestamp = new Date(`${row.created_at.replace(' ', 'T')}Z`);
      return {
        id: row.id,
        title: row.message.replace(/^\[V3:(?:HIGH|CRITICAL)\]\s*/i, ''),
        areaName: row.location_name,
        riskLevel,
        status: row.status,
        time: Number.isNaN(timestamp.getTime()) ? row.created_at : timestamp.toISOString(),
        timeLabel: Number.isNaN(timestamp.getTime()) ? row.created_at : timestamp.toLocaleString(),
      };
    });

    const latestPrediction = predictionRows[0] || null;
    const areas = monitoredAreas.map((area) => ({
      ...area,
      riskLevel: latestByArea.get(area.name.toLowerCase())?.risk_level || 'UNKNOWN',
      riskProbability: latestByArea.get(area.name.toLowerCase())?.probability ?? null,
      riskPredictedAt: latestByArea.get(area.name.toLowerCase())?.predicted_at ?? null,
    }));

    response.json({
      ...emptyDashboard,
      areas,
      recentAlerts,
      summary: {
        ...emptyDashboard.summary,
        overallRiskLevel: latestPrediction?.risk_level || 'UNKNOWN',
      },
      prediction: latestPrediction ? {
        area: latestPrediction.location_name,
        riskLevel: latestPrediction.risk_level,
        probability: latestPrediction.probability,
        predictedAt: latestPrediction.predicted_at,
      } : {},
    });
  } catch (error) {
    console.error('Dashboard data query failed:', error.message);
    response.status(500).json({ error: 'Could not load dashboard history.' });
  }
});

app.post('/api/predict-risk', async (request, response) => {
  try {
    const mlServiceUrl = process.env.ML_SERVICE_URL;

    if (!mlServiceUrl) {
      return response.status(500).json({
        error: 'ML_SERVICE_URL is not configured.',
      });
    }

    const responseFromModel = await fetch(
      `${mlServiceUrl}/predict/risk-v2`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(30000),
      }
    );

    const result = await responseFromModel.json();

    if (!responseFromModel.ok) {
      return response.status(responseFromModel.status).json({
        error: 'The ML service could not process the prediction.',
        details: result,
      });
    }

    return response.json(result);
  } catch (error) {
    console.error('ML prediction request failed:', error.message);

    return response.status(502).json({
      error: 'Could not reach the ML prediction service.',
    });
  }
});


app.post('/api/predict-risk-v3', async (request, response) => {
  try {
    const mlServiceUrl = process.env.ML_SERVICE_URL;

    if (!mlServiceUrl) {
      return response.status(500).json({
        error: 'ML_SERVICE_URL is not configured.',
      });
    }

    // 1. Request a prediction from the V3 ML service.
    const responseFromModel = await fetch(
      `${mlServiceUrl}/predict/risk-v3`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(60000),
      }
    );

    const result = await responseFromModel.json();

    if (!responseFromModel.ok) {
      return response.status(responseFromModel.status).json({
        error: 'The V3 ML service could not process the prediction.',
        details: result,
      });
    }

    // 2. Validate and standardise the model response.
    const validAreas = [
      'Kibera',
      'Mukuru',
      'Nairobi West',
      'South B',
    ];

    const areaName = validAreas.find(
      area =>
        area.toLowerCase() === String(result.area || '').toLowerCase()
    );

    const riskCategory = result.riskCategory;
    const validRiskCategories = [
      'Low',
      'Moderate',
      'High',
      'Critical',
    ];

    if (
      !areaName ||
      !validRiskCategories.includes(riskCategory) ||
      !result.probabilities ||
      typeof result.probabilities !== 'object'
    ) {
      return response.status(502).json({
        error: 'The V3 model returned an invalid prediction format.',
      });
    }

    const probability = result.probabilities[riskCategory];

    if (
      typeof probability !== 'number' ||
      !Number.isFinite(probability) ||
      probability < 0 ||
      probability > 1
    ) {
      return response.status(502).json({
        error: 'The V3 model returned an invalid risk probability.',
      });
    }

    // 3. Save every successful prediction.
    database.prepare(`
      INSERT INTO risk_predictions (
        location_name,
        predicted_at,
        risk_level,
        probability
      )
      VALUES (?, ?, ?, ?)
    `).run(
      areaName,
      new Date().toISOString(),
      riskCategory,
      probability
    );

    // 4. Only High and Critical predictions trigger SMS alerts.
    if (!['High', 'Critical'].includes(riskCategory)) {
      return response.json({
        ...result,
        notification: {
          triggered: false,
          reason: 'SMS notifications are reserved for High and Critical risks.',
          smsSent: 0,
        },
      });
    }

    // 5. Prevent duplicate alerts for the same area and risk
    // category within the last 30 minutes.
    const alertKey = `[V3:${riskCategory.toUpperCase()}]`;

    const existingAlert = database.prepare(`
      SELECT id
      FROM alert_records
      WHERE location_name = ?
        AND message LIKE ?
        AND created_at >= datetime('now', '-30 minutes')
      ORDER BY id DESC
      LIMIT 1
    `).get(areaName, `${alertKey}%`);

    if (existingAlert) {
      return response.json({
        ...result,
        notification: {
          triggered: false,
          reason: 'A matching alert was already created within the last 30 minutes.',
          smsSent: 0,
          existingAlertId: existingAlert.id,
        },
      });
    }

    // 6. Create a new alert record.
    const alertMessage =
      `${alertKey} FloodWatch ${riskCategory} risk detected in ${areaName}. ` +
      `The model estimates a ${Math.round(probability * 100)}% probability ` +
      `of this risk category. Follow local safety guidance and official advisories.`;

    const alertInsert = database.prepare(`
      INSERT INTO alert_records (
        location_name,
        message,
        status
      )
      VALUES (?, ?, 'pending')
    `).run(areaName, alertMessage);

    const alertId = Number(alertInsert.lastInsertRowid);

    // 7. Find active subscribers who selected this area.
    const subscribers = database.prepare(`
      SELECT
        id,
        phone_number,
        subscribed_areas
      FROM notification_subscribers
      WHERE is_opted_in = 1
        AND is_active = 1
    `).all();

    const matchingSubscribers = subscribers.filter(subscriber => {
      try {
        const areas = JSON.parse(subscriber.subscribed_areas);

        return (
          Array.isArray(areas) &&
          areas.some(
            area =>
              typeof area === 'string' &&
              area.toLowerCase() === areaName.toLowerCase()
          )
        );
      } catch {
        console.error(
          `Invalid subscribed areas for subscriber ${subscriber.id}`
        );
        return false;
      }
    });

    let smsSent = 0;
    let smsFailed = 0;
    let smsSkipped = 0;

    const smsMessage =
      `FloodWatch ${riskCategory} Risk Alert: ${areaName}. ` +
      `Our V3 model estimates a ${Math.round(probability * 100)}% ` +
      `probability of this risk category. Please follow local safety ` +
      `guidance and official advisories.`;

    // 8. Send an individual SMS to each matching subscriber.
    for (const subscriber of matchingSubscribers) {
      // Create the log first. The unique constraint prevents a
      // second attempt for the same alert and subscriber.
      const logInsert = database.prepare(`
        INSERT OR IGNORE INTO notification_logs (
          alert_id,
          subscriber_id,
          provider,
          status,
          attempted_at
        )
        VALUES (?, ?, 'Africa''s Talking', 'pending', CURRENT_TIMESTAMP)
      `).run(alertId, subscriber.id);

      if (logInsert.changes === 0) {
        smsSkipped++;
        continue;
      }

      try {
        const smsResult = await sendSms({
          to: subscriber.phone_number,
          message: smsMessage,
        });

        const recipient =
          smsResult?.SMSMessageData?.Recipients?.[0];

        const providerStatus = recipient?.status || 'Unknown';
        const statusCode = Number(recipient?.statusCode);

        const accepted =
          providerStatus.toLowerCase() === 'success' ||
          statusCode === 101;

        if (accepted) {
          smsSent++;
        } else {
          smsFailed++;
        }

        database.prepare(`
          UPDATE notification_logs
          SET
            provider_message_id = ?,
            status = ?,
            error_message = ?
          WHERE alert_id = ?
            AND subscriber_id = ?
        `).run(
          recipient?.messageId || null,
          accepted ? 'sent' : 'failed',
          accepted ? null : `Africa's Talking status: ${providerStatus}`,
          alertId,
          subscriber.id
        );

      } catch (smsError) {
        smsFailed++;

        console.error(
          `SMS failed for subscriber ${subscriber.id}:`,
          smsError.message
        );

        database.prepare(`
          UPDATE notification_logs
          SET
            status = 'failed',
            error_message = ?
          WHERE alert_id = ?
            AND subscriber_id = ?
        `).run(
          smsError.message,
          alertId,
          subscriber.id
        );
      }
    }

    // 9. Update the overall alert status.
    const alertStatus =
      smsSent > 0
        ? 'sent'
        : matchingSubscribers.length === 0
          ? 'no_recipients'
          : 'failed';

    database.prepare(`
      UPDATE alert_records
      SET
        status = ?,
        sent_at = CASE
          WHEN ? > 0 THEN CURRENT_TIMESTAMP
          ELSE sent_at
        END
      WHERE id = ?
    `).run(alertStatus, smsSent, alertId);

    // 10. Return the original prediction plus notification results.
    return response.json({
      ...result,
      notification: {
        triggered: true,
        alertId,
        alertStatus,
        subscribersMatched: matchingSubscribers.length,
        smsSent,
        smsFailed,
        smsSkipped,
      },
    });

  } catch (error) {
    console.error('V3 ML prediction or notification failed:', error);

    return response.status(500).json({
      error: 'The prediction could not be saved or processed.',
    });
  }
});

const weatherAreas = {
  Kibera: { latitude: -1.313, longitude: 36.787 },
  Mukuru: { latitude: -1.316, longitude: 36.881 },
  'Nairobi West': { latitude: -1.316, longitude: 36.817 },
  'South B': { latitude: -1.323, longitude: 36.833 },
};

app.get('/api/weather', async (request, response) => {
  try {
    const requestedArea = String(request.query.area || 'Kibera');
    const areaName = Object.keys(weatherAreas).find(
      (name) => name.toLowerCase() === requestedArea.toLowerCase()
    );

    if (!areaName) {
      return response.status(400).json({
        error: 'Unknown area. Choose Kibera, Mukuru, Nairobi West, or South B.',
      });
    }

    const location = weatherAreas[areaName];

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      hourly:
        'precipitation,temperature_2m,relative_humidity_2m,soil_moisture_0_to_7cm',
      past_days: '14',
      forecast_days: '1',
      timezone: 'UTC',
    }).toString();

    const weatherResponse = await fetch(url, {
      signal: AbortSignal.timeout(20000),
    });

    if (!weatherResponse.ok) {
      console.error('Open-Meteo HTTP status:', weatherResponse.status);
      return response.status(502).json({
        error: 'The weather provider could not return weather data.',
      });
    }

    const weather = await weatherResponse.json();
    const hourly = weather.hourly;

    if (
      !hourly ||
      !Array.isArray(hourly.time) ||
      !Array.isArray(hourly.precipitation) ||
      !Array.isArray(hourly.temperature_2m) ||
      !Array.isArray(hourly.relative_humidity_2m) ||
      !Array.isArray(hourly.soil_moisture_0_to_7cm)
    ) {
      return response.status(502).json({
        error: 'The weather provider returned an incomplete hourly response.',
      });
    }

    const now = new Date();

    // Open-Meteo times are UTC. Ignore future hours in rainfall summaries.
    const observations = hourly.time
      .map((time, index) => ({
        time: new Date(`${time}:00Z`),
        precipitation: hourly.precipitation[index],
        temperature: hourly.temperature_2m[index],
        humidity: hourly.relative_humidity_2m[index],
        soilMoisture: hourly.soil_moisture_0_to_7cm[index],
      }))
      .filter(
        (item) =>
          !Number.isNaN(item.time.getTime()) &&
          item.time <= now
      );

    if (observations.length === 0) {
      return response.status(502).json({
        error: 'No recent weather observations were returned.',
      });
    }

    const latest = observations[observations.length - 1];

    function sumRainSince(startTime) {
      const selected = observations.filter(
        (item) => item.time >= startTime
      );

      // Do not report a total if rainfall values are missing.
      if (
        selected.length === 0 ||
        selected.some(
          (item) =>
            typeof item.precipitation !== 'number' ||
            !Number.isFinite(item.precipitation)
        )
      ) {
        return null;
      }

      return Number(
        selected.reduce((sum, item) => sum + item.precipitation, 0).toFixed(2)
      );
    }

    function validNumber(value) {
      return typeof value === 'number' && Number.isFinite(value)
        ? value
        : null;
    }

    const nairobiNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const nairobiMidnightUtc = Date.UTC(
      nairobiNow.getUTCFullYear(),
      nairobiNow.getUTCMonth(),
      nairobiNow.getUTCDate()
    ) - 3 * 60 * 60 * 1000;

    const dayStart = new Date(nairobiMidnightUtc);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const last24 = observations.filter(
      (item) => item.time >= last24Hours
    );

    const recentRainValues = last24.map((item) => item.precipitation);
    const maxOneHourRain =
      recentRainValues.length > 0 &&
      recentRainValues.every(
        (value) => typeof value === 'number' && Number.isFinite(value)
      )
        ? Math.max(...recentRainValues)
        : null;

    return response.json({
      area: areaName,
      dataMode: 'weather-model-data',
      source: 'Open-Meteo Forecast API',
      location: {
        ...location,
        note: 'Approximate area-centre coordinates; not a local rain-gauge measurement.',
      },
      units: {
        precipitation: 'mm',
        temperature: 'Â°C',
        humidity: '%',
        soilMoisture: 'mÂ³/mÂ³',
      },
      retrievedAt: now.toISOString(),
      latestWeatherTime: latest.time.toISOString(),
      weather: {
        temperatureC: validNumber(latest.temperature),
        relativeHumidityPercent: validNumber(latest.humidity),
        soilMoisture0To7cm: validNumber(latest.soilMoisture),
      },
      rainfall: {
        sinceNairobiMidnightMm: sumRainSince(dayStart),
        last6HoursMm: sumRainSince(
          new Date(now.getTime() - 6 * 60 * 60 * 1000)
        ),
        last12HoursMm: sumRainSince(
          new Date(now.getTime() - 12 * 60 * 60 * 1000)
        ),
        last24HoursMm: sumRainSince(last24Hours),
        last3DaysMm: sumRainSince(
          new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
        ),
        last7DaysMm: sumRainSince(
          new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        ),
        last14DaysMm: sumRainSince(
          new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        ),
        maximumHourlyPrecipitationLast24HoursMm: maxOneHourRain,
      },
      rainfallTrend: observations
        .filter((item) => item.time >= last24Hours)
        .map((item) => ({
          time: item.time.toISOString(),
          precipitationMm: validNumber(item.precipitation),
        })),


coverage: (() => {
  const hourMs = 60 * 60 * 1000;

  // Align the window to exact hourly timestamps.
  const endHour = Math.floor(now.getTime() / hourMs) * hourMs;
  const startHour = endHour - 14 * 24 * hourMs;

  const last14Days = observations.filter((item) => {
    const time = item.time.getTime();
    return time >= startHour && time <= endHour;
  });

  const timestamps = new Set(
    last14Days.map((item) =>
      Math.floor(item.time.getTime() / hourMs) * hourMs
    )
  );

  const expectedRecords = 14 * 24 + 1;
  let missingHourlyTimestamps = 0;

  for (
    let hour = startHour;
    hour <= endHour;
    hour += hourMs
  ) {
    if (!timestamps.has(hour)) {
      missingHourlyTimestamps++;
    }
  }

  return {
    hourlyRecordsAvailable: observations.length,
    recordsWithinRolling14Days: last14Days.length,
    expectedRecordsWithinRolling14Days: expectedRecords,
    missingHourlyTimestamps,
    note: 'Coverage is checked against a rolling 14-day window aligned to hourly timestamps. Verify complete coverage for each rainfall interval before using it for modelling.',
  };
})(),

      warning:
        'Weather-model estimates are not official flood warnings. River discharge, elevation and runoff coefficient have not been supplied by this endpoint.',
    });
  } catch (error) {
    console.error('Weather data request failed:', error.message);

    return response.status(502).json({
      error: 'Could not retrieve weather data. Please try again later.',
    });
  }
});


app.get('/api/discharge', async (request, response) => {
  try {
    const requestedArea = String(request.query.area || 'Kibera');
    const areaName = Object.keys(weatherAreas).find(
      (name) => name.toLowerCase() === requestedArea.toLowerCase()
    );

    if (!areaName) {
      return response.status(400).json({
        error: 'Unknown area. Choose Kibera, Mukuru, Nairobi West, or South B.',
      });
    }

    const location = weatherAreas[areaName];
    const url = new URL('https://flood-api.open-meteo.com/v1/flood');

    url.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      daily: 'river_discharge',
      past_days: '7',
      forecast_days: '3',
      timezone: 'GMT',
    }).toString();

    const apiResponse = await fetch(url, {
      signal: AbortSignal.timeout(20000),
    });

    if (!apiResponse.ok) {
      return response.status(502).json({
        error: `Flood data provider returned HTTP ${apiResponse.status}.`,
      });
    }

    const data = await apiResponse.json();
    const dates = data.daily?.time;
    const values = data.daily?.river_discharge;

    if (
      !Array.isArray(dates) ||
      !Array.isArray(values) ||
      dates.length !== values.length
    ) {
      return response.status(502).json({
        error: 'The flood data provider returned incomplete discharge data.',
      });
    }

    const records = dates
      .map((date, index) => ({
        date,
        discharge: values[index],
      }))
      .filter(
        (item) =>
          typeof item.date === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
          typeof item.discharge === 'number' &&
          Number.isFinite(item.discharge) &&
          item.discharge >= 0
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    // Use the latest available completed day, not today's partial day.
    const todayUtc = new Date().toISOString().slice(0, 10);
    const completed = records.filter((item) => item.date < todayUtc);
    const latest = completed[completed.length - 1];

    if (!latest) {
      return response.status(502).json({
        error: 'No completed daily discharge values are available.',
      });
    }

    const previousDate = new Date(`${latest.date}T00:00:00Z`);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);
    const twoDaysBeforeDate = new Date(`${latest.date}T00:00:00Z`);
    twoDaysBeforeDate.setUTCDate(twoDaysBeforeDate.getUTCDate() - 2);

    const previous = completed.find(
      (item) => item.date === previousDate.toISOString().slice(0, 10)
    );
    const twoDaysBefore = completed.find(
      (item) => item.date === twoDaysBeforeDate.toISOString().slice(0, 10)
    );

    if (!previous || !twoDaysBefore) {
      return response.status(502).json({
        error: 'Three consecutive completed daily discharge values are not available.',
        latestAvailableDate: latest.date,
      });
    }

    const ageDays = Math.floor(
      (Date.parse(`${todayUtc}T00:00:00Z`) -
        Date.parse(`${latest.date}T00:00:00Z`)) /
        86400000
    );

    return response.json({
      area: areaName,
      source: 'Open-Meteo Flood API (GloFAS)',
      dataMode: 'modelled-river-discharge',
      requestedLocation: location,
      gridLocation: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
      units: { discharge: 'm3/s' },
      latestDate: latest.date,
      dataAgeDays: ageDays,
      discharge_m3s: latest.discharge,
      discharge_change_1d: Number(
        (latest.discharge - previous.discharge).toFixed(4)
      ),
      discharge_3d_mean: Number(
        (
          (latest.discharge + previous.discharge +
            twoDaysBefore.discharge) /
          3
        ).toFixed(4)
      ),
      dailyHistory: [twoDaysBefore, previous, latest],
      warning:
        'Modelled discharge estimates are not local river-gauge readings. Verify the returned grid location and data freshness before using these values for predictions.',
    });
  } catch (error) {
    console.error('Discharge data request failed:', error.message);

    return response.status(502).json({
      error: 'Could not retrieve river-discharge data.',
    });
  }
});

// NOTIFICATION SETTINGS ROUTES

// Get notification settings for the currently logged-in user
app.get('/api/notifications/settings', requireAuth, (req, res) => {
  try {
    const settings = database.prepare(`
      SELECT
        phone_number,
        is_opted_in,
        is_active,
        subscribed_areas
      FROM notification_subscribers
      WHERE user_id = ?
    `).get(req.user.id);

    if (!settings) {
      return res.json({
        settings: {
          phoneNumber: '',
          smsEnabled: false,
          isActive: true,
          subscribedAreas: [],
        },
      });
    }

    return res.json({
      settings: {
        phoneNumber: settings.phone_number,
        smsEnabled: settings.is_opted_in === 1,
        isActive: settings.is_active === 1,
        subscribedAreas: JSON.parse(settings.subscribed_areas),
      },
    });

  } catch (error) {
    console.error('Load notification settings error:', error);

    return res.status(500).json({
      message: 'Unable to load notification settings.',
    });
  }
});


// Save notification settings for the currently logged-in user
app.put('/api/notifications/settings', requireAuth, (req, res) => {
  try {
    const {
      phoneNumber,
      smsEnabled,
      subscribedAreas,
    } = req.body;

    if (
      typeof phoneNumber !== 'string' ||
      typeof smsEnabled !== 'boolean' ||
      !Array.isArray(subscribedAreas) ||
      !subscribedAreas.every(
        area => typeof area === 'string' && area.trim().length > 0
      )
    ) {
      return res.status(400).json({
        message: 'Invalid notification settings.',
      });
    }

    const cleanPhoneNumber = phoneNumber.trim();

    if (cleanPhoneNumber.length > 30) {
      return res.status(400).json({
        message: 'Phone number is too long.',
      });
    }

    if (smsEnabled && !cleanPhoneNumber) {
      return res.status(400).json({
        message: 'Enter a phone number before enabling SMS alerts.',
      });
    }

    const cleanAreas = [
      ...new Set(subscribedAreas.map(area => area.trim())),
    ];

    database.prepare(`
      INSERT INTO notification_subscribers (
        user_id,
        phone_number,
        is_opted_in,
        is_active,
        subscribed_areas,
        updated_at
      )
      VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)

      ON CONFLICT(user_id) DO UPDATE SET
        phone_number = excluded.phone_number,
        is_opted_in = excluded.is_opted_in,
        is_active = 1,
        subscribed_areas = excluded.subscribed_areas,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      req.user.id,
      cleanPhoneNumber,
      smsEnabled ? 1 : 0,
      JSON.stringify(cleanAreas)
    );

    return res.json({
      message: 'Notification settings saved successfully.',
      settings: {
        phoneNumber: cleanPhoneNumber,
        smsEnabled,
        isActive: true,
        subscribedAreas: cleanAreas,
      },
    });

  } catch (error) {
    console.error('Save notification settings error:', error);

    return res.status(500).json({
      message: 'Unable to save notification settings.',
    });
  }
});

// Send a test SMS to the logged-in user's saved phone number.
app.post('/api/notifications/test', requireAuth, async (req, res) => {
  try {
    const subscriber = database.prepare(`
      SELECT
        id,
        phone_number,
        is_opted_in,
        is_active
      FROM notification_subscribers
      WHERE user_id = ?
    `).get(req.user.id);

    if (!subscriber) {
      return res.status(404).json({
        message: 'Save your notification settings before testing SMS.',
      });
    }

    if (subscriber.is_opted_in !== 1 || subscriber.is_active !== 1) {
      return res.status(400).json({
        message: 'Enable SMS alerts before sending a test message.',
      });
    }

    if (!subscriber.phone_number) {
      return res.status(400).json({
        message: 'No phone number is saved in your notification settings.',
      });
    }

    const result = await sendSms({
      to: subscriber.phone_number,
      message:
        'FloodWatch Test: Your SMS notifications are configured. You will receive flood risk alerts for your selected Nairobi monitoring areas.',
    });

    console.log('Africa\'s Talking test SMS response:', result);

    return res.json({
      message: 'Test SMS request submitted to Africa\'s Talking.',
      providerResponse: result,
    });

  } catch (error) {
    console.error('Test SMS failed:', error);

    return res.status(500).json({
      message: error.message || 'Unable to send test SMS.',
    });
  }
});
// AUTHENTICATION ROUTES

app.post('/api/auth/register', register);

app.post('/api/auth/login', login);

app.get('/api/auth/me', requireAuth, getCurrentUser);

app.post('/api/auth/logout', requireAuth, logout);

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
