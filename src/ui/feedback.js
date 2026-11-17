// Post-game feedback form and the results/export screen.
import { h, openPanel, btn, seg } from './dom.js';
import { game, save, log, exportRecord, download, archiveSession } from '../state.js';

export function feedbackForm() {
  return new Promise((resolve) => {
    const p = openPanel({ tag: 'Playtest feedback · 1 minute', title: 'How was the expedition?', wide: false });
    const ratings = {};
    const scale = (key, label) => h('div', { class: 'ctl' }, h('label', { style: { minWidth: '260px' } }, label),
      seg([1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })), null, (v) => (ratings[key] = v)));
    const learned = h('textarea', { rows: 2, placeholder: 'One idea you understand better now…', style: taStyle() });
    const confusing = h('textarea', { rows: 2, placeholder: 'Anything confusing, buggy or too slow?', style: taStyle() });
    p.content.append(
      h('p', { class: 'tiny' }, '1 = not at all, 5 = very much'),
      scale('fun', 'It was fun to play'),
      scale('clarity', 'The statistics ideas were clear'),
      scale('discover', 'I discovered ideas by playing, not by reading'),
      scale('decisions', 'My decisions changed what happened'),
      h('div', { style: { marginTop: '12px' } }, learned), h('div', { style: { marginTop: '8px' } }, confusing));
    p.setFooter(btn('Skip', () => finish(true), 'ghost'), btn('Submit feedback', () => finish(false), 'primary'));
    function finish(skipped) {
      game.state.feedback = skipped ? { skipped: true } : { ...ratings, learned: learned.value.trim(), confusing: confusing.value.trim() };
      save(); log('feedback', { skipped }); p.close(); resolve();
    }
  });
}
const taStyle = () => ({ width: '100%', background: 'rgba(0,0,0,0.25)', color: 'var(--text)', border: '1px solid var(--line-2)', borderRadius: '10px', padding: '10px', font: '14px var(--font)', resize: 'vertical' });

export function resultsScreen({ onReplay, onTitle }) {
  archiveSession();
  const s = game.state;
  const p = openPanel({ tag: 'Expedition complete', title: { dawn: 'Dawn over Halcyon', holds: 'Halcyon Holds', night: 'The Long Night' }[s.ending?.ending] || 'Results', wide: false });
  const pre = s.pre?.score ?? 0, post = s.post?.score ?? 0, of = s.post?.of ?? 9;
  p.content.append(
    h('div', { class: 'stats' },
      s.pre && h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Before'), h('div', { class: 'v' }, `${pre}/${of}`)),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, s.pre ? 'After' : 'Quiz'), h('div', { class: 'v cyan-t' }, `${post}/${of}`)),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Evidence'), h('div', { class: 'v' }, `${s.ending?.score ?? 0}/8`)),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Session'), h('div', { class: 'v', style: { fontSize: '14px' } }, s.sessionId))),
    h('p', { class: 'lead', style: { marginTop: '14px' }, html: 'Thank you for playing! If you’re part of a playtest, <b>download your results file</b> and send it to the organiser. It contains your answers, decisions and feedback, and nothing else.' }));
  p.setFooter(
    btn('Download results (.json)', () => { download(`halcyon-${s.alias ? s.alias.replace(/\W+/g, '_') + '-' : ''}${s.sessionId}.json`, exportRecord()); log('export'); }, 'primary'),
    btn('Play again', () => { p.close(); onReplay(); }),
    btn('Title screen', () => { p.close(); onTitle(); }, 'ghost'));
}
