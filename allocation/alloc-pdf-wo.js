/* Prepline: parse a colourless ICC Kitchen Work Orders PDF into the A..O + fill row shape
   parseWorkOrder expects. Uses pdf.js text items when available; Node tests can pass
   pre-extracted rows. No real kitchen data in here. */
(function(root){
const SAND='C9DAF8',SALAD='B6D7A8',GREEN='D9EAD3',FRUIT='FFC000',PLAT='70AD47',KIOSK='D5A6BD',CAN='F4CCCC';
const clean=v=>v==null?'':String(v).replace(/\u00a0/g,' ').trim();
const DAYRE=/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(\d{1,2})\s+([a-z]+),?\s+(\d{4})/i;

function classifyPdf(item, cat){
  const it=clean(item), c=clean(cat);
  if(/botanical water|ice cream|gelato|service fee|hire\b|barista|nespresso|\bteas?\b|filtered (ice )?water|staff\b|mugs|pods\b/i.test(it))return null;
  if(/sydney eats\s*\((monday|tuesday|wednesday|thursday|friday|saturday|sunday|day)\)/i.test(it))return null; // buffet header — white
  if(/stand\s*up|build your own sydney/i.test(it))return SAND;
  if(/retail kiosk/i.test(it))return KIOSK;
  if(/green room/i.test(it))return GREEN;
  if(/canap|^cold items:|^hot items:/i.test(it) || /canap/i.test(c))return CAN;
  if(/^generic menu item/i.test(it) && /canap/i.test(c))return CAN;
  if(/fruit platter|sliced fruit|juice station|fruit skewer/i.test(it))return FRUIT;
  if(/cheese (and charcuterie )?platter|charcuterie|antipasto|\brider\b|promoter complimentary/i.test(it))return PLAT;
  if(/^(sandwich|wrap)\s*-/i.test(it))return SAND;
  if(/^salad( bowl)?\s*-/i.test(it))return SALAD;
  if(/sandwich|\bwraps?\b|lunch bag|lunch box|grab and go|generic menu item|asn menu|custom sydney eats|deconstructed|bagel|croissant/i.test(it))return SAND;
  if(/salad|poke|handbowl|custo?n? lunch menu/i.test(it))return SALAD;
  if(/canap|sushi|rice paper|oyster|tartlet|taco|miang|lettuce cups/i.test(it))return CAN;
  return null;
}

/* Merge PDF wrap continuations: a row with same room+qty, no new item type, fill null → append to prev H. */
function mergeContinuations(rows){
  const out=[];
  for(const x of rows){
    const prev=out[out.length-1];
    const h=clean(x.H), f=clean(x.F);
    const cont=prev && f && f===clean(prev.F) && (x.G===prev.G || x.G==null) && h && !x.fill
      && !/^(salad|sandwich|wrap|bowl|canap|green room|build your own|sydney eats|generic menu|retail|morning tea|promoter|asn menu|cold items|hot items|custom|grab and go|lunch box|lunch bag)/i.test(h)
      && clean(prev.H);
    if(cont){prev.H=clean(prev.H)+' '+h; if(x.I&&!prev.I)prev.I=x.I; if(x.O)prev.O=x.O; continue;}
    out.push(Object.assign({},x));
  }
  return out;
}

function recolour(rows){
  return rows.map(x=>{
    if(!clean(x.F)||!clean(x.H))return x;
    const fill=classifyPdf(x.H, x.cat);
    return Object.assign({},x,{fill});
  });
}

/* Normalise a pdf-rows-like array into engine input (optionally filter week). */
function rowsFromExtracted(rawRows, weekStart){
  let rows=mergeContinuations(rawRows);
  rows=recolour(rows);
  if(weekStart){
    const addDays=(s,n)=>{const d=new Date(s+'T00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
    const parseDay=t=>{const m=clean(t).match(DAYRE);if(!m)return null;const d=new Date(m[2]+' '+m[3]+' '+m[4]);if(isNaN(d))return null;return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
    const start=weekStart, end=addDays(start,8);
    let keep=false, out=[];
    for(const x of rows){
      const d=parseDay(x.A);
      if(d){keep=d>=start&&d<=end; if(keep)out.push(x); continue;}
      if(keep)out.push(x);
    }
    rows=out;
  }
  return rows;
}

const API={classifyPdf,mergeContinuations,recolour,rowsFromExtracted,SAND,SALAD,GREEN,FRUIT,PLAT,KIOSK,CAN};
root.AllocPdfWo=API;
if(typeof module!=='undefined')module.exports=API;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:this);
