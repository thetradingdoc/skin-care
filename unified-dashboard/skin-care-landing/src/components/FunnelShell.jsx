import SiteHeader from './SiteHeader';

export default function FunnelShell({ children }) {
  return (
    <div className="sc-funnel-shell">
      <SiteHeader minimal />
      {children}
    </div>
  );
}
