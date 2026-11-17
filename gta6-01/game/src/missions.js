// The story: six missions for Mama Rosa against the Varela crew, plus
// three side activities (taxi fares, a beach street race, seashell
// collecting). A mission is a list of stages; each stage has a place to
// reach, a thing to do there, and a line of dialogue. Completing a stage
// pays in story; the last stage of a mission pays in cash.
//
// v2: the first job is a real job. Rico starts on foot with no wheels, so
// mission 1 makes him steal a car and then drive it across town to the
// Old Town drop — it can never finish from twenty seconds of blind
// walking. Some goto stages carry needsCar: arriving on foot only earns
// a hint, not a completion.

import { makeCar } from './vehicles.js';
import { chance, range } from './random.js';

export const MISSIONS = [
  {
    id: 'welcome-home',
    title: 'Welcome Home, Rico',
    giver: 'Mama Rosa',
    brief: 'Five years away, and you come back the day the Varelas move in. Get wheels, then drive to the Old Town drop.',
    reward: 150,
    stages: [
      { type: 'car', speaker: 'Mama Rosa', text: 'Rico! My boy. The Varelas think Solmar is theirs now. First things first — you need wheels. Any car on the street will do. Press E next to one.' },
      { type: 'goto', x: 2080, y: 800, radius: 80, needsCar: true, hint: 'DRIVE TO THE OLD TOWN DROP', speaker: 'Mama Rosa', text: 'Good — you are mobile again. The drop is in Old Town, across the whole city. Drive like you mean it, and do not stop for the Varelas.' },
    ],
  },
  {
    id: 'marina-pickup',
    title: 'The Marina Pickup',
    giver: 'Mama Rosa',
    brief: 'Pick up the crate at the marina and drop it in Old Town. No police, no questions.',
    reward: 250,
    stages: [
      { type: 'goto', x: 2880, y: 1760, radius: 70, needsCar: true, hint: 'DRIVE TO THE MARINA CRATE', speaker: 'Rico', text: 'Crate secured. Light as a feather — whatever Mama Rosa smuggles, it is not feathers.' },
      { type: 'goto', x: 2080, y: 800, radius: 70, needsCar: true, hint: 'DELIVER TO OLD TOWN', speaker: 'Mama Rosa', text: 'Delivered clean. The Varelas did not even notice. You still drive like a dream, Rico.' },
    ],
  },
  {
    id: 'tail-varela',
    title: 'Tail the Varela',
    giver: 'Mama Rosa',
    brief: 'A Varela sedan is running errands all over town. Follow it — close enough to see, far enough not to be seen.',
    reward: 400,
    stages: [
      { type: 'tail', seconds: 18, speaker: 'Rico', text: 'There he is. Keep your distance, watch where he goes. Too close and he bolts.' },
    ],
  },
  {
    id: 'heat-beach',
    title: 'Heat on the Beach',
    giver: 'Mama Rosa',
    brief: 'The Varelas tipped off the cops — you are wanted. Lose them, then come back when the streets are quiet.',
    reward: 500,
    stages: [
      { type: 'escape', speaker: 'Radio', text: 'All units: suspect vehicle, Beachfront. Do not let him reach the hills.' },
    ],
  },
  {
    id: 'bridge-run',
    title: 'The Bridge Run',
    giver: 'Mama Rosa',
    brief: 'A package for the safehouse, and the clock is running. Seventy-five seconds, Rico. Do not stop for red lights.',
    reward: 700,
    stages: [
      { type: 'goto', x: 1120, y: 800, radius: 70, needsCar: true, hint: 'GRAB THE PACKAGE AT THE BANK', speaker: 'Rico', text: 'Package in hand. Seventy-five seconds to the safehouse — floor it.' },
      { type: 'timed', x: 2400, y: 2560, radius: 80, seconds: 75, speaker: 'Mama Rosa', text: 'You made it with time to spare. The Varelas are going to hate this.' },
    ],
  },
  {
    id: 'gold-rush',
    title: 'Gold Rush',
    giver: 'Mama Rosa',
    brief: 'The bank. The gold. The whole Solmar PD on your tail. Grab it, run, and do not look back until you are home.',
    reward: 1500,
    stages: [
      { type: 'goto', x: 1120, y: 800, radius: 70, needsCar: true, hint: 'HIT THE BANK, GRAB THE GOLD', speaker: 'Rico', text: 'Gold in the bag. Alarms everywhere — this is going to be a loud drive home.' },
      { type: 'escape', speaker: 'Mama Rosa', text: 'Bring that gold to the safehouse, Rico. Every cop in Solmar is behind you.' },
    ],
  },
];

export function missionTitle(g) {
  const m = MISSIONS[g.mission.index];
  return m ? m.title : 'Solmar Bay — free roam';
}

export function currentStage(g) {
  const m = MISSIONS[g.mission.index];
  if (!m) return null;
  return m.stages[g.mission.stage] || null;
}

export function markerFor(g) {
  const stage = currentStage(g);
  if (!stage) return null;
  if (stage.type === 'tail' && g.tailCar) return { x: g.tailCar.x, y: g.tailCar.y };
  if (stage.type === 'escape') return { x: g.city.landmarks.safehouse.x, y: g.city.landmarks.safehouse.y };
  if (stage.type === 'car') {
    // Point at the closest stealable car so the player is never lost.
    let best = null;
    let bestD = Infinity;
    for (const car of g.cars) {
      if (car.driver === 'player') continue;
      const d = Math.hypot(car.x - g.player.x, car.y - g.player.y);
      if (d < bestD) { best = car; bestD = d; }
    }
    return best ? { x: best.x, y: best.y } : null;
  }
  return { x: stage.x, y: stage.y };
}

function say(g, speaker, text, seconds) {
  g.dialogue = { speaker, text, timer: seconds || 4 };
}

function completeStage(g) {
  const m = MISSIONS[g.mission.index];
  const stage = currentStage(g);
  // Arrival stages speak when Rico gets there; tail and escape stages spoke
  // when they started, so they stay quiet at the end.
  if (stage && stage.text && (stage.type === 'goto' || stage.type === 'timed' || stage.type === 'car')) {
    say(g, stage.speaker || m.giver, stage.text, 4.5);
  }
  g.mission.stage += 1;
  if (g.mission.stage >= m.stages.length) {
    completeMission(g);
  } else {
    g.mission.timer = 0;
    g.mission.outOfRange = 0;
  }
  if (g.audio) g.audio.jingle();
}

function completeMission(g) {
  const m = MISSIONS[g.mission.index];
  g.player.cash += m.reward;
  g.player.respect += 10;
  g.hudMessage = `Mission complete: ${m.title}  +$${m.reward}`;
  g.effects.floatText(g.player.x, g.player.y - 30, `+$${m.reward}`, '#f2c94c');
  g.mission.index += 1;
  g.mission.stage = 0;
  g.mission.timer = 0;
  g.mission.failed = false;
  if (g.tailCar) {
    g.tailCar.driver = 'traffic';
    g.tailCar = null;
  }
  if (g.audio) g.audio.jingle();
  g.save();
}

export function failMission(g, reason) {
  const m = MISSIONS[g.mission.index];
  if (!m) return;
  g.mission.failed = true;
  g.mission.failReason = reason;
  g.hudMessage = `Mission failed: ${reason} — press Enter to retry`;
  if (g.tailCar) {
    g.tailCar.driver = 'traffic';
    g.tailCar = null;
  }
  // The heat from a failed job cools off a little; the Varelas laugh, the
  // cops lose interest.
  g.wanted.heat = Math.max(0, g.wanted.heat - 25);
}

export function retryMission(g) {
  g.mission.stage = 0;
  g.mission.timer = 0;
  g.mission.failed = false;
  g.mission.failReason = '';
  g.wanted.heat = 0;
  startMissionStage(g);
}

export function startMissionStage(g) {
  const stage = currentStage(g);
  if (!stage) return;
  g.mission.timer = 0;
  g.mission.outOfRange = 0;
  if (stage.type === 'tail') {
    // The Varela sedan: a black sports car cruising the downtown loop.
    const car = makeCar(g.rng, 'sports', 1120, 480, 0);
    car.color = '#1a1a1a';
    car.driver = 'tail';
    car.cruise = 380;
    car.lane = 0;
    g.cars.push(car);
    g.tailCar = car;
  }
  if (stage.type === 'escape' && g.mission.index === 3) {
    // Mission 4: the tip-off. The heat arrives on cue.
    g.wanted.heat = 45;
    g.wanted.lastCrime = g.time;
  }
  if (stage.type === 'escape' && g.mission.index === 5) {
    g.wanted.heat = 90;
    g.wanted.lastCrime = g.time;
  }
  if (stage.speaker && stage.type !== 'goto') say(g, stage.speaker, stage.text, 4);
  if (stage.type === 'car') say(g, stage.speaker, stage.text, 5);
}

export function stepMissions(g, dt) {
  const m = MISSIONS[g.mission.index];
  if (!m) return;
  if (g.mission.failed) return;
  const stage = currentStage(g);
  if (!stage) return;
  const p = g.player;

  // A 'car' stage ends the moment Rico is behind a wheel.
  if (stage.type === 'car') {
    if (p.car) completeStage(g);
    return;
  }

  if (stage.type === 'goto' || stage.type === 'timed') {
    if (stage.type === 'timed') {
      g.mission.timer += dt;
      if (g.mission.timer > stage.seconds) {
        failMission(g, 'Out of time');
        return;
      }
    }
    const d = Math.hypot(p.x - stage.x, p.y - stage.y);
    if (d >= stage.radius) return;
    // Some jobs need wheels: arriving on foot earns a hint, not a pass.
    if (stage.needsCar && !p.car) {
      g.mission.hint = 'You need a car for this job — press E near one.';
      return;
    }
    completeStage(g);
    return;
  }

  if (stage.type === 'tail') {
    const car = g.tailCar;
    if (!car) return;
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    if (d < 70 || d > 420) {
      g.mission.outOfRange += dt;
      if (g.mission.outOfRange > 3) {
        failMission(g, d < 70 ? 'You were spotted' : 'You lost him');
        return;
      }
    } else {
      g.mission.outOfRange = 0;
      g.mission.timer += dt;
      if (g.mission.timer >= stage.seconds) completeStage(g);
    }
    return;
  }

  if (stage.type === 'escape') {
    if (g.wanted.stars === 0) {
      const home = g.city.landmarks.safehouse;
      const d = Math.hypot(p.x - home.x, p.y - home.y);
      if (d < 90) completeStage(g);
      else g.mission.hint = 'Heat is off — get to the safehouse.';
    }
  }
}

// --- Side activities ---

export function stepTaxi(g, dt) {
  const p = g.player;
  // A waiting fare flags a nearby pedestrian; drive a taxi up to them.
  if (!g.fare) {
    if (p.car && p.car.type === 'taxi') {
      for (const ped of g.peds) {
        if (ped.down || ped.flee) continue;
        const d = Math.hypot(ped.x - p.x, ped.y - p.y);
        if (d < 60 && chance(g.rng, 0.05)) {
          ped.taxi = true;
          g.fare = { ped, stage: 'pickup', timer: 0 };
          g.hudMessage = 'Fare waiting — pick them up!';
          break;
        }
      }
    }
    return;
  }
  const fare = g.fare;
  if (fare.stage === 'pickup') {
    const d = Math.hypot(fare.ped.x - p.x, fare.ped.y - p.y);
    if (d < 50 && p.car && p.car.type === 'taxi') {
      fare.stage = 'drop';
      fare.ped.down = true; // hidden in the back seat for the ride
      fare.ped.downTimer = 999;
      const lm = g.city.landmarks;
      const spots = [lm.cafeLuna, lm.bank, lm.hospital, lm.raceStart];
      const spot = spots[Math.floor(g.rng() * spots.length)];
      fare.dest = { x: spot.x, y: spot.y };
      g.hudMessage = `Fare aboard — take them to ${spot.label}`;
    }
    return;
  }
  if (fare.stage === 'drop') {
    const d = Math.hypot(fare.dest.x - p.x, fare.dest.y - p.y);
    if (d < 80) {
      const pay = 60 + Math.floor(g.rng() * 60);
      p.cash += pay;
      g.hudMessage = `Fare complete +$${pay}`;
      g.effects.floatText(p.x, p.y - 30, `+$${pay}`, '#f2c94c');
      fare.ped.down = false;
      fare.ped.downTimer = 0;
      fare.ped.x = p.x + 30;
      fare.ped.y = p.y + 30;
      fare.ped.taxi = false;
      g.fare = null;
      if (g.audio) g.audio.pickup();
    }
  }
}

export function stepRace(g, dt) {
  const p = g.player;
  const start = g.city.landmarks.raceStart;
  if (!g.race) {
    if (p.car && Math.hypot(p.x - start.x, p.y - start.y) < 80 && g.racePrompt) {
      // The game loop sets racePrompt when the player presses E here.
      g.race = {
        checkpoints: [
          { x: 480, y: 2720 },
          { x: 480, y: 1440 },
          { x: 1760, y: 1440 },
          { x: 2400, y: 2720 },
        ],
        at: 0,
        timer: 0,
      };
      g.hudMessage = 'Beach race! Hit all 4 checkpoints — beat 60 seconds.';
      g.racePrompt = false;
    }
    return;
  }
  const race = g.race;
  race.timer += dt;
  const cp = race.checkpoints[race.at];
  if (cp && Math.hypot(p.x - cp.x, p.y - cp.y) < 90) {
    race.at += 1;
    if (g.audio) g.audio.pickup();
    if (race.at >= race.checkpoints.length) {
      const won = race.timer < 60;
      const pay = won ? 300 : 50;
      p.cash += pay;
      g.hudMessage = won ? `Race won in ${race.timer.toFixed(1)}s! +$${pay}` : `Race done in ${race.timer.toFixed(1)}s. +$${pay}`;
      g.race = null;
    }
  }
  if (race.timer > 120) {
    g.hudMessage = 'Race abandoned.';
    g.race = null;
  }
}

export function stepShells(g) {
  const p = g.player;
  if (p.car) return;
  for (const shell of g.city.shells) {
    if (shell.taken) continue;
    if (Math.hypot(shell.x - p.x, shell.y - p.y) < 30) {
      shell.taken = true;
      p.cash += 50;
      g.shellsFound += 1;
      g.hudMessage = `Seashell found! +$50 (${g.shellsFound}/12)`;
      g.effects.floatText(shell.x, shell.y - 20, '+$50', '#f2c94c');
      if (g.audio) g.audio.pickup();
      g.save();
    }
  }
}
