# Toss review release — 2026-09-21

Based on deployed revision kindy-00008-krx, source commit 9a04580. Retrieved original Cloud Build source (850b65bf-8906-4ee9-ae75-80a954fdc26e) and compared tracked source bytes. This release preserves the deployed site rather than including ongoing story/account work.

- Unify the public order price and server price at KRW 24,900 pending owner confirmation of the separate 19,900 proposal.
- Show the legal merchant name 주식회사 젠타. Missing mail-order registration remains explicitly unverified, never fabricated.
- First payment 14-day full refund; unused remaining period refundable pro rata thereafter. Clarify cancellation vs refund and actual support contacts.
- `/review/payment` opens the Toss documentation sandbox billing window. It has no production account, payment, billing-key or entitlement writes. Callback strips auth query parameters and never claims completed payment.
- Both production first charge and renewal require explicit enabled flag, live keys, encryption secret, service-role configuration and complete business information. Existing cloud environment does not satisfy these requirements.
- Billing month end uses KST calendar clamping. Live billing is still not launch-ready: actual merchant credentials, consent version/amount verification, renewal/cancellation concurrency, merchant integration tests and operational refund processing require validation before enabling.

Local webpack production build and targeted lint passed. Readiness tests reject empty/test credentials. Actual browser evidence and cloud immutable build/revision IDs are recorded separately after deployment.

Sources: https://docs.tosspayments.com/guides/v2/billing/integration and emailed Toss billing payment-flow guide. Demo evidence is not a final merchant card-review submission.
