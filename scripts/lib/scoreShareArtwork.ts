import type { ShareStars } from '../../src/daily/scoreShare.ts'

/** Flat, code-drawn version of the game's segmented wyrm; no answer spoilers. */
export function scoreShareArtwork(stars: ShareStars): string {
  const colours = { bg: '#25281f', fg: '#c9c2a8', gold: '#e3bd74', green: '#93bd74', red: '#c77e6c' }
  const star = 'M 0 -30 L 9 -10 L 31 -7 L 15 8 L 19 30 L 0 19 L -19 30 L -15 8 L -31 -7 L -9 -10 Z'
  const headline = stars === 3 ? 'BINGO!' : stars === 2 ? 'NICE WORK.' : 'WELL PLAYED.'
  const caption = stars === 3 ? 'ONE WORD. THREE STARS.' : stars === 2 ? 'TWO WORDS. TWO STARS.' : 'ANOTHER PUZZLE SOLVED.'
  const eyes = stars === 3
    ? '<path d="M 906 298 Q 919 274 932 298 M 968 298 Q 981 274 994 298" fill="none" stroke="#25281f" stroke-width="13" stroke-linecap="round"/>'
    : '<rect x="909" y="282" width="17" height="24" rx="3"/><rect x="972" y="282" width="17" height="24" rx="3"/>'
  const mouth = stars === 3
    ? '<path d="M 918 332 Q 950 342 984 332 Q 980 386 950 386 Q 921 386 918 332Z"/><path d="M 936 379 Q 950 362 971 375 Q 958 393 936 379Z" fill="#c77e6c"/>'
    : `<path d="M 928 339 Q 952 ${stars === 2 ? 369 : 356} 978 339" fill="none" stroke="#25281f" stroke-width="11" stroke-linecap="round"/>`
  const sparks = stars === 3 ? `<g fill="${colours.gold}"><path d="M 779 175 v28 m-14-14 h28" stroke="${colours.gold}" stroke-width="7"/><path d="M 1092 288 v20 m-10-10 h20" stroke="${colours.gold}" stroke-width="6"/><rect x="845" y="121" width="10" height="27" transform="rotate(-24 845 121)"/><rect x="1070" y="156" width="12" height="28" transform="rotate(27 1070 156)"/></g>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<title>WYRMLE: ${stars} of 3 stars</title>
<rect width="1200" height="630" fill="${colours.bg}"/>
<g font-family="'Share Tech Mono', 'DejaVu Sans Mono', monospace">
<text x="72" y="110" fill="${colours.fg}" font-size="49" letter-spacing="5">WYRMLE</text>
<g stroke="${colours.gold}" stroke-width="3" stroke-linejoin="round">${[1,2,3].map((i)=>`<path d="${star}" transform="translate(${104+(i-1)*90} 222)" fill="${i<=stars?colours.gold:'none'}" opacity="${i<=stars?1:.3}"/>`).join('')}</g>
<text x="70" y="352" fill="${colours.gold}" font-size="${stars===3?80:60}">${headline}</text>
<text x="74" y="402" fill="${colours.fg}" font-size="25" letter-spacing="1">${caption}</text>
<text x="74" y="552" fill="${colours.fg}" font-size="23" letter-spacing="2">A DAILY WORD BATTLE</text>
</g>
<g fill="${colours.green}"><rect x="661" y="385" width="82" height="69" rx="9"/><rect x="731" y="343" width="104" height="104" rx="11"/><rect x="816" y="303" width="112" height="127" rx="12"/><rect x="876" y="239" width="159" height="166" rx="18"/></g>
<g fill="${colours.bg}">${eyes}${mouth}</g>
${sparks}
</svg>`
}
