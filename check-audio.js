const fs = require('fs');
const path = require('path');

const audioDir = path.join(__dirname, 'content', 'audio');
const dailyDir = path.join(__dirname, 'content', 'daily');

const dates = ['2026-09-17','2026-09-18','2026-09-19','2026-09-20'];

console.log('=== daily JSON presence ===');
for (const d of dates) {
  const p = path.join(dailyDir, d + '.json');
  console.log(d, fs.existsSync(p) ? 'OK' : 'MISSING');
}

console.log('\n=== mp3 per-date (expected 11 each) ===');
for (const d of dates) {
  const files = fs.readdirSync(audioDir).filter(f => f.startsWith(d + '_') && f.endsWith('.mp3'));
  const zero = files.filter(f => {
    const st = fs.statSync(path.join(audioDir, f));
    return st.size === 0;
  });
  const sizes = files.map(f => fs.statSync(path.join(audioDir, f)).size);
  console.log(d, 'count=' + files.length, 'zero=' + zero.length, zero.length ? ('ZERO: ' + zero.join(',')) : '', 'minSize=' + (sizes.length?Math.min(...sizes):'n/a'));
}

console.log('\n=== any 0-byte mp3 anywhere under content/audio (2026-09-1*) ===');
const all = fs.readdirSync(audioDir).filter(f => /^2026-09-1[0-9]/.test(f) && f.endsWith('.mp3'));
const zeros = all.filter(f => fs.statSync(path.join(audioDir, f)).size === 0);
console.log('total=' + all.length, 'zeroCount=' + zeros.length);
if (zeros.length) console.log('ZEROS: ' + zeros.join('\n'));
