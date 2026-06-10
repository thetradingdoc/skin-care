/**
 * EMAIL SERVICE
 * Supports multiple email providers:
 * - SMTP (Gmail, SendGrid, Mailgun, etc.)
 * - Azure Communication Services Email (via SMTP or SDK)
 * Falls back to console logging if not configured
 */

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn('⚠️  nodemailer not installed - emails will be logged to console');
  console.warn('   Install with: npm install nodemailer');
  nodemailer = null;
}

let azureEmailClient;
try {
  const { EmailClient } = require('@azure/communication-email');
  azureEmailClient = EmailClient;
} catch (e) {
  // Azure SDK not installed - will use SMTP if configured
  azureEmailClient = null;
}

const SkinCareEmail = require('../lib/skin-care-email-layout');

const EMAIL_SUBJECT_VERIFICATION = 'Email verification';

/** @param {string} [raw] SMTP_FROM or SMTP_USER value */
function formatSmtpFrom(raw) {
  const addr = String(raw || '').trim();
  if (!addr) return 'Skin & Care <info@callsomo.com>';
  if (/<[^>]+>/.test(addr)) return addr;
  return `Skin & Care <${addr}>`;
}

/** Bare address for providers that do not accept "Name <email>" (e.g. Azure). */
function smtpFromAddress(raw) {
  const formatted = formatSmtpFrom(raw);
  const match = formatted.match(/<([^>]+)>/);
  return match ? match[1].trim() : formatted;
}

class EmailService {
  /** @private Skin & Care-branded HTML wrapper — see lib/skin-care-email-layout.js */
  static _skinCareLayout(title, subtitle, bodyHtml, opts = {}) {
    return SkinCareEmail.layout({ title, subtitle, bodyHtml, ...opts });
  }
  /**
   * Check if Azure Communication Services is configured
   */
  static isAzureConfigured() {
    return !!(process.env.AZURE_COMMUNICATION_CONNECTION_STRING && azureEmailClient);
  }

  /** True when a real outbound path (Azure or SMTP) is available — not console-only. */
  static isDeliveryConfigured() {
    return this.isAzureConfigured() || !!this.getTransporter();
  }

  static _isProductionEnv() {
    const env = String(process.env.NODE_ENV || '').toLowerCase();
    return env === 'production' || env === 'prod';
  }

  /**
   * Get Azure Email Client
   */
  static getAzureClient() {
    if (!this.isAzureConfigured()) {
      return null;
    }

    try {
      // Parse connection string: endpoint=https://...;accesskey=...
      const connString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;

      // Handle escaped semicolons and backslashes
      const cleanConnString = connString.replace(/\\;/g, ';').replace(/\\/g, '');

      const endpointMatch = cleanConnString.match(/endpoint=https?:\/\/([^;]+)/);
      const accessKeyMatch = cleanConnString.match(/accesskey=([^;]+)/);

      if (!endpointMatch || !accessKeyMatch) {
        throw new Error('Invalid connection string format');
      }

      // Remove trailing slashes and clean endpoint
      let endpoint = endpointMatch[1].trim();
      endpoint = endpoint.replace(/\/+$/, ''); // Remove trailing slashes
      endpoint = `https://${endpoint}`;

      const accessKey = accessKeyMatch[1].trim();

      // Validate endpoint URL
      try {
        new URL(endpoint);
      } catch (urlError) {
        throw new Error(`Invalid endpoint URL: ${endpoint}`);
      }

      // Create client with endpoint and access key
      return new azureEmailClient(endpoint, { key: accessKey });
    } catch (error) {
      console.error('❌ Error initializing Azure Email Client:', error.message);
      return null;
    }
  }

  /**
   * Get email transporter (SMTP)
   * Returns null if credentials not configured
   */
  static getTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    if (!nodemailer) {
      console.warn('⚠️  nodemailer not installed - emails will be logged to console');
      return null;
    }

    if (!smtpHost || !smtpUser || !smtpPassword) {
      return null; // Silent return - will check Azure next
    }

    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword
      }
    });
  }

  /**
   * Send email via Azure Communication Services
   * @private
   * Note: Azure Communication Services Email API doesn't support attachments in the current SDK
   * Attachments will be skipped when using Azure
   */
  static async _sendViaAzure({ to, subject, html, text, attachments }) {
    try {
      const client = this.getAzureClient();
      if (!client) {
        return null;
      }

      if (attachments && attachments.length > 0) {
        console.warn('⚠️  Azure Communication Services Email API does not support attachments. Falling back to SMTP.');
        return null; // Fall back to SMTP for attachments
      }

      const senderAddress = smtpFromAddress(
        process.env.AZURE_EMAIL_SENDER || process.env.SMTP_FROM || process.env.SMTP_USER
      ) || 'DoNotReply@azurecomm.net';

      const message = {
        content: {
          subject: subject,
          plainText: text || html.replace(/<[^>]*>/g, ''),
          html: html
        },
        recipients: {
          to: [{ address: to }]
        },
        senderAddress: senderAddress
      };

      const poller = await client.beginSend(message);
      const result = await poller.pollUntilDone();

      console.log('📧 Email sent via Azure:', result.id);
      return { success: true, message_id: result.id, provider: 'azure' };

    } catch (error) {
      console.error('❌ Azure email send error:', error.message);
      return { success: false, error: error.message, provider: 'azure' };
    }
  }

  /**
   * Send email
   * Supports both Azure Communication Services and SMTP
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML body
   * @param {string} options.text - Plain text body (optional)
   * @param {Array} options.attachments - Email attachments (optional)
   */
  static _ensureRcmE2eEmailOutbox() {
    if (process.env.RCM_E2E_RECORD_EMAIL !== '1') return;
    try {
      const db = require('../database');
      if (!db.db) return;
      db.db.exec(`
        CREATE TABLE IF NOT EXISTS rcm_e2e_email_outbox (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recipient TEXT NOT NULL,
          subject TEXT,
          template TEXT,
          provider TEXT,
          success INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
    } catch (e) {
      console.warn('[RCM_E2E_RECORD_EMAIL] outbox table:', e.message);
    }
  }

  static _recordRcmE2eEmail({ to, subject, template, provider, success }) {
    if (process.env.RCM_E2E_RECORD_EMAIL !== '1') return;
    try {
      this._ensureRcmE2eEmailOutbox();
      const db = require('../database');
      db.db
        .prepare(
          `INSERT INTO rcm_e2e_email_outbox (recipient, subject, template, provider, success)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          String(to || '').toLowerCase(),
          String(subject || ''),
          String(template || 'generic'),
          String(provider || ''),
          success ? 1 : 0
        );
    } catch (e) {
      console.warn('[RCM_E2E_RECORD_EMAIL] insert failed:', e.message);
    }
  }

  /** GCP production uses SMTP (Gmail / SendGrid). Azure is legacy — skip unless EMAIL_PROVIDER=azure. */
  static _preferSmtp() {
    const p = String(process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();
    return p === 'smtp' || p === 'gmail' || p === 'sendgrid';
  }

  static async sendEmail({ to, subject, html, text, attachments }) {
    try {
      // Legacy Azure path — opt-in only (EMAIL_PROVIDER=azure)
      if (!this._preferSmtp() && this.isAzureConfigured()) {
        const azureResult = await this._sendViaAzure({ to, subject, html, text, attachments });
        if (azureResult && azureResult.success) {
          this._recordRcmE2eEmail({
            to,
            subject,
            template: 'generic',
            provider: 'azure',
            success: true
          });
          return azureResult;
        }
        // If Azure fails, fall back to SMTP
        console.warn('⚠️  Azure email failed, falling back to SMTP');
      }

      // Try SMTP
      const transporter = this.getTransporter();
      const from = formatSmtpFrom(
        process.env.SMTP_FROM || process.env.SMTP_USER || process.env.AZURE_EMAIL_SENDER
      );

      if (transporter) {
        const mailOptions = {
          from: from,
          to: to,
          subject: subject,
          html: html,
          text: text || html.replace(/<[^>]*>/g, '')
        };

        // Add attachments if provided
        if (attachments && attachments.length > 0) {
          mailOptions.attachments = attachments;
        }

        const info = await transporter.sendMail(mailOptions);

        console.log('📧 Email sent via SMTP:', info.messageId);
        if (attachments && attachments.length > 0) {
          console.log(`   Attachments: ${attachments.length} file(s)`);
        }
        this._recordRcmE2eEmail({
          to,
          subject,
          template: 'generic',
          provider: 'smtp',
          success: true
        });
        return { success: true, message_id: info.messageId, provider: 'smtp' };
      }

      // If no email service configured, log to console
      console.log('\n📧 EMAIL (SIMULATED):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`From: ${from}`);
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${text || html}`);
      if (attachments && attachments.length > 0) {
        console.log(`Attachments: ${attachments.length} file(s)`);
        attachments.forEach(att => {
          console.log(`  - ${att.filename || 'attachment'} (${att.content ? att.content.length : 0} bytes)`);
        });
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      this._recordRcmE2eEmail({
        to,
        subject,
        template: 'generic',
        provider: 'console',
        success: false
      });
      if (process.env.RCM_E2E_RECORD_EMAIL === '1' || this._isProductionEnv()) {
        return {
          success: false,
          error: this._isProductionEnv()
            ? 'email_delivery_not_configured'
            : 'SMTP not configured — set SMTP_USER/SMTP_PASS for real email (RCM_E2E_RECORD_EMAIL=1)',
          provider: 'console'
        };
      }
      return { success: true, message_id: 'simulated', provider: 'console' };

    } catch (error) {
      console.error('❌ Email send error:', error.message);
      this._recordRcmE2eEmail({
        to,
        subject,
        template: 'generic',
        provider: 'error',
        success: false
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send appointment confirmation email
   * @param {Object} appointment - appointment record
   * @param {Object} [options] - { uploadLink } (Phase 5: upload portal link)
   */
  static async sendAppointmentConfirmation(appointment, options = {}) {
    const { uploadLink } = options;
    // Format confirmation number (matches booking service format)
    const confirmationNumber = appointment.id && appointment.id.length > 13
      ? appointment.id.substring(5, 13).toUpperCase()
      : (appointment.id || 'N/A');

    const dateTime = new Date(appointment.start_time).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: appointment.timezone || 'America/New_York'
    });

    const uploadBlock = uploadLink
      ? `<p>You can upload documents (labs, images) before your visit using this link: <a href="${uploadLink}">Upload documents</a>.</p>`
      : '';

    const calBtn = appointment.calendar_link
      ? `<p style="text-align:center;margin-top:16px;">${SkinCareEmail.button(appointment.calendar_link, 'Add to calendar')}</p>`
      : '';
    const html = this._skinCareLayout('Appointment confirmed', dateTime, `
      <h2>Hi ${SkinCareEmail.escapeHtml(appointment.patient_name)},</h2>
      <p>Your appointment is scheduled.</p>
      ${SkinCareEmail.infoRows([
        { label: 'Date & time', value: dateTime },
        { label: 'Type', value: appointment.appointment_type || 'Consultation' },
        { label: 'Duration', value: `${appointment.duration_minutes || 50} minutes` },
        { label: 'Provider', value: appointment.provider || 'Skin & Care team' },
        { label: 'Confirmation', value: confirmationNumber }
      ])}
      ${uploadBlock}
      ${calBtn}
      <p>You will receive a reminder about one hour before your visit.</p>
      <p>Best regards,<br>The Skin & Care team</p>
    `, { preheader: `Confirmed: ${dateTime}` });

    return await this.sendEmail({
      to: appointment.patient_email,
      subject: `Appointment Confirmed - ${dateTime}`,
      html: html
    });
  }

  /**
   * Send appointment reminder email (1 hour before)
   * @param {Object} [options] - { joinLink } (Phase 5: video/join link for "Join here")
   */
  static async sendAppointmentReminder(appointment, options = {}) {
    const { joinLink } = options;
    const dateTime = new Date(appointment.start_time).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: appointment.timezone || 'America/New_York'
    });

    const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
    const cancelLink = `${baseUrl}/api/appointments/${appointment.id}/cancel?token=${this._generateCancelToken(appointment.id)}`;
    const rescheduleLink = `${baseUrl}/api/appointments/${appointment.id}/reschedule?token=${this._generateCancelToken(appointment.id)}`;
    const joinBlock = joinLink
      ? `<p><strong>Join here:</strong> <a href="${joinLink}">${joinLink}</a></p>`
      : '';

    const html = this._skinCareLayout('Appointment in 1 hour', dateTime, `
      <h2>Hi ${SkinCareEmail.escapeHtml(appointment.patient_name)},</h2>
      <p><strong>Your appointment starts in about one hour.</strong></p>
      ${joinBlock}
      ${SkinCareEmail.infoRows([
        { label: 'Date & time', value: dateTime },
        { label: 'Type', value: appointment.appointment_type || 'Consultation' },
        { label: 'Provider', value: appointment.provider || 'Skin & Care team' }
      ])}
      <p style="text-align:center;">
        ${SkinCareEmail.button(rescheduleLink, 'Reschedule', 'warning')}
        ${SkinCareEmail.button(cancelLink, 'Cancel', 'danger')}
      </p>
      <p>Best regards,<br>The Skin & Care team</p>
    `, { preheader: `Reminder: ${dateTime}` });

    return await this.sendEmail({
      to: appointment.patient_email,
      subject: `Appointment Reminder - ${dateTime}`,
      html: html
    });
  }

  /**
   * Send appointment reminder email (24 hours before) - Task 52 / Phase 5 Task 36
   * @param {Object} [options] - { uploadLink } (Phase 5: upload documents link)
   */
  static async sendAppointmentReminder24h(appointment, options = {}) {
    const { uploadLink } = options;
    const dateTime = new Date(appointment.start_time).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: appointment.timezone || 'America/New_York'
    });

    const uploadBlock = uploadLink
      ? `<p>Upload documents before your visit: <a href="${uploadLink}">${uploadLink}</a></p>`
      : '';

    const html = this._skinCareLayout('Appointment tomorrow', dateTime, `
      <h2>Hi ${SkinCareEmail.escapeHtml(appointment.patient_name)},</h2>
      <p><strong>Your appointment is tomorrow.</strong></p>
      ${uploadBlock}
      ${SkinCareEmail.infoRows([
        { label: 'When', value: dateTime },
        { label: 'Type', value: appointment.appointment_type || 'Consultation' },
        { label: 'Provider', value: appointment.provider || 'Skin & Care team' }
      ])}
      <p>We will send another reminder about one hour before your visit.</p>
      <p>Best regards,<br>The Skin & Care team</p>
    `);

    return await this.sendEmail({
      to: appointment.patient_email,
      subject: `Appointment Tomorrow - ${dateTime}`,
      html: html
    });
  }

  /**
   * Send checkout verification code to email
   */
  static async sendCheckoutVerificationCode(email, code) {
    const html = this._skinCareLayout(EMAIL_SUBJECT_VERIFICATION, 'Checkout', `
      <p>Enter this code to continue checkout:</p>
      ${SkinCareEmail.codeBox(code)}
      <p><strong>Expires in 15 minutes.</strong></p>
    `, { preheader: 'Enter this code to continue checkout.' });
    return await this.sendEmail({
      to: email,
      subject: EMAIL_SUBJECT_VERIFICATION,
      html
    });
  }

  /**
   * Send patient portal verification code
   */
  static async sendPatientVerificationCode(email, code) {
    const html = this._skinCareLayout(EMAIL_SUBJECT_VERIFICATION, '', `
      <p>Use this code to sign in and save your skin journey:</p>
      ${SkinCareEmail.codeBox(code)}
      <p><strong>Expires in 10 minutes.</strong></p>
      <p>If you did not request this code, you can ignore this email.</p>
    `, { preheader: 'Your one-time sign-in code is inside this email.' });

    const result = await this.sendEmail({
      to: email,
      subject: EMAIL_SUBJECT_VERIFICATION,
      html
    });
    if (!result?.success && process.env.NODE_ENV === 'production') {
      console.error('❌ Patient verification email not delivered:', result?.error || result?.provider);
    }
    return result;
  }

  /**
   * Send payment link email after verification (Task 37: include appointment details)
   */
  static async sendPaymentLinkEmail(email, paymentLink, order) {
    const aptLine =
      order?.appointment_date || order?.appointment_type || order?.appointment_time
        ? `${order.appointment_type || 'Visit'}${order.appointment_date ? ` — ${order.appointment_date}${order.appointment_time ? ` at ${order.appointment_time}` : ''}` : ''}`
        : '';
    const baseUrl = process.env.BASE_URL || process.env.API_BASE_URL || 'https://api.callsomo.com';
    const appointmentsUrl = baseUrl.replace(/\/$/, '') + '/patients/appointments.html';

    const html = this._skinCareLayout('Complete your payment', 'Secure checkout', `
      <p>Your email is verified. Use the button below to pay securely.</p>
      ${SkinCareEmail.infoRows([
        { label: 'Product', value: order?.product_name || 'Service' },
        ...(aptLine ? [{ label: 'Appointment', value: aptLine }] : []),
        { label: 'Amount', value: `$${(order?.amount || 0).toFixed(2)}` }
      ])}
      <p style="text-align:center;">${SkinCareEmail.button(paymentLink, 'Pay now')}</p>
      <p style="word-break:break-all;font-size:14px;">${SkinCareEmail.escapeHtml(paymentLink)}</p>
      <p>After payment, view your appointment at <a href="${appointmentsUrl}">My appointments</a>.</p>
    `, { preheader: 'Complete payment for your Skin & Care visit' });

    const result = await this.sendEmail({
      to: email,
      subject: 'Complete Your Payment',
      html: html
    });
    this._recordRcmE2eEmail({
      to: email,
      subject: 'Complete Your Payment',
      template: 'payment_link',
      provider: result?.provider || '',
      success: !!result?.success
    });
    return result;
  }

  /**
   * Send post-payment receipt email (Task 12, 38: include appointment details)
   * @param {Object} checkout - Voice checkout record
   * @param {number} amount - Amount charged
   * @param {string} paymentRef - Payment intent ID or transfer ID
   * @param {Object} appointment - Optional { date, time, appointment_type }
   */
  static async sendPaymentReceipt(checkout, amount, paymentRef, appointment) {
    const esc = SkinCareEmail.escapeHtml;
    const name = esc(checkout.customer_name || 'Patient');
    const product = esc(checkout.product_name || 'Appointment');
    const amountPaid = Number(amount || 0).toFixed(2);
    const orderId = esc(checkout.id || 'N/A');
    const txRef = esc(paymentRef || 'N/A');
    const email = esc(checkout.customer_email || '');
    const baseUrl = String(process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

    let productImageUrl = '';
    try {
      const db = require('../database');
      const productRow = checkout.product_id && db.getProduct
        ? db.getProduct(checkout.product_id)
        : null;
      const rawImage = String(productRow?.image_url || '').trim();
      if (rawImage) {
        productImageUrl = /^https?:\/\//i.test(rawImage)
          ? rawImage
          : `${baseUrl}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;
      }
    } catch (_) {}

    const aptValue = (appointment?.date || appointment?.appointment_type)
      ? `${appointment.appointment_type || checkout.product_name || 'Visit'}${appointment.date ? ` — ${appointment.date}${appointment.time ? ` at ${appointment.time}` : ''}` : ''}`
      : null;

    const rows = [
      { label: 'Product', value: checkout.product_name || 'Appointment' },
      { label: 'Quantity', value: String(Number(checkout.quantity || 1)) },
      ...(aptValue ? [{ label: 'Appointment', value: aptValue }] : []),
      { label: 'Order ID', value: checkout.id || 'N/A' },
      { label: 'Transaction', value: paymentRef || 'N/A' },
      { label: 'Amount paid', value: `$${amountPaid}` }
    ];

    const productImageBlock = productImageUrl
      ? `<p><img src="${esc(productImageUrl)}" alt="${product}" style="display:block;max-width:220px;height:auto;border-radius:14px;border:1px solid #ece8df;" /></p>`
      : '';

    const html = this._skinCareLayout('Payment receipt', 'Thank you for your order', `
      <h2>Hi ${name},</h2>
      <p>Thanks for your order. Your payment was successful and your receipt is below.</p>
      ${productImageBlock}
      ${SkinCareEmail.infoRows(rows)}
      <p>Receipt sent to: <strong>${email || 'your email'}</strong></p>
      <p>Please keep this email for your records.</p>
    `, { preheader: `Paid $${amountPaid}` });

    return await this.sendEmail({
      to: checkout.customer_email,
      subject: `Payment Receipt - $${amountPaid}`,
      html
    });
  }

  /**
   * Task 45: Send escrow timeout notification to provider
   */
  static async sendEscrowTimeoutNotification(providerEmail, attempt) {
    const claimId = attempt.claim_id || 'N/A';
    const amount = attempt.provider_amount ?? attempt.total_approved ?? 0;
    const html = this._skinCareLayout('Escrow timeout', 'Action required', `
      <p>An escrow settlement has exceeded the timeout threshold and requires attention.</p>
      ${SkinCareEmail.infoRows([
        { label: 'Claim ID', value: claimId },
        { label: 'Provider amount', value: `$${Number(amount).toFixed(2)}` }
      ])}
      <p>Please review and retry settlement via the admin recovery endpoint if needed.</p>
      <p>Best regards,<br>The Skin & Care finance team</p>
    `, { preheader: 'Escrow settlement timeout' });
    return await this.sendEmail({ to: providerEmail, subject: 'Escrow Timeout – Action Required', html });
  }

  /**
   * Send insurance billing email
   */
  static async sendInsuranceBillingEmail(insurerEmail, claimData) {
    const html = this._skinCareLayout('Insurance claim submitted', 'For your review', `
      <p>Dear Insurance Provider,</p>
      <p>A new insurance claim has been submitted for processing:</p>
      ${SkinCareEmail.infoRows([
        { label: 'Claim ID', value: claimData.claimId || 'N/A' },
        { label: 'X12 Claim ID', value: claimData.x12ClaimId || 'N/A' },
        { label: 'Member ID', value: claimData.memberId || 'N/A' },
        { label: 'Patient name', value: claimData.patientName || 'N/A' },
        { label: 'Service code', value: claimData.serviceCode || 'N/A' },
        { label: 'Total amount', value: `$${(claimData.totalAmount || 0).toFixed(2)}` },
        { label: 'Copay paid', value: `$${(claimData.copayPaid || 0).toFixed(2)}` },
        {
          label: 'Insurance amount',
          value: `$${((claimData.totalAmount || 0) - (claimData.copayPaid || 0)).toFixed(2)}`
        },
        { label: 'Date of service', value: claimData.dateOfService || 'N/A' }
      ])}
      <p>Please process this claim according to your standard procedures.</p>
      <p>Best regards,<br>The Skin & Care team</p>
    `);

    return await this.sendEmail({
      to: insurerEmail,
      subject: `Insurance Claim Submitted - ${claimData.claimId || 'New Claim'}`,
      html
    });
  }

  /**
   * Send patient billing email
   */
  static async sendPatientBillingEmail(patientEmail, billingData) {
    const payBtn = billingData.paymentLink
      ? `<p style="text-align:center;">${SkinCareEmail.button(billingData.paymentLink, 'Pay now')}</p>`
      : '';
    const html = this._skinCareLayout(
      'Billing statement',
      `$${(billingData.amountDue || 0).toFixed(2)} due`,
      `
      <h2>Hi ${SkinCareEmail.escapeHtml(billingData.patientName || 'there')},</h2>
      <p>You have a balance due for your recent appointment.</p>
      ${SkinCareEmail.infoRows([
        { label: 'Appointment date', value: billingData.appointmentDate || 'N/A' },
        { label: 'Service', value: billingData.serviceName || 'N/A' },
        { label: 'Total amount', value: `$${(billingData.totalAmount || 0).toFixed(2)}` },
        { label: 'Insurance coverage', value: `$${(billingData.insuranceAmount || 0).toFixed(2)}` },
        { label: 'Copay', value: `$${(billingData.copayAmount || 0).toFixed(2)}` },
        { label: 'Amount due', value: `$${(billingData.amountDue || 0).toFixed(2)}` }
      ])}
      ${payBtn}
      <p>If you have questions about this bill, please contact us.</p>
      <p>Best regards,<br>The Skin & Care team</p>
    `
    );

    return await this.sendEmail({
      to: patientEmail,
      subject: `Billing Statement - $${(billingData.amountDue || 0).toFixed(2)} Due`,
      html
    });
  }

  /**
   * Generate cancel/reschedule token
   */
  static _generateCancelToken(appointmentId) {
    const crypto = require('crypto');
    const secret = process.env.APPOINTMENT_SECRET || 'default-secret-change-in-production';
    return crypto.createHmac('sha256', secret).update(appointmentId).digest('hex');
  }

  /**
   * Verify cancel/reschedule token
   */
  static verifyCancelToken(appointmentId, token) {
    const crypto = require('crypto');
    const expectedToken = this._generateCancelToken(appointmentId);
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
  }

  /**
   * Send email verification code
   */
  static async sendVerificationCode(email, code, name) {
    const html = this._skinCareLayout(EMAIL_SUBJECT_VERIFICATION, 'Skin & Care API', `
      <h2>Hi ${SkinCareEmail.escapeHtml(name) || 'there'},</h2>
      <p>Thanks for signing up. Use this code to verify your email:</p>
      ${SkinCareEmail.codeBox(code)}
      <p><strong>Expires in 15 minutes.</strong></p>
      <p>If you did not request this, you can ignore this email.</p>
    `, { preheader: 'Confirm your email to continue.' });

    return await this.sendEmail({
      to: email,
      subject: EMAIL_SUBJECT_VERIFICATION,
      html
    });
  }

  /**
   * Send promotional email to customers
   * @param {string} email - Recipient email
   * @param {string} customerName - Customer name
   * @param {object} promotion - Promotion details
   * @param {string} promotion.name - Promotion name
   * @param {string} promotion.discount_type - "percentage" or "fixed_amount"
   * @param {number} promotion.discount_value - Discount value
   * @param {string} promotion.code - Promotion code (optional)
   * @param {string} promotion.description - Promotion description
   * @param {string} promotion.end_date - End date (optional)
   * @param {string} merchantName - Merchant/business name
   */
  static async sendPromotionalEmail(email, customerName, promotion, merchantName = 'Skin & Care') {
    const discountText = promotion.discount_type === 'percentage'
      ? `${promotion.discount_value}% OFF`
      : `$${promotion.discount_value} OFF`;

    const endDateText = promotion.end_date
      ? new Date(promotion.end_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      : null;

    const shopUrl = `${(process.env.BASE_URL || 'https://api.callsomo.com').replace(/\/$/, '')}/storefront`;
    const html = this._skinCareLayout('Special offer', SkinCareEmail.escapeHtml(merchantName), `
      <h2>Hi ${SkinCareEmail.escapeHtml(customerName) || 'there'},</h2>
      <p style="text-align:center;">
        <span style="display:inline-block;background:${SkinCareEmail.TOKENS.brandBlue};color:#fff;font-size:32px;font-weight:700;padding:16px 28px;border-radius:12px;">${SkinCareEmail.escapeHtml(discountText)}</span>
      </p>
      <h2 style="text-align:center;color:${SkinCareEmail.TOKENS.text};">${SkinCareEmail.escapeHtml(promotion.name || 'Special offer')}</h2>
      ${promotion.description ? `<p>${SkinCareEmail.escapeHtml(promotion.description)}</p>` : ''}
      ${promotion.code ? SkinCareEmail.codeBox(promotion.code) : ''}
      ${endDateText ? SkinCareEmail.infoRows([{ label: 'Valid until', value: endDateText }]) : ''}
      <p style="text-align:center;">${SkinCareEmail.button(shopUrl, 'Shop now')}</p>
      <p>Best regards,<br>${SkinCareEmail.escapeHtml(merchantName)}</p>
    `, { preheader: `${discountText} from ${merchantName}` });

    return await this.sendEmail({
      to: email,
      subject: `${discountText} — ${promotion.name || 'Special offer'} (${merchantName})`,
      html
    });
  }

  /**
   * Send monthly invoice email to customer
   */
  static async sendInvoiceEmail(email, name, invoice) {
    const dueDate = new Date(invoice.due_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const billingMonth = new Date(invoice.billing_month + '-01').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });

    const rows = [
      { label: 'Billing period', value: billingMonth },
      { label: 'Invoice number', value: invoice.invoice_number },
      { label: 'Due date', value: dueDate }
    ];
    if (invoice.voice_minutes > 0) {
      rows.push(
        { label: 'Voice minutes', value: `${invoice.voice_minutes.toLocaleString()} min` },
        { label: 'Voice cost', value: `$${invoice.voice_minutes_cost.toFixed(2)}` }
      );
    }
    if (invoice.api_requests > 0) {
      rows.push(
        { label: 'API requests', value: invoice.api_requests.toLocaleString() },
        { label: 'API cost', value: `$${invoice.api_requests_cost.toFixed(2)}` }
      );
    }
    rows.push({
      label: 'Total due',
      valueHtml: `<strong style="font-size:20px;color:${SkinCareEmail.TOKENS.brandBlue}">$${invoice.total.toFixed(2)}</strong>`
    });

    const html = this._skinCareLayout(
      'Monthly invoice',
      `Invoice #${invoice.invoice_number}`,
      `
      <h2>Hi ${SkinCareEmail.escapeHtml(name) || 'there'},</h2>
      <p>Your invoice for <strong>${SkinCareEmail.escapeHtml(billingMonth)}</strong> is ready.</p>
      ${SkinCareEmail.infoRows(rows)}
      <p>Payment is due within 15 days. Your stored payment method will be charged on the due date.</p>
      <p style="text-align:center;">${SkinCareEmail.button('https://api.callsomo.com/docs', 'View dashboard')}</p>
      <p>Questions? Contact <a href="mailto:${SkinCareEmail.SUPPORT_EMAIL}">${SkinCareEmail.SUPPORT_EMAIL}</a>.</p>
    `
    );

    return await this.sendEmail({
      to: email,
      subject: `Skin & Care invoice — $${invoice.total.toFixed(2)} due (${invoice.invoice_number})`,
      html
    });
  }

  /**
   * Send welcome email with subdomain and password
   */
  static async sendWelcomeEmail(customerEmail, customerName, subdomain, customerType, merchantId, password = null) {
    const baseDomain = process.env.BASE_DOMAIN || 'callsomo.com';
    const baseUrl = process.env.BASE_URL || (process.env.NODE_ENV === 'production'
      ? `https://${baseDomain}`
      : 'http://localhost:4000');

    // Determine login URL based on subdomain
    const loginUrl = subdomain
      ? `https://${subdomain}.${baseDomain}/login`
      : `${baseUrl}/login`;

    const accountType = customerType === 'saas' ? 'SaaS Platform' : 'API Integration';
    const dashboardType = customerType === 'saas' ? 'business dashboard' : 'API documentation';

    const infoRows = [
      { label: 'Account type', value: accountType },
      { label: 'Email', value: customerEmail }
    ];
    if (subdomain) {
      infoRows.push({ label: 'Dashboard URL', value: `${subdomain}.${baseDomain}` });
    }
    if (password) {
      infoRows.push({
        label: 'Temporary password',
        valueHtml: `<strong style="color:${SkinCareEmail.TOKENS.brandBlue}">${SkinCareEmail.escapeHtml(password)}</strong>`
      });
    }

    const html = this._skinCareLayout('Welcome to Skin & Care', 'Your account is ready', `
      <h2>Hi ${SkinCareEmail.escapeHtml(customerName) || 'there'},</h2>
      <p>Your Skin & Care account is ready. Sign in to access your ${SkinCareEmail.escapeHtml(dashboardType)}.</p>
      ${SkinCareEmail.infoRows(infoRows)}
      ${password ? SkinCareEmail.panel('<p style="margin:0;color:#92400e;font-weight:600;">Save this password securely. You can change it in account settings.</p>', 'warning') : ''}
      <p style="text-align:center;">${SkinCareEmail.button(loginUrl, 'Log in')}</p>
      ${subdomain ? `<p style="text-align:center;"><a href="https://${SkinCareEmail.escapeHtml(subdomain)}.${SkinCareEmail.escapeHtml(baseDomain)}">https://${SkinCareEmail.escapeHtml(subdomain)}.${SkinCareEmail.escapeHtml(baseDomain)}</a></p>` : ''}
      <p>Best regards,<br>The Skin & Care team</p>
    `);

    return await this.sendEmail({
      to: customerEmail,
      subject: 'Welcome to Skin & Care — your account is ready',
      html
    });
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(email, name, resetUrl) {
    const html = this._skinCareLayout('Reset your password', 'Account security', `
      <h2>Hi ${SkinCareEmail.escapeHtml(name) || 'there'},</h2>
      <p>We received a request to reset your password.</p>
      <p style="text-align:center;">${SkinCareEmail.button(resetUrl, 'Reset password')}</p>
      <p style="word-break:break-all;font-family:monospace;font-size:14px;">${SkinCareEmail.escapeHtml(resetUrl)}</p>
      ${SkinCareEmail.panel('<p style="margin:0;color:#92400e;"><strong>This link expires in 1 hour.</strong> If you did not request a reset, ignore this email.</p>', 'warning')}
      <p>Best regards,<br>The Skin & Care team</p>
    `);

    return await this.sendEmail({
      to: email,
      subject: 'Skin & Care — Reset your password',
      html
    });
  }

  /**
   * Send feature request notification to admin
   */
  static async sendFeatureRequestNotification(customerEmail, customerName, requestedFeatures, companyName) {
    const featureNames = {
      'voice_agent': 'Voice AI Agent',
      'healthcare_commerce': 'Healthcare Commerce',
      'fhir_integration': 'FHIR Integration',
      'payment_processing': 'Payment Processing',
      'appointment_management': 'Appointment Management',
      'ehr_integration': 'EHR Integration'
    };

    const featuresList = requestedFeatures
      .map((f) => `<li>${SkinCareEmail.escapeHtml(featureNames[f] || f)}</li>`)
      .join('');
    const esc = SkinCareEmail.escapeHtml;

    const html = this._skinCareLayout('New feature request', 'Admin notification', `
      <p>A customer has requested access to new API features:</p>
      ${SkinCareEmail.panel(`<ul style="margin:0;padding-left:20px;">${featuresList}</ul>`)}
      ${SkinCareEmail.infoRows([
        { label: 'Customer name', value: customerName },
        { label: 'Email', value: customerEmail },
        { label: 'Company', value: companyName },
        { label: 'Features requested', value: String(requestedFeatures.length) }
      ])}
      <p style="text-align:center;">${SkinCareEmail.button('https://callsomo.com/admin', 'View in admin portal')}</p>
      <p>Please review and approve or reject these feature requests in the admin portal.</p>
    `);

    const adminEmail = process.env.ADMIN_EMAIL || 'richard@callsomo.com';

    return await this.sendEmail({
      to: adminEmail,
      subject: `Notification — New feature request from ${esc(customerName)} (${requestedFeatures.length} feature(s))`,
      html
    });
  }

  /**
   * Notify admin when a waitlist / contact form submission is received.
   */
  static async sendWaitlistAdminNotification({ name, email, source, product }) {
    const adminEmail = process.env.ADMIN_EMAIL || 'richard@callsomo.com';
    const esc = (s) =>
      String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const sourceLabel = esc(source || 'unknown');
    const bodyHtml = `
      <p>A new Skin &amp; Care inquiry was submitted via <strong>${sourceLabel}</strong>.</p>
      <table style="border-collapse:collapse;width:100%;max-width:560px;">
        <tr><td style="padding:8px 0;font-weight:600;">Name</td><td>${esc(name)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;">Email</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
        <tr><td style="padding:8px 0;font-weight:600;vertical-align:top;">Message</td><td style="white-space:pre-wrap;">${esc(product || '(none)')}</td></tr>
      </table>
    `;
    const html = this._skinCareLayout('New inquiry', sourceLabel, bodyHtml);
    return await this.sendEmail({
      to: adminEmail,
      subject: `Notification — Inquiry (${sourceLabel}) from ${name}`,
      html,
      text: `Source: ${source || 'unknown'}\nName: ${name}\nEmail: ${email}\n\n${product || ''}`,
    });
  }

  /**
   * Send low credit alert email
   */
  static async sendLowCreditAlert(customerEmail, customerName, creditBalance, subdomain = null) {
    const baseDomain = process.env.BASE_DOMAIN || 'callsomo.com';
    const dashboardUrl = subdomain
      ? `https://${subdomain}.${baseDomain}/billing`
      : `${process.env.BASE_URL || 'https://api.callsomo.com'}/billing`;

    const isCritical = creditBalance < 25;
    const alertLevel = isCritical ? 'Critical' : 'Low';
    const variant = isCritical ? 'warning' : undefined;

    const html = this._skinCareLayout(
      `${alertLevel} credit alert`,
      `${creditBalance} minutes remaining`,
      `
      <h2>Hi ${SkinCareEmail.escapeHtml(customerName)},</h2>
      ${SkinCareEmail.panel(
        `<p style="margin:0;font-weight:600;">${
          isCritical
            ? 'Your credits are running critically low.'
            : 'Your credits are running low.'
        }</p>`,
        variant
      )}
      <p style="text-align:center;font-size:32px;font-weight:700;margin:20px 0;">${creditBalance} min</p>
      <p style="text-align:center;">
        ${
          isCritical
            ? 'You have less than 25 minutes remaining. Add credits now to avoid service interruption.'
            : 'You have less than 50 minutes remaining. Consider adding credits to continue uninterrupted service.'
        }
      </p>
      <p style="text-align:center;">${SkinCareEmail.button(dashboardUrl, 'Buy more credits')}</p>
      <p><strong>What happens when credits run out?</strong> If your credits reach zero and you do not have a payment method on file, your AI assistant will pause until you add credits.</p>
      <p><strong>Need help?</strong> Contact <a href="mailto:support@callsomo.com">support@callsomo.com</a> or visit your dashboard.</p>
    `,
      { preheader: `${creditBalance} minutes remaining` }
    );

    return await this.sendEmail({
      to: customerEmail,
      subject: `Notification — ${alertLevel} credit alert (${creditBalance} minutes remaining)`,
      html
    });
  }

  // ============================================
  // Patient portal notifications (mvp-47, mvp-48)
  // ============================================
  static async sendAppointmentRescheduled(appointment, details = {}) {
    if (!appointment || !appointment.patient_email) return { success: false, error: 'Missing patient email' };
    const prev = details.previous_datetime || details.previous || '—';
    const next = details.new_datetime || details.next || '—';
    const subject = 'Skin & Care — Appointment rescheduled';
    const html = this._skinCareLayout('Appointment rescheduled', '', `
      <h2>Hi ${SkinCareEmail.escapeHtml(appointment.patient_name || 'there')},</h2>
      <p>Your appointment was rescheduled.</p>
      ${SkinCareEmail.infoRows([
        { label: 'Previous', value: prev },
        { label: 'New', value: next }
      ])}
      <p>You can review or manage your visit in your portal.</p>
    `);
    return this.sendEmail({ to: appointment.patient_email, subject, html });
  }

  static async sendAppointmentCanceled(appointment) {
    if (!appointment || !appointment.patient_email) return { success: false, error: 'Missing patient email' };
    const subject = 'Skin & Care — Appointment canceled';
    const dt = appointment.start_time
      ? new Date(appointment.start_time).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: appointment.timezone || 'America/New_York'
      })
      : `${appointment.date || ''} ${appointment.time || ''}`;
    const html = this._skinCareLayout('Appointment canceled', '', `
      <h2>Hi ${SkinCareEmail.escapeHtml(appointment.patient_name || 'there')},</h2>
      <p>Your appointment was canceled.</p>
      ${SkinCareEmail.infoRows([{ label: 'Canceled visit', value: dt }])}
      <p>If this was a mistake, please schedule a new visit or contact your clinic.</p>
    `);
    return this.sendEmail({ to: appointment.patient_email, subject, html });
  }

  static async sendPostVisitSummaryReady(appointment) {
    if (!appointment || !appointment.patient_email) return { success: false, error: 'Missing patient email' };
    const baseUrl = (process.env.DASHBOARD_BASE_URL || process.env.BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
    const feedbackExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const { createFeedbackToken } = require('../utils/upload-token');
    const feedbackToken = createFeedbackToken(appointment.id, feedbackExpiry);
    const feedbackUrl = `${baseUrl}/patients/feedback.html?appointment_id=${encodeURIComponent(appointment.id)}&token=${encodeURIComponent(feedbackToken)}`;
    const subject = 'Skin & Care — Your visit summary is ready';
    const html = this._skinCareLayout('Visit summary ready', '', `
      <h2>Hi ${SkinCareEmail.escapeHtml(appointment.patient_name || 'there')},</h2>
      <p>Your visit summary is ready. You can view your records and documents in the patient portal.</p>
      <p><strong>Was this visit helpful?</strong></p>
      <p>
        ${SkinCareEmail.button(`${feedbackUrl}&helpful=1`, 'Yes')}
        ${SkinCareEmail.button(`${feedbackUrl}&helpful=0`, 'No', 'secondary')}
      </p>
      <p>Or leave detailed feedback: <a href="${SkinCareEmail.escapeHtml(feedbackUrl)}">${SkinCareEmail.escapeHtml(feedbackUrl)}</a></p>
    `);
    return this.sendEmail({ to: appointment.patient_email, subject, html });
  }
}

module.exports = EmailService;
module.exports.formatSmtpFrom = formatSmtpFrom;
module.exports.smtpFromAddress = smtpFromAddress;
module.exports.EMAIL_SUBJECT_VERIFICATION = EMAIL_SUBJECT_VERIFICATION;

