"use strict";exports.id=9073,exports.ids=[9073],exports.modules={35450:(a,b,c)=>{c.d(b,{_:()=>h,dF:()=>i,ee:()=>g});var d=c(32023);let e=Number(process.env.FSRS_RETENTION||.9),f=(0,d.$F)((0,d.KJ)({request_retention:e,maximum_interval:1095,enable_fuzz:!0,w:function(){let a=process.env.FSRS_W;if(!a)return;let b=a.split(",").map(a=>Number(a.trim()));return b.every(a=>Number.isFinite(a))&&19===b.length?b:void 0}()}));function g(a){return{due:new Date(a.due),stability:a.stability,difficulty:a.difficulty,elapsed_days:a.elapsed_days,scheduled_days:a.scheduled_days,reps:a.reps,lapses:a.lapses,state:a.state??d.Uw.New,last_review:a.last_review?new Date(a.last_review):void 0}}function h(a,b){let c=new Date,d=f.repeat(a,c),e=d[b].card;return{card:e,log:d[b].log,due:e.due.toISOString(),stability:e.stability,difficulty:e.difficulty,elapsedDays:e.elapsed_days,scheduledDays:e.scheduled_days,reps:e.reps,lapses:e.lapses,state:e.state,lastReview:(e.last_review??c).toISOString()}}function i(a){let b=new Date,c=f.repeat(a,b);return{1:Math.max(0,Math.round(j(b,c[d.GW.Again].card.due))),2:Math.max(0,Math.round(j(b,c[d.GW.Hard].card.due))),3:Math.max(0,Math.round(j(b,c[d.GW.Good].card.due))),4:Math.max(0,Math.round(j(b,c[d.GW.Easy].card.due)))}}function j(a,b){return(b.getTime()-a.getTime())/864e5}d.GW.Again,d.GW.Hard,d.GW.Good,d.GW.Easy},35552:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{YB:()=>i,Zy:()=>h,g7:()=>j});var e=c(64939),f=a([e]);function g(){return global.__drpluggPool||(global.__drpluggPool=new e.Pool({host:process.env.PGHOST||"localhost",port:parseInt(process.env.PGPORT||"5432",10),database:process.env.PGDATABASE||"drplugg",user:process.env.PGUSER||"drplugg",password:function(){let a=(process.env.PGPASSWORD||"").trim();if(a.length<12||a.toLowerCase().includes("byt-mig")||a.toLowerCase()===(process.env.PGUSER||"drplugg").toLowerCase())throw Error("PGPASSWORD \xe4r f\xf6r svag eller en platsh\xe5llare – s\xe4tt ett unikt l\xf6senord i .env.local.");return a||"drplugg"}(),max:10,idleTimeoutMillis:3e4})),global.__drpluggPool}async function h(a,b){let{rows:c}=await g().query(a,b);return c[0]??null}async function i(a,b){let{rows:c}=await g().query(a,b);return c}async function j(a,b){return(await g().query(a,b)).rowCount??0}e=(f.then?(await f)():f)[0],d()}catch(a){d(a)}})},49706:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{$S:()=>j,AU:()=>n,E0:()=>i,GT:()=>t,Iu:()=>A,L1:()=>k,Lg:()=>l,Vt:()=>E,W2:()=>y,Xe:()=>q,Zp:()=>F,aV:()=>C,c9:()=>o,fl:()=>h,gS:()=>B,ho:()=>s,kd:()=>D,q7:()=>w,rB:()=>z,wJ:()=>x,wo:()=>m,z0:()=>v,zY:()=>r});var e=c(35552),f=c(35450),g=a([e]);async function h(a){return(0,e.YB)(`SELECT c.id, c.code, c.title, c.term, c.description, c.icon, c.color,
            c.sort_order AS "sortOrder",
            (SELECT count(*) FROM chapters ch WHERE ch.course_id = c.id)::int AS chapters,
            (SELECT count(*) FROM chapters ch
               JOIN chapter_progress cp ON cp.chapter_id = ch.id AND cp.user_id = $1
              WHERE ch.course_id = c.id AND cp.status IN ('completed','mastered'))::int AS completed
       FROM courses c
      WHERE c.archived = false
      ORDER BY c.sort_order, c.code`,[a])}async function i(a){return(0,e.Zy)(`SELECT id, code, title, term, description, icon, color, sort_order AS "sortOrder"
       FROM courses WHERE id = $1`,[a])}async function j(a,b){return(0,e.YB)(`SELECT ch.id, ch.course_id AS "courseId", ch.code, ch.title, ch.summary,
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
      ORDER BY ch.sort_order, ch.id`,[a,b])}async function k(a,b){let c=await (0,e.Zy)(`SELECT id, course_id AS "courseId", code, title, summary,
            est_minutes AS "estMinutes", sort_order AS "sortOrder",
            facts, ninja_topics AS "ninjaTopics", sections
       FROM chapters WHERE id = $1`,[a]);if(!c)return null;let d=await i(c.courseId);if(!d)return null;let f=await (0,e.YB)(`SELECT id, chapter_id AS "chapterId", code, title, level, sort_order AS "sortOrder"
       FROM objectives WHERE chapter_id = $1 ORDER BY sort_order, code`,[a]),g=await (0,e.YB)(`SELECT id, chapter_id AS "chapterId", kind, prompt, options, answer,
            explanation, difficulty, sort_order AS "sortOrder"
       FROM recall_items WHERE chapter_id = $1 ORDER BY sort_order, id`,[a]),h=await (0,e.YB)(`SELECT front, back, COALESCE(origin, 'kapitel') AS origin
       FROM chapter_cards WHERE chapter_id = $1 ORDER BY sort_order, id`,[a]),j=await (0,e.Zy)("SELECT status FROM chapter_progress WHERE user_id = $1 AND chapter_id = $2",[b,a]);return{chapter:c,course:d,objectives:f,recall:g,cards:h,status:j?.status??null}}async function l(a,b,c){await (0,e.g7)(`INSERT INTO chapter_progress (user_id, chapter_id, status, recall_right, recall_total)
     VALUES ($1, $2, 'started', $3, 1)
     ON CONFLICT (user_id, chapter_id) DO UPDATE
       SET recall_right = chapter_progress.recall_right + $3,
           recall_total = chapter_progress.recall_total + 1,
           updated_at = now()`,[a,b,+!!c])}async function m(a,b,c){await (0,e.g7)(`INSERT INTO chapter_progress (user_id, chapter_id, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, chapter_id) DO UPDATE
       SET status = CASE
             WHEN chapter_progress.status = 'mastered' THEN 'mastered'
             WHEN $3 = 'started' THEN chapter_progress.status
             WHEN chapter_progress.status = 'completed' AND $3 = 'completed' THEN 'completed'
             ELSE $3 END,
           updated_at = now()`,[a,b,c])}async function n(a,b){return await (0,e.g7)(`INSERT INTO flashcards (user_id, chapter_id, front, back, origin)
     SELECT $1, cc.chapter_id, cc.front, cc.back, 'kapitel'
       FROM chapter_cards cc
      WHERE cc.chapter_id = $2
     ON CONFLICT (user_id, chapter_id, front) DO NOTHING`,[a,b])}async function o(a,b=30){return(0,e.YB)(`SELECT id, chapter_id AS "chapterId", front, back, origin, due, state, reps, lapses,
            scheduled_days AS "scheduledDays", stability, difficulty,
            last_review AS "lastReview"
       FROM flashcards
      WHERE user_id = $1 AND status = 'active' AND due <= now()
      ORDER BY due ASC
      LIMIT $2`,[a,b])}async function p(a,b){return(0,e.Zy)(`SELECT id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses,
            state, last_review
       FROM flashcards WHERE id = $1 AND user_id = $2`,[b,a])}async function q(a,b,c,d={}){let g=await p(a,b);if(!g)throw Error("Kortet finns inte");let h=(0,f.ee)(g),i=(0,f._)(h,c);return await (0,e.g7)(`UPDATE flashcards
        SET due = $2, stability = $3, difficulty = $4, elapsed_days = $5,
            scheduled_days = $6, reps = $7, lapses = $8, state = $9, last_review = $10
      WHERE id = $1 AND user_id = $11`,[b,i.due,i.stability,i.difficulty,i.elapsedDays,i.scheduledDays,i.reps,i.lapses,i.state,i.lastReview,a]),await (0,e.g7)(`INSERT INTO review_logs (user_id, card_id, chapter_id, rating, source, elapsed_ms, note)
     SELECT $1, f.id, f.chapter_id, $3, $4, $5, $6 FROM flashcards f WHERE f.id = $2`,[a,b,c,d.source??"sjalv",d.elapsedMs??null,d.note??null]),{stored:i,preview:(0,f.dF)(i.card)}}async function r(a,b){let c=await (0,e.Zy)(`INSERT INTO flashcards (user_id, chapter_id, front, back, origin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, chapter_id AS "chapterId", front, back, origin, due, state, reps, lapses,
               scheduled_days AS "scheduledDays", stability, difficulty,
               last_review AS "lastReview"`,[a,b.chapterId??null,b.front,b.back,b.origin??"egen"]);if(!c)throw Error("Kunde inte skapa kortet");return c}async function s(a,b){let c=await p(b,a);return c?(0,f.dF)((0,f.ee)(c)):null}async function t(a){let b=async(a,b=[])=>await (0,e.Zy)(a,b),c=await b(`SELECT
       count(*) FILTER (WHERE status='active' AND due <= now())::int AS due,
       count(*) FILTER (WHERE status='active')::int AS total,
       count(*) FILTER (WHERE status='active' AND state = 0)::int AS fresh,
       count(*) FILTER (WHERE status='active' AND state = 2 AND scheduled_days >= 21)::int AS mature
     FROM flashcards WHERE user_id = $1`,[a]),d=await b(`SELECT count(*)::int AS n FROM review_logs
      WHERE user_id = $1 AND reviewed_at >= date_trunc('day', now())`,[a]),f=await b(`SELECT count(*)::int AS n FROM review_logs
      WHERE user_id = $1 AND reviewed_at >= now() - interval '7 days'`,[a]),g=await b(`SELECT avg(CASE WHEN rating >= 3 THEN 1.0 ELSE 0.0 END)::float AS r
       FROM review_logs WHERE user_id = $1 AND reviewed_at >= now() - interval '30 days'`,[a]),h=await b(`SELECT
       count(*)::int AS started,
       count(*) FILTER (WHERE status IN ('completed','mastered'))::int AS completed
     FROM chapter_progress WHERE user_id = $1`,[a]),i=await b(`SELECT (CASE WHEN sum(recall_total) > 0
                  THEN sum(recall_right)::float / sum(recall_total) ELSE NULL END) AS a
       FROM chapter_progress WHERE user_id = $1`,[a]),j=await b(`SELECT COALESCE((SELECT points FROM daily_activity
                       WHERE user_id = $1 AND day = current_date), 0)::int AS today,
            COALESCE((SELECT sum(points) FROM daily_activity WHERE user_id = $1), 0)::int AS total`,[a]),k=await (0,e.YB)(`SELECT to_char(d.day, 'Dy') AS label,
            (SELECT count(*) FROM flashcards f
              WHERE f.user_id = $1 AND f.status='active'
                AND f.due >= d.day AND f.due < d.day + interval '1 day')::int AS count
       FROM generate_series(date_trunc('day', now()), date_trunc('day', now()) + interval '6 days', interval '1 day') AS d(day)`,[a]),l=await (0,e.YB)(`SELECT to_char(d.day, 'DD/MM') AS label,
            (SELECT count(*) FROM review_logs r
              WHERE r.user_id = $1 AND r.reviewed_at >= d.day AND r.reviewed_at < d.day + interval '1 day')::int AS count,
            (SELECT count(*) FROM review_logs r
              WHERE r.user_id = $1 AND r.reviewed_at >= d.day AND r.reviewed_at < d.day + interval '1 day'
                AND r.rating >= 3)::int AS good
       FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') AS d(day)`,[a]),m=await u(a);return{dueNow:c.due,totalCards:c.total,newCards:c.fresh,mature:c.mature,reviewsToday:d.n,reviews7d:f.n,retention30:null===g.r?null:Number(g.r),accuracy:null===i.a?null:Number(i.a),chaptersStarted:h.started,chaptersCompleted:h.completed,pointsToday:j.today,totalPoints:j.total,forecast:k,history:l,streak:m.current,longestStreak:m.longest}}async function u(a){let b=await (0,e.YB)(`SELECT d.day::text AS day
       FROM (SELECT day FROM daily_activity WHERE user_id = $1
             UNION SELECT date_trunc('day', reviewed_at)::date FROM review_logs WHERE user_id = $1) d
      WHERE d.day IS NOT NULL
      ORDER BY d.day DESC
      LIMIT 400`,[a]);if(0===b.length)return{current:0,longest:0};let c=new Set(b.map(a=>a.day.slice(0,10))),d=a=>a.toISOString().slice(0,10),f=new Date,g=new Date(Date.now()-864e5),h=0,i=c.has(d(f))?f:c.has(d(g))?g:null;for(;i&&c.has(d(i));)h+=1,i=new Date(i.getTime()-864e5);let j=[...c].sort(),k=0,l=0,m=null;for(let a of j){if(m){let b=(new Date(a).getTime()-new Date(m).getTime())/864e5;l=1===b?l+1:1}else l=1;k=Math.max(k,l),m=a}return{current:h,longest:k}}async function v(a,b){b<=0||await (0,e.g7)(`INSERT INTO daily_activity (user_id, day, points) VALUES ($1, current_date, $2)
     ON CONFLICT (user_id, day) DO UPDATE SET points = daily_activity.points + $2`,[a,b])}async function w(a,b){await (0,e.g7)(`INSERT INTO game_attempts (user_id, game, chapter_id, score, max_score, duration_ms, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,[a,b.game,b.chapterId??null,b.score,b.maxScore,b.durationMs??null,b.detail?JSON.stringify(b.detail):null]),await v(a,Math.max(1,Math.round(b.score)))}async function x(a){return(0,e.YB)(`SELECT game, max(score)::int AS best, count(*)::int AS plays
       FROM game_attempts WHERE user_id = $1 GROUP BY game`,[a])}async function y(a,b=10){return(0,e.YB)(`SELECT u.email, u.display_name AS "displayName",
            max(g.score)::int AS best, count(*)::int AS plays
       FROM game_attempts g
       JOIN users u ON u.id = g.user_id
      WHERE g.game = $1
      GROUP BY u.id, u.email, u.display_name
      ORDER BY best DESC, plays ASC
      LIMIT $2`,[a,b])}async function z(a={}){let b=a.limit??10,c=await (0,e.YB)(`SELECT r.id, r.chapter_id, ch.title AS chapter_title, r.prompt, r.options, r.answer,
            r.explanation, r.kind
       FROM recall_items r
       JOIN chapters ch ON ch.id = r.chapter_id
      WHERE ($1::text IS NULL OR r.chapter_id = $1)
        AND ($2::text IS NULL OR ch.course_id = $2)
        AND ch.archived = false
      ORDER BY ${!1===a.random?"r.sort_order":"random()"}
      LIMIT $3`,[a.chapterId??null,a.courseId??null,b]),d=[];for(let a of c)if("mcq"===a.kind&&Array.isArray(a.options)&&a.options.length>=2){let b=a.options.findIndex(b=>b===a.answer);b>=0&&d.push({id:a.id,chapterId:a.chapter_id,chapterTitle:a.chapter_title,prompt:a.prompt,options:a.options,answerIndex:b,explanation:a.explanation})}return d}async function A(a){return(0,e.YB)(`SELECT d.id::text AS id, d.name, d.kind, d.chars, d.added_at AS "addedAt",
            (SELECT count(*) FROM doc_chunks c WHERE c.doc_id = d.id)::int AS chunks
       FROM docs d WHERE d.user_id = $1 ORDER BY d.added_at DESC`,[a])}async function B(a,b,c,d){let f=await (0,e.Zy)("INSERT INTO docs (user_id, name, kind, chars) VALUES ($1, $2, $3, $4) RETURNING id::text AS id",[a,b,c,d]);if(!f)throw Error("Kunde inte spara dokumentet");return f.id}async function C(a,b,c){for(let d=0;d<c.length;d++)await (0,e.g7)("INSERT INTO doc_chunks (doc_id, chapter_id, heading, ord, text) VALUES ($1,$2,$3,$4,$5)",[a,b,c[d].heading,d,c[d].text])}async function D(a,b){await (0,e.g7)("DELETE FROM docs WHERE id = $1 AND user_id = $2",[b,a])}async function E(a){let b=await (0,e.Zy)("SELECT count(*)::int AS n FROM recall_items WHERE chapter_id = $1 AND origin = 'ai'",[a]);return b?.n??0}async function F(a,b){if(0===b.length)return 0;let c=await (0,e.Zy)("SELECT COALESCE(max(sort_order), 0)::int AS max FROM recall_items WHERE chapter_id = $1",[a]),d=c?.max??0,f=0;for(let c of b){let b=c.options[c.answerIndex];b&&(d++,!await (0,e.Zy)("SELECT id FROM recall_items WHERE chapter_id = $1 AND lower(prompt) = lower($2) LIMIT 1",[a,c.prompt.slice(0,400)])&&(await (0,e.g7)(`INSERT INTO recall_items
         (id, chapter_id, kind, prompt, options, answer, explanation, difficulty, sort_order, origin, fact_checked)
       VALUES ($1,$2,'mcq',$3,$4,$5,$6,2,$7,'ai',true)`,[`ai-${a}-${crypto.randomUUID().slice(0,8)}`,a,c.prompt,JSON.stringify(c.options),b,c.explanation,d]),f++))}return f}e=(g.then?(await g)():g)[0],d()}catch(a){d(a)}})},67360:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{BE:()=>u,Er:()=>t,HW:()=>y,VX:()=>p,Vs:()=>q,ht:()=>r,kg:()=>s,uW:()=>m,zF:()=>n});var e=c(70067),f=c(7935),g=c(86802),h=c(74515),i=c(7028),j=c(35552),k=a([j]);function l(){let a=(process.env.JWT_SECRET||"").trim();if(a.length<32||a.toLowerCase().includes("byt-mig"))throw Error("JWT_SECRET \xe4r f\xf6r svag (minst 32 tecken, inte platsh\xe5llaren 'byt-mig'). Generera med: openssl rand -hex 32");return new TextEncoder().encode(a||"drplugg-dev-jwt-secret-change-in-production")}j=(k.then?(await k)():k)[0];let v="drplugg_token";function m(){return(process.env.ADMIN_EMAIL||"daahirmuse@gmail.com").toLowerCase().trim()}async function n(a){return new e.P({sub:a.id,email:a.email,role:a.role}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("30d").sign(l())}async function o(a){try{let{payload:b}=await (0,f.V)(a,l());return{id:b.sub,email:b.email,role:b.role??"student",displayName:null}}catch{return null}}let w=void 0!==process.env.COOKIE_SECURE?"true"===process.env.COOKIE_SECURE:"true"!==process.env.ALLOW_HTTP;async function p(a){(await (0,g.UL)()).set(v,a,{httpOnly:!0,secure:w,sameSite:"lax",maxAge:2592e3,path:"/"})}async function q(){(await (0,g.UL)()).set(v,"",{httpOnly:!0,secure:w,sameSite:"lax",maxAge:0,path:"/"})}let x="id, email, role, display_name";async function r(a){return(0,j.Zy)("SELECT id, email, password_hash, role, display_name, verified FROM users WHERE email = $1",[a.toLowerCase().trim()])}async function s(a,b){let c=a.toLowerCase().trim(),d=c===m()?"admin":"student",e=await (0,j.Zy)(`INSERT INTO users (email, password_hash, role, verified) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING ${x}`,[c,b,d,"admin"===d]);if(!e)throw Error("Kunde inte skapa anv\xe4ndare");return{id:e.id,email:e.email,role:e.role,displayName:e.display_name}}async function t(a){return i.Ay.hash(a,10)}async function u(a,b){return i.Ay.compare(a,b)}let y=(0,h.cache)(async()=>{let a=await (0,g.UL)(),b=a.get(v)?.value;if(!b)return null;let c=await o(b);if(!c)return null;let d=await (0,j.Zy)(`SELECT ${x} FROM users WHERE id = $1`,[c.id]);return d?{id:d.id,email:d.email,role:d.role,displayName:d.display_name}:null});d()}catch(a){d(a)}})}};