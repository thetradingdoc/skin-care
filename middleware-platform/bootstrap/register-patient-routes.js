'use strict';

const { registerFaceReadPublicRoute } = require('../routes/public-face-read');
const { registerPublicRoutineRoutes } = require('../routes/public-routines');
const { registerPublicFunnelMatchRoutes } = require('../routes/public-funnel-match');
const { registerPublicFunnelJourneyRoutes } = require('../routes/public-funnel-journey');
const { registerPublicFunnelIntakeRoutes } = require('../routes/public-funnel-intake');
const { registerPublicFunnelSpecialistRoutes } = require('../routes/public-funnel-specialists');
const { registerPatientFunnelBridgeRoutes } = require('../routes/patient-funnel-bridge');
const { registerPatientCareProgramBillingRoutes } = require('../routes/patient-care-program-billing');
const { registerPublicProductScanRoutes } = require('../routes/public-product-scan');
const { registerPublicRoutineEvaluateRoutes } = require('../routes/public-routine-evaluate');
const { registerPatientCheckoutChatRoutes } = require('../routes/patient-checkout-chat');
const { registerPatientRoutineRoutes } = require('../routes/patient-routine');
const { registerPatientShelfRoutes } = require('../routes/patient-shelf');
const { registerPatientBioProfileRoutes } = require('../routes/patient-bio-profile');
const { registerPatientProductsRoutes } = require('../routes/patient-products');
const { registerPatientBillingPortalRoutes } = require('../routes/patient-billing-portal');
const { registerPatientBookingRoutes } = require('../routes/patient-booking');
const { registerPublicLandingAssistantRoutes } = require('../routes/public-landing-assistant');
const { registerPatientProfileRoutes } = require('../routes/patient-profile');
const { registerPatientAuthRoutes } = require('../routes/patient-auth');
const { registerPatientDocumentsRoutes } = require('../routes/patient-documents');
const { registerPatientWalletRoutes } = require('../routes/patient-wallet');
const { registerPatientRcmRoutes } = require('../routes/patient-rcm');
const { registerPatientInsuranceRoutes } = require('../routes/patient-insurance');
const { registerPriorAuthRoutes } = require('../routes/prior-auth');

/** Consumer funnel + early patient mounts (preserve order vs voice/retell routes). */
function registerConsumerFunnelRoutes(app, deps) {
  const {
    apiLimiter,
    db,
    express,
    requirePatientSession,
    recordPatientPortalEvent,
    resolvePatientIdFromSession,
    ensureBillingTables,
    resolveBillingSubscription,
    billingOk,
    billingErr,
    validatePatientCheckoutChatBody,
    requireCsrfForCookieAuth,
    rotatePatientSessionIfNeeded,
    blockChatWhenDisabled,
    botGuard,
  } = deps;

  registerFaceReadPublicRoute(app, { apiLimiter });
  registerPublicRoutineRoutes(app, { apiLimiter });
  registerPublicFunnelMatchRoutes(app, { apiLimiter });
  registerPublicFunnelJourneyRoutes(app, { apiLimiter, db });
  registerPublicFunnelIntakeRoutes(app, { apiLimiter });
  registerPublicFunnelSpecialistRoutes(app, { apiLimiter });

  registerPatientFunnelBridgeRoutes(app, {
    apiLimiter,
    requirePatientSession,
    recordPatientPortalEvent,
    db,
    resolvePatientIdFromSession,
  });

  app.get(/^\/consumer(\/.*)?$/, (req, res) => {
    const sub = String(req.path || '').replace(/^\/consumer\/?/, '');
    if (sub.includes('get-app') || sub.includes('join')) {
      return res.redirect(302, '/app/sign-in?intent=signup');
    }
    return res.redirect(302, '/start');
  });

  registerPatientCareProgramBillingRoutes(app, {
    apiLimiter,
    express,
    requirePatientSession,
    ensureBillingTables,
    resolvePatientIdFromSession,
    resolveBillingSubscription,
    billingOk,
    billingErr,
    db,
  });

  registerPublicProductScanRoutes(app, { apiLimiter });
  registerPublicRoutineEvaluateRoutes(app, { apiLimiter, botGuard: botGuard || ((_q, _r, n) => n()), db });
  registerPatientCheckoutChatRoutes(app, {
    apiLimiter,
    express,
    requirePatientSession,
    requireCsrfForCookieAuth,
    validatePatientCheckoutChatBody,
    rotatePatientSessionIfNeeded,
    blockChatWhenDisabled,
    db,
  });
}

/** Patient portal routes (after validators and auth token mounts). */
function registerPatientPortalRoutes(app, deps) {
  const {
    patientRouteDeps,
    patientPortalDeps,
    apiLimiter,
    express,
    db,
    validatePatientTriageBody,
    upsertCustomerProductScan,
    antiSybilGuard,
    requireAdminAuth,
  } = deps;

  registerPatientRoutineRoutes(app, patientRouteDeps);
  registerPatientBioProfileRoutes(app, patientRouteDeps);
  registerPatientShelfRoutes(app, patientRouteDeps);
  registerPatientProductsRoutes(app, patientRouteDeps);
  registerPatientBillingPortalRoutes(app, patientRouteDeps);
  registerPatientBookingRoutes(app, patientRouteDeps);

  registerPublicLandingAssistantRoutes(app, {
    apiLimiter,
    express,
    validatePatientTriageBody,
    db,
    upsertCustomerProductScan,
    antiSybilGuard,
    requireAdminAuth,
  });

  registerPatientProfileRoutes(app, patientPortalDeps);
  registerPatientAuthRoutes(app, patientPortalDeps);
  registerPatientDocumentsRoutes(app, patientPortalDeps);
  registerPatientWalletRoutes(app, patientPortalDeps);
  registerPatientRcmRoutes(app, patientPortalDeps);
  registerPatientInsuranceRoutes(app, patientPortalDeps);
  registerPriorAuthRoutes(app, { apiLimiter, express, db });
}

module.exports = {
  registerConsumerFunnelRoutes,
  registerPatientPortalRoutes,
};
