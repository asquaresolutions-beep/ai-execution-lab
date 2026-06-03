#!/usr/bin/env node
// Generate a large synthetic evaluation corpus (goal 1): 500 scam + 500 legit
// OCR-text samples across en / hi / hinglish / mixed and all scam categories.
// Deterministic (seeded) so the corpus is reproducible. Writes JSONL to
// datasets/synthetic/{scam,legit}.jsonl. Run: node scripts/gen-synthetic-corpus.mjs
import { writeFileSync, mkdirSync } from 'node:fs'

// ── seeded PRNG ──
let _s = 0x9e3779b9
function srand(seed) { _s = seed >>> 0 }
function rnd() { _s ^= _s << 13; _s ^= _s >>> 17; _s ^= _s << 5; _s >>>= 0; return _s / 0xffffffff }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
srand(20260603)

const BANKS = ['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'PNB']
const WALLETS = ['Paytm', 'PhonePe', 'Google Pay', 'BHIM']
const COURIERS = ['India Post', 'Blue Dart', 'DTDC', 'FedEx', 'Delhivery']
const SHORTENERS = ['bit.ly/x' , 'tinyurl.com/r', 't.me/joinpay', 'cutt.ly/win']
// Per-category domain pools so a scam domain correlates with its campaign
// (realistic: a "Fake SBI KYC" campaign reuses its own landing domain).
const CAT_DOMAINS = {
  fake_kyc: ['sbi-kyc-verify.xyz', 'hdfc-kyc-update.top', 'icici-kyc.click'],
  upi_refund: ['rbi-refund.live', 'upi-refund-portal.buzz'],
  fake_bank_alert: ['secure-bank-login.top', 'netbanking-alert.click'],
  courier: ['indiapost-customs.top', 'parcel-customs-fee.xyz'],
  investment: ['vip-trading-profit.live', 'forex-guaranteed.buzz'],
  job: ['wfh-jobs-apply.xyz', 'parttime-earn.click'],
  crypto: ['btc-airdrop-claim.top', 'crypto-reward.live'],
  fake_payment: ['payment-confirm.click', 'upi-credit.xyz'],
  fake_whatsapp_support: ['wallet-support-help.top', 'account-restore.click'],
  fake_ecommerce_refund: ['order-refund-portal.xyz', 'shopping-refund.buzz'],
}
let CURRENT_CAT = ''
const LEGIT_DOMAINS = ['amazon.in/orders', 'flipkart.com', 'sbi.co.in', 'hdfcbank.com', 'indiapost.gov.in']
const LANGS = ['en', 'hi', 'hinglish', 'mixed']
const phone = () => `${pick(['9', '8', '7', '6'])}${int(100000000, 999999999)}`
const amount = () => `${pick(['Rs ', '₹', 'INR '])}${pick(['499', '999', '1,999', '2,500', '4,999', '9,999', '49,999'])}`
const otp = () => int(100000, 999999)

// scamUrl: sometimes a brand-lookalike domain, sometimes shortener, sometimes obfuscated
function scamUrl(adv = false) {
  const pool = CAT_DOMAINS[CURRENT_CAT] || ['scam-verify.xyz']
  const base = rnd() < 0.7 ? pick(pool) : pick(SHORTENERS)
  if (adv) return rnd() < 0.5 ? `hxxp://${base.replace(/\./g, '[.]')}` : `http://${base.replace('o', '0').replace('i', '1')}`
  return `http://${base}`
}

// ── scam templates: category -> { en, hi, hinglish } producing text ──
const SCAM = {
  fake_kyc: {
    en: () => `Dear customer, your ${pick(BANKS)} KYC is incomplete and your account will be blocked today. Verify now at ${scamUrl()} or call ${phone()}.`,
    hi: () => `प्रिय ग्राहक, आपका ${pick(BANKS)} केवाईसी अधूरा है और खाता आज बंद हो जाएगा। तुरंत सत्यापित करें: ${scamUrl()}`,
    hinglish: () => `Dear customer, aapka ${pick(BANKS)} KYC update karo warna account block ho jayega. Abhi verify karo: ${scamUrl()}`,
  },
  upi_refund: {
    en: () => `Congratulations! You have received a refund of ${amount()}. Scan the QR or approve the collect request in your ${pick(WALLETS)} app to credit it. UPI REF ${int(1000000, 9999999)}.`,
    hi: () => `बधाई हो! आपको ${amount()} का रिफंड मिला है। राशि पाने के लिए QR स्कैन करें या कलेक्ट रिक्वेस्ट अप्रूव करें।`,
    hinglish: () => `Aapko ${amount()} ka refund mila hai. Paise pane ke liye QR scan karo ya ${pick(WALLETS)} par collect request approve karo. Jaldi karo warna refund cancel ho jayega.`,
  },
  fake_bank_alert: {
    en: () => `ALERT: Unusual login detected on your ${pick(BANKS)} account. If this wasn't you, re-activate immediately at ${scamUrl()}. Failure to act will lock your account.`,
    hi: () => `सूचना: आपके ${pick(BANKS)} खाते में असामान्य लॉगिन। यदि यह आप नहीं थे तो तुरंत यहाँ पुनः सक्रिय करें: ${scamUrl()}`,
    hinglish: () => `Alert: aapke ${pick(BANKS)} account me suspicious login hua hai. Turant re-activate karo: ${scamUrl()} warna account band ho jayega.`,
  },
  courier: {
    en: () => `${pick(COURIERS)}: Your parcel is held at customs. Pay ${amount()} customs fee to release: ${scamUrl()}. Failure to pay within 24 hours returns the parcel.`,
    hi: () => `${pick(COURIERS)}: आपका पार्सल कस्टम में रुका है। ${amount()} शुल्क का भुगतान करें: ${scamUrl()}`,
    hinglish: () => `${pick(COURIERS)}: aapka parcel customs me ruka hai. ${amount()} fee pay karo release ke liye: ${scamUrl()} warna parcel wapas chala jayega.`,
  },
  investment: {
    en: () => `Earn 30% guaranteed returns! Join our ${pick(['stock', 'forex', 'mutual fund'])} VIP group on WhatsApp ${phone()} or ${scamUrl()}. Limited seats, invest ${amount()} today.`,
    hi: () => `30% गारंटीड रिटर्न कमाएँ! हमारे VIP ग्रुप में शामिल हों: ${scamUrl()} आज ${amount()} निवेश करें।`,
    hinglish: () => `30% guaranteed return kamao! Hamare trading VIP group join karo WhatsApp ${phone()} par. Aaj ${amount()} invest karo, seats limited hai.`,
  },
  job: {
    en: () => `Congratulations! You are selected for a work from home job. Earn ${amount()} daily part-time. Pay ${amount()} registration to start: ${scamUrl()} or WhatsApp ${phone()}.`,
    hi: () => `बधाई! आप घर बैठे नौकरी के लिए चुने गए हैं। रोज़ ${amount()} कमाएँ। शुरू करने के लिए ${scamUrl()} पर रजिस्टर करें।`,
    hinglish: () => `Congratulations! Aap ghar baithe job ke liye select hue ho. Roj ${amount()} kamao. Registration ke liye ${amount()} bhejo: ${scamUrl()}`,
  },
  crypto: {
    en: () => `Your crypto wallet won ${amount()} in BTC airdrop! Claim within 1 hour at ${scamUrl()}. Send wallet seed phrase to verify ownership.`,
    hi: () => `आपके क्रिप्टो वॉलेट ने ${amount()} BTC जीता! 1 घंटे में दावा करें: ${scamUrl()}`,
    hinglish: () => `Aapke crypto wallet ne ${amount()} ka BTC airdrop jeeta! 1 ghante me claim karo: ${scamUrl()}. Seed phrase bhejo verify ke liye.`,
  },
  fake_payment: {
    en: () => `Payment of ${amount()} received successfully to your account. To confirm and credit, share the OTP ${otp()} sent to your phone.`,
    hi: () => `${amount()} का भुगतान सफलतापूर्वक प्राप्त हुआ। पुष्टि के लिए OTP ${otp()} भेजें।`,
    hinglish: () => `${amount()} ka payment successful hua hai. Confirm karne ke liye OTP bhejo jo abhi aaya hai.`,
  },
  fake_whatsapp_support: {
    en: () => `${pick(WALLETS)} Support: your account is suspended for KYC. Chat with our agent on WhatsApp ${phone()} or verify at ${scamUrl()} to restore access.`,
    hi: () => `${pick(WALLETS)} सपोर्ट: आपका खाता निलंबित है। एजेंट से बात करें WhatsApp ${phone()} या ${scamUrl()}`,
    hinglish: () => `${pick(WALLETS)} support: aapka account suspend ho gaya hai. Agent se baat karo WhatsApp ${phone()} par ya verify karo: ${scamUrl()}`,
  },
  fake_ecommerce_refund: {
    en: () => `Your ${pick(['Amazon', 'Flipkart'])} order was cancelled. Refund ${amount()} pending. Update your bank details and share OTP to receive it: ${scamUrl()}.`,
    hi: () => `आपका ${pick(['Amazon', 'Flipkart'])} ऑर्डर रद्द हुआ। ${amount()} रिफंड लंबित। OTP साझा करें: ${scamUrl()}`,
    hinglish: () => `Aapka ${pick(['Amazon', 'Flipkart'])} order cancel ho gaya. ${amount()} refund pending hai. Bank details update karo aur OTP bhejo: ${scamUrl()}`,
  },
}

const LEGIT = {
  banking_notification: {
    en: () => `${amount()} debited from A/c XX${int(1000, 9999)} on ${int(1, 28)}-06-26 to UPI/merchant. Avl Bal ${amount()}. Not you? Call 1800${int(1000000, 9999999)}. -${pick(BANKS)}`,
    hi: () => `आपके खाते XX${int(1000, 9999)} से ${amount()} डेबिट हुआ। शेष राशि ${amount()}। -${pick(BANKS)}`,
    hinglish: () => `Aapke account XX${int(1000, 9999)} se ${amount()} debit hua hai. Available balance ${amount()}. -${pick(BANKS)}`,
  },
  otp: {
    en: () => `${otp()} is your OTP for ${pick(BANKS)} NetBanking. Do not share it with anyone. Valid for 10 minutes. -${pick(BANKS)}`,
    hi: () => `${otp()} आपका ${pick(BANKS)} ओटीपी है। इसे किसी के साथ साझा न करें। -${pick(BANKS)}`,
    hinglish: () => `Aapka OTP ${otp()} hai ${pick(BANKS)} ke liye. Ise kisi ke saath share na karein. 10 min valid. -${pick(BANKS)}`,
  },
  courier: {
    en: () => `Your ${pick(['Amazon', 'Flipkart'])} package will be delivered today by ${int(6, 9)} PM. Track at ${pick(LEGIT_DOMAINS)}. No action needed.`,
    hi: () => `आपका ${pick(COURIERS)} पार्सल आज डिलीवर होगा। ट्रैक करें: ${pick(LEGIT_DOMAINS)}`,
    hinglish: () => `Aapka ${pick(COURIERS)} shipment aaj deliver hoga. Track karo: ${pick(LEGIT_DOMAINS)}. Koi payment required nahi.`,
  },
  ecommerce_receipt: {
    en: () => `Order #${pick(['FK', 'AMZ', 'MYN'])}${int(1000, 9999)} confirmed. Amount paid ${amount()} via UPI. Estimated delivery ${int(1, 9)} June. Thank you for shopping.`,
    hi: () => `ऑर्डर #${int(1000, 9999)} पुष्ट। भुगतान ${amount()}। धन्यवाद।`,
    hinglish: () => `Order #${int(1000, 9999)} confirmed. ${amount()} paid via UPI. Delivery ${int(1, 9)} June. Thank you for shopping.`,
  },
  payment_success: {
    en: () => `You paid ${amount()} to ${pick(['Spotify', 'Netflix', 'Jio', 'Airtel'])}. UPI transaction ID ${int(100000000000, 999999999999)}. Completed. -${pick(WALLETS)}`,
    hi: () => `आपने ${pick(['Jio', 'Airtel'])} को ${amount()} का भुगतान किया। पूर्ण। -${pick(WALLETS)}`,
    hinglish: () => `Aapne ${pick(['Spotify', 'Jio'])} ko ${amount()} pay kiya. UPI ID ${int(100000000000, 999999999999)}. Completed. -${pick(WALLETS)}`,
  },
  kyc_branch: {
    en: () => `Dear customer, as per RBI guidelines please update your KYC at your nearest ${pick(BANKS)} branch by 30 June. Carry valid ID. -${pick(BANKS)}`,
    hi: () => `प्रिय ग्राहक, कृपया अपनी निकटतम ${pick(BANKS)} शाखा में केवाईसी अपडेट करें। -${pick(BANKS)}`,
    hinglish: () => `Dear customer, apni nearest ${pick(BANKS)} branch me KYC update karwa lein 30 June tak. Valid ID lekar aayein. -${pick(BANKS)}`,
  },
  promo: {
    en: () => `${pick(['Amazon', 'Flipkart'])} Sale is live! Up to 70% off. Shop at ${pick(LEGIT_DOMAINS)}. T&C apply.`,
    hi: () => `${pick(['Amazon', 'Flipkart'])} सेल शुरू! 70% तक छूट। ${pick(LEGIT_DOMAINS)}`,
    hinglish: () => `${pick(['Amazon', 'Flipkart'])} sale live hai! 70% tak off. Shop karo ${pick(LEGIT_DOMAINS)} par.`,
  },
}

const CHANNELS = ['whatsapp', 'sms', 'email', 'app']
function langText(tmpl) {
  const lang = pick(LANGS)
  if (lang === 'mixed') return { lang, text: `${tmpl.en()} ${tmpl.hi()}` }
  return { lang, text: (tmpl[lang] || tmpl.en)() }
}

function build(set, label, count) {
  const cats = Object.keys(set)
  const out = []
  for (let i = 0; i < count; i++) {
    const category = cats[i % cats.length]
    CURRENT_CAT = category
    const { lang, text } = langText(set[category])
    out.push({ id: `${label}-${category}-${i}`, label, category, lang, channel: pick(CHANNELS), ocrText: text })
  }
  return out
}

mkdirSync(new URL('../datasets/synthetic/', import.meta.url), { recursive: true })
const scam = build(SCAM, 'scam', 500)
const legit = build(LEGIT, 'legit', 500)
const w = (name, rows) => writeFileSync(new URL(`../datasets/synthetic/${name}`, import.meta.url), rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
w('scam.jsonl', scam)
w('legit.jsonl', legit)
console.log(`Wrote ${scam.length} scam + ${legit.length} legit samples to datasets/synthetic/`)
const byLang = {}; for (const r of [...scam, ...legit]) byLang[r.lang] = (byLang[r.lang] || 0) + 1
console.log('by language:', byLang)
