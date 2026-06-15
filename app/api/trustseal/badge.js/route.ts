// GET /api/trustseal/badge.js  (asq-trustseal-pr5)
// Embeddable "Verified by TrustSeal" badge loader. A site adds ONE tag:
//   <script src="https://trustseal.asquaresolution.com/api/trustseal/badge.js" data-domain="acme.com"></script>
// Served under /api/* so it inherits the middleware api-passthrough (no middleware
// change). Heavily CDN-cached static JS. ANTI-FORGERY:
//   • LIVE status — always fetches /api/trustseal/seal/{domain}; a copied static
//     badge can't fake "verified", and a revoked seal degrades within the TTL.
//   • ORIGIN-BINDING — the verified badge renders only when the embedding page's
//     host matches the claimed domain; otherwise an "unverified origin" notice.
//   • Links to the canonical public seal page (the source of truth).
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const JS = `(function(){
  function findScript(){
    if (document.currentScript) return document.currentScript;
    var ss = document.getElementsByTagName('script');
    for (var i=ss.length-1;i>=0;i--){ if ((ss[i].src||'').indexOf('/badge.js')>-1) return ss[i]; }
    return null;
  }
  var s = findScript(); if(!s) return;
  var origin = new URL(s.src).origin;
  var domain = (s.getAttribute('data-domain')||'').trim().toLowerCase().replace(/^www\\./,'');
  if(!domain) return;
  function esc(t){var d=document.createElement('div');d.textContent=t==null?'':String(t);return d.innerHTML;}
  // Origin-binding: the page hosting the badge must be the claimed domain (or a subdomain).
  var host = (location.hostname||'').toLowerCase().replace(/^www\\./,'');
  var sameOrigin = host===domain || host.indexOf('.'+domain)===(host.length-domain.length-1);

  var box=document.createElement('span');
  box.setAttribute('style','display:inline-flex;align-items:center;gap:6px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1;padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#111827;text-decoration:none');
  box.innerHTML='<span style="color:#9ca3af">TrustSeal…</span>';
  s.parentNode.insertBefore(box, s.nextSibling);

  if(!sameOrigin){
    box.innerHTML='<span style="color:#b45309">⚠ TrustSeal: unverified origin</span>';
    return;
  }
  fetch(origin+'/api/trustseal/seal/'+encodeURIComponent(domain)).then(function(r){return r.json()}).then(function(d){
    // Pro-gated: the embeddable verified badge renders only when the owning account
    // is entitled (d.badgeEntitled, computed server-side). Otherwise — including
    // verified-but-Free domains — fall back to a plain link to the public seal page.
    if(!d || !d.verified || !d.badgeEntitled){
      box.innerHTML='<a href="'+origin+'/en/trust/'+encodeURIComponent(domain)+'" target="_blank" rel="noopener" style="color:#6b7280;text-decoration:none">Verify with TrustSeal</a>';
      return;
    }
    // Badge V2: color + icon + wording reflect the trust band (server-computed).
    var BANDS={
      verified:{c:'#16a34a',i:'\\u2713',w:'Verified by'},
      established:{c:'#0891b2',i:'\\u2605',w:'Established ·'},
      limited:{c:'#7c3aed',i:'\\u25d0',w:'Listed on'},
      caution:{c:'#b45309',i:'!',w:'Caution ·'},
      high_risk:{c:'#dc2626',i:'\\u2715',w:'Flagged by'}
    };
    var band=(d.band||d.status||'verified'); var m=BANDS[band]||BANDS.verified;
    var a=document.createElement('a');
    a.href=origin+(d.sealUrl||('/en/trust/'+encodeURIComponent(domain)));
    a.target='_blank'; a.rel='noopener';
    a.setAttribute('style','display:inline-flex;align-items:center;gap:6px;color:#111827;text-decoration:none');
    a.setAttribute('data-band',band);
    a.innerHTML='<span style="display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;border-radius:50%;background:'+m.c+';color:#fff;font-size:11px;font-weight:700">'+m.i+'</span>'
      +'<span>'+m.w+' <strong style="color:'+m.c+'">TrustSeal</strong></span>'
      +(d.score!=null?'<span style="color:#9ca3af">· '+esc(d.score)+'/100</span>':'');
    box.innerHTML=''; box.appendChild(a);
  }).catch(function(){
    box.innerHTML='<a href="'+origin+'/en/trust/'+encodeURIComponent(domain)+'" target="_blank" rel="noopener" style="color:#6b7280;text-decoration:none">TrustSeal</a>';
  });
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
