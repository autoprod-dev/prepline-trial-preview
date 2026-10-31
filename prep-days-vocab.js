/* PrepLine by Autoprod: prep start days by ingredient type (4.6.2 / 4.8.13).
 * EDIT THIS FILE to change the rules. Each category has:
 *   lead   - how many days BEFORE the event/function day the job starts (0 = on the day)
 *   weekendShift - if true, Sat/Sun starts use weekend avoidance (forward Mon / back Fri).
 *                  4.6.2: weekend avoidance applies to ALL categories when the Rules
 *                  profile toggle is on; this flag still seeds per-rule defaults.
 *   batchWindow - max days from batch prep day to latest member use (protein = 4, fish/seafood = 2)
 *   legend / words - matching (first match wins; specific before general)
 *
 * Protein 4-day stages (Gerard 4.8.12) — poultry/redmeat prep START lead=4:
 *   day 4 before = collect & trim; day 3 = sear/cool down; day 2 = re-tray or roast;
 *   day 1 (event) = box off.
 * Seafood / fish & prawns (Gerard 4.8.13): lead=2, batchWindow=2 —
 *   day 2 before = collect & trim; day 1 before = process / count / tray up.
 *   Covers fish, prawns/shrimp, and other seafood words below. Resolves Mon-event
 *   (Saturday start). Veg-only stage split: vegraw≤4, vegcook≤3. Unclear veg → vegcook.
 */

window.PREP_DAYS_VOCAB = [
  {key:'micro',   label:'Micro herbs',             lead:1, batchWindow:1, weekendShift:true, family:'garnish',
   legend:['micro herbs','micro greens','micro herb','micros','micro'],
   words:['micro*','tendril*','sprout*','cress','shoots','pea shoots','baby herbs']},
  {key:'dry',     label:'Dry garnish and crumbs',  lead:4, batchWindow:4, weekendShift:true, family:'garnish',
   legend:['dry garnish','dry garnishes','dry garnish crumbs','dry garnishes crumbs','crumbs','crumb','dry','powders','powder'],
   words:['crumb*','crouton*','crumble','panko','dukkah','dukka','praline','tuile*','crisp*','chip','chips','powder','dust','soil','granola','toasted seeds','toasted nuts','candied nuts','seeds','furikake']},
  {key:'oil',     label:'Oils',                    lead:4, batchWindow:4, weekendShift:true, family:'garnish',
   legend:['oil','oils'],
   words:['oil','oils','chilli oil','herb oil','green oil']},
  {key:'gels',    label:'Gels and purees',         lead:3, batchWindow:3, weekendShift:true, family:'sauce',
   legend:['gel','gels','puree','purees','sauce','sauces','sauce puree gels','sauces purees gels'],
   words:['gel*','puree*','purée*','pureed','coulis','fluid gel','jelly','butter glaze','glaze','romesco','reduction','jus','gravy','salsa','relish','chutney','ragu','ragout','ponzu','cashew cream','cream flora','flora cream']},
  {key:'seafood', label:'Seafood',                 lead:2, batchWindow:2, weekendShift:true, family:'protein',
   legend:['seafood','fish','shellfish'],
   words:['seafood','fish','salmon','tuna','prawn*','scallop*','barramundi','kingfish','hiramasa','snapper','cod','crab','lobster','octopus','squid','calamari','mussel*','oyster*','clam*','bug','bugs','trout','ling','mackerel','sardine*','anchov*','swordfish','whiting','flathead','john dory','bream','caviar','hake','flake','mullet','garfish','ocean trout','coral trout','blue eye','blueeye','pipi*','yabby*','marron','eel','shrimp*','langoustine*','crayfish','dory']},
  {key:'redmeat', label:'Red meat',                lead:4, batchWindow:4, weekendShift:true, family:'protein',
   legend:['red meat','red meats','meat','beef','lamb','pork'],
   words:['beef','lamb','pork','veal','venison','wagyu','brisket','short rib*','rib eye','ribeye','sirloin','striploin','eye fillet','rump','steak*','mince','kangaroo','oxtail','cheek*','shank*','goat leg','goat shoulder','lamb rump','pork belly','chorizo','prosciutto','pancetta','bacon']},
  {key:'starch',  label:'Starch',                  lead:3, batchWindow:3, weekendShift:true, family:'starch',
   legend:['starch','starches','big jobs','big job'],
   words:['potato*','mash','rice','risotto','pasta','gnocchi','polenta','bread','brioche','dough','noodle*','ravioli','tortellini','couscous','quinoa','croquette*','fondant','pomme*','farro','freekeh','lentil*','barley','pastry','tart shell*','lasagne','lasagna']},
  {key:'garnish', label:'Garnish, pick herbs',     lead:2, batchWindow:2, weekendShift:true, family:'garnish',
   legend:['garnish','garnishes','pick herbs','picked herbs','herbs','garnish pick herbs','garnishes pick herbs'],
   words:['garnish*','pick','picked','herb','herbs','parsley','chervil','dill','coriander','mint','basil','chive*','tarragon','sage','thyme','rosemary','oregano','shiso','edible flower*','flower edible','flowers','pickle*','pickled','viola','allysium','alyssum','sorrel','red vein','soaked raisin','raisin','fennel seed','seed mix','pea tendril','tendril','blossom*','zucchini blossom','salmon roe','trout roe','roe','caviar','tobiko','karkalla','samphire','sea blite']},
  /* 4.8.12 Gerard: veg raw collect/trim up to 4 days; cooked stages max 3 (prefer 2–3).
   * Matching still uses produce words → key 'veg', then classifyVegPrepStage refines to vegraw|vegcook. */
  {key:'veg',     label:'Vegetables',              lead:3, batchWindow:3, weekendShift:true, family:'veg',
   legend:['veg','vege','veges','veggies','vegetable','vegetables'],
   words:['veg','vege','vegetable*','carrot*','dutch carrot*','baby carrot*','onion*','shallot*','eschalot*','leek*','celery','celeriac','fennel','beetroot*','beet*','pumpkin','squash','zucchini','eggplant','aubergine','capsicum*','mushroom*','cauliflower','broccoli*','broccolini','asparagus','pea','peas','bean*','kale','spinach','cabbage','tomato*','cucumber*','radish*','corn','garlic','lettuce','greens','cos','witlof','witlof','artichoke*','parsnip*','turnip*','kohlrabi','silverbeet','chard','okra','salad','warrigal','karkalla','samphire','sea blite','blite','saltbush','davidson','finger lime','bunya','yam daisy','compressed apple','apple dice','shimeji','enoki','king brown']},
  {key:'vegraw',  label:'Vegetables (raw / trim)', lead:4, batchWindow:4, weekendShift:true, family:'veg',
   legend:[], words:[]},
  {key:'vegcook', label:'Vegetables (cooked)',     lead:3, batchWindow:3, weekendShift:true, family:'veg',
   legend:[], words:[]},
  {key:'poultry', label:'Poultry',                 lead:4, batchWindow:4, weekendShift:true, family:'protein',
   legend:['poultry','chicken','duck','birds','game birds'],
   words:['poultry','chicken','duck','turkey','quail','spatchcock','poussin','guinea fowl','pheasant','goose','pigeon','squab','confit leg','thigh*','drumstick*','wing*']},
  {key:'dairy',   label:'Cheese, butters and creams', lead:4, batchWindow:4, weekendShift:true, family:'dairy',
   legend:['cheese','cheeses','dairy','butter','butters','cream','creams','butters creams','cheese dairy'],
   words:['cheese*','parmesan','parmigiano','pecorino','grana padano','mozzarella','burrata','ricotta','feta','haloumi','halloumi','goat curd','labneh','mascarpone','stracciatella','gruyere','cheddar','brie','camembert','blue cheese','butter*','cream','creams','creme fraiche','crème fraîche','sour cream','chantilly','custard','yoghurt','yogurt']},
  {key:'dressing', label:'Dressings',              lead:4, batchWindow:4, weekendShift:true, family:'dressing',
   legend:['dressing','dressings','vinaigrette','vinaigrettes'],
   words:['dressing*','vinaigrette*','mayo','mayonnaise','aioli','ranch']},
  /* Crab croquettes (bulked/frozen): 4-day protein-style window. Keyword rule overrides plain "crab" seafood. */
  {key:'crabcroq', label:'Crab croquettes (frozen bulk)', lead:4, batchWindow:4, weekendShift:true, family:'starch',
   legend:[],
   words:[]}
];

/* 4.8.12 — Gerard: veg raw (collect/trim) ≤4 days; cooked ≤3. Batch only within same stage.
 * Returns { key:'vegraw'|'vegcook', stage:'raw'|'cooked', clear:boolean, reason:string }.
 * Unclear → vegcook (shorter, safer).
 */
window.classifyVegPrepStage = function classifyVegPrepStage(taskText) {
  var raw = String(taskText == null ? '' : taskText);
  var t = raw.toLowerCase().replace(/[ée]/g, function (m) { return m === 'é' ? 'e' : m; });
  var parts = t.split(/\s*\/\s*/);
  var head = (parts[0] || '').trim();
  var method = parts.slice(1).join(' / ');
  var body = method || t;

  var RAW_RE = /\b(collect|collection|pick|picked|picking|trim|trimmed|trimming|wash|washed|washing|peel|peeled|peeling|cut|cutting|slice|sliced|slicing|dice|diced|dicing|shave|shaved|shaving|portion|portioned|decant|shred|shredded|drain|drained|bag(?:ged)?|tray(?:ed)?)\b/;
  var COOK_RE = /\b(roast|roasted|roasting|blanch|blanched|blanching|cook|cooked|cooking|puree|pureed|purees|confit|grill|grilled|grilling|saute|sauteed|sauted|fry|fried|frying|oven|bake|baked|baking|steam|steamed|steaming|boil|boiled|boiling|braise|braised|char|charred|sear|seared|poach|poached|sous[\s-]?vide|compress(?:ed)?|fermen(?:t|ted)|pickle(?:d)?|cure(?:d)?|smoke(?:d)?|glaze(?:d)?|caramelis(?:e|ed)|carameliz(?:e|ed)|reduce(?:d)?|reduction|ragu|remoulade|marinade|marinate(?:d)?)\b/;
  /* "rub" only as a method step, not "no rub" / "eggplant no rub" */
  var RUB_RE = /(^|\/)\s*rub\b/;

  var hasCook = COOK_RE.test(body) || COOK_RE.test(head) || RUB_RE.test(body);
  var hasRaw = RAW_RE.test(body);

  if (hasCook) {
    return { key: 'vegcook', stage: 'cooked', clear: true, reason: 'cook-stage keyword' };
  }
  if (hasRaw && method) {
    return { key: 'vegraw', stage: 'raw', clear: true, reason: 'raw-stage keyword only' };
  }
  return { key: 'vegcook', stage: 'cooked', clear: false, reason: 'unclear — default cooked (shorter)' };
};
