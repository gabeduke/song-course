// The practice book's lessons: the ideas behind the drills, short enough to
// read before you play. Each points at the drills that practise it.
// Plain data, no DOM.

export const LESSONS = [
  {
    id: 'soloing-over-changes',
    title: 'Soloing over chord changes',
    summary: 'Why one scale over everything stops working, and a method that follows the chords: triads, timing, the scale in between, simple phrases.',
    sections: [
      {
        h: 'The problem',
        p: [
          'Most of us learn chords for rhythm and one pentatonic box for solos, and the two never meet. The box works over a blues jam, but over a song that changes chord every bar it sounds like noodling, because nothing you play knows the chord has changed.',
          'Players who sound good over changes don’t know more scales. Their notes move when the chords move.',
        ],
      },
      {
        h: '1. See each chord as a triad',
        p: [
          'Every major or minor chord is three notes: root, 3rd and 5th. On any three neighbouring strings they make a small shape, and there’s one within reach wherever your hand is on the neck. You don’t need the full barre chord; the triad is the chord’s skeleton.',
          'Learn the three shapes of one chord on strings 1–3 first, the most useful set for soloing. Then the same on 2–4.',
        ],
      },
      {
        h: '2. Time before notes',
        p: [
          'A few notes in time beat a lot of notes out of it. Landing on a chord tone on beat 1 only works if you know where beat 1 is, so make sure you can change chords on the beat and play steady eighths and sixteenths against a click before worrying about what to play.',
        ],
      },
      {
        h: '3. The scale lives between the triad’s notes',
        p: [
          'Keep the triad shape and add the notes of the key that sit between its notes, on the same strings. The triad notes are where you land; the in-between notes are how you get there.',
          'When the chord changes, the triad changes and the landing spots move, but most of the in-between notes stay where they were. You’re not changing scales, only targets.',
        ],
      },
      {
        h: '4. Keep phrases simple',
        p: ['One phrase per chord is enough to start:'],
        list: [
          'a chord tone on beat 1,',
          'two or three steps through the scale,',
          'a chord tone, held,',
          'a breath, then a note leading into the next chord’s nearest triad note just before it arrives.',
        ],
        after: 'Repeat that shape over every chord and it already sounds like you’re following the changes. Add more later; leaving space never stops sounding good.',
      },
      {
        h: '5. Make it go anywhere',
        p: [
          'Once it works in one key, on one string set, in one place on the neck, move one thing at a time: the area of the neck, the string set, then the key. The method stays the same, only where it sits changes.',
        ],
      },
    ],
    drills: ['triad-inversions', 'triads-in-key', 'rhythm-ladder', 'triad-changes', 'triad-solo'],
  },
  {
    id: 'triads',
    title: 'Triads and inversions',
    summary: 'Three notes, three shapes, four string sets: the small chord shapes everything else hangs on.',
    sections: [
      {
        h: 'What a triad is',
        p: [
          'A root, a 3rd and a 5th. The 3rd makes it major (four frets above the root) or minor (three frets). Every major and minor chord you already play is a triad with some notes doubled.',
        ],
      },
      {
        h: 'Three inversions',
        p: [
          'On three neighbouring strings any of the three notes can be at the bottom. Root position has the root lowest, first inversion the 3rd, second inversion the 5th. Going up the neck they come round in that order and repeat after twelve frets.',
          'Each inversion has a different sound as well as a different shape: root position is solid, the inversions lighter. Over a band, the top note is the one people hear as the melody.',
        ],
      },
      {
        h: 'Four string sets',
        p: [
          'Strings 1–3, 2–4, 3–5 and 4–6. The shapes change wherever the B string is involved, because it’s tuned a fret lower relative to its neighbours, so learn each set as its own thing. For lead playing, 1–3 and 2–4 matter most.',
        ],
      },
      {
        h: 'How to learn them',
        list: [
          'Find the root in each shape first; it’s your anchor.',
          'Say the inversion out loud as you play it.',
          'Then play the minor version: only the 3rd moves, down one fret.',
          'Then walk the key: the seven chords of a key in one inversion on one string set.',
        ],
      },
    ],
    drills: ['triad-inversions', 'triads-in-key', 'triad-changes'],
  },
  {
    id: 'pentatonic',
    title: 'The pentatonic map',
    summary: 'Five notes, five boxes that join up the neck, major and minor in the same shapes, and how to get out of the box.',
    sections: [
      {
        h: 'Five notes, five boxes',
        p: [
          'Minor pentatonic is the root, ♭3, 4, 5 and ♭7. Its five boxes cover the neck end to end. Box 1 starts on the root on the low E string, and each box starts where the one before had its second note.',
          'Always know where the roots are in each box. They’re the notes a phrase comes home to.',
        ],
      },
      {
        h: 'Major and minor share the boxes',
        p: [
          'A minor pentatonic and C major pentatonic are the same five notes, so the shapes are the same; what changes is which note sounds like home. To play G major pentatonic, use the E minor shapes: the same notes, three frets lower than you’d put G’s minor box.',
        ],
      },
      {
        h: 'The blues note',
        p: [
          'Add the ♭5 between the 4 and the 5 and you have the blues scale. It’s a passing note: slide or bend through it, don’t sit on it.',
        ],
      },
      {
        h: 'Getting out of the box',
        list: [
          'Learn the boxes in pairs, the way they join, sliding from one to the next on the top strings.',
          'Sequences (threes, fours) turn a scale into phrases.',
          'String skipping breaks the up-and-down habit and gives you wider, more melodic jumps.',
          'Copying short phrases by ear makes the box into a vocabulary rather than a shape.',
        ],
      },
    ],
    drills: ['pentatonic-boxes', 'pentatonic-connect', 'string-skipping', 'call-response'],
  },
  {
    id: 'caged',
    title: 'CAGED: one chord, five shapes',
    summary: 'The open C, A, G, E and D chords slide up the neck and link together, so every chord can be played in five places.',
    sections: [
      {
        h: 'The idea',
        p: [
          'The open C, A, G, E and D chord shapes can each be moved up the neck as a barre shape. In that order, C A G E D, they join end to end, so any major chord has five places on the neck, one per shape.',
        ],
      },
      {
        h: 'The order',
        p: [
          'Whichever shape you start on, the next one up is the next letter, round to C again an octave higher. In G: the open G shape, the E shape barred at the 3rd fret, the D shape at the 5th, the C shape around the 7th and the A shape at the 10th.',
          'Neighbouring shapes share notes. Those shared notes are where your hand moves from one to the next.',
        ],
      },
      {
        h: 'Why it matters',
        p: [
          'Each shape is a home for the scale box and the triads around it. The pentatonic boxes sit over these shapes, and the triads on each string set are pieces of them. When you know where the chord is in a position, you know where the strong notes are.',
        ],
      },
      {
        h: 'How to practise it',
        list: [
          'One key at a time: play each shape and say its name.',
          'Find every root in the shape.',
          'Join two neighbouring shapes, then all five, up the neck and back.',
          'You rarely need a full six-string shape. Three or four strings of it is how you’ll use it.',
        ],
      },
    ],
    drills: ['caged', 'triad-inversions', 'scale-positions'],
  },
  {
    id: 'the-neck',
    title: 'Learning the notes on the neck',
    summary: 'The natural notes, the landmarks, octave shapes, and a few minutes a day, one note at a time.',
    sections: [
      {
        h: 'Start with the naturals',
        p: [
          'A B C D E F G, with a fret between each, except B to C and E to F, which are next to each other. The sharps and flats fill the gaps.',
          'Learn the low E and A strings first: they’re where the roots of barre chords and most scale boxes are.',
        ],
      },
      {
        h: 'Landmarks',
        p: [
          'The dots are at frets 3, 5, 7, 9 and 12, and at 12 everything starts again an octave up. On the low E: G at 3, A at 5, B at 7, C♯ at 9, E at 12. On the A string: C at 3, D at 5, E at 7, F♯ at 9, A at 12.',
        ],
      },
      {
        h: 'Octave shapes',
        p: [
          'From a note on the low E or A string, the same note an octave up is two strings higher and two frets up. From the D or G string it’s three frets up, because the B string is tuned a fret lower. Chain two octave shapes and you’ve found a note on four strings.',
        ],
      },
      {
        h: 'One note at a time',
        p: [
          'Pick one note. Find it on every string, low to high and back, saying its name. Next day, the next note round the cycle of fourths: C, F, B♭, E♭, A♭, D♭, G♭, B, E, A, D, G. Two or three minutes a day adds up quicker than you’d think.',
        ],
      },
    ],
    drills: ['find-notes', 'octaves', 'caged'],
  },
  {
    id: 'timing',
    title: 'Timing and the click',
    summary: 'Why time matters more than notes, the strumming hand that never stops, counting out loud, and how to use the click.',
    sections: [
      {
        h: 'Time comes first',
        p: [
          'People forgive a wrong note long before a late one. Steady time is the part of your playing everyone else leans on, and it’s what makes a few notes sound like a solo.',
        ],
      },
      {
        h: 'Keep the hand moving',
        p: [
          'When you strum, the hand goes down on the beats and up on the “ands”, all the time, whether it hits the strings or not. A pattern is only a choice about which of those motions touch the strings. That’s what keeps it steady: the hand is the clock.',
        ],
      },
      {
        h: 'Count out loud',
        p: [
          '“1 & 2 & 3 & 4 &” for eighths, “1 e & a 2 e & a” for sixteenths. If you can’t say it while you play, you don’t feel it yet. Saying it fixes that quicker than anything.',
        ],
      },
      {
        h: 'Using the click',
        list: [
          'Find a tempo where it’s easy, and play four clean bars.',
          'Go up about 4 bpm. When it falls apart, come back down two steps and stay there a while.',
          'Mute the strings for a percussive chuck now and then: it shows every wobble.',
          'Record yourself sometimes. The recording is honest.',
        ],
      },
    ],
    drills: ['rhythm-ladder', 'strumming', 'chord-changes'],
  },
  {
    id: 'technique',
    title: 'Clean technique',
    summary: 'Fretting, picking and muting: the small habits that make notes sound clean, and why slow practice is the fast way.',
    sections: [
      {
        h: 'The fretting hand',
        p: [
          'Press just behind the fret with your fingertip, only as hard as it takes to get a clear note. Fingers that aren’t playing hover close to the strings, ready. The thumb sits behind the neck for stretches and scales, over the top for chords and bends.',
        ],
      },
      {
        h: 'The picking hand',
        p: [
          'Alternate picking, down up down up, is the default. Keep the motion small, from the wrist, with the pick only just getting past the string. Crossing between strings is where most mistakes happen, so practise it on purpose.',
        ],
      },
      {
        h: 'Muting',
        p: [
          'Strings ringing when they shouldn’t is what makes playing sound messy. The fretting hand’s spare fingers rest lightly on the strings you aren’t playing, and the side of the picking hand covers the low strings. Octaves and double stops teach it best: they only sound right when everything else is quiet.',
        ],
      },
      {
        h: 'Slow is the shortcut',
        p: [
          'Practise at a speed where every note is right. Speed comes from repeating the right motion, not from rushing the wrong one. When it’s clean three times running, go up a little.',
        ],
      },
    ],
    drills: ['chromatic', 'legato', 'string-skipping', 'octaves', 'double-stops'],
  },
  {
    id: 'ear',
    title: 'Training your ear',
    summary: 'Hearing each note against the key, singing before playing, and copying phrases: a little every day, like the hands.',
    sections: [
      {
        h: 'Why',
        p: [
          'Being able to play what you hear, in your head or on a record, is where all the rest is going. The ear improves the same way the hands do: a little, often.',
        ],
      },
      {
        h: 'Hear notes against the key',
        p: [
          'Every note of a key has its own feel against the root. The 3rd sounds settled, the 5th strong and open, the 7th leans up into the root, the 4th wants to fall to the 3rd, the 2nd and 6th float. Learn those feelings over a held chord and you can name notes without seeing them.',
        ],
      },
      {
        h: 'Sing it, then play it',
        p: [
          'If you can sing a phrase, you can find it. Sing it back, find the first note, then for each next note ask: up or down, and a step or a jump?',
        ],
      },
      {
        h: 'Call and response',
        p: [
          'Copy short phrases right after you hear them. Start with three notes in one box and one key; it’s how players learned long before tab. The longer ones come with time.',
        ],
      },
    ],
    drills: ['scale-degrees', 'call-response'],
  },
  {
    id: 'practising',
    title: 'How to practise',
    summary: 'What goes in a session, one goal per drill, little and often, and writing it down.',
    sections: [
      {
        h: 'A session',
        list: [
          'Warm up: five minutes, hands and time.',
          'Something new: ten to fifteen minutes on the thing you can’t do yet.',
          'Something you’re getting better at: ten minutes, a bit faster or in a new key.',
          'Then music: a song, or a jam over the band.',
        ],
        after: 'Your session on the front page of the book is set up that way. Change it to suit you.',
      },
      {
        h: 'One goal per drill',
        p: [
          '“Box 2 at 80 bpm, no mistakes”, not “pentatonic”. Small, specific goals tell you when you’re done and when to move on.',
        ],
      },
      {
        h: 'Little and often',
        p: [
          'Twenty minutes every day beats two hours on Sunday: your hands learn while you sleep. Stop while it’s still going well, and you’ll want to come back.',
        ],
      },
      {
        h: 'Keep track',
        p: [
          'Note the tempo you reached and what was hard, and start there next time. The book remembers each drill’s key, settings and tempo for you.',
        ],
      },
    ],
    drills: [],
  },
];

export function lessonById(id) {
  return LESSONS.find((l) => l.id === id) ?? null;
}

/** The lessons that send you to this drill. */
export function lessonsFor(drillId) {
  return LESSONS.filter((l) => l.drills.includes(drillId));
}
