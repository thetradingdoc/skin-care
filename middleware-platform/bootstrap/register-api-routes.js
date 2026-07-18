'use strict';

/** Core B2B/API mounts (signup through video-consult) — before consumer funnel. */
function registerCoreApiRoutes(app) {
  const signupRoutes = require('../routes/signup');
  app.use('/api', signupRoutes);

  const creditsRoutes = require('../routes/credits');
  app.use('/api/credits', creditsRoutes);

  const invoiceRoutes = require('../routes/invoices');
  app.use('/api', invoiceRoutes);

  const merchantRoutes = require('../routes/merchant');
  app.use('/api/merchant', merchantRoutes);
  const providerRoutes = require('../routes/providers');
  app.use('/api/providers', providerRoutes);

  const clinicInvoiceRoutes = require('../routes/invoices-clinic');
  const { requireAdminAuth } = require('../middleware/admin-auth');
  app.use('/api/invoices', requireAdminAuth, clinicInvoiceRoutes); // SEC-15

  const productRoutes = require('../routes/products');
  const orderRoutes = require('../routes/orders');
  app.use('/api/products', productRoutes);
  const prescriptionRoutes = require('../routes/prescriptions');
  app.use('/api/prescriptions', prescriptionRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/prescription-orders', orderRoutes);

  const onboardingRoutes = require('../routes/onboarding');
  app.use('/api/onboarding', onboardingRoutes);

  const adminLeadsRoutes = require('../routes/admin-leads');
  app.use('/api/admin/leads', adminLeadsRoutes);

  const sequencesRoutes = require('../routes/sequences');
  app.use('/api/sequences', sequencesRoutes);

  const workflowsRoutes = require('../routes/workflows');
  app.use('/api/admin/workflows', workflowsRoutes);

  const aiTemplatesRoutes = require('../routes/ai-templates');
  app.use('/api/ai/templates', aiTemplatesRoutes);

  const qualificationRulesRoutes = require('../routes/qualification-rules');
  app.use('/api/qualification-rules', qualificationRulesRoutes);

  const adminAIAssistantRoutes = require('../routes/admin-ai-assistant');
  app.use('/api/admin/ai', adminAIAssistantRoutes);

  const adminTenantsRoutes = require('../routes/admin-tenants');
  app.use('/api/admin/tenants', requireAdminAuth, adminTenantsRoutes); // SEC-16

  const tenantConfigRoutes = require('../routes/tenant-config');
  app.use('/api/tenant', tenantConfigRoutes);

  const ragProxyRoutes = require('../routes/rag-proxy');
  const ragSearchRoutes = require('../routes/rag-search');
  app.use('/api/rag', ragProxyRoutes);
  app.use('/api/rag', ragSearchRoutes);

  const videoConsultRoutes = require('../routes/video-consult');
  app.use('/api/video-consult', videoConsultRoutes);
}

/** Public catalog + commerce (mounted after voice routes in server.js). */
function registerPublicCommerceRoutes(app, { publicCatalogReadLimiter, publicCommerceLimiter }) {
  const publicProductsRoutes = require('../routes/public-products');
  app.use('/api/public/products', publicCatalogReadLimiter, publicProductsRoutes);
  app.use('/api/public/prescriptions', publicCatalogReadLimiter, publicProductsRoutes);
  app.use('/public/products', publicCatalogReadLimiter, publicProductsRoutes);
  app.use('/public/prescriptions', publicCatalogReadLimiter, publicProductsRoutes);

  const publicPlanSearchRoutes = require('../routes/public-plan-search');
  app.use('/api/public/plans', publicCatalogReadLimiter, publicPlanSearchRoutes);
  const publicGeoRoutes = require('../routes/public-geo');
  app.use('/api/public/geo', publicCatalogReadLimiter, publicGeoRoutes);
  const publicProviderSearchRoutes = require('../routes/public-provider-search');
  app.use('/api/public/providers', publicCatalogReadLimiter, publicProviderSearchRoutes);

  const publicCheckoutRoutes = require('../routes/public-checkout');
  app.use('/api/public/checkout', publicCheckoutRoutes);

  const publicCommerceQuoteRoutes = require('../routes/public-commerce-quote');
  const publicCommerceCartRoutes = require('../routes/public-commerce-cart');
  app.use('/api/public/commerce', publicCommerceLimiter);
  app.use('/api/public/commerce', publicCommerceQuoteRoutes);
  app.use('/api/public/commerce', publicCommerceCartRoutes);
  app.use('/public/commerce', publicCommerceLimiter);
  app.use('/public/commerce', publicCommerceQuoteRoutes);
  app.use('/public/commerce', publicCommerceCartRoutes);

  const publicCheckoutChatRoutes = require('../routes/public-checkout-chat');
  app.use('/api/public/checkout-chat', publicCheckoutChatRoutes);
}

module.exports = {
  registerCoreApiRoutes,
  registerPublicCommerceRoutes,
};
