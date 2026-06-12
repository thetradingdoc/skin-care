import SiteHeader from './SiteHeader';
import FunnelProgress from './FunnelProgress';

export default function FunnelShell({ children, step, stepTotal = 5, hideBrand = true }) {
  return (
    <div className="sc-funnel-shell">
      <SiteHeader minimal hideBrand={hideBrand} />
      {step != null ? <FunnelProgress step={step} total={stepTotal} /> : null}
      {children}
    </div>
  );
}
