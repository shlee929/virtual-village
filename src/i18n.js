// UI strings. Learners are Tharu-speaking Grade 2 children learning Nepali (MTB-MLE).
// UI languages: Nepali (school language, teachers), English (partners), Korean (research team).
// Tharu, the children's mother tongue, is carried by the content (every word card, hint and
// recorded voice: see tools/content.json). A Tharu UI can be added as I18N.thr once a Tharu
// speaker has written it; until then it is left out rather than guessed. Missing keys fall back to Nepali.

export const UI_LANGS = [
  { id: 'ne', label: 'नेपाली', short: 'ने' },
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'ko', label: '한국어', short: '한' },
];

// Shown text is kept to a minimum (children read little; pictures, dots and the guide's voice lead).
// Many keys below are only screen-reader labels (aria-label).
export const I18N = {
  ne: {
    stageN: (n) => `स्टेज ${n}`,
    notStarted: 'सुरु भएको छैन', inProgress: (a, b) => `${a}/${b} भेटियो`, done: 'सकियो',
    startStage: 'सुरु', reset: 'सुरुदेखि', passport: 'गाउँ राहदानी',
    resetConfirm: 'सबै छाप र भेटिएका शब्द मेटिन्छन्। सुरुदेखि गर्ने?',
    home: 'स्टेज छान्ने ठाउँ', langLabel: 'भाषा',
    prevSpot: 'अघिल्लो ठाउँ', nextSpot: 'अर्को ठाउँ', walk: (d) => ({ f: 'अगाडि', b: 'पछाडि', l: 'देब्रे', r: 'दाहिने' })[d],
    listen: 'सुन', hint: 'सङ्केत', other: 'अर्को शब्द', play: 'खेलौँ',
    ok: 'हुन्छ', close: 'बन्द गर',
    fact: { baby: 'बच्चा', food: 'खाना', home: 'घर', sound: 'आवाज', move: 'चाल', group: 'खानाको समूह', unit: 'नापतौल', days: 'बार', posture: 'आसन' },
    actRight: 'ठीक छ!', actWrong: 'फेरि प्रयास गर!', actDone: 'स्याबास!',
    getStamp: 'छाप लिऊ',
    plantSeed: 'बिउ रोप', water: 'पानी हाल', countDone: 'गनेँ!',
    needN: (n) => `${n} वटा चाहिन्छ`,
    totalQ: 'डालोमा जम्मा कति थोक छ?',
    stampGot: (name) => `"${name}" को छाप पायौ!`, allDone: 'सबै स्टेज सकियो!',
    backToStages: 'स्टेजहरू',
    loading: 'खुल्दैछ…',
    noVoice: (lang) => `${lang} आवाज छैन`,
    mapLabel: 'नक्सा', unknownSpot: 'के होला? छोएर हेर',
    thrLabel: 'थारु', neLabel: 'नेपाली', enLabel: 'English',
  },
  en: {
    stageN: (n) => `Stage ${n}`,
    notStarted: 'Not started', inProgress: (a, b) => `${a}/${b} found`, done: 'Done',
    startStage: 'Start', reset: 'Start over', passport: 'Village Passport',
    resetConfirm: 'This clears all stamps and found words. Start over?',
    home: 'Stage select', langLabel: 'Language',
    prevSpot: 'Previous spot', nextSpot: 'Next spot', walk: (d) => ({ f: 'Forward', b: 'Back', l: 'Left', r: 'Right' })[d],
    listen: 'Listen', hint: 'Hint', other: 'Another word', play: 'Play',
    ok: 'OK', close: 'Close',
    fact: { baby: 'Baby', food: 'Food', home: 'Home', sound: 'Sound', move: 'Moves', group: 'Food group', unit: 'Unit', days: 'Days', posture: 'Posture' },
    actRight: 'Correct!', actWrong: 'Try again!', actDone: 'Great job!',
    getStamp: 'Get the stamp',
    plantSeed: 'Plant the seed', water: 'Water it', countDone: 'Done!',
    needN: (n) => `We need ${n}`,
    totalQ: 'How many things are in the basket?',
    stampGot: (name) => `You got the "${name}" stamp!`, allDone: 'All stages done!',
    backToStages: 'Stages',
    loading: 'Loading…',
    noVoice: (lang) => `No ${lang} voice in this browser`,
    mapLabel: 'Map', unknownSpot: 'What is it? Tap to see',
    thrLabel: 'Tharu', neLabel: 'Nepali', enLabel: 'English',
  },
  ko: {
    stageN: (n) => `스테이지 ${n}`,
    notStarted: '시작 전', inProgress: (a, b) => `${a}/${b} 찾음`, done: '완료',
    startStage: '시작', reset: '처음부터', passport: '마을 여권',
    resetConfirm: '모은 도장과 찾은 낱말이 모두 지워져요. 처음부터 할까요?',
    home: '스테이지 선택', langLabel: '언어',
    prevSpot: '이전 지점', nextSpot: '다음 지점', walk: (d) => ({ f: '앞으로', b: '뒤로', l: '왼쪽', r: '오른쪽' })[d],
    listen: '듣기', hint: '힌트', other: '다른 낱말', play: '놀이 시작',
    ok: '좋아요', close: '닫기',
    fact: { baby: '새끼', food: '먹이·음식', home: '사는 곳', sound: '소리', move: '움직임', group: '음식 분류', unit: '단위', days: '요일', posture: '자세' },
    actRight: '맞았어요!', actWrong: '다시 해 봐요!', actDone: '잘했어요!',
    getStamp: '도장 받기',
    plantSeed: '씨앗 심기', water: '물 주기', countDone: '다 셌어요',
    needN: (n) => `${n}개가 필요해요`,
    totalQ: '바구니에 모두 몇 개 있을까요?',
    stampGot: (name) => `‘${name}’ 도장을 받았어요!`, allDone: '모든 스테이지를 마쳤어요!',
    backToStages: '스테이지',
    loading: '불러오는 중…',
    noVoice: (lang) => `이 브라우저에는 ${lang} 음성이 없어요`,
    mapLabel: '지도', unknownSpot: '무엇일까요? 눌러 봐요',
    thrLabel: '타루어', neLabel: '네팔어', enLabel: '영어',
  },
};

const pickDefault = () => {
  try {
    const saved = localStorage.getItem('vv.lang');
    if (saved && I18N[saved]) return saved;
  } catch { /* storage blocked */ }
  return /^ko/i.test(navigator.language || '') ? 'ko' : 'ne';
};
let lang = pickDefault();
export const getLang = () => lang;
export const setLangValue = (l) => {
  if (!I18N[l]) return;
  lang = l;
  try { localStorage.setItem('vv.lang', l); } catch { /* ignore */ }
};
export const t = (k, ...a) => { const v = I18N[lang][k] ?? I18N.ne[k]; return typeof v === 'function' ? v(...a) : v; };
// localized content object {ne, en, ko, thr?}
export const L = (obj) => (obj ? obj[lang] ?? obj.ne ?? obj.en ?? obj.ko ?? '' : '');
export const toDeva = (n) => String(n).replace(/\d/g, (d) => '०१२३४५६७८९'[d]);
// Nepali number words 0-50 (counting game)
export const NE_NUM = ['शून्य', 'एक', 'दुई', 'तीन', 'चार', 'पाँच', 'छ', 'सात', 'आठ', 'नौ', 'दस',
  'एघार', 'बाह्र', 'तेह्र', 'चौध', 'पन्ध्र', 'सोह्र', 'सत्र', 'अठार', 'उन्नाइस', 'बीस',
  'एक्काइस', 'बाइस', 'तेइस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताइस', 'अट्ठाइस', 'उनन्तीस', 'तीस',
  'एकतीस', 'बत्तीस', 'तेत्तीस', 'चौँतीस', 'पैँतीस', 'छत्तीस', 'सैँतीस', 'अठतीस', 'उनन्चालीस', 'चालीस',
  'एकचालीस', 'बयालीस', 'त्रिचालीस', 'चवालीस', 'पैँतालीस', 'छयालीस', 'सतचालीस', 'अठचालीस', 'उनन्पचास', 'पचास'];
