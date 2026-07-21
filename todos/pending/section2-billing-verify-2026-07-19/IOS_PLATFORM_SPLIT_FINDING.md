# Finding — iOS platform split was NOT implemented in Section 2

**Honest status before this pass:** Steps 7–11 were verified against the **pre-correction** flow.

| Path | Before this fix | After |
|------|-----------------|-------|
| `/billing/care-checkout` | `WebBrowser.openAuthSessionAsync` (in-app SFSafari / AuthSession) | `Linking.openURL` via `openBillingCheckoutUrl` |
| `/capture/unlock-ai` (iOS) | Full hide (G-IAP paused UI, no pricing) | Pricing + **Continue in browser** CTA |
| Profile Care Subscribe | `openAuthSessionAsync` | `openBillingCheckoutUrl` |
| Stripe Elements / WebView | **Not present** in repo for these steps | Still absent |

No `react-native-webview` or `@stripe/stripe-react-native` was reachable from Steps 7/8/10 — the in-app risk was **AuthSession**, not Elements.
