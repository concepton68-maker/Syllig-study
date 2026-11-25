// Correction automatique : cas vérifiés à la main (signes, exposants, mots composés, nombres, réponses sans chiffre).
// Usage : npx tsx tests/unit-correction.ts (code de sortie 1 en cas d'échec)
import { normShort as n, autoCorrect } from '../src/lib/course-format';
const eq = (a: string, b: string) => n(a) === n(b);
const cases: [string, string, boolean][] = [
  ['5x+9', '5x-9', false], ['5x+9', '5x + 9', true], ['3x²', '3x', false], ['3x²', '3x^2', true], ['3x²', '3 x²', true],
  ['-1/3', '1/3', false], ['−1/3', '-1/3', true], ['1,3', '1.3', true], ['1,3', '1/3', false], ['x-5', 'x - 5', true], ['x-5', 'x−5', true],
  ['peut-être', 'peut etre', true], ['Peut-être', 'peut-être', true], ['c’est-à-dire', "c'est a dire", true], ['un adjectif', 'Un adjectif.', true],
  ['-5', '−5', true], ['-5', '5', false], ['(x+3)(x-3)', '(x+3)(x+3)', false], ['(x+3)(x-3)', '(x + 3)(x − 3)', true], ['2x-3', '2x+3', false],
  ['-7/12', '−7/12', true], ['il prit', 'Il prit', true], ['3-x', '3+x', false],
];
let bad = 0;
for (const [a, b, want] of cases) { const got = eq(a, b); if (got !== want) { bad++; console.log('✗', a, '|', b, 'attendu', want, '→', n(a), '/', n(b)); } }
console.log(bad ? `${bad} échec(s)` : `${cases.length} cas OK`);
const N = (answer: number, tolerance?: number) => ({ id: 'n', type: 'numeric', prompt: '', points: 1, answer, tolerance } as never);
const more: [boolean, boolean][] = [
  [autoCorrect(N(0), 'abc')!, false], [autoCorrect(N(0), '%')!, false], [autoCorrect(N(0), '.')!, false], [autoCorrect(N(0), '0')!, true],
  [autoCorrect(N(0.5, 0.5), 'cm')!, false], [autoCorrect(N(25), '25 %')!, true], [autoCorrect(N(-4.5), '−4,5')!, true], [autoCorrect(N(3.5), '3,5 cm³')!, true],
  [n('3²') === n('32'), false], [n('2^10') === n('210'), false], [n('x²') === n('x^2'), true],
];
const badMore = more.filter(([g, w]) => g !== w).length;
console.log(badMore ? `${badMore} échec(s) numériques/exposants : ${JSON.stringify(more.map(([g]) => g))}` : `${more.length} cas numériques/exposants OK`);

if (bad || badMore) process.exit(1);
