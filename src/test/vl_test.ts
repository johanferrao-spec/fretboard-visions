import { generateVoiceLeadingVoicings, generateThreeNpsPattern, STANDARD_TUNING } from '../lib/music';

console.log('=== 3-NPS: G Ionian, degree 0 (G major / I) ===');
const nps = generateThreeNpsPattern('G', [0,2,4,5,7,9,11], 0, STANDARD_TUNING);
console.log(nps.map(n => `s${n.stringIndex}:${n.fret}`).join(' '));
// Expect: s0:3 s0:5 s0:7 s1:3 s1:5 s1:7 s2:4 s2:5 s2:7 s3:4 s3:5 s3:7 s4:5 s4:7 s4:8 s5:5 s5:7 s5:8

console.log('\n=== 3-NPS: G major key, degree 1 (A Dorian / ii) ===');
const nps2 = generateThreeNpsPattern('G', [0,2,4,5,7,9,11], 1, STANDARD_TUNING);
console.log(nps2.map(n => `s${n.stringIndex}:${n.fret}`).join(' '));
// User said: low e 5 7 8, A 5 7 9, D 5 7 9, ...

console.log('\n=== Voice leading: Cmaj7, melody = high-e string (5) at fret 7 (G - the 5th) ===');
const v1 = generateVoiceLeadingVoicings('C', 'Major 7', 5, 7, STANDARD_TUNING);
console.log(`${v1.length} voicings found`);
v1.slice(0, 5).forEach(v => {
  console.log(`  ${v.tab}  span=${v.span}  3rd=${v.hasThird} 7th=${v.hasSeventh}  ${v.degreeOrder}  -> ${v.slashName}`);
});

console.log('\n=== Voice leading: Dm7, melody = high-e fret 5 (A - the 5th) ===');
const v2 = generateVoiceLeadingVoicings('D', 'Minor 7', 5, 5, STANDARD_TUNING);
console.log(`${v2.length} voicings found`);
v2.slice(0, 5).forEach(v => {
  console.log(`  ${v.tab}  span=${v.span}  3rd=${v.hasThird} 7th=${v.hasSeventh}  ${v.degreeOrder}  -> ${v.slashName}`);
});

console.log('\n=== Voice leading: G7, melody = B string fret 8 (G - the root) ===');
const v3 = generateVoiceLeadingVoicings('G', 'Dominant 7', 4, 8, STANDARD_TUNING);
console.log(`${v3.length} voicings found`);
v3.slice(0, 5).forEach(v => {
  console.log(`  ${v.tab}  span=${v.span}  3rd=${v.hasThird} 7th=${v.hasSeventh}  ${v.degreeOrder}  -> ${v.slashName}`);
});
