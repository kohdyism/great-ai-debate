import type { Content, FactItem } from './types';

// Default content. Everything here is editable from Host Mode → Content,
// saved in the host browser and exportable/importable as JSON.

const fact = (
  id: string,
  statement: string,
  answer: 'FACT' | 'FICTION',
  explanation: string,
): FactItem => ({ id, statement, kind: 'fact', answer, explanation, points: 10 });

const debate = (id: string, statement: string, explanation: string): FactItem => ({
  id,
  statement,
  kind: 'debate',
  answer: null,
  explanation,
  points: 10,
});

export const DEFAULT_CONTENT: Content = {
  facts: [
    fact(
      'f-detect',
      'Universities can reliably detect AI-generated assignments.',
      'FICTION',
      'Detection tools produce both false positives and false negatives. OpenAI withdrew its own AI-text classifier in July 2023, citing its low accuracy, and many universities warn staff not to rely on detector scores alone.',
    ),
    debate(
      'd-less-capable',
      'AI makes students less capable of independent thinking.',
      'DEBATE STATEMENT — evidence is mixed and still emerging. It depends heavily on how AI is used: as a shortcut or as a sparring partner.',
    ),
    fact(
      'f-chatgpt-date',
      'ChatGPT was released to the public in November 2022.',
      'FACT',
      'OpenAI launched ChatGPT as a free research preview on 30 November 2022. It reached an estimated 100 million users within about two months.',
    ),
    debate(
      'd-same-grades',
      'AI-generated assignments should receive the same grades as human-written assignments.',
      'DEBATE STATEMENT — a question of values and assessment design, not fact. What is a grade meant to measure: the output, or the student?',
    ),
    fact(
      'f-nonnative',
      'AI detectors flag essays by non-native English writers as AI-generated more often than essays by native speakers.',
      'FACT',
      'A 2023 Stanford study (Liang et al., published in Patterns) found popular GPT detectors misclassified over half of the non-native English (TOEFL) essays tested as AI-written, while native speakers’ essays were mostly classified correctly.',
    ),
    debate(
      'd-ai-tutors',
      'AI tutors can provide better personalised learning than human tutors.',
      'DEBATE STATEMENT — AI tutors scale and never tire; human tutors read the room and motivate. Research comparisons are early and context-dependent.',
    ),
    fact(
      'f-russell',
      'In 2023 the Russell Group of UK universities announced a ban on generative AI.',
      'FICTION',
      'In July 2023 the Russell Group published five principles committing its universities to support students and staff to become AI-literate and to use generative AI appropriately — not a ban.',
    ),
    debate(
      'd-fairer',
      'Banning AI would create a fairer university environment.',
      'DEBATE STATEMENT — supporters cite a level playing field; critics say bans are unenforceable and hurt students who rely on AI for accessibility.',
    ),
    fact(
      'f-fake-refs',
      'Chatbots like ChatGPT can invent academic references that look real but do not exist.',
      'FACT',
      'So-called “hallucinated” citations are widely documented: language models generate plausible-looking authors, titles and DOIs that do not exist. Always check every reference.',
    ),
    debate(
      'd-accessible',
      'AI makes higher education more accessible.',
      'DEBATE STATEMENT — AI can support disabled students and non-native speakers, but access to the best tools often costs money.',
    ),
    fact(
      'f-database',
      'A large language model checks every answer against a database of verified facts before it replies.',
      'FICTION',
      'Language models generate text by predicting likely next words from patterns learned in training. Unless connected to a search or retrieval tool, they do not look facts up — which is why they can be confidently wrong.',
    ),
    debate(
      'd-disadvantage',
      'Students who refuse to use AI are at a competitive disadvantage.',
      'DEBATE STATEMENT — depends on the course, the assessment and the job market. Is speed the same as learning?',
    ),
    fact(
      'f-eu-act',
      'Under the EU AI Act, AI systems used to evaluate students’ learning outcomes are classed as “high-risk”.',
      'FACT',
      'Annex III of the EU AI Act lists education and vocational training — including AI used for admissions and for evaluating learning outcomes — as high-risk uses, which carry extra obligations.',
    ),
    debate(
      'd-replace-lecturers',
      'AI will eventually replace university lecturers.',
      'DEBATE STATEMENT — a prediction, not a fact. Nobody can verify the future; argue it on plausibility.',
    ),
    fact(
      'f-misconduct',
      'Using AI is automatically classed as academic misconduct at every UK university.',
      'FICTION',
      'Policies vary by institution and by assessment. Many UK universities (UCL among them) set out categories — from AI not permitted, to AI allowed in an assistive role, to AI as an integral part of the task — usually with a requirement to acknowledge use.',
    ),
    debate(
      'd-misconduct',
      'Using AI is equivalent to academic misconduct.',
      'DEBATE STATEMENT — is it the tool, or the dishonesty about using it, that makes something misconduct?',
    ),
    fact(
      'f-usmle',
      'In 2023 researchers reported ChatGPT performing at or near the passing threshold on US medical licensing exam questions.',
      'FACT',
      'Kung et al. (PLOS Digital Health, February 2023) reported ChatGPT performed at or near the passing threshold on all three steps of USMLE-style questions, without specialised training.',
    ),
    debate(
      'd-teach-not-ban',
      'Universities should teach students how to use AI rather than prohibit it.',
      'DEBATE STATEMENT — the motion in disguise. A policy choice, not a factual claim.',
    ),
  ],

  scenarios: [
    { id: 's1', text: 'A student submits an entirely AI-generated dissertation. Should they graduate?', points: 10 },
    { id: 's2', text: 'An AI tutor consistently outperforms a university lecturer. Should the university replace the lecturer?', points: 10 },
    { id: 's3', text: 'A university discovers that 80% of its students use ChatGPT. Should it ban AI?', points: 10 },
    { id: 's4', text: 'An AI system gives students better grades than human lecturers. Should it be adopted?', points: 10 },
    { id: 's5', text: 'A student who refuses to use AI is disadvantaged compared with classmates. Is that fair?', points: 10 },
    { id: 's6', text: 'A lecturer uses AI to grade every student essay. Is this acceptable?', points: 10 },
    { id: 's7', text: 'A student uses AI to write a personal statement for a scholarship. Is that dishonest?', points: 10 },
    { id: 's8', text: 'Universities ban AI, but students continue using it secretly. Has the ban achieved anything?', points: 10 },
    { id: 's9', text: 'A university makes AI tools compulsory for every student. Is that fair?', points: 10 },
    { id: 's10', text: 'AI-generated research papers begin outperforming human researchers. What happens to academic research?', points: 10 },
    { id: 's11', text: 'A student with dyslexia uses AI to fix the spelling and structure of every essay. Should that be allowed?', points: 10 },
    { id: 's12', text: 'A professor finds half the class submitted AI-written reading summaries. Fail them — or change the assignment?', points: 10 },
  ],

  devil: [
    { id: 'dv-b1', team: 'ban', text: 'Argue why AI should be compulsory in every university.', points: 15 },
    { id: 'dv-b2', team: 'ban', text: 'Explain why AI-generated assignments should receive full marks.', points: 15 },
    { id: 'dv-b3', team: 'ban', text: 'Defend replacing lecturers with AI tutors.', points: 15 },
    { id: 'dv-b4', team: 'ban', text: "Argue that AI makes university fairer for students who can't afford private tutors.", points: 15 },
    { id: 'dv-b5', team: 'ban', text: 'Argue that banning AI would leave graduates unprepared for the workplace.', points: 15 },
    { id: 'dv-b6', team: 'ban', text: 'Defend letting students use AI in closed-book exams.', points: 15 },
    { id: 'dv-e1', team: 'embrace', text: 'Argue why AI should be banned from university assessments.', points: 15 },
    { id: 'dv-e2', team: 'embrace', text: 'Explain why AI damages independent thinking.', points: 15 },
    { id: 'dv-e3', team: 'embrace', text: 'Defend restricting AI access to preserve academic integrity.', points: 15 },
    { id: 'dv-e4', team: 'embrace', text: 'Argue that AI tutors will widen inequality between students.', points: 15 },
    { id: 'dv-e5', team: 'embrace', text: 'Argue that universities should return to handwritten, in-person exams.', points: 15 },
    { id: 'dv-e6', team: 'embrace', text: 'Defend the claim that AI-assisted research cannot be trusted.', points: 15 },
  ],

  roulette: [
    {
      id: 'c-devil',
      name: "DEVIL'S ADVOCATE",
      mode: 'devil',
      blurb: 'Argue it — even if you hate it.',
      questions: [
        { id: 'rq-dv1', text: 'Defend the statement: Universities should make AI use compulsory.' },
        { id: 'rq-dv2', text: 'Argue that AI-written essays deserve full marks if the ideas are good.' },
        { id: 'rq-dv3', text: 'Argue that every university exam should return to pen and paper.' },
        { id: 'rq-dv4', text: 'Make the case that lecturers should be replaced by AI tutors within ten years.' },
        { id: 'rq-dv5', text: 'Argue that using ChatGPT for coursework should be treated as plagiarism.' },
        { id: 'rq-dv6', text: 'Argue that AI detectors should be run on every single assignment.' },
      ],
    },
    {
      id: 'c-hot',
      name: 'HOT TAKE',
      mode: 'hot',
      blurb: 'Pick a side. No sitting on the fence.',
      questions: [
        { id: 'rq-h1', text: 'If AI makes students more productive, why should universities ban it?' },
        { id: 'rq-h2', text: 'If AI disappears tomorrow, would universities become better places to learn?' },
        { id: 'rq-h3', text: 'Is a degree earned with AI worth less than one earned without it?' },
        { id: 'rq-h4', text: 'Are essays dead as a form of assessment?' },
        { id: 'rq-h5', text: 'Should students be allowed to use AI in exams if lecturers use it to write them?' },
        { id: 'rq-h6', text: 'Is “AI literacy” just a buzzword?' },
      ],
    },
    {
      id: 'c-impossible',
      name: 'IMPOSSIBLE QUESTION',
      mode: 'impossible',
      blurb: 'There is no right answer. Find the best one.',
      questions: [
        { id: 'rq-i1', text: 'If AI can write better essays than humans, what is the purpose of university education?' },
        { id: 'rq-i2', text: 'If AI can teach better than a lecturer, why do we still need lecturers?' },
        { id: 'rq-i3', text: "If you can't tell whether a human or an AI wrote it, does it matter?" },
        { id: 'rq-i4', text: 'Who owns an idea that a student and an AI came up with together?' },
        { id: 'rq-i5', text: 'If AI helps the weakest students the most, is banning it elitist?' },
        { id: 'rq-i6', text: 'Can a machine ever be “intellectually honest”?' },
      ],
    },
    {
      id: 'c-switch',
      name: 'SWITCH SIDES',
      mode: 'switch',
      blurb: "Defend the other team's position.",
      questions: [
        { id: 'rq-s1', text: "Using your opponents' best argument, convince the audience that they are right." },
        { id: 'rq-s2', text: 'Should a student who uses ChatGPT to write an entire dissertation receive the same degree? Answer as your opponents would.' },
        { id: 'rq-s3', text: 'As your opponents: should AI be allowed to make university admissions decisions?' },
        { id: 'rq-s4', text: 'As your opponents: should lecturers be allowed to use AI to write student feedback?' },
        { id: 'rq-s5', text: 'As your opponents: should first-years be banned from AI while final-years can use it?' },
      ],
    },
    {
      id: 'c-ten',
      name: '10-SECOND CHALLENGE',
      mode: 'ten',
      blurb: 'Ten seconds. Go.',
      questions: [
        { id: 'rq-t1', text: 'Name three things AI cannot do for a student.' },
        { id: 'rq-t2', text: 'Describe ChatGPT in one word — and justify it.' },
        { id: 'rq-t3', text: 'Give one rule every university AI policy should include.' },
        { id: 'rq-t4', text: 'Would you trust an AI to decide whether you graduate? Yes or no — and why?' },
        { id: 'rq-t5', text: 'Finish the sentence: “Universities exist to…”' },
        { id: 'rq-t6', text: 'Name one job a university should never hand to AI.' },
      ],
    },
    {
      id: 'c-wild',
      name: 'WILD CARD',
      mode: 'wild',
      blurb: 'Anything goes.',
      questions: [
        { id: 'rq-w1', text: 'Pitch a brand-new university degree that only exists because of AI.' },
        { id: 'rq-w2', text: 'Say, out loud, the one-sentence AI policy for Goodenough College.' },
        { id: 'rq-w3', text: 'You are the Vice-Chancellor. A journalist asks: “Is your degree still meaningful?” Respond.' },
        { id: 'rq-w4', text: 'Convince the audience in 30 seconds that this debate was written by an AI.' },
        { id: 'rq-w5', text: 'Describe a university in 2050 — in exactly three sentences.' },
        { id: 'rq-w6', text: 'Pick one audience member and win them over to your side.' },
      ],
    },
    {
      id: 'c-audience',
      name: 'AUDIENCE DECIDES',
      mode: 'audience',
      blurb: 'The room chooses who answers.',
      questions: [
        { id: 'rq-a1', text: 'Should AI be allowed to mark final-year dissertations?' },
        { id: 'rq-a2', text: 'Is it cheating to use AI to brainstorm ideas?' },
        { id: 'rq-a3', text: "Should universities monitor students' AI usage?" },
        { id: 'rq-a4', text: 'Would you rather have a brilliant AI tutor or an average human one?' },
        { id: 'rq-a5', text: 'Should a university have to tell students when a lecture was written by AI?' },
      ],
    },
    {
      id: 'c-double',
      name: 'DOUBLE OR NOTHING',
      mode: 'double',
      blurb: 'Risk it. Win double — or lose the stake.',
      questions: [
        { id: 'rq-d1', text: 'In 60 seconds, convince the room: “AI makes students lazier.”' },
        { id: 'rq-d2', text: 'Defend: “A degree completed with AI is still a real degree.”' },
        { id: 'rq-d3', text: 'Defend: “Universities that ban AI will fall behind.”' },
        { id: 'rq-d4', text: 'Defend: “Students should be graded on how well they use AI.”' },
        { id: 'rq-d5', text: 'Defend: “Handwritten exams are the only fair exams.”' },
      ],
    },
  ],

  settings: {
    openingSec: 60,
    closingSec: 90,
    prepSec: 30,
    responseSec: 60,
    challengeSec: 30,
    tenSec: 10,
    pollPoints: 10,
    rouletteSpinMs: 7000,
    doubleStake: 10,
    roulettePoints: 10,
    devilBonus: 15,
  },
};

/** Segment colours for the wheel, alternating red / blue / gold / dark. */
export const WHEEL_COLORS = ['#e3192b', '#1565ff', '#e9b53a', '#10131c', '#e3192b', '#1565ff', '#e9b53a', '#10131c'];
