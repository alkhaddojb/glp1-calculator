import { useState, useEffect, useRef } from "react";

// ─── SUBGROUP DATA AVAILABILITY MAP ─────────────────────────────────────────
// For each medication, which subgroup inputs have published trial data?
// null = no published subgroup data → input grayed out, not applied to calculation
// Values = adjustment multipliers or deltas applied to the base typical% estimate

const MEDS = [
  {
    id: "wegovy",
    name: "Wegovy",
    generic: "Semaglutide injection",
    dose: "2.4 mg once weekly · injectable",
    type: "GLP-1 RA",
    approved: "2021",
    trialName: "STEP 1",
    trialWeeks: 68,
    ranges: { overweight:[11,17,15], class1:[12,18,15], class2:[12,18,15], class3:[13,20,15] },
    timelinePts: [1.5,5.5,10,12,13.5,15],
    timelineLabels: ["4 wks","12 wks","24 wks","36 wks","52 wks","68 wks"],
    milestones: { 5:86, 10:69, 15:48, 20:29 },
    diabetesDiscount: 4.5,
    // Ceiling anchored to ITT mean (14.9%) + upside margin for best responders
    // Must stay below Wegovy HD ceiling (23%) at all times
    ceiling: 19,      // female ceiling — ITT 14.9% + margin; below Wegovy HD
    ceilingMale: 15,  // male ceiling — males ~11-12% ITT in STEP 1 + margin
    subgroups: {
      sex:        { available: true,  source: "SELECT trial sex analysis (Nature Med 2024): female −11.1% vs male −7.5% vs ITT −10.2%. Female 11.1% < STEP 1 ITT 14.9% → no upward adjustment for females. Male delta −3% based on SELECT sex gap.", female: 0, male: -3.0 },
      age:        { available: false, source: null },
      menopause:  { available: false, source: null, reason: "STEP 1 did not publish menopausal subgroup weight loss data. Women across all stages achieved ~14–15%, consistent with the overall ITT mean." },
      earlyResp:  { available: true,  source: "STEP 1 trial data", responder: +4.0, nonResponder: -5.5 },
      prediabetes:{ available: true,  source: "STEP 1 post-hoc BMI/comorbidity analysis", yes: -1.5, no: 0 },
    },
    note: "STEP 1 (2021): 1,961 adults without T2DM, 68 wks. Treatment-policy estimand: −14.9%.",
    diabetesNote: "STEP 2 (2021, JAMA): 1,210 adults with T2DM, 68 wks. Treatment-policy estimand: −9.6% with semaglutide 2.4 mg. Source: Rubino et al., JAMA 2022;327(2):138–150.",
    diabetesRanges: { overweight:[7,11,9], class1:[8,12,10], class2:[9,13,10], class3:[9,13,10] },
      },
  {
    id: "zepbound",
    name: "Zepbound",
    generic: "Tirzepatide injection",
    dose: "5 mg, 10 mg, or 15 mg once weekly · injectable",
    type: "GLP-1 / GIP dual agonist",
    approved: "2023",
    trialName: "SURMOUNT-1",
    trialWeeks: 72,
    // Default ranges = 15mg (maximum dose) — overridden by doseKey selection
    ranges: { overweight:[15,21,21], class1:[17,22,21], class2:[17,23,21], class3:[17,23,21] },
    // Dose-specific ranges use treatment-policy estimand (ITT regardless of discontinuation)
    // SURMOUNT-1 treatment-regimen estimand: 5mg 15.0% | 10mg 19.5% | 15mg 20.9%
    doseOptions: [
      { key:"5mg",  label:"5 mg",  note:"SURMOUNT-1: ~15.0% (treatment-policy estimand, 72 wks)",
        diabetesRanges: { overweight:[6,10,8], class1:[7,11,9], class2:[7,11,9], class3:[7,12,9] },
                ranges: { overweight:[11,16,15], class1:[12,17,15], class2:[12,18,15], class3:[13,18,15] },
        ceiling:20, ceilingMale:16, milestones:{5:85,10:57,15:32,20:22} },
      { key:"10mg", label:"10 mg", note:"SURMOUNT-1: ~19.5% (treatment-policy estimand, 72 wks)",
        diabetesRanges: { overweight:[10,15,12], class1:[11,15,13], class2:[11,16,13], class3:[12,16,13] },
                ranges: { overweight:[14,20,20], class1:[15,21,20], class2:[15,22,20], class3:[16,22,20] },
        ceiling:22, ceilingMale:18, milestones:{5:89,10:78,15:60,20:45} },
      { key:"15mg", label:"15 mg (max)", note:"SURMOUNT-1: ~20.9% (treatment-policy estimand, 72 wks)",
        diabetesRanges: { overweight:[12,17,14], class1:[13,18,15], class2:[13,18,15], class3:[14,18,15] },
                ranges: { overweight:[15,21,21], class1:[17,22,21], class2:[17,23,21], class3:[17,23,21] },
        ceiling:26, ceilingMale:20, milestones:{5:91,10:81,15:67,20:50} },
    ],
    defaultDoseKey: "15mg",
    timelinePts: [2,7,13,17,20,22],
    timelineLabels: ["4 wks","12 wks","24 wks","36 wks","52 wks","72 wks"],
    milestones: { 5:96, 10:81, 15:67, 20:57 },
    diabetesDiscount: 6,
    ceiling: 26,
    ceilingMale: 20,
    subgroups: {
      sex:        { available: true,  source: "Tchang et al. Obesity 2025 (SURMOUNT post-hoc): women combined mean −25% at 72 wks (range 24–26%). Female delta +4% above ITT 20.9%. SURMOUNT-5: ~6% sex gap → male delta −3%.", female: +4.0, male: -3.0 },
      age:        { available: false, source: null },
      menopause:  { available: true,  source: "SURMOUNT-1/3/4 post-hoc (Tchang et al., Obesity 2025): pre-menopausal 26%, peri/post-menopausal 23% — peri and post identical, collapsed", pre: +3.0, peripost: 0 },
      earlyResp:  { available: true,  source: "SURMOUNT-1 post-hoc early response analysis (2025)", responder: +5.0, nonResponder: -6.0 },
      prediabetes:{ available: true,  source: "SURMOUNT-1: 59.4% had prediabetes at baseline", yes: -1.0, no: 0 },
    },
    note: "SURMOUNT-1 (2023): 2,539 adults without T2DM, 72 wks. Treatment-policy estimand: 5mg −15.0%, 10mg −19.5%, 15mg −20.9%.",
    diabetesNote: "SURMOUNT-2 (2023, NEJM): 938 adults with T2DM, 72 wks. Treatment-regimen estimand: 5mg ~−8.2%, 10mg ~−11.6%, 15mg ~−13.4%. Source: Jastreboff et al., NEJM 2022;387(3):205–216.",
    diabetesRanges: { overweight:[10,15,12], class1:[11,15,13], class2:[11,16,13], class3:[12,16,13] },
          },
  {
    id: "wegovy_hd",
    name: "Wegovy HD",
    generic: "Semaglutide injection 7.2 mg",
    dose: "7.2 mg once weekly · injectable",
    type: "GLP-1 RA",
    approved: "Mar 2026",
    trialName: "STEP UP",
    trialWeeks: 72,
    ranges: {
      // STEP UP ITT mean: 18.7%. Ranges adjusted down from previous version to stay below Zepbound.
      // No head-to-head vs Zepbound exists; indirect comparison favours Zepbound by ~2% ITT.
      overweight: [13, 22, 19],
      class1:     [13, 22, 19],
      class2:     [15, 22, 19],
      class3:     [16, 23, 19],
    },
    timelinePts: [2, 7, 14, 18, 20, 21],
    timelineLabels: ["4 wks","12 wks","24 wks","36 wks","52 wks","72 wks"],
    milestones: { 5: 93, 10: 80, 15: 62, 20: 48 },
    diabetesDiscount: 6,
    // Ceiling anchored to ITT mean 18.7% + upside margin
    // Must stay BELOW Zepbound ceiling (26% female / 21% male) at all times
    // Early responder 27.7% was adherent-only — not used as ceiling anchor
    ceiling: 23,      // female ceiling — ITT 18.7% + margin; strictly below Zepbound female 25% (Tchang 2025)
    ceilingMale: 19,  // male ceiling — below Zepbound male ceiling (21%); above Wegovy 2.4mg (15%)
    earlyRespThreshold: "≥15% by week 24",
    earlyRespNonThreshold: "<15% by week 24",
    subgroups: {
      sex:        { available: true, source: "STEP UP subgroup analysis (2025/2026): sex-specific means not published above ITT — female delta set to 0 per pre-specified rule. Male delta −2% based on consistent sex gap pattern across STEP trials.", female: 0, male: -2.0 },
      age:        { available: false, source: null },
      menopause:  { available: true,  source: "STEP UP post-hoc, ECO 2026 (May 12–15, 2026): pre-menopausal 22.6%, peri/post-menopausal ~19.7–19.8% — peri and post nearly identical, collapsed", pre: +3.5, peripost: 0 },
      earlyResp:  { available: true, source: "STEP UP post-hoc, ECO 2026 (May 12, 2026): ≥15% at wk 24 → 27.7% at wk 72 (adherent-only; ITT mean 18.7%)", responder: +4.0, nonResponder: -4.0 },
      prediabetes:{ available: true, source: "STEP UP trial: semaglutide efficacy in prediabetes subgroup", yes: -1.5, no: 0 },
    },
    note: "STEP UP (2025): ~1,400 adults without T2DM, 72 wks. Treatment-policy estimand: −18.7%.",
    diabetesNote: "STEP UP T2DM subgroup (2025): Adults with T2DM achieved ~−14.1% at 72 wks. Full T2DM-specific trial data pending regulatory publication.",
    diabetesRanges: { overweight:[11,17,14], class1:[12,17,14], class2:[12,18,14], class3:[13,18,14] },
      },
  {
    id: "saxenda",
    name: "Saxenda",
    generic: "Liraglutide injection",
    dose: "3 mg once daily · injectable",
    type: "GLP-1 RA",
    approved: "2014",
    trialName: "SCALE Obesity",
    trialWeeks: 56,
    ranges: { overweight:[5,9,8], class1:[5,9,8], class2:[6,10,8], class3:[6,11,8] },
    timelinePts: [1,4,6.5,7.5,8,8],
    timelineLabels: ["4 wks","12 wks","24 wks","36 wks","52 wks","56 wks"],
    milestones: { 5:63, 10:33, 15:14, 20:6 },
    diabetesDiscount: 3,
    // Anchored to ITT mean ~8% + modest margin; well below all semaglutide and tirzepatide agents
    ceiling: 12,      // female ceiling — ITT ~8% + margin
    ceilingMale: 9,   // male ceiling — modest agent, male response ~6-7% ITT
    subgroups: {
      sex:        { available: true,  source: "GLP-1 sex meta-analysis (PMC 2024): pooled sex difference 1.69% — insufficient to adjust female above ITT mean. Male delta −1.5%.", female: 0, male: -1.5 },
      age:        { available: false, source: null },
      menopause:  { available: false, source: null },
      earlyResp:  { available: true,  source: "SCALE trial early response predictor data", responder: +2.5, nonResponder: -3.5 },
      prediabetes:{ available: false, source: null },
    },
    note: "SCALE Obesity (2015): 3,731 adults without diabetes, 56 wks. Treatment-policy estimand: ~−8%.",
    diabetesNote: "SCALE Diabetes (2015, Lancet): 846 adults with T2DM, 56 wks. Mean weight loss −5.9% with liraglutide 3 mg vs −2.0% placebo. Source: Davies et al., Lancet 2015;386(9999):1823–1833.",
    diabetesRanges: { overweight:[4,8,6], class1:[4,8,6], class2:[5,8,6], class3:[5,9,6] },
      },
  {
    id: "wegovy_pill",
    name: "Wegovy Pill",
    generic: "Oral semaglutide 25 mg",
    dose: "25 mg once daily · oral (empty stomach)",
    type: "GLP-1 RA",
    approved: "Dec 2025",
    trialName: "OASIS 4",
    trialWeeks: 64,
    ranges: { overweight:[10,16,14], class1:[10,16,14], class2:[10,16,14], class3:[11,17,14] },
    timelinePts: [1.5,5,9.5,12,13,14],
    timelineLabels: ["4 wks","12 wks","24 wks","36 wks","52 wks","64 wks"],
    milestones: { 5:82, 10:63, 15:40, 20:33 },
    diabetesDiscount: 4.5,
    // Anchored to ITT mean 13.6% (OASIS 4) + upside margin
    // Early responder 21.6% was adherent-only — not used as ceiling anchor
    // Must stay below Wegovy 2.4mg injectable ceiling (19%) — comparable active ingredient, lower bioavailability
    ceiling: 18,      // female ceiling — ITT 13.6% + margin; below injectable Wegovy ceiling
    ceilingMale: 14,  // male ceiling — estimated; no sex subgroup published for OASIS 4
    earlyRespThreshold: "≥10% by week 16",
    earlyRespNonThreshold: "<10% by week 16",
    subgroups: {
      sex:        { available: false, source: null },
      age:        { available: false, source: null },
      menopause:  { available: false, source: null, reason: "OASIS 4 (n=307) was too small for a published menopausal subgroup. The oral formulation has distinct pharmacokinetics — injectable STEP menopause data cannot be directly applied." },
      earlyResp:  { available: true, source: "OASIS 4 post-hoc, ECO 2026 (May 2026): ≥10% by wk 16 → 21.6% at wk 64 (adherent); ITT mean 13.6%", responder: +4.0, nonResponder: -2.0 },
      prediabetes:{ available: false, source: null },
    },
    note: "OASIS 4 (2025): 307 adults without T2DM, 64 wks. Treatment-policy estimand: −13.6%.",
    diabetesNote: "No dedicated T2DM trial published for oral semaglutide 25 mg. Estimate uses a discount derived from the STEP 2 vs STEP 1 differential (−5.3 percentage points). Interpret with caution — T2DM-specific data pending.",
    diabetesRanges: { overweight:[6,11,8], class1:[7,11,9], class2:[7,12,9], class3:[8,12,9] },
      },
  {
    id: "foundayo",
    name: "Foundayo",
    generic: "Orforglipron",
    dose: "5.5 mg, 9 mg, or 17.2 mg once daily · oral (no restrictions)",
    type: "GLP-1 RA (small molecule)",
    approved: "Apr 2026",
    trialName: "ATTAIN-1",
    trialWeeks: 72,
    ranges: { overweight:[8,13,11], class1:[7,13,11], class2:[8,14,11], class3:[8,14,11] },
    doseOptions: [
      { key:"5.5mg",  label:"5.5 mg",       note:"ATTAIN-1: ~7.4% ITT at 72 wks",
        diabetesRanges: { overweight:[3,7,5], class1:[4,7,5], class2:[4,8,5], class3:[4,8,5] },
                ranges:{ overweight:[5,10,7], class1:[5,10,7], class2:[5,11,7], class3:[6,11,7] },
        ceiling:10, ceilingMale:8,  milestones:{5:55,10:22,15:8,20:3} },
      { key:"9mg",    label:"9 mg",          note:"ATTAIN-1: ~8.3% ITT at 72 wks",
        diabetesRanges: { overweight:[5,9,7], class1:[5,10,7], class2:[6,10,7], class3:[6,10,7] },
                ranges:{ overweight:[6,11,8], class1:[6,11,8], class2:[6,12,9], class3:[7,12,9] },
        ceiling:11, ceilingMale:9,  milestones:{5:63,10:29,15:11,20:4} },
      { key:"17.2mg", label:"17.2 mg (max)", note:"ATTAIN-1: ~11.1% ITT at 72 wks",
        ranges:{ overweight:[8,13,11], class1:[7,13,11], class2:[8,14,11], class3:[8,14,11] },
        ceiling:14, ceilingMale:11, milestones:{5:72,10:51,15:28,20:13} },
    ],
    defaultDoseKey: "17.2mg",
    timelinePts: [1.5,5,8,9.5,10.5,11],
    timelineLabels: ["4 wks","12 wks","24 wks","36 wks","52 wks","72 wks"],
    milestones: { 5:72, 10:51, 15:28, 20:13 },
    diabetesDiscount: 3.5,
    ceiling: 14,
    ceilingMale: 11,
    subgroups: {
      sex:        { available: false, source: null },
      age:        { available: false, source: null },
      menopause:  { available: false, source: null },
      earlyResp:  { available: false, source: null },
      prediabetes:{ available: false, source: null },
    },
    note: "ATTAIN-1 (2026, NEJM): 3,127 adults without T2DM, 72 wks. Treatment-policy estimand: 5.5mg ~−7.4%, 9mg ~−8.3%, 17.2mg ~−11.2%.",
    diabetesNote: "ATTAIN-2 (2025, Lancet): 1,613 adults with T2DM, 72 wks. Treatment-regimen estimand: 17.2mg −9.6%, 12mg ~−7.0%. Source: Horn et al., Lancet 2026;407:2927–2944.",
    diabetesRanges: { overweight:[7,12,9], class1:[8,12,10], class2:[8,12,10], class3:[8,13,10] },
      },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const calcBMI   = (lbs,ft,inches) => { const h=parseFloat(ft)*12+parseFloat(inches||0); return h>0?(parseFloat(lbs)/(h*h))*703:null; };
const calcBMIm  = (kg,cm)         => { const c=parseFloat(cm); return c>0?parseFloat(kg)/((c/100)**2):null; };
const getBMIClass = bmi => {
  if (!bmi||bmi<25) return null;
  if (bmi<30) return { key:"overweight", label:"Overweight",      range:"25.0–29.9" };
  if (bmi<35) return { key:"class1",     label:"Class 1 Obesity", range:"30.0–34.9" };
  if (bmi<40) return { key:"class2",     label:"Class 2 Obesity", range:"35.0–39.9" };
  return             { key:"class3",     label:"Class 3 Obesity", range:"≥ 40.0"    };
};

// ─── SUBCOMPONENTS ───────────────────────────────────────────────────────────
function AnimBar({ pct, delay=0 }) {
  const [w,setW]=useState(0);
  useEffect(()=>{ const t=setTimeout(()=>setW(pct),130+delay); return()=>clearTimeout(t); },[pct,delay]);
  return <div style={{background:"#e4e4e4",borderRadius:99,height:8,overflow:"hidden"}}><div style={{height:"100%",borderRadius:99,background:"#111",width:`${w}%`,transition:"width 0.85s cubic-bezier(.4,0,.2,1)"}}/></div>;
}

function RangeBar({ lo,hi,typ,max }) {
  const [on,setOn]=useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setOn(true),100); return()=>clearTimeout(t); },[lo,hi,typ,max]);
  const tr=on?"all 0.9s cubic-bezier(.4,0,.2,1)":"none";
  return <div style={{position:"relative",height:"100%",width:"100%"}}>
    <div style={{position:"absolute",left:`${(lo/max)*100}%`,width:`${((hi-lo)/max)*100}%`,height:"100%",background:"#bbb",transition:tr,opacity:on?1:0}}/>
    <div style={{position:"absolute",left:`${(typ/max)*100}%`,width:3,height:"100%",background:"#111",transition:tr,opacity:on?1:0}}/>
  </div>;
}

function TimelineChart({ med }) {
  const lossPts=med.timelinePts, labels=med.timelineLabels;
  const maxLoss=Math.max(...lossPts);
  const yTop=100, yBottom=Math.max(100-maxLoss*1.35,60);
  const W=100,H=58;
  const remaining=[100,...lossPts.map(v=>100-v)];
  const allLabels=["Start",...labels];
  const px=i=>(i/(remaining.length-1))*W;
  const py=r=>((yTop-r)/(yTop-yBottom))*H;
  const path=remaining.map((r,i)=>`${i===0?"M":"L"} ${px(i).toFixed(1)} ${py(r).toFixed(1)}`).join(" ");
  const area=`${path} L ${px(remaining.length-1).toFixed(1)} ${H} L 0 ${H} Z`;
  const gridLines=[100,95,90,85,80,75].filter(r=>r>=yBottom-2&&r<=yTop);
  return <div>
    <svg viewBox="-8 -6 116 70" style={{width:"100%",height:"auto",overflow:"visible"}}>
      {gridLines.map(r=><g key={r}>
        <line x1={0} y1={py(r)} x2={W} y2={py(r)} stroke="#e8e8e8" strokeWidth={0.6}/>
        <text x={-1} y={py(r)+1.3} fontSize={3.6} textAnchor="end" fill="#ccc" fontFamily="system-ui">{r===100?"0%":`−${100-r}%`}</text>
      </g>)}
      <path d={area} fill="#111" opacity={0.05}/>
      <path d={path} fill="none" stroke="#111" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round"/>
      {remaining.map((r,i)=><g key={i}>
        <circle cx={px(i)} cy={py(r)} r={i===0?1.8:2.3} fill={i===0?"#ccc":"#111"}/>
        {i>0&&<text x={px(i)} y={py(r)-4} fontSize={3.8} textAnchor="middle" fill="#333" fontFamily="system-ui" fontWeight="700">−{lossPts[i-1]}%</text>}
      </g>)}
    </svg>
    <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
      {allLabels.map((l,i)=><div key={i} style={{fontSize:10,color:"#bbb",fontFamily:"system-ui",textAlign:"center",flex:1}}>{l}</div>)}
    </div>
  </div>;
}

// Subgroup toggle — grayed out if no data
function SubgroupToggle({ label, options, value, onChange, available, source, note }) {
  const lbl={ fontSize:11,fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase",color:available?"#888":"#bbb",marginBottom:4,display:"block",fontFamily:"system-ui" };
  const togWrap={ display:"flex",background:available?"#eee":"#f4f4f2",borderRadius:10,padding:3,width:"fit-content",gap:0,opacity:available?1:0.5 };
  const tog=active=>({ padding:"6px 15px",borderRadius:8,border:"none",cursor:available?"pointer":"not-allowed",fontSize:12,fontFamily:"system-ui",fontWeight:600,background:active&&available?"#111":"transparent",color:active&&available?"#fff":"#999",transition:"all 0.18s" });
  return <div style={{marginBottom:18}}>
    <label style={lbl}>
      {label}
      {!available && <span style={{fontSize:10,fontWeight:400,marginLeft:6,color:"#ccc",letterSpacing:"0.02em",textTransform:"none"}}>— no published subgroup data for this medication</span>}
    </label>
    <div style={togWrap}>
      {options.map(([v,l])=>
        <button key={v} style={tog(value===v)} onClick={()=>available&&onChange(v)} disabled={!available}>{l}</button>
      )}
    </div>
    {available&&source&&<div style={{fontSize:10,color:"#bbb",marginTop:4,fontFamily:"system-ui",lineHeight:1.5}}>Source: {source}</div>}
    {!available&&<div style={{fontSize:10,color:"#ccc",marginTop:4,fontFamily:"system-ui",fontStyle:"italic"}}>This input is not applied — estimate uses overall trial average.</div>}
    {available&&note&&<div style={{fontSize:10,color:"#aaa",marginTop:2,fontFamily:"system-ui"}}>{note}</div>}
  </div>;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function GLP1Calc() {
  const [unit,setUnit]         = useState("imperial");
  const [wLbs,setWLbs]         = useState("");
  const [hFt,setHFt]           = useState("");
  const [hIn,setHIn]           = useState("");
  const [wKg,setWKg]           = useState("");
  const [hCm,setHCm]           = useState("");
  const [medId,setMedId]       = useState("wegovy");
  const [wegovyDoseIntent,setWegovyDoseIntent] = useState("standard");
  const [zepboundDose,setZepboundDose]   = useState("15mg");
  const [foundayoDose,setFoundayoDose]   = useState("17.2mg");
  const [tab,setTab]           = useState("outcomes");
  const [shown,setShown]       = useState(false);
  // Subgroup inputs
  const [diabetes,setDiabetes]       = useState(false);
  const [sex,setSex]                 = useState(null);
  const [menopause,setMenopause]     = useState(null);
  const [prediabetes,setPrediabetes] = useState(null);      // null | true | false
  const [patientAge,setPatientAge]   = useState(null);      // safety flag only
  // Early response — Wegovy & Wegovy Pill only
  const [txStatus,setTxStatus]               = useState(null); // null | "new" | "existing"
  const [durationMet,setDurationMet]         = useState(null); // null | true | false
  const [weightThresholdMet,setWeightThresholdMet] = useState(null); // null | true | false
  const resultRef = useRef(null);

  const effectiveMedId = (medId === "wegovy" && wegovyDoseIntent === "hd") ? "wegovy_hd" : medId;
  const baseMed = MEDS.find(m=>m.id===effectiveMedId);

  // For medications with dose options, merge the selected dose's data over the base med
  const getSelectedDose = (m) => {
    if (!m.doseOptions) return null;
    if (m.id === "zepbound") return m.doseOptions.find(d=>d.key===zepboundDose) || m.doseOptions.find(d=>d.key===m.defaultDoseKey);
    if (m.id === "foundayo") return m.doseOptions.find(d=>d.key===foundayoDose) || m.doseOptions.find(d=>d.key===m.defaultDoseKey);
    return null;
  };
  const selectedDose = getSelectedDose(baseMed);
  const med = selectedDose ? { ...baseMed, ranges: selectedDose.ranges, ceiling: selectedDose.ceiling, ceilingMale: selectedDose.ceilingMale, milestones: selectedDose.milestones, activeDoseLabel: selectedDose.label, activeDoseNote: selectedDose.note, diabetesRanges: selectedDose.diabetesRanges || baseMed.diabetesRanges, diabetesNote: selectedDose.diabetesNote || baseMed.diabetesNote } : baseMed;

  // ── EARLY RESPONSE DERIVED VALUES ────────────────────────────────────────────
  const isEarlyRespConfirmed = !diabetes && txStatus==="existing" && durationMet===true && weightThresholdMet===true;
  const isWegovy = medId==="wegovy";
  const isPill   = medId==="wegovy_pill";

  // Published early responder means and ceilings (ECO 2026)
  // typ is SET to the published mean — ceiling constrains the hi end
  // lo is set ~3% below mean, hi is set to ceiling
  const EARLY_RESP_DATA = {
    wegovy_hd:   { typ:27.7, lo:24, ceiling:30, ceilingMale:25, label:"Wegovy HD early responder", note:"STEP UP post-hoc, ECO 2026: ≥15% at wk 24 → mean 27.7% at 72 wks" },
    wegovy_std:  { typ:24.8, lo:21, ceiling:27, ceilingMale:22, label:"Wegovy 2.4mg early responder", note:"STEP UP post-hoc, ECO 2026: ≥15% at wk 24 → mean 24.8% at 72 wks" },
    wegovy_pill: { typ:21.6, lo:18, ceiling:24, ceilingMale:20, label:"Wegovy Pill early responder", note:"OASIS 4 post-hoc, ECO 2026: ≥10% at wk 16 → mean 21.6% at 64 wks" },
  };
  const earlyRespKey = isEarlyRespConfirmed && isWegovy
    ? (wegovyDoseIntent==="hd" ? "wegovy_hd" : "wegovy_std")
    : isEarlyRespConfirmed && isPill ? "wegovy_pill" : null;
  const earlyRespData = earlyRespKey ? EARLY_RESP_DATA[earlyRespKey] : null;

  const isWegovyEarlyResp24 = isEarlyRespConfirmed && isWegovy;
  const isPillEarlyResp     = isEarlyRespConfirmed && isPill;
  const medWithOverride = earlyRespData
    ? { ...med, ceiling: earlyRespData.ceiling, ceilingMale: earlyRespData.ceilingMale,
        earlyRespLabel: earlyRespData.label, earlyRespNote: earlyRespData.note }
    : med;
  const bmi = unit==="imperial" ? calcBMI(wLbs,hFt,hIn) : calcBMIm(wKg,hCm);
  const weightLbs = unit==="imperial" ? parseFloat(wLbs)||0 : (parseFloat(wKg)||0)*2.205;
  const bmiClass = getBMIClass(bmi);
  const canCalc = bmi&&bmi>=25&&bmiClass;
  const reset = ()=>setShown(false);
  const resetMed = () => { setShown(false); setTxStatus(null); setDurationMet(null); setWeightThresholdMet(null); };

  function getAdjustedResults() {
    if (!canCalc) return null;
    const activeMed = medWithOverride;

    // ── BASE RANGES ───────────────────────────────────────────────────────────
    // When diabetes=true and T2DM-specific trial ranges exist, use them directly.
    // This anchors the estimate to the actual published T2DM trial mean
    // rather than applying a discount to non-diabetic ranges.
    // When no T2DM ranges exist (Wegovy Pill), fall back to discount formula.
    let lo, hi, typ;
    const useT2dmRanges = diabetes && activeMed.diabetesRanges;
    if (earlyRespData) {
      typ = earlyRespData.typ;
      lo  = earlyRespData.lo;
      hi  = activeMed.ceiling;
    } else if (useT2dmRanges) {
      [lo, hi, typ] = activeMed.diabetesRanges[bmiClass.key];
    } else {
      [lo, hi, typ] = activeMed.ranges[bmiClass.key];
    }

    // ── T2DM DISCOUNT — fallback only ────────────────────────────────────────
    // Applied ONLY when diabetes=true but no T2DM-specific trial ranges exist.
    // Currently only Wegovy Pill has no dedicated T2DM trial.
    // All other medications use diabetesRanges derived from actual T2DM trials above.
    if (diabetes && !useT2dmRanges && !earlyRespData) {
      lo  = Math.max(lo  - activeMed.diabetesDiscount, lo  * 0.62);
      hi  = Math.max(hi  - activeMed.diabetesDiscount, hi  * 0.65);
      typ = Math.max(typ - activeMed.diabetesDiscount, typ * 0.63);
    }

    // ── LAYER 2: Single strongest subgroup — sex competes with all others ────────
    // Sex, menopause, and prediabetes all enter the same competition.
    // Only the factor with the largest absolute delta is applied.
    // This prevents stacking of adjustments derived from separate post-hoc analyses.
    const sg = activeMed.subgroups;
    const candidates = [];

    if (sg.sex?.available && sex !== null) {
      const d = sex === "female" ? sg.sex.female : sg.sex.male;
      candidates.push({ label:`Sex (${sex})`, delta:d, source:sg.sex.source, type:"sex" });
    }
    if (sg.menopause?.available && sex==="female" && menopause !== null) {
      const d = menopause==="pre" ? sg.menopause.pre : sg.menopause.peripost;
      if (d !== 0) candidates.push({ label:`Menopausal status (${menopause==="pre"?"pre-menopausal":"peri/post-menopausal"})`, delta:d, source:sg.menopause.source, type:"menopause" });
    }
    if (sg.prediabetes?.available && !diabetes && prediabetes===true) {
      candidates.push({ label:"Prediabetes", delta:sg.prediabetes.yes, source:sg.prediabetes.source, type:"prediabetes" });
    }

    // Sort by absolute magnitude — largest wins
    candidates.sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta));
    const winner  = candidates.length > 0 ? candidates[0] : null;
    const ignored = candidates.slice(1);
    const delta   = winner ? winner.delta : 0;

    // Apply the winner
    // When early responder data is active, typ is already set to the published mean.
    // Sex delta applies asymmetrically to preserve typ while widening the spread:
    //   female positive delta → raises hi (Strong response) without changing typ
    //   male negative delta   → lowers lo (Conservative) without changing typ
    // For non-early-responder paths, delta shifts all three as normal.
    if (earlyRespData && winner) {
      if (delta > 0) {
        hi  = hi  + delta;
      } else {
        lo  = lo  + delta;
      }
    } else {
      typ = typ + delta;
      lo  = lo  + delta * 0.7;
      hi  = hi  + delta * 0.7;
      // Ensure ordering: hi >= typ >= lo always holds after delta shift
      if (hi < typ) hi = typ + 1;
      if (lo > typ) lo = typ - 1;
    }

    // For display purposes — expose sex delta separately only if sex won
    const sexDelta = winner?.type === "sex" ? winner.delta : 0;
    const sexLabel = winner?.type === "sex" ? winner.label : null;

    // ── LAYER 4: Sex-stratified hard ceiling ──────────────────────────────────
    const effectiveCeiling = (sex === "male" && activeMed.ceilingMale) ? activeMed.ceilingMale : activeMed.ceiling;
    typ = Math.min(Math.max(typ, 4), effectiveCeiling);  // 4% floor: late responders still lose meaningful weight
    lo  = Math.min(Math.max(lo,  1), effectiveCeiling - 2);
    hi  = Math.min(Math.max(hi,  1), effectiveCeiling);

    return {
      lo:  lo.toFixed(0),  hi:  hi.toFixed(0),  typ: typ.toFixed(0),
      loLbs:  (weightLbs*lo /100).toFixed(0),
      hiLbs:  (weightLbs*hi /100).toFixed(0),
      typLbs: (weightLbs*typ/100).toFixed(0),
      wtLo:   (weightLbs*(1-hi /100)).toFixed(0),
      wtHi:   (weightLbs*(1-lo /100)).toFixed(0),
      wtTyp:  (weightLbs*(1-typ/100)).toFixed(0),
      sexDelta, sexLabel,
      winner, ignored, delta,
      subgroupsConsidered: candidates.length,
      subgroupsGrayed: Object.values(sg).filter(s=>!s.available).length,
      ceilingHit: (typ >= effectiveCeiling || hi >= effectiveCeiling),
      effectiveCeiling,
    };
  }

  const R = getAdjustedResults();

  function handleCalc() {
    if (!canCalc) return;
    setShown(true);
    setTimeout(()=>resultRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),80);
  }

  const inp={ background:"#f6f6f4",border:"1.5px solid #ddd",borderRadius:8,padding:"11px 14px",fontSize:15,color:"#111",width:"100%",outline:"none",fontFamily:"system-ui,-apple-system,sans-serif",boxSizing:"border-box" };
  const lbl={ fontSize:11,fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase",color:"#888",marginBottom:6,display:"block",fontFamily:"system-ui" };
  const togWrap={ display:"flex",background:"#eee",borderRadius:10,padding:3,width:"fit-content" };
  const tog=active=>({ padding:"7px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontFamily:"system-ui",fontWeight:600,background:active?"#111":"transparent",color:active?"#fff":"#888",transition:"all 0.18s" });
  const divider=<div style={{borderTop:"1px solid #ebebeb",margin:"22px 0"}}/>;

  return (
    <div style={{background:"#ffffff",minHeight:"100vh",fontFamily:"system-ui,-apple-system,sans-serif",paddingBottom:60}}>

      {/* HEADER */}
      <div style={{background:"#1a3a5c",padding:"28px 28px 24px"}}>
        <div style={{maxWidth:680,margin:"0 auto"}}>
          <div style={{fontSize:11,color:"#7aaed4",letterSpacing:"0.14em",textTransform:"uppercase",fontFamily:"system-ui,-apple-system,sans-serif",marginBottom:6,fontWeight:600}}>
            North County Endocrinology Associates · Carlsbad, CA
          </div>
          <h1 style={{margin:0,fontSize:26,fontWeight:700,color:"#ffffff",lineHeight:1.25,fontFamily:"system-ui,-apple-system,sans-serif"}}>
            GLP-1 Weight Loss Outcome Estimator
          </h1>
          <p style={{margin:"8px 0 4px",color:"#b8d4ea",fontSize:13,fontFamily:"system-ui,-apple-system,sans-serif",lineHeight:1.6}}>
            Evidence-based, personalised weight loss estimates for FDA-approved GLP-1 medications. Developed by Dr. Jamil Alkhaddo, MD — Board Certified Endocrinologist, Diabetes &amp; Metabolism.
          </p>
          <p style={{margin:0,color:"#7aaed4",fontSize:11,fontFamily:"system-ui,-apple-system,sans-serif"}}>
            6 FDA-approved medications · Phase 3 trial data · Updated May 2026
          </p>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"28px 22px 0"}}>

        {/* UNIT */}
        <div style={{marginBottom:22}}>
          <span style={lbl}>Units</span>
          <div style={togWrap}>
            {[["imperial","lbs / ft · in"],["metric","kg / cm"]].map(([u,l])=>(
              <button key={u} style={tog(unit===u)} onClick={()=>{setUnit(u);reset();}}>{l}</button>
            ))}
          </div>
        </div>

        {/* WEIGHT */}
        <div style={{marginBottom:18}}>
          <label style={lbl}>Current weight · {unit==="imperial"?"lbs":"kg"}</label>
          {unit==="imperial"
            ? <input type="number" placeholder="e.g. 220" value={wLbs} onChange={e=>{setWLbs(e.target.value);reset();}} style={inp}/>
            : <input type="number" placeholder="e.g. 100" value={wKg}  onChange={e=>{setWKg(e.target.value);reset();}}  style={inp}/>}
        </div>

        {/* HEIGHT */}
        <div style={{marginBottom:18}}>
          <label style={lbl}>Height · {unit==="imperial"?"ft / in":"cm"}</label>
          {unit==="imperial"
            ? <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}><input type="number" placeholder="5" value={hFt} onChange={e=>{setHFt(e.target.value);reset();}} style={inp}/><div style={{fontSize:11,color:"#ccc",marginTop:3,fontFamily:"system-ui"}}>feet</div></div>
                <div style={{flex:1}}><input type="number" placeholder="8" min={0} max={11} value={hIn} onChange={e=>{setHIn(e.target.value);reset();}} style={inp}/><div style={{fontSize:11,color:"#ccc",marginTop:3,fontFamily:"system-ui"}}>inches</div></div>
              </div>
            : <input type="number" placeholder="e.g. 170" value={hCm} onChange={e=>{setHCm(e.target.value);reset();}} style={inp}/>}
        </div>

        {/* BMI CHIP */}
        {bmi&&<div style={{background:bmiClass?"#111":"#f0f0ee",borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,transition:"background 0.3s"}}>
          <div>
            <div style={{fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",color:bmiClass?"#666":"#aaa",fontFamily:"system-ui",marginBottom:2}}>Your BMI</div>
            <div style={{fontSize:30,fontWeight:400,color:bmiClass?"#fff":"#555"}}>{bmi.toFixed(1)}</div>
          </div>
          {bmiClass
            ? <div style={{background:"#1e1e1e",borderRadius:8,padding:"8px 14px",textAlign:"right"}}>
                <div style={{fontSize:13,color:"#fff",fontFamily:"system-ui",fontWeight:600}}>{bmiClass.label}</div>
                <div style={{fontSize:12,color:"#777",fontFamily:"system-ui"}}>BMI {bmiClass.range}</div>
              </div>
            : <div style={{fontSize:12,color:"#aaa",fontFamily:"system-ui",maxWidth:210,textAlign:"right",lineHeight:1.5}}>GLP-1s require BMI ≥30, or ≥27 with a weight-related comorbidity</div>}
        </div>}

        {/* MEDICATION */}
        <div style={{marginBottom:22}}>
          <label style={lbl}>Medication</label>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {MEDS.map(m=>{
              const active=medId===m.id;
              const avail=Object.values(m.subgroups).filter(s=>s.available).length;
              const total=Object.values(m.subgroups).length;
              return <button key={m.id} onClick={()=>{setMedId(m.id);resetMed();}}
                style={{border:`2px solid ${active?"#111":"#e0e0e0"}`,borderRadius:10,padding:"12px 16px",background:active?"#111":"#fff",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.18s",textAlign:"left"}}>
                <div>
                  <div style={{fontSize:15,fontWeight:600,color:active?"#fff":"#111",fontFamily:"system-ui"}}>{m.name} <span style={{fontSize:12,fontWeight:400,color:active?"#888":"#aaa"}}>· {m.generic}</span></div>
                  <div style={{fontSize:12,color:active?"#777":"#bbb",fontFamily:"system-ui",marginTop:3}}>{m.dose}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0,marginLeft:10}}>
                  <div style={{fontSize:10,fontFamily:"system-ui",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:active?"#bbb":"#aaa",background:active?"#222":"#f0f0f0",padding:"3px 9px",borderRadius:5}}>{m.type}</div>
                  <div style={{fontSize:10,color:active?"#666":"#ccc",fontFamily:"system-ui"}}>FDA {m.approved} · {avail}/{total} subgroups</div>
                </div>
              </button>;
            })}
          </div>

          {/* WEGOVY DOSE INTENT — simple: 2.4mg or uptitrate to HD */}
          {medId==="wegovy"&&(
            <div style={{marginTop:12,background:"#f7f7f5",borderRadius:10,padding:"14px 16px",border:"1.5px solid #e0e0e0"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase",color:"#888",fontFamily:"system-ui",marginBottom:6}}>
                Intended maximum dose
              </div>
              <div style={{fontSize:12,color:"#aaa",fontFamily:"system-ui",lineHeight:1.6,marginBottom:10}}>
                Wegovy HD (7.2 mg) is FDA-approved as a step-up for patients who have tolerated 2.4 mg for ≥4 weeks and need additional weight loss.
              </div>
              <div style={{display:"flex",background:"#eee",borderRadius:10,padding:3,width:"fit-content",gap:0,marginBottom:8}}>
                {[["standard","Stay at 2.4 mg"],["hd","Uptitrate to 7.2 mg (HD)"]].map(([v,l])=>(
                  <button key={v} style={{padding:"7px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontFamily:"system-ui",fontWeight:600,background:wegovyDoseIntent===v?"#111":"transparent",color:wegovyDoseIntent===v?"#fff":"#888",transition:"all 0.18s",whiteSpace:"nowrap"}}
                    onClick={()=>{setWegovyDoseIntent(v);reset();}}>{l}
                  </button>
                ))}
              </div>
              {wegovyDoseIntent==="hd"&&<div style={{fontSize:11,color:"#8b2020",fontFamily:"system-ui",lineHeight:1.6}}>⚠ Dysesthesia rate 22% vs 6% at 2.4 mg (STEP UP trial). Projections use STEP UP 7.2 mg data.</div>}
              {wegovyDoseIntent==="standard"&&<div style={{fontSize:11,color:"#aaa",fontFamily:"system-ui",lineHeight:1.6}}>Projections use STEP 1 (2.4 mg, 68 wks) trial data.</div>}
            </div>
          )}

                    {/* ZEPBOUND DOSE SELECTOR */}
          {medId==="zepbound"&&(
            <div style={{marginTop:12,background:"#f7f7f5",borderRadius:10,padding:"14px 16px",border:"1.5px solid #e0e0e0"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase",color:"#888",fontFamily:"system-ui",marginBottom:6}}>
                Maintenance dose
              </div>
              <div style={{fontSize:12,color:"#aaa",fontFamily:"system-ui",lineHeight:1.6,marginBottom:10}}>
                Select the dose the patient is on or plans to reach. SURMOUNT-1 published separate outcomes for each dose.
              </div>
              <div style={{display:"flex",flexWrap:"wrap",background:"#eee",borderRadius:10,padding:3,width:"fit-content",gap:0,marginBottom:8}}>
                {MEDS.find(m=>m.id==="zepbound").doseOptions.map(d=>(
                  <button key={d.key} style={{padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontFamily:"system-ui",fontWeight:600,background:zepboundDose===d.key?"#111":"transparent",color:zepboundDose===d.key?"#fff":"#888",transition:"all 0.18s",whiteSpace:"nowrap"}}
                    onClick={()=>{setZepboundDose(d.key);reset();}}>{d.label}</button>
                ))}
              </div>
              <div style={{fontSize:11,color:"#aaa",fontFamily:"system-ui",lineHeight:1.6}}>
                {MEDS.find(m=>m.id==="zepbound").doseOptions.find(d=>d.key===zepboundDose)?.note}
                {" · "}Dose-response: 5mg −16.0%, 10mg −21.4%, 15mg −22.5%
              </div>
            </div>
          )}

          {/* FOUNDAYO DOSE SELECTOR */}
          {medId==="foundayo"&&(
            <div style={{marginTop:12,background:"#f7f7f5",borderRadius:10,padding:"14px 16px",border:"1.5px solid #e0e0e0"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase",color:"#888",fontFamily:"system-ui",marginBottom:6}}>
                Maintenance dose
              </div>
              <div style={{fontSize:12,color:"#aaa",fontFamily:"system-ui",lineHeight:1.6,marginBottom:10}}>
                Select the dose the patient is on or plans to reach. ATTAIN-1 published separate outcomes for all three doses.
              </div>
              <div style={{display:"flex",flexWrap:"wrap",background:"#eee",borderRadius:10,padding:3,width:"fit-content",gap:0,marginBottom:8}}>
                {MEDS.find(m=>m.id==="foundayo").doseOptions.map(d=>(
                  <button key={d.key} style={{padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontFamily:"system-ui",fontWeight:600,background:foundayoDose===d.key?"#111":"transparent",color:foundayoDose===d.key?"#fff":"#888",transition:"all 0.18s",whiteSpace:"nowrap"}}
                    onClick={()=>{setFoundayoDose(d.key);reset();}}>{d.label}</button>
                ))}
              </div>
              <div style={{fontSize:11,color:"#aaa",fontFamily:"system-ui",lineHeight:1.6}}>
                {MEDS.find(m=>m.id==="foundayo").doseOptions.find(d=>d.key===foundayoDose)?.note}
                {" · "}Dose-response: 5.5mg −7.4%, 9mg −8.3%, 17.2mg −11.1%
              </div>
            </div>
          )}
        </div>

        {divider}

        {/* ── SUBGROUP SECTION ── */}
        <div style={{marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:600,color:"#333",fontFamily:"system-ui",marginBottom:4}}>About You</div>
          <div style={{fontSize:12,color:"#aaa",fontFamily:"system-ui",lineHeight:1.6,marginBottom:20}}>
            Answer as many questions as apply to you. Questions shown in grey have no published data for your selected medication and do not affect your estimate.
          </div>

          {/* T2DM — always active */}
          <div style={{marginBottom:18}}>
            <label style={{...lbl,color:"#888"}}>Type 2 Diabetes</label>
            <div style={togWrap}>
              {[[false,"No"],[true,"Yes"]].map(([v,l])=>(
                <button key={String(v)} style={tog(diabetes===v)} onClick={()=>{setDiabetes(v);if(v===true){setTxStatus(null);setDurationMet(null);setWeightThresholdMet(null);}reset();}}>{l}</button>
              ))}
            </div>
            {diabetes&&<div style={{fontSize:10,color:"#aaa",marginTop:4,fontFamily:"system-ui"}}>Applied across all medications — reduces expected loss by ~{med.diabetesDiscount}%</div>}
          </div>

          {/* SEX — Female / Male only, always selectable */}
          <div style={{marginBottom:18}}>
            <label style={lbl}>Sex</label>
            <div style={{fontSize:11,color:"#aaa",fontFamily:"system-ui",marginBottom:6,lineHeight:1.5}}>
              {med.subgroups.sex.available
                ? med.subgroups.sex.female > 0
                  ? "Clinical trials show females achieved greater weight loss than the trial average — selecting Female adjusts the estimate upward."
                  : "Clinical trials show females performed at or near the trial average. Selecting Female uses the ITT mean. Selecting Male applies a downward adjustment based on published sex-stratified data."
                : "No sex-specific trial data available for this medication — selecting your sex will not change the estimate."}
            </div>
            <div style={{display:"flex",background:"#eee",borderRadius:10,padding:3,width:"fit-content",gap:0}}>
              {[["female","Female"],["male","Male"]].map(([v,l])=>(
                <button key={v} style={{padding:"7px 24px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontFamily:"system-ui",fontWeight:600,background:sex===v?"#111":"transparent",color:sex===v?"#fff":"#888",transition:"all 0.18s"}}
                  onClick={()=>{setSex(v);reset();}}>
                  {l}
                </button>
              ))}
            </div>
            {!sex&&<div style={{fontSize:10,color:"#e08040",marginTop:4,fontFamily:"system-ui"}}>Please select to get an accurate estimate.</div>}
            {sex&&med.subgroups.sex.available&&<div style={{fontSize:10,color:"#bbb",marginTop:4,fontFamily:"system-ui"}}>Source: {med.subgroups.sex.source}</div>}
          </div>

          {/* AGE — safety flag only, not used in calculation */}
          <div style={{marginBottom:18}}>
            <label style={lbl}>Age</label>
            <div style={{fontSize:11,color:"#aaa",fontFamily:"system-ui",marginBottom:6,lineHeight:1.5}}>
              Age does not affect the weight loss estimate — published trial data shows adults ≥65 perform at or above the trial average. Age is collected only to surface relevant safety flags in the results.
            </div>
            <div style={{display:"flex",background:"#eee",borderRadius:10,padding:3,width:"fit-content",gap:0}}>
              {[[null,"—"],["under65","Under 65"],["65plus","65 or older"]].map(([v,l])=>(
                <button key={String(v)}
                  style={{padding:"7px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontFamily:"system-ui",fontWeight:600,background:patientAge===v?"#111":"transparent",color:patientAge===v?"#fff":"#888",transition:"all 0.18s"}}
                  onClick={()=>{setPatientAge(v==="—"?null:v);reset();}}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* MENOPAUSE — only show if female selected */}
          {sex==="female" && <SubgroupToggle
            label="Menopausal status"
            options={[[null,"Do not know"],["pre","Pre-menopausal"],["peripost","Peri or post-menopausal"]]}
            value={menopause} onChange={v=>{setMenopause(v);reset();}}
            available={med.subgroups.menopause.available}
            source={med.subgroups.menopause.source}
            note={med.subgroups.menopause.available
              ? `Pre-menopausal women show greater weight loss than peri/post-menopausal women on this medication.${(medId==="zepbound"||medId==="wegovy_hd")?" Peri and post-menopausal outcomes are nearly identical in published data and are combined here.":""}`
              : med.subgroups.menopause.reason||null}
          />}

          {sex==="female" && menopause==="peripost" && (medId==="zepbound") && (
            <div style={{fontSize:11,color:"#8b6020",fontFamily:"system-ui",lineHeight:1.6,background:"#f0f4f8",borderRadius:8,padding:"8px 12px",marginTop:-10,marginBottom:18,borderLeft:"3px solid #ddc080"}}>
              <strong>Clinical note:</strong> A 2026 Lancet study (Castaneda et al.) found peri/post-menopausal women on Zepbound who were also using menopausal hormone therapy (HRT) lost ~35% more weight than those without HRT. If your patient is on HRT, outcomes may be meaningfully higher than shown.
            </div>
          )}
          {!diabetes && <SubgroupToggle
            label="Prediabetes (without T2DM)"
            options={[[null,"Not specified"],[false,"No"],[true,"Yes"]]}
            value={prediabetes} onChange={v=>{setPrediabetes(v);reset();}}
            available={med.subgroups.prediabetes.available}
            source={med.subgroups.prediabetes.source}
          />}

          {/* EARLY RESPONSE — Wegovy injection and Wegovy Pill only, non-diabetic populations only */}
          {(medId==="wegovy"||medId==="wegovy_pill")&&!diabetes&&(
            <div style={{marginBottom:18}}>
              <label style={lbl}>Early treatment response</label>

              {/* Step 1: New or existing user? */}
              <div style={{fontSize:11,color:"#aaa",fontFamily:"system-ui",marginBottom:6,lineHeight:1.5}}>Are you new to this medication or have you already been using it?</div>
              <div style={{display:"flex",background:"#eee",borderRadius:10,padding:3,width:"fit-content",gap:0,marginBottom:10}}>
                {[[null,"—"],["new","I am new to this medication"],["existing","I am already using it"]].map(([v,l])=>(
                  <button key={String(v)} style={{padding:"7px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontFamily:"system-ui",fontWeight:600,background:txStatus===v?"#111":"transparent",color:txStatus===v?"#fff":"#888",transition:"all 0.18s"}}
                    onClick={()=>{setTxStatus(v==="—"?null:v);setDurationMet(null);setWeightThresholdMet(null);reset();}}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Step 2: Duration threshold met? */}
              {txStatus==="existing"&&(
                <>
                  <div style={{fontSize:11,color:"#555",fontFamily:"system-ui",marginBottom:6,fontWeight:600}}>
                    {medId==="wegovy" ? "Have you been using Wegovy for 24 weeks (about 6 months) or longer?" : "Have you been using the Wegovy pill for 16 weeks (about 4 months) or longer?"}
                  </div>
                  <div style={{display:"flex",background:"#eee",borderRadius:10,padding:3,width:"fit-content",gap:0,marginBottom:10}}>
                    {[[null,"—"],[true,"Yes"],[false,"No"]].map(([v,l])=>(
                      <button key={String(v)} style={{padding:"7px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontFamily:"system-ui",fontWeight:600,background:durationMet===v?"#111":"transparent",color:durationMet===v?"#fff":"#888",transition:"all 0.18s"}}
                        onClick={()=>{setDurationMet(v===null?null:v);setWeightThresholdMet(null);reset();}}>
                        {l}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Step 3: Weight threshold met? — only if duration met = Yes */}
              {txStatus==="existing"&&durationMet===true&&(
                <>
                  <div style={{fontSize:11,color:"#555",fontFamily:"system-ui",marginBottom:6,fontWeight:600}}>
                    {medId==="wegovy" ? "In the first 24 weeks of using Wegovy, did you lose 15% or more of your body weight?" : "After using the Wegovy pill for 16 weeks, did you lose 10% or more of your body weight?"}
                  </div>
                  <div style={{display:"flex",background:"#eee",borderRadius:10,padding:3,width:"fit-content",gap:0,marginBottom:8}}>
                    {[[null,"—"],[true,"Yes"],[false,"No"]].map(([v,l])=>(
                      <button key={String(v)} style={{padding:"7px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontFamily:"system-ui",fontWeight:600,background:weightThresholdMet===v?"#111":"transparent",color:weightThresholdMet===v?"#fff":"#888",transition:"all 0.18s"}}
                        onClick={()=>{setWeightThresholdMet(v===null?null:v);reset();}}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {weightThresholdMet===true&&(
                    <div style={{fontSize:11,color:"#1a5c4a",fontFamily:"system-ui",lineHeight:1.6,background:"#e8f4f1",borderRadius:8,padding:"8px 12px",borderLeft:"3px solid #1a5c4a"}}>
                      ✓ Early responder confirmed — ceiling raised to reflect published {medId==="wegovy"?"STEP UP ECO 2026":"OASIS 4 ECO 2026"} early responder outcomes.
                      {medId==="wegovy"&&<span> {wegovyDoseIntent==="hd"?"Projected 27.7% at 72 wks (7.2 mg).":"Projected 24.8% at 72 wks (2.4 mg)."}</span>}
                      {medId==="wegovy_pill"&&<span> Projected 21.6% at 64 wks.</span>}
                    </div>
                  )}
                  {weightThresholdMet===false&&(
                    <div style={{fontSize:11,color:"#8b6020",fontFamily:"system-ui",lineHeight:1.6,background:"#f0f4f8",borderRadius:8,padding:"8px 12px",borderLeft:"3px solid #ddc080"}}>
                      That\'s okay \u2014 many people take longer to see significant results. The estimate below reflects the overall trial average for people in your situation. Keep going and discuss with your prescriber if you have concerns.
                    </div>
                  )}
                </>
              )}
              {txStatus==="existing"&&durationMet===false&&(
                <div style={{fontSize:11,color:"#aaa",fontFamily:"system-ui",fontStyle:"italic"}}>
                  {medId==="wegovy" ? "Keep going \u2014 check back when you reach 6 months (24 weeks) to see if your early response unlocks an updated estimate." : "Keep going \u2014 check back when you reach 4 months (16 weeks) to see if your early response unlocks an updated estimate."}
                </div>
              )}
              <div style={{fontSize:10,color:"#bbb",fontFamily:"system-ui",marginTop:6,lineHeight:1.5}}>
                Source: {medId==="wegovy"
                  ? "STEP UP post-hoc, ECO 2026 (May 2026): early responders ≥15% at wk 24 → 27.7% (7.2mg) / 24.8% (2.4mg) at 72 wks"
                  : "OASIS 4 post-hoc, ECO 2026 (May 2026): early responders ≥10% at wk 16 → 21.6% at 64 wks"}
              </div>
            </div>
          )}
        </div>

        {divider}

        {/* CALCULATE */}
        <button onClick={handleCalc} disabled={!canCalc} style={{width:"100%",padding:15,borderRadius:12,border:"none",background:canCalc?"#111":"#d0d0d0",color:canCalc?"#fff":"#aaa",fontSize:16,fontFamily:"system-ui",fontWeight:700,cursor:canCalc?"pointer":"not-allowed",letterSpacing:"0.02em",transition:"all 0.2s",marginBottom:6}}>
          Calculate My Personalised Estimate
        </button>
        {!canCalc&&bmi&&bmi<25&&<div style={{textAlign:"center",fontSize:12,color:"#bbb",fontFamily:"system-ui"}}>BMI must be ≥25 to generate an estimate</div>}

        {/* ════ RESULTS ════ */}
        {shown&&R&&(
          <div ref={resultRef} style={{marginTop:40,borderTop:"2px solid #111",paddingTop:28}}>

            <div style={{fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:"#888",fontFamily:"system-ui",marginBottom:4}}>
              {medId==="wegovy"&&wegovyDoseIntent==="hd"?"Wegovy → HD (7.2 mg)":med.name}
              {med.activeDoseLabel ? ` · ${med.activeDoseLabel}` : ""}
              {isWegovyEarlyResp24 ? " · Week-24 early responder" : ""}
              {" · "}{bmiClass.label} · {med.trialName} ({med.trialWeeks} wks)
            </div>
            <div style={{fontSize:13,color:"#aaa",fontFamily:"system-ui",lineHeight:1.6,marginBottom:16}}>
              Personalised projection at ~{med.trialWeeks} weeks
              {medId==="wegovy"&&wegovyDoseIntent==="hd"?" · STEP UP 7.2 mg data":""}
              {isWegovyEarlyResp24 ? ` · ceiling raised to ${medWithOverride.ceiling}% based on ECO 2026 early responder data` : ""}
              {med.activeDoseNote ? ` · ${med.activeDoseNote}` : ""}
              {diabetes?" · adjusted for T2DM":""}
              {R.winner?" · strongest subgroup factor applied":""}
            </div>

            {/* Week-24 early responder ceiling override notice */}
            {isWegovyEarlyResp24 && (
              <div style={{background:"#e8f4f1",borderRadius:10,padding:"12px 14px",marginBottom:16,borderLeft:"3px solid #1a5c4a"}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#1a5c4a",fontFamily:"system-ui",marginBottom:4}}>
                  Week-24 early responder — ceiling raised
                </div>
                <div style={{fontSize:12,color:"#2a7a5a",fontFamily:"system-ui",lineHeight:1.6}}>
                  {medWithOverride.earlyRespNote}
                </div>
                <div style={{fontSize:11,color:"#aaa",fontFamily:"system-ui",marginTop:4,lineHeight:1.5}}>
                  Ceiling raised to {medWithOverride.ceiling}% (female) / {medWithOverride.ceilingMale}% (male) to reflect published early responder outcomes. No SD published yet — ceiling set conservatively ~2% above reported mean.
                </div>
              </div>
            )}

            {/* Subgroup adjustment panel — single winner */}
            {(R.winner || R.ignored?.length > 0) && (
              <div style={{background:"#f7f7f5",borderRadius:10,padding:"12px 14px",marginBottom:20,borderLeft:"3px solid #ccc"}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#888",fontFamily:"system-ui",marginBottom:10}}>
                  Personalisation applied
                </div>

                {/* Applied — single strongest factor */}
                {R.winner && (
                  <div style={{marginBottom: R.ignored?.length > 0 ? 10 : 0}}>
                    <div style={{fontSize:10,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"system-ui",marginBottom:5}}>
                      Applied — strongest factor
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff",borderRadius:8,padding:"8px 12px"}}>
                      <div>
                        <div style={{fontSize:13,fontFamily:"system-ui",color:"#222",fontWeight:500}}>{R.winner.label}</div>
                        <div style={{fontSize:10,color:"#bbb",fontFamily:"system-ui",marginTop:2,lineHeight:1.4}}>{R.winner.source}</div>
                      </div>
                      <div style={{fontSize:15,fontWeight:700,color:R.delta>=0?"#1a5c4a":"#8b2020",marginLeft:12,flexShrink:0}}>
                        {R.delta>0?"+":""}{R.delta.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}

                {/* Other factors — considered but not applied */}
                {R.ignored?.length > 0 && (
                  <div>
                    <div style={{fontSize:10,color:"#ccc",textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"system-ui",marginBottom:5}}>
                      Other factors — not applied to avoid confounding
                    </div>
                    {R.ignored.map((a,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,fontFamily:"system-ui",color:"#ccc",marginBottom:3,padding:"4px 0",borderBottom:"1px solid #f0f0f0"}}>
                        <span>{a.label}</span>
                        <span style={{fontWeight:500}}>{a.delta>0?"+":""}{a.delta.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ceiling notice */}
                {R.ceilingHit && (
                  <div style={{marginTop:10,fontSize:11,color:"#8b2020",fontFamily:"system-ui",fontStyle:"italic",lineHeight:1.5}}>
                    ⚠ Estimate capped at {R.effectiveCeiling}% — the highest published outcome for this medication and sex. Based on clinical trial data.
                  </div>
                )}
              </div>
            )}

            {/* ── AGE SAFETY FLAGS — shown when age is specified ── */}
            {patientAge === "65plus" && (
              <div style={{marginBottom:20}}>
                <div style={{background:"#f0f4f8",borderRadius:10,padding:"13px 15px",borderLeft:"3px solid #ddc080",fontSize:12,color:"#8b6020",fontFamily:"system-ui",lineHeight:1.7}}>
                  <strong>⚠ Age 65+ — important safety information:</strong>
                  <ul style={{margin:"6px 0 0",paddingLeft:18}}>
                    <li>Clinical trial data shows adults 65 and older achieve weight loss <em>at or above</em> the trial average — effectiveness is not reduced with age.</li>
                    <li>However, weight loss in older adults carries a higher risk of muscle and bone loss. About 25% of weight lost on GLP-1 medications is lean mass.</li>
                    <li><strong>BMI should not be lowered below 23</strong> in adults 65 and older. Your prescriber should adjust or pause the dose if you approach this threshold.</li>
                    <li>Make sure you are eating enough protein and staying physically active to protect muscle mass during treatment.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* TAB BAR */}
            <div style={{display:"flex",background:"#eee",borderRadius:10,padding:3,marginBottom:24,flexWrap:"wrap",gap:0}}>
              {[["outcomes","Outcome Ranges"],["timeline","Timeline"],["milestones","Milestones"]].map(([v,l])=>(
                <button key={v} style={tog(tab===v)} onClick={()=>setTab(v)}>{l}</button>
              ))}
            </div>

            {/* OUTCOMES */}
            {tab==="outcomes"&&<>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:22}}>
                {[
                  {label:"Conservative",pct:R.lo, lbs:R.loLbs, wt:R.wtHi},
                  {label:"Typical",     pct:R.typ,lbs:R.typLbs,wt:R.wtTyp,hi:true},
                  {label:"Strong",      pct:R.hi, lbs:R.hiLbs, wt:R.wtLo},
                ].map((r,i)=>(
                  <div key={i} style={{background:r.hi?"#111":"#f4f4f2",borderRadius:12,padding:"16px 12px",textAlign:"center"}}>
                    <div style={{fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:r.hi?"#666":"#aaa",fontFamily:"system-ui",marginBottom:6}}>{r.label}</div>
                    <div style={{fontSize:30,fontWeight:400,color:r.hi?"#fff":"#111",lineHeight:1}}>−{r.pct}%</div>
                    <div style={{fontSize:17,color:r.hi?"#999":"#777",marginTop:4,fontFamily:"system-ui"}}>−{r.lbs} lbs</div>
                    <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${r.hi?"#2a2a2a":"#e0e0e0"}`}}>
                      <div style={{fontSize:10,color:r.hi?"#555":"#ccc",textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:"system-ui"}}>Target weight</div>
                      <div style={{fontSize:14,color:r.hi?"#bbb":"#999",fontFamily:"system-ui",marginTop:2}}>~{r.wt} lbs</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#ccc",fontFamily:"system-ui",marginBottom:5}}>
                  <span>0%</span><span>Personalised range: −{R.lo}% to −{R.hi}%</span><span>35%</span>
                </div>
                <div style={{background:"#e4e4e4",borderRadius:99,height:10,position:"relative",overflow:"hidden"}}>
                  <RangeBar lo={parseFloat(R.lo)} hi={parseFloat(R.hi)} typ={parseFloat(R.typ)} max={35}/>
                </div>
              </div>
            </>}

            {/* TIMELINE */}
            {tab==="timeline"&&<div style={{marginBottom:22}}>
              <div style={{fontSize:11,letterSpacing:"0.09em",textTransform:"uppercase",color:"#aaa",fontFamily:"system-ui",marginBottom:12}}>Average cumulative % weight loss · {med.trialName} population</div>
              <TimelineChart med={med}/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:18}}>
                {[
                  {label:"~12 weeks",              pct:med.timelinePts[1], note:"Dose escalation — appetite suppression building"},
                  {label:"~6 months",              pct:med.timelinePts[3], note:"Near therapeutic dose — most active loss phase"},
                  {label:`~${med.trialWeeks} wks`, pct:med.timelinePts[5], note:"Trial endpoint — maximum effect, plateau typical"},
                ].map((t,i)=>(
                  <div key={i} style={{background:"#f4f4f2",borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
                    <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:"#bbb",fontFamily:"system-ui",marginBottom:4}}>{t.label}</div>
                    <div style={{fontSize:22,color:"#111"}}>~{t.pct}%</div>
                    <div style={{fontSize:10,color:"#bbb",fontFamily:"system-ui",marginTop:4,lineHeight:1.45}}>{t.note}</div>
                  </div>
                ))}
              </div>
              {diabetes&&<div style={{marginTop:12,fontSize:12,color:"#aaa",fontFamily:"system-ui",fontStyle:"italic",lineHeight:1.5}}>Timeline is from non-diabetic trial data. Expect each milestone ~{med.diabetesDiscount}% lower with T2DM.</div>}
            </div>}

            {/* MILESTONES */}
            {tab==="milestones"&&<div style={{marginBottom:22}}>
              <div style={{fontSize:12,color:"#aaa",fontFamily:"system-ui",lineHeight:1.65,marginBottom:18}}>
                Out of 100 patients on {med.name} at {med.trialWeeks} weeks, approximately this many achieved each threshold{diabetes?" (T2DM-adjusted)":""}.
              </div>
              {[5,10,15,20].map((thr,i)=>{
                const raw=med.milestones[thr];
                const adj=diabetes?Math.round(raw*0.73):raw;
                return <div key={thr} style={{marginBottom:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,alignItems:"baseline"}}>
                    <span style={{fontSize:14,color:"#222",fontFamily:"system-ui"}}>Lose ≥{thr}% body weight</span>
                    <span style={{fontSize:15,fontWeight:700,color:"#111",fontFamily:"system-ui"}}>{adj} / 100 patients</span>
                  </div>
                  <AnimBar pct={adj} delay={i*90}/>
                  <div style={{fontSize:11,color:"#ccc",fontFamily:"system-ui",marginTop:4}}>≥{thr}% = losing ≥{Math.round(weightLbs*thr/100)} lbs for you</div>
                </div>;
              })}
            </div>}

            {/* SOURCE + DISCLAIMER */}
            <div style={{background:"#f4f4f2",borderRadius:10,padding:"13px 15px",fontSize:12,color:"#888",fontFamily:"system-ui",lineHeight:1.7,borderLeft:"3px solid #d0d0d0",marginBottom:10}}>
              <strong style={{color:"#555"}}>Clinical Trial Source: </strong>
              {diabetes && med.diabetesNote ? med.diabetesNote : med.note}
            </div>
            <div style={{background:"#f0f4f8",borderRadius:10,padding:"12px 15px",fontSize:12,color:"#4a6080",fontFamily:"system-ui",lineHeight:1.65,borderLeft:"3px solid #ddc080"}}>
              <strong>Medical Disclaimer © 2026 North County Endocrinology Associates:</strong> For educational purposes only — not medical advice. Subgroup adjustments are derived from post-hoc and pooled analyses and carry greater uncertainty than primary trial endpoints. Individual outcomes vary significantly. ~32% of patients lose &lt;5% of body weight. Consult a prescriber before starting or changing any medication.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
