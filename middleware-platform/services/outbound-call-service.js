'use strict';

const db = require('../database');
const twilio = require('twilio');
const { resolveTelephonyWebhookBase } = require('../utils/telephony-webhook-base');

/**
 * Initiate outbound call via Twilio (same path as routes/outbound-call.js).
 */
async function initiateOutboundCall({ phone_number, merchantId, customer_id, call_type = 'rcm_follow_up', clinic_id }) {
  if (!phone_number) throw new Error('Phone number is required');
  const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
  if (!phoneRegex.test(phone_number)) throw new Error('Invalid phone number format');
  if (!merchantId) throw new Error('Merchant context is required');

  const merchant = db.getMerchant(merchantId);
  if (!merchant) throw new Error('Merchant not found');

  const clinic = db.getClinicBySlug(merchant.subdomain || '');
  const retellAgentId = clinic?.retell_agent_id || process.env.RETELL_AGENT_ID;
  if (!retellAgentId) throw new Error('Voice agent not configured');

  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!fromNumber) throw new Error('TWILIO_PHONE_NUMBER not configured');

  const apiBase = await resolveTelephonyWebhookBase();

  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const webhookUrl = new URL(`${apiBase}/voice/incoming`);
  webhookUrl.searchParams.set('call_type', call_type);
  webhookUrl.searchParams.set('agent_id', retellAgentId);
  if (merchantId) webhookUrl.searchParams.set('merchant_id', String(merchantId));
  if (customer_id) webhookUrl.searchParams.set('customer_id', String(customer_id));
  if (clinic_id) webhookUrl.searchParams.set('clinic_id', String(clinic_id));

  const twilioCall = await twilioClient.calls.create({
    from: fromNumber,
    to: phone_number,
    url: webhookUrl.toString(),
    statusCallback: `${apiBase}/voice/status-callback`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
  });

  return {
    success: true,
    call_id: twilioCall.sid,
    provider: 'twilio_direct',
    phone_number,
  };
}

module.exports = { initiateOutboundCall };
