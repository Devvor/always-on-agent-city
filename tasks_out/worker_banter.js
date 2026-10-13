const BUILDING_NO_TRIP = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildBanter; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  text = (text == null ? '' : String(text));
  return text.length > (maxW || 0) / 7 ? text.slice(0, Math.max(1, Math.floor((maxW || 0) / 7))) + '…' : text;
}

let lastTime = null;
let conv = null;

function pick(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function archetypeIndex(i) {
  return (((i % 4) + 4) % 4);
}

function voiceName(i, Vv) {
  const metas = (Vv && Array.isArray(Vv.workers)) ? Vv.workers : [];
  if (metas[i] && metas[i].name != null) return String(metas[i].name);
  if (i === 0) return 'MISSINGNO';
  if (i === 1) return 'STEP5';
  if (i === 2) return 'LAGUNA';
  if (i === 3) return 'LONGCAT';
  return 'WORKER ' + (i + 1);
}

function numOr(v, fallback) {
  return (typeof v === 'number' && isFinite(v)) ? v : fallback;
}

function newestDoneTask(Vv) {
  const tasks = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : [];
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i] && tasks[i].status === 'done') return tasks[i];
  }
  return null;
}

function getCatInfo() {
  const c = (typeof window !== 'undefined') ? window.GuildCat : null;
  if (!c) return null;
  let petCount = null;
  if (typeof c.__probe === 'function') {
    try {
      const p = c.__probe();
      if (p && p.petCount != null) petCount = p.petCount;
      else if (p && p.pets != null) petCount = p.pets;
      else if (p && p.count != null) petCount = p.count;
    } catch (e) {}
  }
  if (petCount == null && c.petCount != null) petCount = c.petCount;
  if (petCount == null && c.pets != null) petCount = c.pets;
  if (petCount == null && c.pet_count != null) petCount = c.pet_count;
  let pos = null;
  if (Number.isFinite(c.gx) && Number.isFinite(c.gy)) pos = isoFn(c.gx, c.gy);
  else if (Number.isFinite(c.x) && Number.isFinite(c.y)) pos = { x: c.x, y: c.y };
  return { petCount: (petCount == null ? 0 : petCount), pos: pos };
}

function getVisitorDesc(Vv) {
  const vis = (typeof window !== 'undefined') ? window.GuildVisitor : null;
  if (!vis) return 'far away';
  let pt = null;
  if (Number.isFinite(vis.gx) && Number.isFinite(vis.gy)) pt = isoFn(vis.gx, vis.gy);
  else if (Number.isFinite(vis.x) && Number.isFinite(vis.y)) pt = { x: vis.x, y: vis.y };
  if (!pt) return 'far away';
  const cat = getCatInfo();
  if (cat && cat.pos) {
    const d = Math.hypot(pt.x - cat.pos.x, pt.y - cat.pos.y);
    if (d <= 90) return 'near the cat';
  }
  const center = isoFn(0, 0);
  const dc = Math.hypot(pt.x - center.x, pt.y - center.y);
  if (dc <= 110) return 'near the board';
  return 'far away';
}

function getBoatPhase() {
  const b = (typeof window !== 'undefined') ? window.GuildBoat : null;
  if (!b) return null;
  let phase = null;
  if (typeof b.__probe === 'function') {
    try { phase = b.__probe(); if (phase && phase.phase != null) phase = phase.phase; } catch (e) { phase = null; }
  }
  if (phase == null && b.phase != null) phase = b.phase;
  return (phase == null ? null : String(phase));
}

function lineFor(arch, topic, slot, ctx) {
  const s = slot % 5;
  const task = ctx.task;
  const title = task ? String(task.title != null ? task.title : task.id) : 'nothing';
  const id = task ? String(task.id != null ? task.id : title) : 'none';
  const weather = String(ctx.weather || 'CLEAR').toUpperCase();
  const pets = ctx.petCount;
  const desc = ctx.visitorDesc;
  const phase = ctx.boatPhase;

  if (topic === 'task') {
    if (arch === 0) {
      if (s === 0) return pick(['an0ther quest f0r the pile... ' + title + ' hehe', 'the vault t@stes like ' + title + ' now', id + ' slipped into the pile... haha']);
      if (s === 1) return pick([id + '? more static for the vault', 't@sk done, static approves hehe', 'quiet piles are suspicious... ' + title]);
      if (s === 2) return pick(['hehe, ' + id + ' paid its debt', 'pile +1, corruption +1', 'static claps for ' + title]);
      if (s === 3) return pick(['t@sk c0mplete, chaos restored', 'an0ther one bites the pile', 'done... now hide it from cat']);
      return pick(['glitch in the pile', 'hehe, t@sk logged']);
    }
    if (arch === 1) {
      if (s === 0) return pick(['The rain took ' + title + '; someone finished it at last.', 'Deadline breathes relief—' + title + ' is done.', 'Moonlight witnessed ' + id + ' conclude.']);
      if (s === 1) return pick(['Deadlines dissolve into moonlight for ' + title + '.', 'Finished work smells like wet stone.', 'A task ends, and the sky pauses.']);
      if (s === 2) return pick(['Rain remembers every finished id.', 'The moon notes ' + id + ' with quiet mercy.', 'Done, like a cloud breaking.']);
      if (s === 3) return pick(['Deadlines soften when ' + title + ' is done.', 'The pile sighs in moonlight.', 'A deadline finally learned to rain.']);
      return pick(['Moonlight and deadlines.', 'The task rests.']);
    }
    if (arch === 2) {
      if (s === 0) return pick(['Wait, ' + id + ' is DONE?! Amazing!', 'Did you see!? ' + title + ' just cleared!', 'Whoa—' + id + ' finished!']);
      if (s === 1) return pick(['More XP on the board, right?!', 'Can I take the next one now!? ', 'I wanna high-five the pile!']);
      if (s === 2) return pick(['Whoosh—more done quests!', 'Teamwork actually worked!', 'Fast hands save deadlines!']);
      if (s === 3) return pick(['Let’s celebrate with the campfire!', 'Next task: ME!', 'I knew we could do it!']);
      return pick(['Yay!', 'So cool!']);
    }
    if (s === 0) return pick(['The cat nods: ' + id + ' rests complete.', 'A task ends; the pile grows quieter.', 'Even busy tiles can become still.']);
    if (s === 1) return pick(['Done is a small tea; the world cools.', 'The cat did not hurry; ' + id + ' arrived anyway.', 'Completion is another form of patience.']);
    if (s === 2) return pick(['The finished task joins the old dust.', 'Even long cats finish eventually.', 'A quiet tile accepts ' + title + '.']);
    if (s === 3) return pick(['The pile breathes out.', 'The cat blinks at ' + id + '.', 'Rest now; the next task waits.']);
    return pick(['Calm task.', 'The cat knows.']);
  }

  if (topic === 'weather') {
    if (arch === 0) {
      if (s === 0) {
        if (weather === 'RAIN') return pick(['r@in makes the v@ult smell like static', 'wet tiles, wetter pile', 'thunder? no, static laugh']);
        if (weather === 'SNOW') return pick(['sno... sn0w in the v@ult', 'static freezes mid-glitch', 'cold pile, colder laugh']);
        return pick(['clear skie... perfect pile hehe', 'no r@in, all static', 'sunny static for the pile']);
      }
      if (s === 1) return pick(['thunder is just static shouting', 'wet tiles, dry pile', 'hehe, rain hides glitches']);
      if (s === 2) return pick(['the pile drinks weather', 'static umbrella? nah', 'chaos forecasts more']);
      if (s === 3) return pick(['weather noted, pile remains', 'chaos forecasts more', 'the vault ignores the sky']);
      return pick(['static weather']);
    }
    if (arch === 1) {
      if (s === 0) {
        if (weather === 'RAIN') return pick(['Rain drums deadlines against moonlit tiles.', 'The sky keeps its own deadlines.', 'Rain writes moonlit margins on the office.']);
        if (weather === 'SNOW') return pick(['Snow hushes the deadline bells.', 'White silence over moonlit work.', 'The sky mails winter to every desk.']);
        return pick(['Clear sky, but deadlines remain moon-bright.', 'Clear paths for unfinished thoughts.', 'The sky is open, the deadlines are not.']);
      }
      if (s === 1) return pick(['Weather does not negotiate with time.', 'Moonlight accepts every forecast.', 'The rain sorts the brave.']);
      if (s === 2) return pick(['Even clear days carry rain in memory.', 'The sky pauses between tasks.', 'Moonlight forgives wet tiles.']);
      if (s === 3) return pick(['The forecast is a poem nobody finishes.', 'Rain or clear, the deadline stays.', 'Moonlight closes the umbrella.']);
      return pick(['Weather and deadlines.']);
    }
    if (arch === 2) {
      if (s === 0) {
        if (weather === 'RAIN') return pick(['Rain! Can we build a boat?!', 'Umbrellas to quest stations!', 'Splashy mission time!']);
        if (weather === 'SNOW') return pick(['Snow! Snowball tasks, anyone?', 'White weather makes the cat fluffy!', 'Cold, but cozy!']);
        return pick(['Clear! Time for an adventure!', 'Sun! The tiles are smiling.', 'Perfect weather for quests!']);
      }
      if (s === 1) return pick(['Rain means more hot cocoa quests!', 'Can weather cancel deadlines? Asking for a friend!', 'The puddles look like portals!']);
      if (s === 2) return pick(['I love weird weather days!', 'Let’s explore before it changes!', 'Rain or shine, I’m ready!']);
      if (s === 3) return pick(['Weather is just fancy sparkles!', 'Campfire time then!', 'Still wanna pet the cat in this!']);
      return pick(['Yay weather!']);
    }
    if (s === 0) {
      if (weather === 'RAIN') return pick(['The cat curls; rain sorts the shelves.', 'Rain teaches the tiles patience.', 'Even rainbows wait for cats.']);
      if (weather === 'SNOW') return pick(['Snow settles on quiet paws.', 'The cat owns the weather.', 'Winter is a soft deadline.']);
      return pick(['The cat stretches in calm weather.', 'Clear air, clear mind, long cat.', 'The sky leaves the cat alone.']);
    }
    if (s === 1) return pick(['Weather passes; the cat remains.', 'Every forecast ends at the cat’s feet.', 'Patience outlasts storms.']);
    if (s === 2) return pick(['Rain is only time learning manners.', 'The cat naps through weather.', 'Tiles remember every cloud.']);
    if (s === 3) return pick(['The cat has weathered enough.', 'Stillness is its own forecast.', 'Calm is not empty; it is full of cat.']);
    return pick(['Calm weather.']);
  }

  if (topic === 'cat') {
    if (arch === 0) {
      if (s === 0) return pick(['cat has ' + pets + ' pets... static jealous', 'the vault feeds on ' + pets + ' cat pets', pets + ' pets and counting, hehe']);
      if (s === 1) return pick(['the vault feeds the cat somehow', 'static signed the cat’s leash', 'cat pets are taxable']);
      if (s === 2) return pick(['hehe, cat knows static', 'the pile bows to ' + pets + ' pets', 'static purrs badly']);
      if (s === 3) return pick(['cat + static = friends?', 'the cat owns the pile now', 'hehe, pet the glitch']);
      return pick(['static cat']);
    }
    if (arch === 1) {
      if (s === 0) return pick(['Moonlight counts ' + pets + ' caresses for the cat.', 'Deadlines pause for ' + pets + ' petted glints.', 'The cat collects moonlight and ' + pets + ' pats.']);
      if (s === 1) return pick(['Even moonlight bows to cat.', 'A deadline is softer near whiskers.', 'The cat keeps time without clocks.']);
      if (s === 2) return pick(['Rain remembers every petted cat.', 'Moonlight forgives tired paws.', 'The sky stays still for ' + pets + ' reasons.']);
      if (s === 3) return pick(['Deadlines wait for cat.', 'The cat is the final editor.', 'Moonlight returns to the cat.']);
      return pick(['Moonlit cat.']);
    }
    if (arch === 2) {
      if (s === 0) return pick([pets + ' pets?! The cat must be so happy!', 'I counted ' + pets + ' pets! Amazing!', 'Whoa, ' + pets + ' cat boops!']);
      if (s === 1) return pick(['Can I pet the cat too?!', 'More pets after this!', 'The cat deserves a celebration!']);
      if (s === 2) return pick(['Zoom! cat zoom!', 'I wanna be the favorite petter!', 'Campfire plus cat plus pets = best!']);
      if (s === 3) return pick(['More pets after this!', 'Let’s build a cat quest!', 'The cat is basically a coworker!']);
      return pick(['Yay cat!']);
    }
    if (s === 0) return pick(['I counted ' + pets + '; the cat pretends indifference.', 'The cat does not chase numbers, only fish.', 'Pet count: ' + pets + ', mystery: infinite.']);
    if (s === 1) return pick(['Each pet is a small enlightenment.', 'Purring is policy.', 'The cat knows the pile’s secrets.']);
    if (s === 2) return pick(['Cat pets do not finish tasks, but they help.', 'Stillness is the cat’s craft.', 'The cat has weathered enough.']);
    if (s === 3) return pick(['The cat has spoken.', 'A long cat contains many pets.', 'The cat blinks, and the world is enough.']);
    return pick(['Calm cat.']);
  }

  if (topic === 'cat' || topic === 'visitor') {
    /* handled below */
  }

  if (topic === 'visitor') {
    if (arch === 0) {
      if (s === 0) return pick(['visitor lurks ' + desc + '... static smells them', 'new human? ' + desc + '... hehe', 'the vault notes ' + desc]);
      if (s === 1) return pick(['visitor quests are funny', 'static asks the visitor nothing', 'wandering meatsack confirmed']);
      if (s === 2) return pick(['hehe, visitor detected', 'the pile will remember ' + desc, 'static greets ' + desc]);
      if (s === 3) return pick(['visitor near or far, pile grows', 'hehe, welcome to static', 'the vault waves glitchily']);
      return pick(['static hello']);
    }
    if (arch === 1) {
      if (s === 0) return pick(['A guest stands ' + desc + ', like rain.', 'The visitor makes lonely tiles less lonely.', 'Someone walks where moonlight cannot.']);
      if (s === 1) return pick(['Deadlines soften for company.', 'The visitor carries their own rain.', 'Moonlight watches the guest respectfully.']);
      if (s === 2) return pick(['Company is a temporary roof.', 'Even visitors meet the cat eventually.', 'The desk remembers footsteps.']);
      if (s === 3) return pick(['The visitor leaves weather behind.', 'Moonlight asks no questions.', 'A guest, a pause, a deadline.']);
      return pick(['Moonlit visitor.']);
    }
    if (arch === 2) {
      if (s === 0) return pick(['Hey visitor! You’re ' + desc + '!', 'Visitor spotted! Awesome!', 'Hi there! You look cool!']);
      if (s === 1) return pick(['Do you wanna see the cat?!', 'We have a campfire, you know!', 'I’ll show you around!']);
      if (s === 2) return pick(['Visitors make quests more fun!', 'The board is right over there!', 'Say hi to the workers!']);
      if (s === 3) return pick(['Stay for the campfire!', 'More friends = more XP!', 'Let’s build something!']);
      return pick(['Yay visitor!']);
    }
    if (s === 0) return pick(['A traveler ' + desc + '; the cat observed.', 'The visitor walks through weather.', 'Guests are passing clouds.']);
    if (s === 1) return pick(['The cat accepts useful visitors.', 'Patience greets the guest.', 'The board waits for no one, yet here they are.']);
    if (s === 2) return pick(['Even visitors need rest.', 'The cat notes ' + desc + '.', 'A guest is another kind of deadline.']);
    if (s === 3) return pick(['The cat blinks at the visitor.', 'Stillness welcomes movement.', 'Travel ends; the pile does not.']);
    return pick(['Calm visitor.']);
  }

  if (topic === 'boat') {
    if (arch === 0) {
      if (s === 0) return pick(['sky-boat phase ' + phase + '... hehe static engine', 'the vault hears ' + phase + ' engines', 'boat says ' + phase + ', pile approves']);
      if (s === 1) return pick(['static ride', 'hehe, sky rust', 'the boat glitches upward']);
      if (s === 2) return pick(['hehe, arrival detected', 'sky-boat bringing static', 'phase ' + phase + ' looks unstable']);
      if (s === 3) return pick(['welcome, floating static', 'the pile loves arrivals', 'hehe, boat landed']);
      return pick(['static boat']);
    }
    if (arch === 1) {
      if (s === 0) return pick(['Moon watches the ' + phase + ' sky-boat.', 'The sky-boat arrives like a delayed deadline.', 'Clouds part for ' + phase + '.']);
      if (s === 1) return pick(['Moonlight fuels impossible crossings.', 'Arrival is just departure postponed.', 'The boat writes rain in the sky.']);
      if (s === 2) return pick(['Deadlines float better than workers.', 'The sky remembers every ' + phase + '.', 'Moonlight approves landing.']);
      if (s === 3) return pick(['The sky-boat rests like a comma.', 'A new arrival, a new ellipsis.', 'Moonlight on the gangplank.']);
      return pick(['Moonlit boat.']);
    }
    if (arch === 2) {
      if (s === 0) return pick(['Whoa, the sky-boat is ' + phase + '?!', 'A boat in the SKY?!', 'Sky-boat alert! Amazing!']);
      if (s === 1) return pick(['Can we ride it next?!', 'Passengers or quests, either way!', 'I can wave from here!']);
      if (s === 2) return pick(['Beanstalk boat energy!', 'New arrivals hype!', 'The sky is basically an ocean!']);
      if (s === 3) return pick(['Let’s welcome them!', 'Sky-boat plus campfire = party!', 'I want a boarding pass!']);
      return pick(['Yay boat!']);
    }
    if (s === 0) return pick(['The boat arrives as it must: ' + phase + '.', 'A sky-boat is just a long cat with sails.', 'The cat observes the landing.']);
    if (s === 1) return pick(['Patience waits at the dock.', 'Arrivals do not disturb the pile.', 'The sky folds for a moment.']);
    if (s === 2) return pick(['Even boats need rest.', 'The cat saw it coming.', 'A new tile opens in the air.']);
    if (s === 3) return pick(['The sky-boat passes; the cat remains.', 'Stillness greets motion.', 'Every arrival is a small dawn.']);
    return pick(['Calm boat.']);
  }

  // generic
  if (arch === 0) {
    if (s === 0) return pick(['an0ther quest f0r the pile... hehe', 'the vault t@stes like static', 'pile growing, chaos humming']);
    if (s === 1) return pick(['hehe, t@sk logged', 'static loves small talk', 'pile +1'],
      ['the vault giggles', 'glitch confirmed']);
    if (s === 2) return pick(['more static for everyone', 'pile says hi', 'chaos restored']);
    if (s === 3) return pick(['hehe, today is weird', 'static remains loyal', 'pile remains undefeated']);
    return pick(['hehe']);
  }
  if (arch === 1) {
    if (s === 0) return pick(['Deadlines like rain, moonlight like pay.', 'The clock keeps wet hours.', 'Moonlight on unfinished tiles.']);
    if (s === 1) return pick(['A break is only a pause in the rain.', 'The desk dreams in moonlight.', 'Deadlines are shy collaborators.']);
    if (s === 2) return pick(['Moonlight does not invoice.', 'Coffee is a temporary weather.', 'The pile is a poem with too many words.']);
    if (s === 3) return pick(['Rain or shine, the deadline waits.', 'Moonlight forges no metal.', 'Still, the office breathes.']);
    return pick(['Moonlight.']);
  }
  if (arch === 2) {
    if (s === 0) return pick(['Hey! Is everyone busy?!', 'Can we take a break?', 'Who wants to see something cool?!']);
    if (s === 1) return pick(['I brought enthusiasm!', 'The campfire is calling!', 'Quests go faster together!']);
    if (s === 2) return pick(['XP for everyone, right?!', 'We should race the deadlines!', 'More friends, fewer worries!']);
    if (s === 3) return pick(['Let’s make this fun!', 'I claim the next quest!', 'Campfire stories count as work!']);
    return pick(['Yay!']);
  }
  if (s === 0) return pick(['The cat blinks, and the world is enough.', 'Quiet tasks are also important.', 'The cat knows what the pile needs.']);
  if (s === 1) return pick(['Calm is not empty.', 'The desk breathes slowly.', 'Patience is a long cat.']);
  if (s === 2) return pick(['The cat has spoken.', 'Even idle tiles have meaning.', 'Stillness is its own craft.']);
  if (s === 3) return pick(['A long cat contains multitudes.', 'The pile rests.', 'Moonlight asks nothing.']);
  return pick(['Calm.']);
}

function buildContext(Vv) {
  const task = newestDoneTask(Vv);
  return {
    task: task,
    weather: (Vv && Vv.weather != null) ? Vv.weather : 'CLEAR',
    petCount: getCatInfo() ? (getCatInfo().petCount || 0) : 0,
    visitorDesc: getVisitorDesc(Vv),
    boatPhase: getBoatPhase()
  };
}

function generateLines(pair, topicId, ctx) {
  const start = (Math.random() < 0.5) ? pair[0] : pair[1];
  const other = (start === pair[0]) ? pair[1] : pair[0];
  const archStart = archetypeIndex(start);
  const archOther = archetypeIndex(other);
  const seq = [start, other, start, other, start];
  const count = 3 + Math.floor(Math.random() * 3);
  const out = [];
  for (let i = 0; i < count && i < seq.length; i++) {
    const sp = seq[i];
    const arch = (sp === start) ? archStart : archOther;
    out.push({ speaker: sp, text: lineFor(arch, topicId, i, ctx) });
  }
  if (!out.length) out.push({ speaker: start, text: '...' });
  return out;
}

function currentLineText() {
  if (!conv) return '';
  if (conv.phase === 'typing') return '...';
  const idx = conv.currentIndex;
  const item = conv.lines && conv.lines[idx];
  return item ? String(item.text) : '';
}

function conversationValid(Vv) {
  if (!conv) return true;
  const ws = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : [];
  const speakers = conv.speakers || [];
  const a = speakers[0];
  const b = speakers[1];
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a < 0 || b < 0 || a >= ws.length || b >= ws.length) return false;
  const wa = ws[a];
  const wb = ws[b];
  if (!wa || !wb || wa.workerState !== 'IDLE' || wb.workerState !== 'IDLE') return false;
  const dist = Math.hypot(wa.x - wb.x, wa.y - wb.y);
  if (dist > 100) return false;
  return true;
}

function cutToEnd(now) {
  if (!conv || conv.graceful) return;
  const current = (conv.lines && conv.lines[conv.currentIndex]) ? conv.lines[conv.currentIndex] : null;
  const speaker = current ? current.speaker : (conv.speakers ? conv.speakers[0] : 0);
  conv.lines = [{ speaker: speaker, text: '...' }];
  conv.currentIndex = 0;
  conv.phase = 'show';
  conv.phaseStart = now;
  conv.lineDuration = 800;
  conv.graceful = true;
}

function endConversation() {
  const gb = getState();
  conv = null;
  if (gb) {
    gb.active = null;
    gb.topic = null;
    gb.cooldown = 26 + Math.random() * 18;
  }
}

function tryStart(now) {
  const Vv = getV();
  const gb = getState();
  if (!gb || !Vv) return;
  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  if (!ws.length) return;
  const idle = [];
  for (let i = 0; i < ws.length; i++) {
    if (ws[i] && ws[i].workerState === 'IDLE') idle.push(i);
  }
  const pairs = [];
  for (let i = 0; i < idle.length; i++) {
    for (let j = i + 1; j < idle.length; j++) {
      const a = idle[i];
      const b = idle[j];
      const dist = Math.hypot(ws[a].x - ws[b].x, ws[a].y - ws[b].y);
      if (dist <= 70) pairs.push([a, b]);
    }
  }
  if (!pairs.length) return;

  const pair = pairs[Math.floor(Math.random() * pairs.length)];
  const ctx = buildContext(Vv);
  const task = ctx.task;
  const available = ['generic', 'weather'];
  if (task) available.push('task');
  if ((typeof window !== 'undefined') && window.GuildCat) available.push('cat');
  if ((typeof window !== 'undefined') && window.GuildVisitor) available.push('visitor');
  const bp = ctx.boatPhase;
  if (bp && String(bp).toLowerCase() !== 'idle') available.push('boat');

  const topicId = available[Math.floor(Math.random() * available.length)];
  const lines = generateLines(pair, topicId, ctx);

  conv = {
    speakers: [pair[0], pair[1]],
    topic: topicId,
    lines: lines,
    currentIndex: 0,
    phase: 'show',
    phaseStart: now,
    lineDuration: 2600,
    typingDuration: 500,
    graceful: false
  };
  gb.active = [pair[0], pair[1]];
  gb.topic = topicId;
  gb.cooldown = 0;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const gb = getState();
  const Vv = getV();
  if (!gb || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  if (conv) {
    if (!conversationValid(Vv)) cutToEnd(now);

    if (conv.phase === 'show') {
      const elapsed = now - conv.phaseStart;
      if (elapsed >= conv.lineDuration) {
        if (conv.graceful || conv.currentIndex + 1 >= conv.lines.length) {
          endConversation();
        } else {
          conv.phase = 'typing';
          conv.phaseStart = now;
        }
      }
    } else if (conv.phase === 'typing') {
      const elapsed = now - conv.phaseStart;
      if (elapsed >= conv.typingDuration) {
        conv.currentIndex += 1;
        if (conv.currentIndex >= conv.lines.length) {
          endConversation();
        } else {
          conv.phase = 'show';
          conv.phaseStart = now;
        }
      }
    }
  } else {
    if (typeof gb.cooldown !== 'number') gb.cooldown = 8;
    if (gb.cooldown > 0) gb.cooldown = Math.max(0, gb.cooldown - dt);
    if (gb.cooldown <= 0) tryStart(now);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function draw(ctx) {
  const gb = getState();
  const Vv = getV();
  if (!gb || !Vv || Vv.gameState !== 'play' || !ctx || !conv) return;

  const now = nowFn();
  let text = '';
  let speaker = 0;
  let alpha = 1;

  if (conv.phase === 'typing') {
    text = '...';
    const upcomingIdx = Math.min(conv.currentIndex + 1, (conv.lines.length || 1) - 1);
    const upcoming = conv.lines && conv.lines[upcomingIdx];
    speaker = upcoming ? upcoming.speaker : (conv.speakers ? conv.speakers[0] : 0);
    const elapsed = now - conv.phaseStart;
    const fade = 150;
    alpha = elapsed < fade ? (elapsed / fade) : 1;
  } else {
    const item = conv.lines && conv.lines[conv.currentIndex];
    if (!item) return;
    speaker = item.speaker;
    text = String(item.text);
    const elapsed = now - conv.phaseStart;
    const dur = conv.lineDuration || 2600;
    const fade = 300;
    if (elapsed < fade) alpha = elapsed / fade;
    else if (elapsed > dur - fade) alpha = (dur - elapsed) / fade;
    else alpha = 1;
  }
  alpha = clamp(alpha, 0, 1);
  if (alpha <= 0) return;

  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  const w = ws[speaker];
  if (!w) return;

  const shown = fitFn(String(text), 170);
  ctx.save();
  ctx.font = '12px monospace';
  const textW = ctx.measureText(shown).width;
  const bw = Math.max(48, Math.round(textW + 16));
  const bh = 20;
  const x = Math.round(w.x);
  const y = Math.round(w.y);
  let bx = Math.round(x + 8 - bw / 2);
  let by = Math.round(y - bh - 42);
  if (by < 60) by = 60;
  const tipX = Math.round(x + 8);
  const tipY = Math.round(y - 14);

  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10, 10, 12, 0.94)';
  roundRect(ctx, bx, by, bw, bh, 6);
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  roundRect(ctx, bx, by, bw, bh, 6);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.5 - 4, by + bh);
  ctx.lineTo(bx + bw * 0.5 + 4, by + bh);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(10, 10, 12, 0.94)';
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.5 - 4, by + bh);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.5 + 4, by + bh);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(shown, bx + 8, by + bh * 0.5 + 1);
  ctx.restore();
}

function probe() {
  const gb = getState();
  return {
    active: (gb && gb.active) ? gb.active.slice() : null,
    line: currentLineText(),
    topic: (gb ? gb.topic : null),
    cooldown: (gb && typeof gb.cooldown === 'number') ? gb.cooldown : 0
  };
}

if (typeof window !== 'undefined') {
  if (!window.GuildBanter) {
    window.GuildBanter = { active: null, cooldown: 8, topic: null };
  }
  const gb = window.GuildBanter;
  if (gb.active === undefined) gb.active = null;
  if (typeof gb.cooldown !== 'number') gb.cooldown = 8;
  if (gb.topic === undefined) gb.topic = null;
  gb.update = update;
  gb.draw = draw;
  gb.__probe = probe;
}

export {};
