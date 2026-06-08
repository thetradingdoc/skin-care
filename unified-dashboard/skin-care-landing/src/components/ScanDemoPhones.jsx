export default function ScanDemoPhones() {
  return (
    <div className="sc-phone-row" aria-hidden="true">
      <div className="sc-phone-col">
        <div className="sc-phone">
          <div className="sc-phone-screen sc-screen-scan">
            <div className="sc-scan-cam">
              <div className="sc-face-oval" />
              <div className="sc-scan-line" />
            </div>
            <div className="sc-scan-bottom">
              <div className="sc-scan-label">Position your face in the oval</div>
              <div className="sc-scan-btn">Scan my skin age</div>
            </div>
          </div>
        </div>
        <div className="sc-phone-label">1. Scan</div>
      </div>

      <div className="sc-phone-col sc-phone-col-center">
        <div className="sc-phone">
          <div className="sc-phone-screen sc-screen-reveal">
            <div className="sc-reveal-top">
              <div className="sc-reveal-label">Skin age estimate</div>
              <div className="sc-big-num">29</div>
              <div className="sc-reveal-sub">Based on your photo today</div>
            </div>
            <div className="sc-reveal-compare">
              <div className="sc-compare-text">
                Looks <strong>4 years younger</strong> than your real age
              </div>
            </div>
            <div className="sc-reveal-btn">Continue</div>
          </div>
        </div>
        <div className="sc-phone-label">2. Your number</div>
      </div>

      <div className="sc-phone-col">
        <div className="sc-phone">
          <div className="sc-phone-screen sc-screen-today">
            <div className="sc-today-head">
              <div className="sc-today-title">Today</div>
              <div className="sc-streak-badge">Day 12</div>
            </div>
            <div className="sc-today-img">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9 3H7.17A3 3 0 004 6.17V19a2 2 0 002 2h12a2 2 0 002-2V8.83A3 3 0 0016.83 6H15V4a2 2 0 00-2-2H9z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
            <div className="sc-score-row">
              <div className="sc-score-card">
                <div className="sc-score-num">29</div>
                <div className="sc-score-label">Skin age</div>
              </div>
              <div className="sc-score-card">
                <div className="sc-score-num">94%</div>
                <div className="sc-score-label">Consistency</div>
              </div>
            </div>
            <div className="sc-log-btn">Log today&apos;s photo</div>
          </div>
        </div>
        <div className="sc-phone-label">3. Track daily</div>
      </div>
    </div>
  );
}
