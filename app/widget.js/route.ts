// GET /widget.js — embeddable scam-alerts widget (backlink engine).
//
// Publishers paste ONE <script> tag; this injects a styled, auto-updating
// widget into THEIR page DOM (not an iframe → the attribution <a> is a real
// dofollow backlink). Data comes from the CDN-cached trending API, so it is
// real-time yet near-zero cost. Served as cacheable JavaScript.
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const JS = `(function(){
  function findScript(){
    if (document.currentScript) return document.currentScript;
    var ss = document.getElementsByTagName('script');
    for (var i=ss.length-1;i>=0;i--){ if ((ss[i].src||'').indexOf('/widget.js')>-1) return ss[i]; }
    return null;
  }
  var s = findScript(); if(!s) return;
  var origin = new URL(s.src).origin;
  var kind = s.getAttribute('data-kind') || 'latest';
  var value = s.getAttribute('data-value') || '';
  var limit = parseInt(s.getAttribute('data-limit')||'5',10);
  var title = s.getAttribute('data-title') || (kind==='city' ? ('Scam alerts: '+value) : kind==='bank' ? (value+' scam alerts') : 'Latest scam alerts — India');
  var CAT={upi_fraud:'upi-fraud',otp_fraud:'otp-fraud',kyc_fraud:'kyc-fraud',phishing:'phishing',fake_job:'fake-job',investment_fraud:'investment-fraud',loan_scam:'loan-scam',courier_customs:'courier-scam',lottery_prize:'lottery-scam',tech_support:'tech-support-scam',romance:'romance-scam',whatsapp_scam:'phishing'};
  var box=document.createElement('div');
  box.setAttribute('style','max-width:360px;font-family:system-ui,-apple-system,sans-serif;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)');
  box.innerHTML='<div style="background:#4f46e5;color:#fff;padding:10px 14px;font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f87171"></span>'+esc(title)+'</div><div data-sc-list style="padding:6px 0"><div style="padding:12px 14px;color:#6b7280;font-size:13px">Loading scam alerts…</div></div><a href="'+origin+'/scams" target="_blank" rel="noopener" style="display:block;padding:8px 14px;font-size:11px;color:#6b7280;text-decoration:none;border-top:1px solid #f3f4f6">Powered by <span style="color:#4f46e5;font-weight:600">ScamCheck</span> — live scam alerts in India</a>';
  s.parentNode.insertBefore(box, s.nextSibling);
  function esc(t){var d=document.createElement('div');d.textContent=t==null?'':String(t);return d.innerHTML;}
  fetch(origin+'/api/scam-intel/trending?limit='+limit).then(function(r){return r.json()}).then(function(d){
    var items=(d&&d.items)||[]; var list=box.querySelector('[data-sc-list]');
    if(!items.length){list.innerHTML='<div style="padding:12px 14px;color:#6b7280;font-size:13px">No active alerts right now.</div>';return;}
    list.innerHTML=items.map(function(it){
      var slug=CAT[it.category]||'phishing';
      var badge=it.viral?'<span style="background:#fee2e2;color:#b91c1c;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:600">VIRAL</span>':(it.active?'<span style="background:#dcfce7;color:#15803d;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:600">ACTIVE</span>':'');
      return '<a href="'+origin+'/scams/type/'+slug+'" target="_blank" rel="noopener" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 14px;font-size:13px;color:#111827;text-decoration:none;border-top:1px solid #f9fafb">'+esc(it.title)+badge+'</a>';
    }).join('');
  }).catch(function(){});
})();`

export async function GET() {
  return new NextResponse(JS, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
