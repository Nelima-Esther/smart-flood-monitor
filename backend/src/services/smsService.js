import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AfricasTalking = require('africastalking');

function normalizeKenyanPhoneNumber(phoneNumber) {
  const phone = String(phoneNumber || '').trim().replace(/[\s()-]/g, '');

  if (/^0[17]\d{8}$/.test(phone)) {
    return `+254${phone.slice(1)}`;
  }

  if (/^254[17]\d{8}$/.test(phone)) {
    return `+${phone}`;
  }

  if (/^\+254[17]\d{8}$/.test(phone)) {
    return phone;
  }

  throw new Error(
    'Invalid Kenyan mobile number. Use a number such as 0712345678.'
  );
}

export async function sendSms({ to, message }) {
  const username = process.env.AT_USERNAME?.trim();
  const apiKey = process.env.AT_API_KEY?.trim();

  if (!username || !apiKey) {
    throw new Error('Africa\'s Talking credentials are not configured.');
  }

  if (!message || typeof message !== 'string') {
    throw new Error('A valid SMS message is required.');
  }

  const phoneNumber = normalizeKenyanPhoneNumber(to);

  const client = AfricasTalking({
    username,
    apiKey,
  });

  return client.SMS.send({
    to: [phoneNumber],
    message,
  });
}