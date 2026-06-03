// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/__fixtures__/screenshot-scams.ts
// Test fixtures for multimodal ScamCheck (task 11). Each fixture is the OCR
// text a screenshot would yield, plus the signals/entities/category the
// deterministic pipeline must detect. Used by scripts/test-screenshot-fixtures.mjs
// and as canned inputs for /api/scam-intel/screenshot (imageBase64 of these).
// ─────────────────────────────────────────────────────────────────

export interface ScreenshotFixture {
  name: string
  ocrText: string
  expect: {
    mustSignals: string[]      // visualSignal ids that must fire
    mustEntities: Array<keyof import('../extract-entities').ExtractedEntities>
    minRisk: number            // expected minimum risk band
  }
}

export const SCREENSHOT_FIXTURES: ScreenshotFixture[] = [
  {
    name: 'fake SBI SMS',
    ocrText:
      'Dear Customer, your SBI account will be BLOCKED today due to incomplete KYC. ' +
      'Update immediately at http://sbi-kyc-verify.xyz or your account is suspended. ' +
      'For help call 9876543210. - SBI',
    expect: { mustSignals: ['kyc_phish', 'urgency', 'impersonation', 'suspicious_link'], mustEntities: ['urls', 'shorteners', 'phones'], minRisk: 60 },
  },
  {
    name: 'fake courier customs screenshot',
    ocrText:
      'India Post: Your parcel is held at customs clearance. A customs fee of Rs 25 is pending. ' +
      'Pay now to release your package: http://bit.ly/parcel-clear-pay. Failure to pay within 24 hours will return the parcel.',
    expect: { mustSignals: ['suspicious_link', 'impersonation', 'urgency'], mustEntities: ['urls', 'shorteners', 'amounts'], minRisk: 50 },
  },
  {
    name: 'fake UPI refund scam',
    ocrText:
      'Congratulations! You have received a refund of ₹4,999. To credit the amount, ' +
      'scan the QR code below or approve the collect request in your UPI app (PhonePe/Google Pay). ' +
      'Refund reference UPI REF 8821934.',
    expect: { mustSignals: ['fake_payment', 'reward_bait', 'impersonation'], mustEntities: ['amounts', 'qrPaymentRefs'], minRisk: 55 },
  },
  {
    name: 'fake KYC verification image',
    ocrText:
      'URGENT: Your HDFC Bank PAN-Aadhaar KYC is incomplete and your account is suspended. ' +
      'Verify now at http://hdfc-kyc.top within 24 hours. Share the OTP sent to your phone to confirm. ' +
      'Do not ignore this message.',
    expect: { mustSignals: ['kyc_phish', 'otp_request', 'urgency', 'impersonation', 'suspicious_link'], mustEntities: ['urls', 'shorteners'], minRisk: 70 },
  },
]
