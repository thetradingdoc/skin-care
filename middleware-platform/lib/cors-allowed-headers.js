'use strict';

/** Keep in sync with corsOptions.allowedHeaders in server.js */
module.exports = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'x-session-id',
  'x-client-date',
  'x-journey-id',
  'idempotency-key',
  'ngrok-skip-browser-warning',
];
