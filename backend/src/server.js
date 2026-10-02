import 'dotenv/config';
import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(cors());

// Replace this local demo data with database/API values in a later stage.
const demoAreas = [
  {
    id: 'south-b',
    name: 'South B',
    zone: 'Industrial Area - Zone 04',
    riskLevel: 'WARNING',
    rainfallLast12HoursMm: 28.4,
    rainfallIntensityMmPerHour: 8.2,
  },
  {
    id: 'nairobi-west',
    name: 'Nairobi West',
    zone: 'Madaraka - Zone 02',
    riskLevel: 'ADVISORY',
    rainfallLast12HoursMm: 19.7,
    rainfallIntensityMmPerHour: 5.6,
  },
  {
    id: 'kibera',
    name: 'Kibera',
    zone: 'Laini Saba - Zone 07',
    riskLevel: 'WARNING',
    rainfallLast12HoursMm: 24.1,
    rainfallIntensityMmPerHour: 7.1,
  },
  {
    id: 'mukuru',
    name: 'Mukuru',
    zone: 'Kwa Njenga - Zone 09',
    riskLevel: 'WATCH',
    rainfallLast12HoursMm: 11.2,
    rainfallIntensityMmPerHour: 3.4,
  },
];

const demoDashboard = {
  dataMode: 'demo',
  summary: {
    rainfallTodayMm: 38.6,
    rainfallLast6HoursMm: 24.2,
    rainfallLast12HoursMm: 31.8,
    rainfallIntensityMmPerHour: 6.4,
    overallRiskLevel: 'HIGH',
    riskIndex: 68,
  },
  prediction: {
    type: 'rainfall',
    window: 'Next 6 hours',
    expectedRainfallMm: 42,
    confidencePercent: 87,
    isDemo: true,
  },
  areas: demoAreas,
  recentAlerts: [
    {
      id: 'alert-south-b-demo',
      title: 'High rainfall intensity in sample data',
      areaId: 'south-b',
      areaName: 'South B',
      riskLevel: 'WARNING',
      timeLabel: 'Demo scenario',
    },
    {
      id: 'alert-kibera-demo',
      title: 'Elevated 6-hour rainfall estimate',
      areaId: 'kibera',
      areaName: 'Kibera',
      riskLevel: 'ADVISORY',
      timeLabel: 'Demo scenario',
    },
    {
      id: 'alert-nairobi-west-demo',
      title: 'Rainfall accumulation approaching watch level',
      areaId: 'nairobi-west',
      areaName: 'Nairobi West',
      riskLevel: 'WATCH',
      timeLabel: 'Demo scenario',
    },
  ],
};

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'smart-flood-monitor-api',
    dataMode: 'demo',
  });
});

app.get('/api/areas', (_request, response) => {
  response.json({ dataMode: 'demo', areas: demoAreas });
});

app.get('/api/dashboard', (_request, response) => {
  response.json(demoDashboard);
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
