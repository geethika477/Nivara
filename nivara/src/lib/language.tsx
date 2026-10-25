import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export type Language = 'en' | 'te' | 'hi';
const words: Record<string, [string, string]> = {
'Authority Command':['అధికారుల నియంత్రణ','प्राधिकरण नियंत्रण'], 'Citizen Safety':['పౌరుల భద్రత','नागरिक सुरक्षा'], 'Flood Resilience':['వరద సంరక్షణ','बाढ़ सुरक्षा'],
'State':['రాష్ట్రం','राज्य'], 'District':['జిల్లా','ज़िला'], 'District population':['జిల్లా జనాభా','ज़िले की जनसंख्या'], 'Population at risk':['ప్రమాదంలో జనాభా','जोखिम में जनसंख्या'], 'Evacuation zones':['తరలింపు ప్రాంతాలు','निकासी क्षेत्र'],
'Module 1 · Flood & Evacuation':['విభాగం 1 · వరద & తరలింపు','मॉड्यूल 1 · बाढ़ और निकासी'], 'Module 2 · Infrastructure':['విభాగం 2 · మౌలిక సదుపాయాలు','मॉड्यूल 2 · बुनियादी ढाँचा'],
'Map layers':['మ్యాప్ పొరలు','मानचित्र परतें'], 'Flood risk zones':['వరద ప్రమాద ప్రాంతాలు','बाढ़ जोखिम क्षेत्र'], 'Water flow direction':['నీటి ప్రవాహ దిశ','जल प्रवाह की दिशा'], 'Terrain data':['భూభాగ సమాచారం','भूभाग डेटा'], 'Flood susceptibility':['వరద ముప్పు','बाढ़ संवेदनशीलता'],
'Red · orange · yellow · green':['ఎరుపు · నారింజ · పసుపు · ఆకుపచ్చ','लाल · नारंगी · पीला · हरा'], 'Mapped waterways · animated flow':['నమోదైన జలమార్గాలు · ప్రవాహ కదలిక','मानचित्रित जलमार्ग · गतिशील प्रवाह'], 'Contours & elevation shading':['ఎత్తు రేఖలు & ఛాయలు','समोच्च और ऊँचाई छायांकन'], 'Low-lying land (simulated)':['లోతట్టు భూమి (అనుకరణ)','निचली भूमि (अनुकरण)'],
'Rainfall simulation':['వర్షపాత అనుకరణ','वर्षा अनुकरण'], 'Rainfall intensity':['వర్ష తీవ్రత','वर्षा की तीव्रता'], 'Duration':['వ్యవధి','अवधि'], 'River / reservoir level':['నది / జలాశయ స్థాయి','नदी / जलाशय स्तर'], 'Normal':['సాధారణ','सामान्य'], 'Heavy':['భారీ','भारी'], 'Cyclone':['తుఫాను','चक्रवात'], '☁ Use live rainfall forecast':['☁ ప్రత్యక్ష వర్ష సూచన వాడండి','☁ ताज़ा वर्षा पूर्वानुमान इस्तेमाल करें'],
'Safe zones':['సురక్షిత ప్రాంతాలు','सुरक्षित क्षेत्र'], 'Nearby safe-zone candidates':['సమీప సురక్షిత ప్రాంతాల సూచనలు','आसपास के सुरक्षित क्षेत्र'], 'Highest ground with lowest flood risk':['తక్కువ వరద ముప్పు ఉన్న ఎత్తైన ప్రాంతాలు','कम बाढ़ जोखिम वाले ऊँचे स्थान'], 'Nearest first · estimated risk, not verified shelters':['దగ్గరగా ఉన్నవి ముందు · అంచనా ముప్పు, ధృవీకరించిన ఆశ్రయాలు కావు','निकटतम पहले · अनुमानित जोखिम, प्रमाणित आश्रय नहीं'], 'Nearest':['అతి సమీపం','निकटतम'], 'Navigate':['దారి చూపు','रास्ता देखें'], 'Close':['మూసివేయి','बंद करें'], 'Decision engine · Evacuation priority':['నిర్ణయ వ్యవస్థ · తరలింపు ప్రాధాన్యత','निर्णय प्रणाली · निकासी प्राथमिकता'], 'Flood arrival':['వరద చేరుకునే సమయం','बाढ़ पहुँचने का समय'], '✓ Evacuated':['✓ తరలించారు','✓ निकासी पूरी'], 'Resume route':['దారిని కొనసాగించండి','मार्ग जारी रखें'],
'Is my area safe from floods?':['నా ప్రాంతం వరదల నుంచి సురక్షితమేనా?','क्या मेरा क्षेत्र बाढ़ से सुरक्षित है?'], 'Nivara needs your location to check live rainfall and terrain around you.':['మీ చుట్టూ వర్షపాతం, భూభాగాన్ని పరిశీలించడానికి మీ స్థానం అవసరం.','आपके आसपास की वर्षा और भूभाग जाँचने के लिए आपका स्थान चाहिए।'], 'Allow location & check':['స్థానాన్ని అనుమతించి పరిశీలించండి','स्थान की अनुमति दें और जाँचें'], '↻ Refresh':['↻ మళ్లీ పరిశీలించు','↻ फिर जाँचें'], '🚨 I am not safe':['🚨 నేను సురక్షితంగా లేను','🚨 मैं सुरक्षित नहीं हूँ'], 'Sending…':['పంపుతోంది…','भेज रहे हैं…'], 'Retry — I am not safe':['మళ్లీ పంపండి — నేను సురక్షితంగా లేను','फिर भेजें — मैं सुरक्षित नहीं हूँ'], '🚨 Help alerted — stay where you are safe':['🚨 సహాయం కోరబడింది — సురక్షిత ప్రదేశంలో ఉండండి','🚨 मदद को सूचित किया — सुरक्षित स्थान पर रहें'],
'Lower estimated flood risk in your area.':['మీ ప్రాంతంలో అంచనా వరద ముప్పు తక్కువ.','आपके क्षेत्र में अनुमानित बाढ़ जोखिम कम है।'], 'Flood risk is low in your area.':['మీ ప్రాంతంలో వరద ముప్పు తక్కువ.','आपके क्षेत्र में बाढ़ जोखिम कम है।'], 'Moderate flood risk near you.':['మీ సమీపంలో మోస్తరు వరద ముప్పు.','आपके पास मध्यम बाढ़ जोखिम है।'], 'High estimated flood risk — follow local emergency advice.':['అంచనా వరద ముప్పు ఎక్కువ — స్థానిక అధికారుల సూచనలు పాటించండి.','अनुमानित बाढ़ जोखिम अधिक — स्थानीय आपात सलाह मानें।'], 'Flood risk unavailable — follow local emergency advice.':['వరద ముప్పు సమాచారం లేదు — స్థానిక సూచనలు పాటించండి.','बाढ़ जोखिम उपलब्ध नहीं — स्थानीय आपात सलाह मानें।'],
'Getting your location…':['మీ స్థానం తెలుసుకుంటోంది…','आपका स्थान पता कर रहे हैं…'], 'Checking rainfall and terrain…':['వర్షపాతం, భూభాగం పరిశీలిస్తోంది…','वर्षा और भूभाग जाँच रहे हैं…'], 'Finding the nearest safe zone…':['సమీప సురక్షిత ప్రాంతాన్ని వెతుకుతోంది…','निकटतम सुरक्षित क्षेत्र खोज रहे हैं…'],
'Live weather':['ప్రత్యక్ష వాతావరణం','ताज़ा मौसम'], 'Weather unavailable':['వాతావరణ సమాచారం లేదు','मौसम उपलब्ध नहीं'], 'Refresh weather':['వాతావరణం నవీకరించు','मौसम ताज़ा करें'], 'Rain now':['ప్రస్తుత వర్షం','अभी वर्षा'], 'Today’s forecast':['నేటి సూచన','आज का पूर्वानुमान'], 'Wind':['గాలి','हवा'], 'Updated':['నవీకరణ','अपडेट'], 'Loading weather…':['వాతావరణం లోడ్ అవుతోంది…','मौसम लोड हो रहा है…'], 'Retry':['మళ్లీ ప్రయత్నించు','फिर प्रयास करें'],
'Severe':['తీవ్రమైన','गंभीर'], 'High':['అధిక','उच्च'], 'Moderate':['మోస్తరు','मध्यम'], 'Safe':['సురక్షిత','सुरक्षित'], 'You':['మీరు','आप'], 'Your location':['మీ స్థానం','आपका स्थान'], '🗺 Show in Google Maps':['🗺 Google Maps లో చూపు','🗺 Google Maps में देखें'], 'Calculating road route…':['రోడ్డు మార్గం గణిస్తోంది…','सड़क मार्ग की गणना…'], 'No lower-risk locations available in this area.':['ఈ ప్రాంతంలో తక్కువ ముప్పు ఉన్న ప్రదేశాలు అందుబాటులో లేవు.','इस क्षेत्र में कम जोखिम वाले स्थान उपलब्ध नहीं हैं।'],
'🔔 Citizen SOS alerts':['🔔 పౌరుల అత్యవసర హెచ్చరికలు','🔔 नागरिक SOS अलर्ट'], 'Hide':['దాచు','छिपाएँ'], 'Show':['చూపు','दिखाएँ'], 'Send team':['బృందాన్ని పంపు','टीम भेजें'], '✓ Rescued':['✓ రక్షించారు','✓ बचाया गया'], 'No active alerts. Citizens who tap "I am not safe" will appear here instantly.':['ప్రస్తుత హెచ్చరికలు లేవు. సహాయం కోరిన పౌరులు ఇక్కడ కనిపిస్తారు.','कोई सक्रिय अलर्ट नहीं। मदद माँगने वाले नागरिक यहाँ दिखाई देंगे।'],
'Substations (nodes)':['ఉపకేంద్రాలు','विद्युत उपकेंद्र'], '⚡ Simulate failure':['⚡ వైఫల్యాన్ని అనుకరించు','⚡ विफलता अनुकरण'], '🔧 Send repair team':['🔧 మరమ్మత్తు బృందాన్ని పంపు','🔧 मरम्मत टीम भेजें'], '✓ Mark complete':['✓ పూర్తయింది','✓ पूरा करें'], '✓ Substation repaired':['✓ ఉపకేంద్రం మరమ్మత్తు పూర్తయింది','✓ उपकेंद्र ठीक हुआ'], 'Online':['పనిచేస్తోంది','चालू'], 'Restored':['పునరుద్ధరించారు','बहाल'], '● FAILED':['● విఫలమైంది','● विफल'], 'Hospital':['ఆసుపత్రి','अस्पताल'], 'Water plant':['నీటి కేంద్రం','जल संयंत्र'], 'Telecom':['టెలికాం','दूरसंचार'], 'School / shelter':['పాఠశాల / ఆశ్రయం','विद्यालय / आश्रय'],
'Open dashboard →':['నియంత్రణ తెరవండి →','नियंत्रण खोलें →'], 'Check my area →':['నా ప్రాంతాన్ని పరిశీలించు →','मेरा क्षेत्र जाँचें →'], 'See the flood before it arrives.':['వరద రాకముందే తెలుసుకోండి.','बाढ़ आने से पहले देखें।'], 'Built for India · 700+ districts':['భారతదేశం కోసం · 700+ జిల్లాలు','भारत के लिए · 700+ ज़िले'],
};
export function translate(text: string, language: Language): string {
  if (language === 'en') return text;
  const i = language === 'te' ? 0 : 1;
  const direct = words[text];
  if (direct) return direct[i];
  const patterns: Array<[RegExp, string, string]> = [
    [/^Evacuate (.+)$/, '$1 ప్రాంతాన్ని తరలించండి', '$1 की निकासी करें'],
    [/^Route to (.+)$/, '$1 కు మార్గం', '$1 तक मार्ग'],
    [/^Safe zone: (.+)$/, 'సురక్షిత ప్రాంతం: $1', 'सुरक्षित क्षेत्र: $1'],
    [/^Head (.+)$/, '$1 వైపు వెళ్ళండి', '$1 की ओर चलें'],
    [/^Turn (.+)$/, '$1 వైపు తిరగండి', '$1 मुड़ें'],
    [/^Continue (.+)$/, '$1 కొనసాగించండి', '$1 चलते रहें'],
  ];
  for (const [pattern, te, hi] of patterns) if (pattern.test(text)) return text.replace(pattern, i === 0 ? te : hi);
  return text;
}
const Context = createContext({ language: 'en' as Language, setLanguage: (_: Language) => {}, t: (text: string) => text });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  useEffect(() => { const stored = localStorage.getItem('nivara-language'); if (stored === 'en' || stored === 'te' || stored === 'hi') setLanguage(stored); }, []);
  useEffect(() => { document.documentElement.lang = language; localStorage.setItem('nivara-language', language); }, [language]);
  return <Context.Provider value={{ language, setLanguage, t: (text) => translate(text, language) }}>{children}</Context.Provider>;
}
export const useLanguage = () => useContext(Context);
export function T({ text }: { text: string }) { return <>{useLanguage().t(text)}</>; }
