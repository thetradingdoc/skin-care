'use strict';

const constants = require('../utils/constants');

function registerHealthRoutes(app, { db, healthCheckHandler, readinessCheck, livenessCheck }) {
  app.get('/health', healthCheckHandler);
  app.get('/health/ready', readinessCheck);
  app.get('/health/live', livenessCheck);

  app.get('/health/voice-deps', async (req, res) => {
    try {
      const twilioPhone = process.env.TWILIO_PHONE_NUMBER || null;
      const retellAgentId = process.env.RETELL_AGENT_ID || null;
      const defaultSubdomain = constants.TENANTS?.DEFAULT_SUBDOMAIN || 'akin-dunbar';

      const clinicPhone = twilioPhone ? db.getClinicPhoneNumber(twilioPhone) : null;
      const defaultMerchant = db.getMerchantBySubdomain ? db.getMerchantBySubdomain(defaultSubdomain) : null;

      const checks = {
        retell_api_key_present: !!process.env.RETELL_API_KEY,
        retell_agent_id_present: !!retellAgentId,
        twilio_phone_present: !!twilioPhone,
        twilio_phone_mapped_to_clinic: !!clinicPhone?.clinic_id,
        default_tenant_exists: !!defaultMerchant?.id,
      };

      const ok = Object.values(checks).every(Boolean);
      return res.status(ok ? 200 : 503).json({
        success: ok,
        checks,
        details: {
          twilio_phone_number: twilioPhone,
          mapped_clinic_id: clinicPhone?.clinic_id || null,
          mapped_clinic_name: clinicPhone?.clinic_name || null,
          default_subdomain: defaultSubdomain,
          default_merchant_id: defaultMerchant?.id || null,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = { registerHealthRoutes };
