(()=>{var e={};e.id=739,e.ids=[739],e.modules={846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},4870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},9294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},3033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},5511:e=>{"use strict";e.exports=require("crypto")},4939:e=>{"use strict";e.exports=import("pg")},2516:(e,t,r)=>{"use strict";r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{patchFetch:()=>x,routeModule:()=>d,serverHooks:()=>g,workAsyncStorage:()=>c,workUnitAsyncStorage:()=>p});var n=r(2706),s=r(8203),i=r(5994),l=r(1808),o=e([l]);l=(o.then?(await o)():o)[0];let d=new n.AppRouteRouteModule({definition:{kind:s.RouteKind.APP_ROUTE,page:"/api/grade/route",pathname:"/api/grade",filename:"route",bundlePath:"app/api/grade/route"},resolvedPagePath:"/home/dahir-muse/Desktop/DrPlugg1.0/src/app/api/grade/route.ts",nextConfigOutput:"standalone",userland:l}),{workAsyncStorage:c,workUnitAsyncStorage:p,serverHooks:g}=d;function x(){return(0,i.patchFetch)({workAsyncStorage:c,workUnitAsyncStorage:p})}a()}catch(e){a(e)}})},6487:()=>{},8335:()=>{},1808:(e,t,r)=>{"use strict";r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{POST:()=>c,dynamic:()=>g,runtime:()=>p});var n=r(9187),s=r(7702),i=r(7914),l=r(8898),o=r(6981),x=r(1952),d=e([s,i,x]);[s,i,x]=d.then?(await d)():d;let p="nodejs",g="force-dynamic",k=[1,2,3,4];async function c(e){let t;let r=await (0,s.HW)();if(!r)return n.NextResponse.json({error:"Inte inloggad."},{status:401});if(!(0,l.u2)())return n.NextResponse.json({error:"DEEPSEEK_API_KEY saknas i .env.local."},{status:503});let{sessionId:a}=await e.json().catch(()=>({}));if(!a)return n.NextResponse.json({error:"sessionId kr\xe4vs."},{status:400});let d=await (0,i.Zy)("SELECT id, chapter_id FROM chat_sessions WHERE id = $1 AND user_id = $2",[a,r.id]);if(!d)return n.NextResponse.json({error:"Sessionen finns inte."},{status:404});let c=await (0,i.YB)("SELECT role, content FROM messages WHERE session_id = $1 ORDER BY id ASC",[a]);if(0===c.length)return n.NextResponse.json({error:"Ingen dialog att bed\xf6ma \xe4nnu."},{status:400});let p=d.chapter_id?await (0,x.L1)(d.chapter_id,r.id):null;try{t=await (0,l.cd)((0,o.yl)({chapter:{title:p?.chapter.title??"Allm\xe4n medicin",courseTitle:p?.course.title??"L\xe4karprogrammet"},objective:p?.objectives.map(e=>`${e.code??""} ${e.title}`).join("\n")??null,transcript:c}),{temperature:.1,maxTokens:900})}catch(e){return n.NextResponse.json({error:e.message},{status:e.status??502})}let g={rating:k.includes(Number(t.rating))?Number(t.rating):2,confidence:Number(t.confidence)||.5,verdict:t.verdict??"",strengths:Array.isArray(t.strengths)?t.strengths.slice(0,4):[],gaps:Array.isArray(t.gaps)?t.gaps.slice(0,6):[],misconception:t.misconception??"",reference_answer:t.reference_answer??"",next_question:t.next_question??""};return await (0,i.Zy)(`UPDATE messages SET grade = $1
      WHERE id = (SELECT id FROM messages WHERE session_id = $2 AND role = 'assistant'
                   ORDER BY id DESC LIMIT 1)`,[JSON.stringify(g),a]),n.NextResponse.json({grade:g,chapterTitle:p?.chapter.title??null})}a()}catch(e){a(e)}})},8898:(e,t,r)=>{"use strict";r.d(t,{cd:()=>d,u2:()=>i,xD:()=>x});let a=process.env.DEEPSEEK_BASE_URL||"https://api.deepseek.com",n=process.env.DEEPSEEK_MODEL||"deepseek-chat",s=`${a.replace(/\/$/,"")}/v1/chat/completions`;function i(){return!!process.env.DEEPSEEK_API_KEY}class l extends Error{constructor(e,t=502){super(e),this.status=t}}function o(){let e=process.env.DEEPSEEK_API_KEY;if(!e)throw new l("DEEPSEEK_API_KEY saknas p\xe5 servern.",503);return{"Content-Type":"application/json",Authorization:`Bearer ${e}`}}async function x(e,t={}){let r=await fetch(s,{method:"POST",headers:o(),body:JSON.stringify({model:n,messages:e,stream:!0,temperature:t.temperature??.6,max_tokens:t.maxTokens??900})});if(!r.ok||!r.body){let e="";try{e=(await r.text()).slice(0,300)}catch{}throw new l(`AI-tj\xe4nsten svarade ${r.status}. ${e?`(${e})`:""}`.trim(),401===r.status?401:502)}return r}async function d(e,t={}){let r=await fetch(s,{method:"POST",headers:o(),body:JSON.stringify({model:n,messages:e,stream:!1,temperature:t.temperature??.2,max_tokens:t.maxTokens??900,response_format:{type:"json_object"}})});if(!r.ok)throw new l(`AI-tj\xe4nsten svarade ${r.status}.`,401===r.status?401:502);let a=await r.json(),i=a.choices?.[0]?.message?.content??"",x=i.indexOf("{"),c=i.lastIndexOf("}");if(-1===x||-1===c)throw new l("AI-svaret inneh\xf6ll ingen JSON.",502);try{return JSON.parse(i.slice(x,c+1))}catch{throw new l("Kunde inte tolka AI-svaret som JSON.",502)}}},6981:(e,t,r)=>{"use strict";r.d(t,{Ex:()=>l,dz:()=>p,et:()=>h,hk:()=>u,j5:()=>k,sI:()=>o,yl:()=>d});let a={sokratisk:{label:"Sokratisk coach",icon:"\uD83E\uDDE0",hint:"AI:n ger aldrig svaret direkt – en ledtr\xe5d i taget.",prefix:"[L\xc4GE: SOKRATISK COACH] St\xe4ll en fr\xe5ga i taget och l\xe5t mig formulera kunskapen sj\xe4lv."},tentagen:{label:"Tentagenerator",icon:"\uD83D\uDCDD",hint:"Kliniska vinjetter med A–E-alternativ och facit.",prefix:"[L\xc4GE: TENTAGENERATOR] Generera tentafr\xe5gor i flervalsformat med facit och f\xf6rklaringar."},koncept:{label:"Konceptgenomg\xe5ng",icon:"\uD83D\uDCD6",hint:"Fokuserad, mekanistisk f\xf6rklaring med klinisk p\xe4rla.",prefix:"[L\xc4GE: KONCEPTGENOMG\xc5NG] Ge en fokuserad, mekanistisk f\xf6rklaring med klinisk p\xe4rla."},kliniskt:{label:"Kliniskt fall",icon:"\uD83C\uDFE5",hint:"Du \xe4r jourhavande – st\xe4ll fr\xe5gor, best\xe4ll prover, st\xe4ll diagnos.",prefix:"[L\xc4GE: KLINISKT FALL] Spela upp ett fall d\xe4r jag \xe4r jourhavande l\xe4kare och m\xe5ste agera."}},n=`Du \xe4r Karolina – DrPluggs studiecoach f\xf6r l\xe4karprogrammet (Karolinska Institutet).
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
- H\xe5ll svaren korta. Vid breda \xe4mnen: fr\xe5ga vilken aspekt studenten vill ta f\xf6rst.`,s=`SOKRATISKA REGLER (g\xe4ller i detta l\xe4ge)
1. Ge aldrig hela svaret direkt. Kan studenten inte, ge EN ledtr\xe5d i taget i tre niv\xe5er:
   (1) peka p\xe5 r\xe4tt omr\xe5de, (2) ge halva kedjan, (3) ge f\xf6rsta steget och be studenten forts\xe4tta.
2. St\xe4ll EXAKT EN fr\xe5ga per svar – aldrig tv\xe5.
3. Max 70 ord per svar.
4. Har studenten fel: st\xe4ll en motfr\xe5ga som avsl\xf6jar felet ("Om X vore sant, vad skulle d\xe5 h\xe4nda med Y?")
   i st\xe4llet f\xf6r att r\xe4tta direkt.
5. Kr\xe4v till slut att studenten formulerar k\xe4rnan SJ\xc4LV med egna ord. F\xf6rst d\xe5 bekr\xe4ftar du.
6. Ge aldrig betyg eller po\xe4ng – bed\xf6mningen g\xf6rs i ett separat steg.`,i=`K\xc4LLGRUNDNING
- Finns K\xc4LLUTDRAG nedan: grunda varje sakp\xe5st\xe5ende i dem och h\xe4nvisa kort ("enligt ditt material: <rubrik>").
- T\xe4cker utdragen inte fr\xe5gan: s\xe4g det rakt ut och erbjud att svara fr\xe5n allm\xe4n kunskap.
- Hitta aldrig p\xe5 sidnummer, citat eller k\xe4llor.`;function l(e){let t=[n];if("sokratisk"===e.mode&&t.push(s),"tentagen"===e.mode&&t.push(`TENTAGENERATOR
- Skriv 5 fr\xe5gor som kliniska vinjetter (2–4 meningar) med 5 alternativ (A–E), ett r\xe4tt.
- Blanda sv\xe5righetsgrad. Facit och f\xf6rklaring l\xe4ggs EFTER alla fr\xe5gor under "## Facit".
- Varje fr\xe5ga ska pr\xf6va en mekanism eller ett prioriteringsbeslut – inte en definition.`),"koncept"===e.mode&&t.push(`KONCEPTGENOMG\xc5NG
- B\xf6rja enkelt, inf\xf6r sedan terminologin.
- Struktur: mekanism → klinisk bild → diagnostik → behandling → 🧠 minnesregel → klinisk p\xe4rla.`),"kliniskt"===e.mode&&t.push(`KLINISKT FALL
- Presentera en realistisk patient (\xe5lder, k\xf6n, anamnes, vitalparametrar, labb).
- Stanna d\xe4r och l\xe5t studenten best\xe4lla unders\xf6kningar. Avsl\xf6ja bara det som efterfr\xe5gas.
- Ge \xe5terkoppling p\xe5 varje steg: vad var rimligt, vad var farligt att missa.
- Avsluta f\xf6rst n\xe4r studenten st\xe4llt diagnos och f\xf6reslagit behandling (med motivering).`),e.chapter){let r=e.chapter.objectives?.length?`
L\xe4randem\xe5l:
- ${e.chapter.objectives.join("\n- ")}`:"";t.push(`AKTUELLT KAPITEL
Kurs: ${e.chapter.courseTitle}
Kapitel: ${e.chapter.chapterTitle}${e.chapter.summary?`
Sammanfattning: ${e.chapter.summary}`:""}${r}
H\xe5ll dig till kapitlets niv\xe5 och bygg vidare p\xe5 det studenten redan sett d\xe4r.`)}return t.push(i),e.snippets.length?t.push("K\xc4LLUTDRAG ur studentens eget material\n"+e.snippets.map((e,t)=>`[${t+1}] ${e.heading?e.heading+" \xb7 ":""}${e.chapterId??""}
${e.text}`).join("\n\n")):t.push("K\xc4LLUTDRAG: inga tillg\xe4ngliga – svara fr\xe5n allm\xe4n kurskunskap och var tydlig med det."),t.join("\n\n")}function o(e,t){return`${a[e].prefix}

${t}`}let x=`Du \xe4r examinator p\xe5 l\xe4karprogrammet (Karolinska Institutet).
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
- Svara ENDAST med JSON enligt schemat. All text p\xe5 svenska.`;function d(e){let t=e.transcript.map(e=>`${"assistant"===e.role?"COACH":"STUDENT"}: ${e.content}`).join("\n\n");return[{role:"system",content:x},{role:"user",content:`KAPITEL
${e.chapter.courseTitle} – ${e.chapter.title}

L\xc4RANDEM\xc5L
${e.objective||"(kapitlet som helhet)"}

DIALOGEN
${t||"(studenten gav inget svar)"}

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
}`}]}let c=`Du skriver flashcards f\xf6r l\xe4karstudenter. Korten ska tr\xe4na \xc5TERKALLNING, inte igenk\xe4nning.

REGLER
- Ett kort = ett faktum. Aldrig tv\xe5 fr\xe5gor i samma kort.
- Fram: max 25 ord, entydig fr\xe5ga. Ingen ledtr\xe5d.
- Bak: 1-3 meningar, exakt och korrekt, svensk terminologi + latinska begrepp.
- Prioritera mekanismer, orsak→verkan, skillnader mellan begrepp och kliniska kopplingar.
- Hitta inte p\xe5 siffror. R\xe4cker inte underlaget: skriv f\xe4rre kort.
- Svara ENDAST med JSON: {"cards":[{"front":"...","back":"..."}]}`;function p(e){let t=e.snippets.length?e.snippets.map((e,t)=>`[${t+1}] ${e.heading??""}
${e.text}`).join("\n\n---\n\n"):"(inget k\xe4llmaterial uppladdat – anv\xe4nd allm\xe4n kurskunskap p\xe5 l\xe4karprogrammet)";return[{role:"system",content:c},{role:"user",content:`KAPITEL
${e.chapter.courseTitle} – ${e.chapter.chapterTitle}
${e.chapter.summary??""}

L\xc4RANDEM\xc5L
${(e.chapter.objectives??[]).join("\n")||"(kapitlet som helhet)"}

K\xc4LLMATERIAL
${t}

Skriv ${e.count} kort i JSON-format.`}]}let g=`Du skriver tentafr\xe5gor f\xf6r l\xe4karprogrammet (Karolinska Institutet) utifr\xe5n kapitlets l\xe4randem\xe5l.

REGLER
- Skriv exakt det antal fr\xe5gor som efterfr\xe5gas, i JSON.
- Varje fr\xe5ga: klinisk vinjett eller resonemangsfr\xe5ga, fyra alternativ, exakt ett r\xe4tt.
- Pr\xf6va mekanism, prioritering eller differentialdiagnostik – inte trivia eller rena definitioner.
- F\xf6rklaringen ska s\xe4ga varf\xf6r r\xe4tt svar \xe4r r\xe4tt OCH varf\xf6r det vanligaste distraktionsalternativet \xe4r fel.
- Variera vilken position det r\xe4tta svaret har (0–3) mellan fr\xe5gorna.
- Hitta inte p\xe5 siffror, doser eller referenser. Bygg p\xe5 l\xe4randem\xe5len.
- Svara ENDAST med JSON: {"questions":[{"prompt":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"..."}]}`;function k(e){let t=e.snippets.length?e.snippets.map((e,t)=>`[${t+1}] ${e.heading??""}
${e.text}`).join("\n\n---\n\n"):"(inget eget k\xe4llmaterial – anv\xe4nd l\xe4randem\xe5len nedan)";return[{role:"system",content:g},{role:"user",content:`KAPITEL
${e.chapter.courseTitle} – ${e.chapter.chapterTitle}
${e.chapter.summary??""}

L\xc4RANDEM\xc5L
${(e.chapter.objectives??[]).join("\n")||"(kapitlet som helhet)"}

K\xc4LLMATERIAL
${t}

Skriv ${e.count} nya fr\xe5gor. JSON: {"questions":[{"prompt":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"..."}]}`}]}let m=`Du \xe4r examinator och faktagranskar flervalsfr\xe5gor som en AI just skrev till l\xe4karprogrammet.
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
Svara ENDAST med JSON: {"results":[{"index":0,"verdict":"ok"|"wrong","correctedAnswerIndex":null,"note":"kort motivering"}]}`;function u(e){let t=e.snippets.length?e.snippets.map((e,t)=>`[${t+1}] ${e.heading??""}
${e.text}`).join("\n\n---\n\n"):"(inget eget k\xe4llmaterial)";return[{role:"system",content:m},{role:"user",content:`L\xc4RANDEM\xc5L (${e.chapter.chapterTitle})
${(e.chapter.objectives??[]).join("\n")||"(kapitlet som helhet)"}

K\xc4LLMATERIAL
${t}

FR\xc5GOR ATT GRANSKA
${e.questions.map((e,t)=>`#${t}
Fr\xe5ga: ${e.prompt}
${e.options.map((t,r)=>`${r===e.answerIndex?"*":" "}${r}: ${t}`).join("\n")}
F\xf6rklaring: ${e.explanation}`).join("\n\n")}

Svara med JSON: {"results":[{"index":0,"verdict":"ok"|"wrong","correctedAnswerIndex":null,"note":"..."}]}`}]}let f=`Du skapar begreppspar f\xf6r ett memory-spel i medicin (l\xe4karprogrammet).
Varje par = ett BEGREPP och en kort DEFINITION.

REGLER
- Begreppet ska vara 1–4 ord (svensk term eller latinskt/grekiskt begrepp), t.ex. "Nefron", "Frank–Starling", "HLA klass II".
- Definitionen ska vara max 12 ord, entydig och korrekt.
- Paren ska h\xf6ra till modulen och vara s\xe5 olika varandra att de inte kan f\xf6rv\xe4xlas.
- Inga p\xe5hittade fakta, inga siffror du inte \xe4r s\xe4ker p\xe5.
- Svara ENDAST med JSON: {"pairs":[{"term":"...","definition":"..."}]}`;function h(e){return[{role:"system",content:f},{role:"user",content:`MODUL
${e.chapter.courseTitle} – ${e.chapter.chapterTitle}
${e.chapter.summary??""}

L\xc4RANDEM\xc5L
${(e.chapter.objectives??[]).slice(0,25).join("\n")||"(modulen som helhet)"}
${e.avoid.length?`
ANV\xc4ND INTE DESSA BEGREPP IGEN
${e.avoid.join(", ")}`:""}

Ge ${e.count} begreppspar som JSON.`}]}}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[1847,700,5452,3381,5665],()=>r(2516));module.exports=a})();