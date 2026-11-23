// UI strings. Learners are Tharu-speaking Grade 2 children learning Nepali (MTB-MLE).
// UI languages: Nepali (school language, teachers), English (partners), Korean (research team).
// Tharu, the children's mother tongue, is carried by the content (every word card, hint and
// recorded voice: see tools/content.json). A Tharu UI can be added as I18N.thr once a Tharu
// speaker has written it; until then it is left out rather than guessed. Missing keys fall back to Nepali.

const eul = (w) => {           // 을/를 after a Korean noun
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return '을(를)';
  return (c - 0xac00) % 28 ? '을' : '를';
};

export const UI_LANGS = [
  { id: 'ne', label: 'नेपाली', short: 'ने' },
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'ko', label: '한국어', short: '한' },
];

export const I18N = {
  ne: {
    kicker: 'भर्चुअल गाउँ · कक्षा २ · थारु → नेपाली',
    lede: 'गाउँका छवटा ठाउँ ३६०° फोटोमा घुम्दै थारु शब्दलाई नेपाली (र अङ्ग्रेजी) सँग जोडौँ। दुई ठाउँ 3D (3DGS) मा बदलिन्छन्, त्यहाँ हिँडेर हेर्न सकिन्छ।',
    chooseStage: 'स्टेज छान',
    stageN: (n) => `स्टेज ${n}`,
    notStarted: 'सुरु भएको छैन', inProgress: (a, b) => `${a}/${b} भेटियो`, done: 'सकियो',
    subj: { serophero: 'हाम्रो सेरोफेरो', english: 'अङ्ग्रेजी', nepali: 'नेपाली' },
    linked: 'जोडिएका विषय', goalLabel: 'सिकाइ उद्देश्य', placeLabel: 'गाउँको ठाउँ', gameLabel: 'खेल',
    startStage: 'सुरु गरौँ', reset: 'सुरुदेखि', passport: 'गाउँ राहदानी',
    resetConfirm: 'सबै छाप र भेटिएका शब्द मेटिन्छन्। सुरुदेखि गर्ने?',
    testNote: 'Virtual Village Phase 2 प्रोटोटाइप · फोटो हान्दोङ विश्वविद्यालय क्याम्पसमा खिचिएको (थारु गाउँको सट्टा) · थारु शब्द मस्यौदा हुन्, थारु भाषीले जाँच्नुपर्छ · आवाज ब्राउजरको TTS हो, पछि रेकर्ड गरिएको आवाजले बदलिन्छ।',
    home: 'स्टेज छान्ने ठाउँ', langLabel: 'भाषा',
    spotOf: (i, n) => `${i}/${n} ठाउँ`, filmedAt: (p) => `फोटो: ${p}`,
    media360: '३६०° फोटो', media3d: '3D ठाउँ',
    hint360: 'तानेर हेर · भुइँको गोलो थिचे अर्को ठाउँ जान्छ',
    hint360Touch: 'औँलाले सारेर हेर · भुइँको गोलो थिच',
    hint3d: '3D ठाउँ! तीर वा WASD ले हिँड',
    hint3dTouch: '3D ठाउँ! तीरका बटनले हिँड',
    prevSpot: 'अघिल्लो ठाउँ', nextSpot: 'अर्को ठाउँ', walk: (d) => ({ f: 'अगाडि', b: 'पछाडि', l: 'देब्रे', r: 'दाहिने' })[d],
    stepFind: (a, b) => `चित्र र थोक भेट्ने ${a}/${b}`,
    stepAct: (name) => `खेल: ${name}`,
    stepStamp: 'छाप लिने',
    askFind: 'रुपा दिदीले भनेको कुरा खोज',
    listen: 'सुन', hint: 'सङ्केत', other: 'अर्को शब्द', play: 'खेल खेलौँ',
    hintText: (thr, spot) => `थारुमा: ${thr} · ${spot} नम्बर ठाउँमा`,
    allFound: 'सबै भेटियो! अब खेल खेलौँ।', stageDone: 'यो स्टेज सकियो! अर्को स्टेज छान।',
    found: 'भेटियो!', wordsLearned: 'सिकेका शब्द', noWords: 'अहिलेसम्म कुनै शब्द भेटिएको छैन।',
    sayIt: 'भन त!', ok: 'हुन्छ', close: 'बन्द गर', next: 'अर्को',
    ttsNote: 'आवाज: ब्राउजरको TTS · थारु आवाज रेकर्ड गर्न बाँकी', thrDraft: 'थारु शब्द मस्यौदा हो',
    thrSrc: { tcv: 'स्रोत: TCV शब्दसूची', 'tcv-dangaura': 'स्रोत: TCV शब्दसूची (डँगौरा)', guess: 'स्रोत छैन, अनुमान' },
    approxThr: 'थारु आवाज रेकर्ड भएको छैन, नेपाली आवाजले पढ्दैछ',
    fact: { baby: 'बच्चा', food: 'खाना', home: 'घर', sound: 'आवाज', move: 'चाल', group: 'खानाको समूह', unit: 'नापतौल', days: 'बार', posture: 'आसन' },
    actRight: 'ठीक छ!', actWrong: 'फेरि प्रयास गर!', actDone: 'धेरै राम्रो! सबै मिल्यो।',
    tapOrDrag: 'कार्ड छोएर ठाउँमा छोऊ, वा तानेर राख।',
    getStamp: 'छाप लिऊ',
    plantSeed: 'बिउ रोप', water: 'पानी हाल', waterLeft: (n) => `अझै ${n} पटक पानी हाल`, tapParts: 'बिरुवाका भाग छोऊ',
    listTitle: 'किनमेलको सूची', basket: 'डालो', countDone: 'गनेँ!',
    needN: (n, got) => `${n} वटा चाहिन्छ, डालोमा ${got} वटा छ। फेरि गन।`,
    totalQ: 'डालोमा जम्मा कति थोक छ?',
    stampGot: (name) => `"${name}" को छाप पायौ!`, allDone: 'सबै स्टेज सकियो! स्याबास!',
    actResult: (title, a, b) => `${title}: पहिलो प्रयासमै ठीक ${a}/${b}`,
    keepExploring: 'घुम्दै गर', backToStages: 'स्टेजमा फर्क',
    loading: 'खुल्दैछ…', loading3d: '3D ठाउँ खुल्दैछ…',
    arrive3d: (name) => `${name}: 3D ठाउँ! हिँडेर हेर।`,
    noVoice: (lang) => `यो ब्राउजरमा ${lang} आवाज छैन। (Edge वा एन्ड्रोइड Chrome मा सुनिन्छ)`,
    mapLabel: 'नक्सा', missionToggle: 'खोल / बन्द', unknownSpot: 'के होला? छोएर हेर',
    thrLabel: 'थारु (मातृभाषा)', neLabel: 'नेपाली', enLabel: 'अङ्ग्रेजी',
  },
  en: {
    kicker: 'Virtual Village · Grade 2 · Tharu → Nepali',
    lede: 'Walk six village places in 360° photos and connect Tharu words to Nepali (and English). Two places turn into 3D (3DGS) so you can walk around inside them.',
    chooseStage: 'Choose a stage',
    stageN: (n) => `Stage ${n}`,
    notStarted: 'Not started', inProgress: (a, b) => `${a}/${b} found`, done: 'Done',
    subj: { serophero: 'Our Surroundings', english: 'English', nepali: 'Nepali' },
    linked: 'Linked subjects', goalLabel: 'Learning goal', placeLabel: 'Village place', gameLabel: 'Game',
    startStage: 'Let\'s start', reset: 'Start over', passport: 'Village Passport',
    resetConfirm: 'This clears all stamps and found words. Start over?',
    testNote: 'Virtual Village Phase 2 prototype · photos taken on the Handong campus (standing in for a Tharu village) · Tharu words are drafts to be checked by a Tharu speaker · voices are browser TTS, to be replaced by recordings.',
    home: 'Stage select', langLabel: 'Language',
    spotOf: (i, n) => `Spot ${i} of ${n}`, filmedAt: (p) => `Photo: ${p}`,
    media360: '360° photo', media3d: '3D place',
    hint360: 'Drag to look · tap a floor ring to move',
    hint360Touch: 'Swipe to look · tap a floor ring to move',
    hint3d: '3D place! Walk with the arrows or WASD',
    hint3dTouch: '3D place! Walk with the arrow buttons',
    prevSpot: 'Previous spot', nextSpot: 'Next spot', walk: (d) => ({ f: 'Forward', b: 'Back', l: 'Left', r: 'Right' })[d],
    stepFind: (a, b) => `Find people & things ${a}/${b}`,
    stepAct: (name) => `Game: ${name}`,
    stepStamp: 'Get the stamp',
    askFind: 'Find what Rupa Didi says',
    listen: 'Listen', hint: 'Hint', other: 'Another word', play: 'Play the game',
    hintText: (thr, spot) => `In Tharu: ${thr} · at spot ${spot}`,
    allFound: 'You found them all! Now play the game.', stageDone: 'Stage complete! Choose another stage.',
    found: 'You found it!', wordsLearned: 'Words learned', noWords: 'No words found yet.',
    sayIt: 'Say it!', ok: 'OK', close: 'Close', next: 'Next',
    ttsNote: 'Voice: browser TTS · Tharu audio still to be recorded', thrDraft: 'Tharu word is a draft',
    thrSrc: { tcv: 'source: TCV word list', 'tcv-dangaura': 'source: TCV word list (Dangaura)', guess: 'no source, a guess' },
    approxThr: 'No Tharu recording yet: read by a Nepali voice',
    fact: { baby: 'Baby', food: 'Food', home: 'Home', sound: 'Sound', move: 'Moves', group: 'Food group', unit: 'Unit', days: 'Days', posture: 'Posture' },
    actRight: 'Correct!', actWrong: 'Try again!', actDone: 'Great job! All matched.',
    tapOrDrag: 'Tap a card, then its place, or drag it there.',
    getStamp: 'Get the stamp',
    plantSeed: 'Plant the seed', water: 'Water it', waterLeft: (n) => `Water it ${n} more time${n > 1 ? 's' : ''}`, tapParts: 'Tap the plant parts',
    listTitle: 'Shopping list', basket: 'Basket', countDone: 'Done counting',
    needN: (n, got) => `You need ${n}; the basket has ${got}. Count again.`,
    totalQ: 'How many things are in the basket?',
    stampGot: (name) => `You got the "${name}" stamp!`, allDone: 'All stages done! Wonderful!',
    actResult: (title, a, b) => `${title}: right on first try ${a}/${b}`,
    keepExploring: 'Keep exploring', backToStages: 'Back to stages',
    loading: 'Loading…', loading3d: 'Loading 3D place…',
    arrive3d: (name) => `${name}: a 3D place. Walk around!`,
    noVoice: (lang) => `This browser has no ${lang} voice. (Try Edge or Chrome on Android.)`,
    mapLabel: 'Map', missionToggle: 'Collapse or expand', unknownSpot: 'What is it? Tap to see',
    thrLabel: 'Tharu (mother tongue)', neLabel: 'Nepali', enLabel: 'English',
  },
  ko: {
    kicker: 'Virtual Village · 2학년 · 타루어 → 네팔어',
    lede: '마을의 여섯 장소를 360° 사진으로 돌아보며 타루어 낱말을 네팔어(와 영어)로 이어 가요. 두 곳은 3D(3DGS)로 바뀌어 안을 걸어 볼 수 있어요.',
    chooseStage: '스테이지를 골라요',
    stageN: (n) => `스테이지 ${n}`,
    notStarted: '시작 전', inProgress: (a, b) => `${a}/${b} 찾음`, done: '완료',
    subj: { serophero: '우리 주변(Hamro Serophero)', english: '영어', nepali: '네팔어' },
    linked: '연계 교과', goalLabel: '학습 목표', placeLabel: '마을 공간', gameLabel: '활동',
    startStage: '시작하기', reset: '처음부터', passport: '마을 여권',
    resetConfirm: '모은 도장과 찾은 낱말이 모두 지워져요. 처음부터 할까요?',
    testNote: 'Virtual Village Phase 2 프로토타입 · 사진은 타루 마을 대신 한동대 캠퍼스에서 촬영 · 타루어는 초안이라 타루어 화자 검수가 필요해요 · 발음은 브라우저 TTS이며 녹음 파일로 바꿀 예정이에요.',
    home: '스테이지 선택', langLabel: '언어',
    spotOf: (i, n) => `${i}/${n} 지점`, filmedAt: (p) => `촬영: ${p}`,
    media360: '360° 사진', media3d: '3D 구역',
    hint360: '끌어서 둘러보기 · 바닥의 원을 누르면 이동해요',
    hint360Touch: '밀어서 둘러보기 · 바닥의 원을 누르면 이동해요',
    hint3d: '3D 구역이에요! 화살표나 WASD로 걸어 보세요',
    hint3dTouch: '3D 구역이에요! 화살표 버튼으로 걸어 보세요',
    prevSpot: '이전 지점', nextSpot: '다음 지점', walk: (d) => ({ f: '앞으로', b: '뒤로', l: '왼쪽', r: '오른쪽' })[d],
    stepFind: (a, b) => `사람·사물 찾기 ${a}/${b}`,
    stepAct: (name) => `활동: ${name}`,
    stepStamp: '도장 받기',
    askFind: '루파 디디가 말한 것을 찾아요',
    listen: '듣기', hint: '힌트', other: '다른 낱말', play: '활동하기',
    hintText: (thr, spot) => `타루어로 ‘${thr}’${eul(thr)} 찾아요 · ${spot}번 지점`,
    allFound: '모두 찾았어요! 이제 활동을 해요.', stageDone: '스테이지 완료! 다른 스테이지를 골라요.',
    found: '찾았어요!', wordsLearned: '배운 낱말', noWords: '아직 찾은 낱말이 없어요.',
    sayIt: '따라 말해 봐요!', ok: '좋아요', close: '닫기', next: '다음',
    ttsNote: '발음: 브라우저 TTS · 타루어 녹음 전', thrDraft: '타루어 초안(검수 필요)',
    thrSrc: { tcv: '출처: TCV 낱말 목록', 'tcv-dangaura': '출처: TCV 낱말 목록(당가우라)', guess: '출처 없음, 추정' },
    approxThr: '타루어 녹음이 아직 없어 네팔어 음성으로 읽어요',
    fact: { baby: '새끼', food: '먹이·음식', home: '사는 곳', sound: '소리', move: '움직임', group: '음식 분류', unit: '단위', days: '요일', posture: '자세' },
    actRight: '맞았어요!', actWrong: '다시 해 봐요!', actDone: '잘했어요! 모두 맞혔어요.',
    tapOrDrag: '카드를 누른 뒤 놓을 곳을 누르거나, 끌어다 놓아요.',
    getStamp: '도장 받기',
    plantSeed: '씨앗 심기', water: '물 주기', waterLeft: (n) => `물을 ${n}번 더 줘요`, tapParts: '식물의 부분을 눌러 봐요',
    listTitle: '장보기 목록', basket: '바구니', countDone: '다 셌어요',
    needN: (n, got) => `${n}개가 필요한데 바구니에 ${got}개 있어요. 다시 세어 봐요.`,
    totalQ: '바구니에 모두 몇 개 있을까요?',
    stampGot: (name) => `‘${name}’ 도장을 받았어요!`, allDone: '모든 스테이지를 마쳤어요! 정말 잘했어요.',
    actResult: (title, a, b) => `${title}: 첫 시도 정답 ${a}/${b}`,
    keepExploring: '계속 둘러보기', backToStages: '스테이지 선택으로',
    loading: '불러오는 중…', loading3d: '3D 구역 불러오는 중…',
    arrive3d: (name) => `${name}: 3D 구역이에요. 걸어서 살펴보세요!`,
    noVoice: (lang) => `이 브라우저에는 ${lang} 음성이 없어요. (Edge나 안드로이드 Chrome에서 들을 수 있어요)`,
    mapLabel: '지도', missionToggle: '접기/펴기', unknownSpot: '무엇일까요? 눌러 봐요',
    thrLabel: '타루어 (모국어)', neLabel: '네팔어', enLabel: '영어',
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
