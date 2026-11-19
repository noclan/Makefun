// Radio stations: five WebAudio flavours for the drive. Press R to
// switch — the station name shows in the HUD and the music engine
// retunes itself (different bass line and lead voice per station).

export const STATIONS = [
  { name: 'SOLMAR FM', bass: [110, 110, 130.8, 98], lead: 440, wave: 'triangle', step: 0.42 },
  { name: 'NEON NIGHTS', bass: [130.8, 98, 110, 146.8], lead: 660, wave: 'sine', step: 0.32 },
  { name: 'BAY COUNTRY', bass: [98, 123.5, 98, 146.8], lead: 523, wave: 'triangle', step: 0.5 },
  { name: 'GOLDEN HOUR', bass: [87.3, 110, 130.8, 164.8], lead: 392, wave: 'sine', step: 0.55 },
  { name: 'ISLAND BEATS', bass: [110, 164.8, 130.8, 196], lead: 587, wave: 'square', step: 0.28 },
];

export function ensureStations(state) {
  if (!state.depth) state.depth = {};
  if (!state.depth.stations) state.depth.stations = { idx: 0 };
  return state.depth.stations;
}

export function stationOf(state) {
  const st = ensureStations(state);
  return STATIONS[st.idx % STATIONS.length];
}

export function stationName(state) {
  return stationOf(state).name;
}

export function cycleStation(state) {
  const st = ensureStations(state);
  st.idx = (st.idx + 1) % STATIONS.length;
  const s = STATIONS[st.idx];
  state.dialogue = { who: 'Radio', text: `Now playing: ${s.name} — turn it up, Rico.`, t: 3 };
  state.events.push({ kind: 'station', name: s.name });
  return s;
}

export function stepStations(state, dt) {
  ensureStations(state);
  void dt;
}
