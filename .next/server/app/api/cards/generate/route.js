(()=>{var a={};a.id=8675,a.ids=[8675],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},30636:(a,b,c)=>{"use strict";c.d(b,{cd:()=>k,u2:()=>g,xD:()=>j});let d=process.env.DEEPSEEK_BASE_URL||"https://api.deepseek.com",e=process.env.DEEPSEEK_MODEL||"deepseek-chat",f=`${d.replace(/\/$/,"")}/v1/chat/completions`;function g(){return!!process.env.DEEPSEEK_API_KEY}class h extends Error{constructor(a,b=502){super(a),this.status=b}}function i(){let a=process.env.DEEPSEEK_API_KEY;if(!a)throw new h("DEEPSEEK_API_KEY saknas p\xe5 servern.",503);return{"Content-Type":"application/json",Authorization:`Bearer ${a}`}}async function j(a,b={}){let c=await fetch(f,{method:"POST",headers:i(),body:JSON.stringify({model:e,messages:a,stream:!0,temperature:b.temperature??.6,max_tokens:b.maxTokens??900})});if(!c.ok||!c.body){let a="";try{a=(await c.text()).slice(0,300)}catch{}throw new h(`AI-tj\xe4nsten svarade ${c.status}. ${a?`(${a})`:""}`.trim(),401===c.status?401:502)}return c}async function k(a,b={}){let c=await fetch(f,{method:"POST",headers:i(),body:JSON.stringify({model:e,messages:a,stream:!1,temperature:b.temperature??.2,max_tokens:b.maxTokens??900,response_format:{type:"json_object"}})});if(!c.ok)throw new h(`AI-tj\xe4nsten svarade ${c.status}.`,401===c.status?401:502);let d=await c.json(),g=d.choices?.[0]?.message?.content??"",j=g.indexOf("{"),l=g.lastIndexOf("}");if(-1===j||-1===l)throw new h("AI-svaret inneh\xf6ll ingen JSON.",502);try{return JSON.parse(g.slice(j,l+1))}catch{throw new h("Kunde inte tolka AI-svaret som JSON.",502)}}},33873:a=>{"use strict";a.exports=require("path")},35170:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.r(b),c.d(b,{POST:()=>m,dynamic:()=>o,runtime:()=>n});var e=c(10641),f=c(67360),g=c(30636),h=c(81895),i=c(44228),j=c(49706),k=c(35552),l=a([f,i,j,k]);[f,i,j,k]=l.then?(await l)():l;let n="nodejs",o="force-dynamic";async function m(a){let b,c=await (0,f.HW)();if(!c)return e.NextResponse.json({error:"Inte inloggad."},{status:401});if(!(0,g.u2)())return e.NextResponse.json({error:"DEEPSEEK_API_KEY saknas i .env.local."},{status:503});let{chapterId:d,count:l=10,focus:m}=await a.json().catch(()=>({}));if(!d)return e.NextResponse.json({error:"chapterId kr\xe4vs."},{status:400});let n=await (0,j.L1)(d,c.id);if(!n)return e.NextResponse.json({error:"Kapitlet finns inte."},{status:404});let o=Math.min(15,Math.max(3,Number(l)||10)),p={chapterTitle:n.chapter.title,courseTitle:n.course.title,summary:[n.chapter.summary,m?`Fokus: ${m}`:null].filter(Boolean).join(" "),objectives:n.objectives.map(a=>`${a.code??""} ${a.title}`.trim())},q=[];try{q=await (0,i.K)(c.id,d,`${n.chapter.title} ${m??""}`,3)}catch{q=[]}try{b=await (0,g.cd)((0,h.dz)({chapter:p,snippets:q,count:o}),{temperature:.8,maxTokens:3e3})}catch(a){return e.NextResponse.json({error:a.message},{status:a.status??502})}let r=await (0,k.Zy)("SELECT COALESCE(max(sort_order), 0)::int AS max FROM chapter_cards WHERE chapter_id = $1",[d]),s=r?.max??0,t=[];for(let a of b.cards??[]){let b=String(a.front??"").trim(),c=String(a.back??"").trim();b.length<8||c.length<8||b.length>220||c.length>900||(await (0,k.YB)("SELECT 1 FROM chapter_cards WHERE chapter_id = $1 AND lower(front) = lower($2) LIMIT 1",[d,b])).length||(s++,await (0,k.g7)(`INSERT INTO chapter_cards (id, chapter_id, front, back, sort_order, origin)
       VALUES ($1,$2,$3,$4,$5,'ai')`,[`ai-card-${d}-${crypto.randomUUID().slice(0,8)}`,d,b,c,s]),t.push({front:b,back:c}))}return e.NextResponse.json({added:t.length,cards:t,message:t.length>0?`${t.length} nya kort tillagda i modulen.`:"Inga nya kort den h\xe4r g\xe5ngen (alla fanns redan)."})}d()}catch(a){d(a)}})},44228:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.d(b,{K:()=>g,f:()=>h});var e=c(35552),f=a([e]);e=(f.then?(await f)():f)[0];let i=new Set(["och","att","det","som","den","p\xe5","\xe4r","av","f\xf6r","med","till","en","ett","i","om","s\xe5","kan","hur","vad","varf\xf6r","vilka","vilken","the","and","of"]);async function g(a,b,c,d=4){let f=[...new Set(c.toLowerCase().replace(/[^a-zåäö0-9\s-]/gi," ").split(/\s+/).filter(a=>a.length>2&&!i.has(a)))].slice(0,12);if(0===f.length)return[];let h=f.map(a=>a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|");return(await (0,e.YB)(`SELECT c.heading, c.chapter_id, c.text,
            (SELECT count(*) FROM regexp_matches(lower(c.text), $3, 'g'))::int
              + CASE WHEN c.chapter_id = $2 THEN 3 ELSE 0 END AS score
       FROM doc_chunks c
       JOIN docs d ON d.id = c.doc_id
      WHERE d.user_id = $1 AND lower(c.text) ~ $3
      ORDER BY score DESC, length(c.text) ASC
      LIMIT $4`,[a,b,h,d])).map(a=>({heading:a.heading,chapterId:a.chapter_id,text:a.text.slice(0,1200)}))}function h(a,b){let c=a.split(/\r?\n/),d=[],e=b,f=[],g=()=>{let a=f.join("\n").trim();if(a.length>40)if(a.length>1800)for(let b=0;b<a.length;b+=1400)d.push({heading:e,text:a.slice(b,b+1400)});else d.push({heading:e,text:a});f=[]};for(let a of c){let b=/^(#{1,3})\s+(.*)$/.exec(a.trim());b?(g(),e=b[2].trim()):f.push(a)}return g(),d.slice(0,400)}d()}catch(a){d(a)}})},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{"use strict";a.exports=require("crypto")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},64939:a=>{"use strict";a.exports=import("pg")},78047:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.r(b),c.d(b,{handler:()=>y,patchFetch:()=>x,routeModule:()=>z,serverHooks:()=>C,workAsyncStorage:()=>A,workUnitAsyncStorage:()=>B});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(34679),u=c(51356),v=c(35170),w=a([v]);v=(w.then?(await w)():w)[0];let z=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/cards/generate/route",pathname:"/api/cards/generate",filename:"route",bundlePath:"app/api/cards/generate/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/home/dahir-muse/Desktop/DrPlugg1.0/src/app/api/cards/generate/route.ts",nextConfigOutput:"standalone",userland:v}),{workAsyncStorage:A,workUnitAsyncStorage:B,serverHooks:C}=z;function x(){return(0,g.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:B})}async function y(a,b,c){var d;let e="/api/cards/generate/route";"/index"===e&&(e="/");let g=await z.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:v,params:w,nextConfig:x,isDraftMode:y,prerenderManifest:A,routerServerContext:B,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,resolvedPathname:E}=g,F=(0,j.normalizeAppPath)(e),G=!!A.routes[E]&&(z.isDev||(0,t.isRouteCacheOwner)(E,z.cacheOwner,A.routes[E])),H=!!(A.dynamicRoutes[F]||G);if(H&&!y){let a=A.dynamicRoutes[F];if(a&&!1===a.fallback&&!G)throw new s.NoFallbackError}let I=null;!H||z.isDev||y||(I=E,I="/index"===I?"/":I);let J=!0===z.isDev||!H,K=H&&!J,L=a.method||"GET",M=(0,i.getTracer)(),N=M.getActiveScopeSpan(),O={params:w,prerenderManifest:A,renderOpts:{experimental:{cacheComponents:!!x.experimental.cacheComponents,authInterrupts:!!x.experimental.authInterrupts},supportsDynamicResponse:J,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=x.experimental)?void 0:d.cacheLife,isRevalidate:K,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>z.onRequestError(a,b,d,B)},sharedContext:{buildId:v}},P=new k.NodeNextRequest(a),Q=new k.NodeNextResponse(b),R=l.NextRequestAdapter.fromNodeNextRequest(P,(0,l.signalFromNodeResponse)(b));try{let d=async c=>z.handle(R,O).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=M.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${L} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${L} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&C&&D&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=O.renderOpts.fetchMetrics;let i=O.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=O.renderOpts.collectedTags;if(!H)return await (0,o.I)(P,Q,e,O.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==O.renderOpts.collectedRevalidate&&!(O.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&O.renderOpts.collectedRevalidate,d=void 0===O.renderOpts.collectedExpire||O.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:O.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await z.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:K,isOnDemandRevalidate:C})},B),b}},l=await z.handleResponse({req:a,nextConfig:x,cacheKey:I,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:A,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,responseGenerator:k,waitUntil:c.waitUntil});if(!H)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",C?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&H||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(P,Q,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};N?await g(N):await M.withPropagatedContext(a.headers,()=>M.trace(m.BaseServerSpan.handleRequest,{spanName:`${L} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":L,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await z.onRequestError(a,b,{routerKind:"App Router",routePath:F,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:K,isOnDemandRevalidate:C})}),H)throw b;return await (0,o.I)(P,Q,new Response(null,{status:500})),null}}d()}catch(a){d(a)}})},78335:()=>{},81895:(a,b,c)=>{"use strict";c.d(b,{Ex:()=>h,dz:()=>m,et:()=>s,hk:()=>q,j5:()=>o,sI:()=>i,yl:()=>k});let d={sokratisk:{label:"Sokratisk coach",icon:"\uD83E\uDDE0",hint:"AI:n ger aldrig svaret direkt – en ledtr\xe5d i taget.",prefix:"[L\xc4GE: SOKRATISK COACH] St\xe4ll en fr\xe5ga i taget och l\xe5t mig formulera kunskapen sj\xe4lv."},tentagen:{label:"Tentagenerator",icon:"\uD83D\uDCDD",hint:"Kliniska vinjetter med A–E-alternativ och facit.",prefix:"[L\xc4GE: TENTAGENERATOR] Generera tentafr\xe5gor i flervalsformat med facit och f\xf6rklaringar."},koncept:{label:"Konceptgenomg\xe5ng",icon:"\uD83D\uDCD6",hint:"Fokuserad, mekanistisk f\xf6rklaring med klinisk p\xe4rla.",prefix:"[L\xc4GE: KONCEPTGENOMG\xc5NG] Ge en fokuserad, mekanistisk f\xf6rklaring med klinisk p\xe4rla."},kliniskt:{label:"Kliniskt fall",icon:"\uD83C\uDFE5",hint:"Du \xe4r jourhavande – st\xe4ll fr\xe5gor, best\xe4ll prover, st\xe4ll diagnos.",prefix:"[L\xc4GE: KLINISKT FALL] Spela upp ett fall d\xe4r jag \xe4r jourhavande l\xe4kare och m\xe5ste agera."}},e=`Du \xe4r Karolina – DrPluggs studiecoach f\xf6r l\xe4karprogrammet (Karolinska Institutet).
Du undervisar ALLTID p\xe5 svenska och anv\xe4nder korrekt svensk medicinsk terminologi
(latin/grekiska begrepp n\xe4r det h\xf6r dit, t.ex. tubuli contorti, canalis carpi).

OM DIG
- Du heter Karolina. Presentera dig kort som Karolina f\xf6rsta g\xe5ngen i ett samtal.
- Du \xe4r en coach, inte en uppslagsverk – m\xe5let \xe4r att studenten ska kunna f\xf6rklara sj\xe4lv.
- Om studenten fr\xe5gar vem du \xe4r: du \xe4r DrPluggs AI-coach f\xf6r l\xe4karprogrammet.

PEDAGOGISK GRUND
- L\xe4r ut "varf\xf6r" (patofysiologi/mekanism) innan "vad" (fakta).
- Koppla varje faktum till klinik: symtom, diagnostik, behandling.
- Var varm men saklig. Ingen ber\xf6m-inflation: "bra" bara n\xe4r det \xe4r korrekt.

FORMATERING
- **Fetstil** f\xf6r h\xf6gyieldstermer.
- 🏥 fall \xb7 🤔 fr\xe5ga \xb7 📚 undervisning \xb7 🧠 minnesregel \xb7 📝 tentafr\xe5ga
- H\xe5ll svaren korta. Vid breda \xe4mnen: fr\xe5ga vilken aspekt studenten vill ta f\xf6rst.`,f=`SOKRATISKA REGLER (g\xe4ller i detta l\xe4ge)
1. Ge aldrig hela svaret direkt. Kan studenten inte, ge EN ledtr\xe5d i taget i tre niv\xe5er:
   (1) peka p\xe5 r\xe4tt omr\xe5de, (2) ge halva kedjan, (3) ge f\xf6rsta steget och be studenten forts\xe4tta.
2. St\xe4ll EXAKT EN fr\xe5ga per svar – aldrig tv\xe5.
3. Max 70 ord per svar.
4. Har studenten fel: st\xe4ll en motfr\xe5ga som avsl\xf6jar felet ("Om X vore sant, vad skulle d\xe5 h\xe4nda med Y?")
   i st\xe4llet f\xf6r att r\xe4tta direkt.
5. Kr\xe4v till slut att studenten formulerar k\xe4rnan SJ\xc4LV med egna ord. F\xf6rst d\xe5 bekr\xe4ftar du.
6. Ge aldrig betyg eller po\xe4ng – bed\xf6mningen g\xf6rs i ett separat steg.`,g=`K\xc4LLGRUNDNING
- Finns K\xc4LLUTDRAG nedan: grunda varje sakp\xe5st\xe5ende i dem och h\xe4nvisa kort ("enligt ditt material: <rubrik>").
- T\xe4cker utdragen inte fr\xe5gan: s\xe4g det rakt ut och erbjud att svara fr\xe5n allm\xe4n kunskap.
- Hitta aldrig p\xe5 sidnummer, citat eller k\xe4llor.`;function h(a){let b=[e];if("sokratisk"===a.mode&&b.push(f),"tentagen"===a.mode&&b.push(`TENTAGENERATOR
- Skriv 5 fr\xe5gor som kliniska vinjetter (2–4 meningar) med 5 alternativ (A–E), ett r\xe4tt.
- Blanda sv\xe5righetsgrad. Facit och f\xf6rklaring l\xe4ggs EFTER alla fr\xe5gor under "## Facit".
- Varje fr\xe5ga ska pr\xf6va en mekanism eller ett prioriteringsbeslut – inte en definition.`),"koncept"===a.mode&&b.push(`KONCEPTGENOMG\xc5NG
- B\xf6rja enkelt, inf\xf6r sedan terminologin.
- Struktur: mekanism → klinisk bild → diagnostik → behandling → 🧠 minnesregel → klinisk p\xe4rla.`),"kliniskt"===a.mode&&b.push(`KLINISKT FALL
- Presentera en realistisk patient (\xe5lder, k\xf6n, anamnes, vitalparametrar, labb).
- Stanna d\xe4r och l\xe5t studenten best\xe4lla unders\xf6kningar. Avsl\xf6ja bara det som efterfr\xe5gas.
- Ge \xe5terkoppling p\xe5 varje steg: vad var rimligt, vad var farligt att missa.
- Avsluta f\xf6rst n\xe4r studenten st\xe4llt diagnos och f\xf6reslagit behandling (med motivering).`),a.chapter){let c=a.chapter.objectives?.length?`
L\xe4randem\xe5l:
- ${a.chapter.objectives.join("\n- ")}`:"";b.push(`AKTUELLT KAPITEL
Kurs: ${a.chapter.courseTitle}
Kapitel: ${a.chapter.chapterTitle}${a.chapter.summary?`
Sammanfattning: ${a.chapter.summary}`:""}${c}
H\xe5ll dig till kapitlets niv\xe5 och bygg vidare p\xe5 det studenten redan sett d\xe4r.`)}return b.push(g),a.snippets.length?b.push("K\xc4LLUTDRAG ur studentens eget material\n"+a.snippets.map((a,b)=>`[${b+1}] ${a.heading?a.heading+" \xb7 ":""}${a.chapterId??""}
${a.text}`).join("\n\n")):b.push("K\xc4LLUTDRAG: inga tillg\xe4ngliga – svara fr\xe5n allm\xe4n kurskunskap och var tydlig med det."),b.join("\n\n")}function i(a,b){return`${d[a].prefix}

${b}`}let j=`Du \xe4r examinator p\xe5 l\xe4karprogrammet (Karolinska Institutet).
Du bed\xf6mer en students f\xf6rklaring efter en sokratisk dialog.

BETYGSSKALA (FSRS-rating) – var strikt och kalibrerad:
1 = Igen. Kunde inte f\xf6rklara, eller flera centrala sakfel kvarst\xe5r.
2 = Sv\xe5rt. Kom fram till k\xe4rnan men beh\xf6vde flera ledtr\xe5dar, eller har v\xe4sentliga luckor.
    Om din ledtr\xe5d i praktiken avsl\xf6jade svaret → max 2.
3 = Bra. F\xf6rklarade sj\xe4lvst\xe4ndigt och korrekt, med sm\xe5 luckor. Inga sakfel.
4 = L\xe4tt. Korrekt, fullst\xe4ndigt, snabbt, utan ledtr\xe5dar – och kunde generalisera till klinik.

REGLER
- En student som bara upprepade dina ord utan egen f\xf6rst\xe5else f\xe5r max 2.
- Sakfel som inte r\xe4ttats av studenten → max 2.
- Ett "Bra" ska betyda att studenten klarat en muntlig tentafr\xe5ga p\xe5 m\xe5let.
- Svara ENDAST med JSON enligt schemat. All text p\xe5 svenska.`;function k(a){let b=a.transcript.map(a=>`${"assistant"===a.role?"COACH":"STUDENT"}: ${a.content}`).join("\n\n");return[{role:"system",content:j},{role:"user",content:`KAPITEL
${a.chapter.courseTitle} – ${a.chapter.title}

L\xc4RANDEM\xc5L
${a.objective||"(kapitlet som helhet)"}

DIALOGEN
${b||"(studenten gav inget svar)"}

JSON-schema:
{
  "rating": 1 | 2 | 3 | 4,
  "confidence": 0.0-1.0,
  "verdict": "en mening om niv\xe5n",
  "strengths": ["kort punkt"],
  "gaps": ["vad som saknades eller var fel"],
  "misconception": "viktigaste begreppsf\xf6rv\xe4xlingen, annars tom str\xe4ng",
  "reference_answer": "2-4 meningar korrekt svar",
  "next_question": "EN fr\xe5ga att kunna n\xe4sta g\xe5ng"
}`}]}let l=`Du skriver flashcards f\xf6r l\xe4karstudenter. Korten ska tr\xe4na \xc5TERKALLNING, inte igenk\xe4nning.

REGLER
- Ett kort = ett faktum. Aldrig tv\xe5 fr\xe5gor i samma kort.
- Fram: max 25 ord, entydig fr\xe5ga. Ingen ledtr\xe5d.
- Bak: 1-3 meningar, exakt och korrekt, svensk terminologi + latinska begrepp.
- Prioritera mekanismer, orsak→verkan, skillnader mellan begrepp och kliniska kopplingar.
- Hitta inte p\xe5 siffror. R\xe4cker inte underlaget: skriv f\xe4rre kort.
- Svara ENDAST med JSON: {"cards":[{"front":"...","back":"..."}]}`;function m(a){let b=a.snippets.length?a.snippets.map((a,b)=>`[${b+1}] ${a.heading??""}
${a.text}`).join("\n\n---\n\n"):"(inget k\xe4llmaterial uppladdat – anv\xe4nd allm\xe4n kurskunskap p\xe5 l\xe4karprogrammet)";return[{role:"system",content:l},{role:"user",content:`KAPITEL
${a.chapter.courseTitle} – ${a.chapter.chapterTitle}
${a.chapter.summary??""}

L\xc4RANDEM\xc5L
${(a.chapter.objectives??[]).join("\n")||"(kapitlet som helhet)"}

K\xc4LLMATERIAL
${b}

Skriv ${a.count} kort i JSON-format.`}]}let n=`Du skriver tentafr\xe5gor f\xf6r l\xe4karprogrammet (Karolinska Institutet) utifr\xe5n kapitlets l\xe4randem\xe5l.

REGLER
- Skriv exakt det antal fr\xe5gor som efterfr\xe5gas, i JSON.
- Varje fr\xe5ga: klinisk vinjett eller resonemangsfr\xe5ga, fyra alternativ, exakt ett r\xe4tt.
- Pr\xf6va mekanism, prioritering eller differentialdiagnostik – inte trivia eller rena definitioner.
- F\xf6rklaringen ska s\xe4ga varf\xf6r r\xe4tt svar \xe4r r\xe4tt OCH varf\xf6r det vanligaste distraktionsalternativet \xe4r fel.
- Variera vilken position det r\xe4tta svaret har (0–3) mellan fr\xe5gorna.
- Hitta inte p\xe5 siffror, doser eller referenser. Bygg p\xe5 l\xe4randem\xe5len.
- Svara ENDAST med JSON: {"questions":[{"prompt":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"..."}]}`;function o(a){let b=a.snippets.length?a.snippets.map((a,b)=>`[${b+1}] ${a.heading??""}
${a.text}`).join("\n\n---\n\n"):"(inget eget k\xe4llmaterial – anv\xe4nd l\xe4randem\xe5len nedan)";return[{role:"system",content:n},{role:"user",content:`KAPITEL
${a.chapter.courseTitle} – ${a.chapter.chapterTitle}
${a.chapter.summary??""}

L\xc4RANDEM\xc5L
${(a.chapter.objectives??[]).join("\n")||"(kapitlet som helhet)"}

K\xc4LLMATERIAL
${b}

Skriv ${a.count} nya fr\xe5gor. JSON: {"questions":[{"prompt":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"..."}]}`}]}let p=`Du \xe4r examinator och faktagranskar flervalsfr\xe5gor som en AI just skrev till l\xe4karprogrammet.
Du f\xe5r fr\xe5gorna med f\xf6reslaget r\xe4tt svar, l\xe4randem\xe5len de ska pr\xf6va och eventuellt k\xe4llmaterial.

GODK\xc4NN (verdict "ok") endast om
- exakt ett alternativ \xe4r medicinskt korrekt och det \xe4r det angivna,
- f\xf6rklaringen \xe4r sakligt riktig och inte mots\xe4ger svaret,
- fr\xe5gan pr\xf6var n\xe5got som ryms i l\xe4randem\xe5len.

UNDERK\xc4NN (verdict "wrong") om
- r\xe4tt svar \xe4r fel eller flera alternativ \xe4r korrekta,
- f\xf6rklaringen inneh\xe5ller ett sakfel,
- fr\xe5gan bygger p\xe5 p\xe5st\xe5enden som inte st\xf6ds och du inte \xe4r s\xe4ker.

Om svaret \xe4r fel men ett annat alternativ uppenbart \xe4r r\xe4tt: s\xe4tt verdict "wrong" och ange correctedAnswerIndex.
Var str\xe4ng – hellre underk\xe4nna \xe4n att sl\xe4ppa igenom en tveksam fr\xe5ga.
Svara ENDAST med JSON: {"results":[{"index":0,"verdict":"ok"|"wrong","correctedAnswerIndex":null,"note":"kort motivering"}]}`;function q(a){let b=a.snippets.length?a.snippets.map((a,b)=>`[${b+1}] ${a.heading??""}
${a.text}`).join("\n\n---\n\n"):"(inget eget k\xe4llmaterial)";return[{role:"system",content:p},{role:"user",content:`L\xc4RANDEM\xc5L (${a.chapter.chapterTitle})
${(a.chapter.objectives??[]).join("\n")||"(kapitlet som helhet)"}

K\xc4LLMATERIAL
${b}

FR\xc5GOR ATT GRANSKA
${a.questions.map((a,b)=>`#${b}
Fr\xe5ga: ${a.prompt}
${a.options.map((b,c)=>`${c===a.answerIndex?"*":" "}${c}: ${b}`).join("\n")}
F\xf6rklaring: ${a.explanation}`).join("\n\n")}

Svara med JSON: {"results":[{"index":0,"verdict":"ok"|"wrong","correctedAnswerIndex":null,"note":"..."}]}`}]}let r=`Du skapar begreppspar f\xf6r ett memory-spel i medicin (l\xe4karprogrammet).
Varje par = ett BEGREPP och en kort DEFINITION.

REGLER
- Begreppet ska vara 1–4 ord (svensk term eller latinskt/grekiskt begrepp), t.ex. "Nefron", "Frank–Starling", "HLA klass II".
- Definitionen ska vara max 12 ord, entydig och korrekt.
- Paren ska h\xf6ra till modulen och vara s\xe5 olika varandra att de inte kan f\xf6rv\xe4xlas.
- Inga p\xe5hittade fakta, inga siffror du inte \xe4r s\xe4ker p\xe5.
- Svara ENDAST med JSON: {"pairs":[{"term":"...","definition":"..."}]}`;function s(a){return[{role:"system",content:r},{role:"user",content:`MODUL
${a.chapter.courseTitle} – ${a.chapter.chapterTitle}
${a.chapter.summary??""}

L\xc4RANDEM\xc5L
${(a.chapter.objectives??[]).slice(0,25).join("\n")||"(modulen som helhet)"}
${a.avoid.length?`
ANV\xc4ND INTE DESSA BEGREPP IGEN
${a.avoid.join(", ")}`:""}

Ge ${a.count} begreppspar som JSON.`}]}},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[8921,3848,1692,2023,9073],()=>b(b.s=78047));module.exports=c})();