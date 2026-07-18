'use strict';

/**
 * Medical-tracker reminder scheduler — reuses ReminderScheduler lock pattern / interval.
 * Starts alongside telemedicine ReminderScheduler from server.js.
 */

const dbModule = require('../database');
const { runMedicalTrackerReminderTick } = require('./medical-tracker-domain/reminder-jobs');

class MedicalTrackerReminderScheduler {
  static intervalId = null;
  static isRunning = false;
  static lockId = null;
  static lockName = 'medical_tracker_reminder_scheduler';

  static start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lockId = `mt-${process.pid}-${Date.now()}`;
    const ttlSeconds = parseInt(process.env.MEDICAL_TRACKER_REMINDER_LOCK_TTL_SECONDS || '90', 10);
    try {
      const acquired = dbModule.tryAcquireSchedulerLock?.(this.lockName, this.lockId, ttlSeconds);
      if (acquired === false) {
        console.log('ℹ️  Medical-tracker reminder scheduler: not leader');
        this.isRunning = false;
        return;
      }
    } catch (_) {
      // lock helpers may be absent in light test envs — still run single-instance
    }

    const tick = () => {
      try {
        const sqlite = dbModule.db || dbModule;
        void runMedicalTrackerReminderTick(sqlite, { flush: true }).catch((e) => {
          console.warn('[medical-tracker-reminders]', e.message);
        });
      } catch (e) {
        console.warn('[medical-tracker-reminders]', e.message);
      }
    };
    tick();
    this.intervalId = setInterval(tick, 5 * 60 * 1000);
    console.log('✅ Medical-tracker reminder scheduler started (5 min)');
  }

  static stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
  }
}

module.exports = { MedicalTrackerReminderScheduler };
