import SiteHeader from './SiteHeader';
import FunnelProgress from './FunnelProgress';

export default function FunnelShell({ children, step, stepTotal = 5 }) {
  return (
    <div className="sc-funnel-shell">
      <SiteHeader minimal />
      {step != null ? <FunnelProgress step={step} total={stepTotal} /> : null}
      {children}
    </div>
  );
}
