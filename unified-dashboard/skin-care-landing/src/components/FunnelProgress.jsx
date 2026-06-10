export default function FunnelProgress({ step, total = 5 }) {
  return (
    <p className="sc-funnel-progress" aria-live="polite">
      Step {step} of {total}
    </p>
  );
}
