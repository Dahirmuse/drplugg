"use strict";exports.id=5665,exports.ids=[5665],exports.modules={7702:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.d(t,{BE:()=>w,Er:()=>m,HW:()=>g,VX:()=>h,Vs:()=>y,ht:()=>S,kg:()=>R,uW:()=>E,zF:()=>p});var i=a(733),s=a(4903),d=a(4512),n=a(6301),c=a(4926),o=a(7914),l=e([o]);function u(){let e=(process.env.JWT_SECRET||"").trim();if(e.length<32||e.toLowerCase().includes("byt-mig"))throw Error("JWT_SECRET \xe4r f\xf6r svag (minst 32 tecken, inte platsh\xe5llaren 'byt-mig'). Generera med: openssl rand -hex 32");return new TextEncoder().encode(e||"drplugg-dev-jwt-secret-change-in-production")}o=(l.then?(await l)():l)[0];let f="drplugg_token";function E(){return(process.env.ADMIN_EMAIL||"daahirmuse@gmail.com").toLowerCase().trim()}async function p(e){return new i.P({sub:e.id,email:e.email,role:e.role}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("30d").sign(u())}async function _(e){try{let{payload:t}=await (0,s.V)(e,u());return{id:t.sub,email:t.email,role:t.role??"student",displayName:null}}catch{return null}}let A=void 0!==process.env.COOKIE_SECURE?"true"===process.env.COOKIE_SECURE:"true"!==process.env.ALLOW_HTTP;async function h(e){(await (0,d.UL)()).set(f,e,{httpOnly:!0,secure:A,sameSite:"lax",maxAge:2592e3,path:"/"})}async function y(){(await (0,d.UL)()).set(f,"",{httpOnly:!0,secure:A,sameSite:"lax",maxAge:0,path:"/"})}let T="id, email, role, display_name";async function S(e){return(0,o.Zy)("SELECT id, email, password_hash, role, display_name, verified FROM users WHERE email = $1",[e.toLowerCase().trim()])}async function R(e,t){let a=e.toLowerCase().trim(),r=a===E()?"admin":"student",i=await (0,o.Zy)(`INSERT INTO users (email, password_hash, role, verified) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING ${T}`,[a,t,r,"admin"===r]);if(!i)throw Error("Kunde inte skapa anv\xe4ndare");return{id:i.id,email:i.email,role:i.role,displayName:i.display_name}}async function m(e){return c.Ay.hash(e,10)}async function w(e,t){return c.Ay.compare(e,t)}let g=(0,n.cache)(async()=>{let e=await (0,d.UL)(),t=e.get(f)?.value;if(!t)return null;let a=await _(t);if(!a)return null;let r=await (0,o.Zy)(`SELECT ${T} FROM users WHERE id = $1`,[a.id]);return r?{id:r.id,email:r.email,role:r.role,displayName:r.display_name}:null});r()}catch(e){r(e)}})},7914:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.d(t,{YB:()=>c,Zy:()=>n,g7:()=>o});var i=a(4939),s=e([i]);function d(){return global.__drpluggPool||(global.__drpluggPool=new i.Pool({host:process.env.PGHOST||"localhost",port:parseInt(process.env.PGPORT||"5432",10),database:process.env.PGDATABASE||"drplugg",user:process.env.PGUSER||"drplugg",password:function(){let e=(process.env.PGPASSWORD||"").trim();if(e.length<12||e.toLowerCase().includes("byt-mig")||e.toLowerCase()===(process.env.PGUSER||"drplugg").toLowerCase())throw Error("PGPASSWORD \xe4r f\xf6r svag eller en platsh\xe5llare – s\xe4tt ett unikt l\xf6senord i .env.local.");return e||"drplugg"}(),max:10,idleTimeoutMillis:3e4})),global.__drpluggPool}async function n(e,t){let{rows:a}=await d().query(e,t);return a[0]??null}async function c(e,t){let{rows:a}=await d().query(e,t);return a}async function o(e,t){return(await d().query(e,t)).rowCount??0}i=(s.then?(await s)():s)[0],r()}catch(e){r(e)}})},1248:(e,t,a)=>{a.d(t,{_:()=>n,dF:()=>c,ee:()=>d});var r=a(3381);let i=Number(process.env.FSRS_RETENTION||.9),s=(0,r.$F)((0,r.KJ)({request_retention:i,maximum_interval:1095,enable_fuzz:!0,w:function(){let e=process.env.FSRS_W;if(!e)return;let t=e.split(",").map(e=>Number(e.trim()));return t.every(e=>Number.isFinite(e))&&19===t.length?t:void 0}()}));function d(e){return{due:new Date(e.due),stability:e.stability,difficulty:e.difficulty,elapsed_days:e.elapsed_days,scheduled_days:e.scheduled_days,reps:e.reps,lapses:e.lapses,state:e.state??r.Uw.New,last_review:e.last_review?new Date(e.last_review):void 0}}function n(e,t){let a=new Date,r=s.repeat(e,a),i=r[t].card;return{card:i,log:r[t].log,due:i.due.toISOString(),stability:i.stability,difficulty:i.difficulty,elapsedDays:i.elapsed_days,scheduledDays:i.scheduled_days,reps:i.reps,lapses:i.lapses,state:i.state,lastReview:(i.last_review??a).toISOString()}}function c(e){let t=new Date,a=s.repeat(e,t);return{1:Math.max(0,Math.round(o(t,a[r.GW.Again].card.due))),2:Math.max(0,Math.round(o(t,a[r.GW.Hard].card.due))),3:Math.max(0,Math.round(o(t,a[r.GW.Good].card.due))),4:Math.max(0,Math.round(o(t,a[r.GW.Easy].card.due)))}}function o(e,t){return(t.getTime()-e.getTime())/864e5}r.GW.Again,r.GW.Hard,r.GW.Good,r.GW.Easy},1952:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.d(t,{$S:()=>o,AU:()=>p,E0:()=>c,GT:()=>m,Iu:()=>N,L1:()=>l,Lg:()=>u,Vt:()=>v,W2:()=>g,Xe:()=>y,Zp:()=>D,aV:()=>L,c9:()=>_,fl:()=>n,gS:()=>$,ho:()=>R,kd:()=>C,q7:()=>A,rB:()=>O,wJ:()=>T,wo:()=>E,z0:()=>f,zY:()=>S});var i=a(7914),s=a(1248),d=e([i]);async function n(e){return(0,i.YB)(`SELECT c.id, c.code, c.title, c.term, c.description, c.icon, c.color,
            c.sort_order AS "sortOrder",
            (SELECT count(*) FROM chapters ch WHERE ch.course_id = c.id)::int AS chapters,
            (SELECT count(*) FROM chapters ch
               JOIN chapter_progress cp ON cp.chapter_id = ch.id AND cp.user_id = $1
              WHERE ch.course_id = c.id AND cp.status IN ('completed','mastered'))::int AS completed
       FROM courses c
      WHERE c.archived = false
      ORDER BY c.sort_order, c.code`,[e])}async function c(e){return(0,i.Zy)(`SELECT id, code, title, term, description, icon, color, sort_order AS "sortOrder"
       FROM courses WHERE id = $1`,[e])}async function o(e,t){return(0,i.YB)(`SELECT ch.id, ch.course_id AS "courseId", ch.code, ch.title, ch.summary,
            ch.est_minutes AS "estMinutes", ch.sort_order AS "sortOrder",
            (SELECT count(*) FROM objectives o WHERE o.chapter_id = ch.id)::int AS "objectiveCount",
            (SELECT count(*) FROM recall_items r WHERE r.chapter_id = ch.id)::int AS "recallCount",
            (SELECT count(*) FROM chapter_cards cc WHERE cc.chapter_id = ch.id)::int AS "cardCount",
            cp.status,
            COALESCE(cp.recall_right, 0) AS "recallRight",
            COALESCE(cp.recall_total, 0) AS "recallTotal"
       FROM chapters ch
       LEFT JOIN chapter_progress cp ON cp.chapter_id = ch.id AND cp.user_id = $2
      WHERE ch.course_id = $1 AND ch.archived = false
      ORDER BY ch.sort_order, ch.id`,[e,t])}async function l(e,t){let a=await (0,i.Zy)(`SELECT id, course_id AS "courseId", code, title, summary,
            est_minutes AS "estMinutes", sort_order AS "sortOrder",
            facts, ninja_topics AS "ninjaTopics", sections
       FROM chapters WHERE id = $1`,[e]);if(!a)return null;let r=await c(a.courseId);if(!r)return null;let s=await (0,i.YB)(`SELECT id, chapter_id AS "chapterId", code, title, level, sort_order AS "sortOrder"
       FROM objectives WHERE chapter_id = $1 ORDER BY sort_order, code`,[e]),d=await (0,i.YB)(`SELECT id, chapter_id AS "chapterId", kind, prompt, options, answer,
            explanation, difficulty, sort_order AS "sortOrder"
       FROM recall_items WHERE chapter_id = $1 ORDER BY sort_order, id`,[e]),n=await (0,i.YB)(`SELECT front, back, COALESCE(origin, 'kapitel') AS origin
       FROM chapter_cards WHERE chapter_id = $1 ORDER BY sort_order, id`,[e]),o=await (0,i.Zy)("SELECT status FROM chapter_progress WHERE user_id = $1 AND chapter_id = $2",[t,e]);return{chapter:a,course:r,objectives:s,recall:d,cards:n,status:o?.status??null}}async function u(e,t,a){await (0,i.g7)(`INSERT INTO chapter_progress (user_id, chapter_id, status, recall_right, recall_total)
     VALUES ($1, $2, 'started', $3, 1)
     ON CONFLICT (user_id, chapter_id) DO UPDATE
       SET recall_right = chapter_progress.recall_right + $3,
           recall_total = chapter_progress.recall_total + 1,
           updated_at = now()`,[e,t,a?1:0])}async function E(e,t,a){await (0,i.g7)(`INSERT INTO chapter_progress (user_id, chapter_id, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, chapter_id) DO UPDATE
       SET status = CASE
             WHEN chapter_progress.status = 'mastered' THEN 'mastered'
             WHEN $3 = 'started' THEN chapter_progress.status
             WHEN chapter_progress.status = 'completed' AND $3 = 'completed' THEN 'completed'
             ELSE $3 END,
           updated_at = now()`,[e,t,a])}async function p(e,t){return await (0,i.g7)(`INSERT INTO flashcards (user_id, chapter_id, front, back, origin)
     SELECT $1, cc.chapter_id, cc.front, cc.back, 'kapitel'
       FROM chapter_cards cc
      WHERE cc.chapter_id = $2
     ON CONFLICT (user_id, chapter_id, front) DO NOTHING`,[e,t])}async function _(e,t=30){return(0,i.YB)(`SELECT id, chapter_id AS "chapterId", front, back, origin, due, state, reps, lapses,
            scheduled_days AS "scheduledDays", stability, difficulty,
            last_review AS "lastReview"
       FROM flashcards
      WHERE user_id = $1 AND status = 'active' AND due <= now()
      ORDER BY due ASC
      LIMIT $2`,[e,t])}async function h(e,t){return(0,i.Zy)(`SELECT id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses,
            state, last_review
       FROM flashcards WHERE id = $1 AND user_id = $2`,[t,e])}async function y(e,t,a,r={}){let d=await h(e,t);if(!d)throw Error("Kortet finns inte");let n=(0,s.ee)(d),c=(0,s._)(n,a);return await (0,i.g7)(`UPDATE flashcards
        SET due = $2, stability = $3, difficulty = $4, elapsed_days = $5,
            scheduled_days = $6, reps = $7, lapses = $8, state = $9, last_review = $10
      WHERE id = $1 AND user_id = $11`,[t,c.due,c.stability,c.difficulty,c.elapsedDays,c.scheduledDays,c.reps,c.lapses,c.state,c.lastReview,e]),await (0,i.g7)(`INSERT INTO review_logs (user_id, card_id, chapter_id, rating, source, elapsed_ms, note)
     SELECT $1, f.id, f.chapter_id, $3, $4, $5, $6 FROM flashcards f WHERE f.id = $2`,[e,t,a,r.source??"sjalv",r.elapsedMs??null,r.note??null]),{stored:c,preview:(0,s.dF)(c.card)}}async function S(e,t){let a=await (0,i.Zy)(`INSERT INTO flashcards (user_id, chapter_id, front, back, origin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, chapter_id AS "chapterId", front, back, origin, due, state, reps, lapses,
               scheduled_days AS "scheduledDays", stability, difficulty,
               last_review AS "lastReview"`,[e,t.chapterId??null,t.front,t.back,t.origin??"egen"]);if(!a)throw Error("Kunde inte skapa kortet");return a}async function R(e,t){let a=await h(t,e);return a?(0,s.dF)((0,s.ee)(a)):null}async function m(e){let t=async(e,t=[])=>await (0,i.Zy)(e,t),a=await t(`SELECT
       count(*) FILTER (WHERE status='active' AND due <= now())::int AS due,
       count(*) FILTER (WHERE status='active')::int AS total,
       count(*) FILTER (WHERE status='active' AND state = 0)::int AS fresh,
       count(*) FILTER (WHERE status='active' AND state = 2 AND scheduled_days >= 21)::int AS mature
     FROM flashcards WHERE user_id = $1`,[e]),r=await t(`SELECT count(*)::int AS n FROM review_logs
      WHERE user_id = $1 AND reviewed_at >= date_trunc('day', now())`,[e]),s=await t(`SELECT count(*)::int AS n FROM review_logs
      WHERE user_id = $1 AND reviewed_at >= now() - interval '7 days'`,[e]),d=await t(`SELECT avg(CASE WHEN rating >= 3 THEN 1.0 ELSE 0.0 END)::float AS r
       FROM review_logs WHERE user_id = $1 AND reviewed_at >= now() - interval '30 days'`,[e]),n=await t(`SELECT
       count(*)::int AS started,
       count(*) FILTER (WHERE status IN ('completed','mastered'))::int AS completed
     FROM chapter_progress WHERE user_id = $1`,[e]),c=await t(`SELECT (CASE WHEN sum(recall_total) > 0
                  THEN sum(recall_right)::float / sum(recall_total) ELSE NULL END) AS a
       FROM chapter_progress WHERE user_id = $1`,[e]),o=await t(`SELECT COALESCE((SELECT points FROM daily_activity
                       WHERE user_id = $1 AND day = current_date), 0)::int AS today,
            COALESCE((SELECT sum(points) FROM daily_activity WHERE user_id = $1), 0)::int AS total`,[e]),l=await (0,i.YB)(`SELECT to_char(d.day, 'Dy') AS label,
            (SELECT count(*) FROM flashcards f
              WHERE f.user_id = $1 AND f.status='active'
                AND f.due >= d.day AND f.due < d.day + interval '1 day')::int AS count
       FROM generate_series(date_trunc('day', now()), date_trunc('day', now()) + interval '6 days', interval '1 day') AS d(day)`,[e]),u=await (0,i.YB)(`SELECT to_char(d.day, 'DD/MM') AS label,
            (SELECT count(*) FROM review_logs r
              WHERE r.user_id = $1 AND r.reviewed_at >= d.day AND r.reviewed_at < d.day + interval '1 day')::int AS count,
            (SELECT count(*) FROM review_logs r
              WHERE r.user_id = $1 AND r.reviewed_at >= d.day AND r.reviewed_at < d.day + interval '1 day'
                AND r.rating >= 3)::int AS good
       FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') AS d(day)`,[e]),E=await w(e);return{dueNow:a.due,totalCards:a.total,newCards:a.fresh,mature:a.mature,reviewsToday:r.n,reviews7d:s.n,retention30:null===d.r?null:Number(d.r),accuracy:null===c.a?null:Number(c.a),chaptersStarted:n.started,chaptersCompleted:n.completed,pointsToday:o.today,totalPoints:o.total,forecast:l,history:u,streak:E.current,longestStreak:E.longest}}async function w(e){let t=await (0,i.YB)(`SELECT d.day::text AS day
       FROM (SELECT day FROM daily_activity WHERE user_id = $1
             UNION SELECT date_trunc('day', reviewed_at)::date FROM review_logs WHERE user_id = $1) d
      WHERE d.day IS NOT NULL
      ORDER BY d.day DESC
      LIMIT 400`,[e]);if(0===t.length)return{current:0,longest:0};let a=new Set(t.map(e=>e.day.slice(0,10))),r=e=>e.toISOString().slice(0,10),s=new Date,d=new Date(Date.now()-864e5),n=0,c=a.has(r(s))?s:a.has(r(d))?d:null;for(;c&&a.has(r(c));)n+=1,c=new Date(c.getTime()-864e5);let o=[...a].sort(),l=0,u=0,E=null;for(let e of o){if(E){let t=(new Date(e).getTime()-new Date(E).getTime())/864e5;u=1===t?u+1:1}else u=1;l=Math.max(l,u),E=e}return{current:n,longest:l}}async function f(e,t){t<=0||await (0,i.g7)(`INSERT INTO daily_activity (user_id, day, points) VALUES ($1, current_date, $2)
     ON CONFLICT (user_id, day) DO UPDATE SET points = daily_activity.points + $2`,[e,t])}async function A(e,t){await (0,i.g7)(`INSERT INTO game_attempts (user_id, game, chapter_id, score, max_score, duration_ms, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,[e,t.game,t.chapterId??null,t.score,t.maxScore,t.durationMs??null,t.detail?JSON.stringify(t.detail):null]),await f(e,Math.max(1,Math.round(t.score)))}async function T(e){return(0,i.YB)(`SELECT game, max(score)::int AS best, count(*)::int AS plays
       FROM game_attempts WHERE user_id = $1 GROUP BY game`,[e])}async function g(e,t=10){return(0,i.YB)(`SELECT u.email, u.display_name AS "displayName",
            max(g.score)::int AS best, count(*)::int AS plays
       FROM game_attempts g
       JOIN users u ON u.id = g.user_id
      WHERE g.game = $1
      GROUP BY u.id, u.email, u.display_name
      ORDER BY best DESC, plays ASC
      LIMIT $2`,[e,t])}async function O(e={}){let t=e.limit??10,a=await (0,i.YB)(`SELECT r.id, r.chapter_id, ch.title AS chapter_title, r.prompt, r.options, r.answer,
            r.explanation, r.kind
       FROM recall_items r
       JOIN chapters ch ON ch.id = r.chapter_id
      WHERE ($1::text IS NULL OR r.chapter_id = $1)
        AND ($2::text IS NULL OR ch.course_id = $2)
        AND ch.archived = false
      ORDER BY ${!1===e.random?"r.sort_order":"random()"}
      LIMIT $3`,[e.chapterId??null,e.courseId??null,t]),r=[];for(let e of a)if("mcq"===e.kind&&Array.isArray(e.options)&&e.options.length>=2){let t=e.options.findIndex(t=>t===e.answer);t>=0&&r.push({id:e.id,chapterId:e.chapter_id,chapterTitle:e.chapter_title,prompt:e.prompt,options:e.options,answerIndex:t,explanation:e.explanation})}return r}async function N(e){return(0,i.YB)(`SELECT d.id::text AS id, d.name, d.kind, d.chars, d.added_at AS "addedAt",
            (SELECT count(*) FROM doc_chunks c WHERE c.doc_id = d.id)::int AS chunks
       FROM docs d WHERE d.user_id = $1 ORDER BY d.added_at DESC`,[e])}async function $(e,t,a,r){let s=await (0,i.Zy)("INSERT INTO docs (user_id, name, kind, chars) VALUES ($1, $2, $3, $4) RETURNING id::text AS id",[e,t,a,r]);if(!s)throw Error("Kunde inte spara dokumentet");return s.id}async function L(e,t,a){for(let r=0;r<a.length;r++)await (0,i.g7)("INSERT INTO doc_chunks (doc_id, chapter_id, heading, ord, text) VALUES ($1,$2,$3,$4,$5)",[e,t,a[r].heading,r,a[r].text])}async function C(e,t){await (0,i.g7)("DELETE FROM docs WHERE id = $1 AND user_id = $2",[t,e])}async function v(e){let t=await (0,i.Zy)("SELECT count(*)::int AS n FROM recall_items WHERE chapter_id = $1 AND origin = 'ai'",[e]);return t?.n??0}async function D(e,t){if(0===t.length)return 0;let a=await (0,i.Zy)("SELECT COALESCE(max(sort_order), 0)::int AS max FROM recall_items WHERE chapter_id = $1",[e]),r=a?.max??0,s=0;for(let a of t){let t=a.options[a.answerIndex];t&&(r++,!await (0,i.Zy)("SELECT id FROM recall_items WHERE chapter_id = $1 AND lower(prompt) = lower($2) LIMIT 1",[e,a.prompt.slice(0,400)])&&(await (0,i.g7)(`INSERT INTO recall_items
         (id, chapter_id, kind, prompt, options, answer, explanation, difficulty, sort_order, origin, fact_checked)
       VALUES ($1,$2,'mcq',$3,$4,$5,$6,2,$7,'ai',true)`,[`ai-${e}-${crypto.randomUUID().slice(0,8)}`,e,a.prompt,JSON.stringify(a.options),t,a.explanation,r]),s++))}return s}i=(d.then?(await d)():d)[0],r()}catch(e){r(e)}})}};