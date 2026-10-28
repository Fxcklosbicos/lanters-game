const rig = { ctx: null, muted: false };

export const setMuted = (muted) => { rig.muted = muted; };
export const wake = () => {
  rig.ctx = rig.ctx ?? new (window.AudioContext ?? window.webkitAudioContext)();
  rig.ctx.resume();
};
export const tone = (freq, { dur = 0.09, type = 'triangle', vol = 0.06, slide = 1, wait = 0 } = {}) => {
  if (rig.muted || !rig.ctx || rig.ctx.state !== 'running') return;
  const at = rig.ctx.currentTime + wait;
  const osc = new OscillatorNode(rig.ctx, { type, frequency: freq });
  const gain = new GainNode(rig.ctx, { gain: 0 });
  osc.frequency.exponentialRampToValueAtTime(freq * slide, at + dur);
  gain.gain.setValueAtTime(vol, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(rig.ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
};
export const chord = (notes, options) => notes.forEach((freq, i) => tone(freq, { ...options, wait: i * 0.07 }));
