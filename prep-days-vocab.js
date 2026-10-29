/* PrepLine by Autoprod: prep start days by ingredient type (4.6.2).
 * EDIT THIS FILE to change the rules. Each category has:
 *   lead   - how many days BEFORE the event/function day the job starts (0 = on the day)
 *   weekendShift - if true, Sat/Sun starts use weekend avoidance (forward Mon / back Fri).
 *                  4.6.2: weekend avoidance applies to ALL categories when the Rules
 *                  profile toggle is on; this flag still seeds per-rule defaults.
 *   batchWindow - max days from batch prep day to latest member use (protein = 4, fish = 1)
 *   legend / words - matching (first match wins; specific before general)
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
   words:['gel*','puree*','purée*','pureed','coulis','fluid gel','jelly','glaze*','romesco','reduction','jus','gravy','salsa','relish','chutney']},
  {key:'seafood', label:'Seafood',                 lead:1, batchWindow:1, weekendShift:true, family:'protein',
   legend:['seafood','fish','shellfish'],
   words:['seafood','fish','salmon','tuna','prawn*','scallop*','barramundi','kingfish','hiramasa','snapper','cod','crab','lobster','octopus','squid','calamari','mussel*','oyster*','clam*','bug','bugs','trout','ling','mackerel','sardine*','anchov*','swordfish','whiting','flathead','john dory','bream','caviar','roe','hake','flake','mullet','garfish','ocean trout','coral trout','blue eye','blueeye','pipi*','yabby*','marron','eel','shrimp*','langoustine*','crayfish','dory']},
  {key:'redmeat', label:'Red meat',                lead:4, batchWindow:4, weekendShift:true, family:'protein',
   legend:['red meat','red meats','meat','beef','lamb','pork'],
   words:['beef','lamb','pork','veal','venison','wagyu','brisket','short rib*','rib eye','ribeye','sirloin','striploin','eye fillet','rump','steak*','mince','kangaroo','oxtail','cheek*','shank*','goat leg','goat shoulder','lamb rump','pork belly','chorizo','prosciutto','pancetta','bacon']},
  {key:'starch',  label:'Starch',                  lead:3, batchWindow:3, weekendShift:true, family:'starch',
   legend:['starch','starches','big jobs','big job'],
   words:['potato*','mash','rice','risotto','pasta','gnocchi','polenta','bread','brioche','dough','noodle*','ravioli','tortellini','couscous','quinoa','croquette*','fondant','pomme*','farro','freekeh','lentil*','barley','pastry','tart shell*','lasagne','lasagna']},
  {key:'garnish', label:'Garnish, pick herbs',     lead:2, batchWindow:2, weekendShift:true, family:'garnish',
   legend:['garnish','garnishes','pick herbs','picked herbs','herbs','garnish pick herbs','garnishes pick herbs'],
   words:['garnish*','pick','picked','herb','herbs','parsley','chervil','dill','coriander','mint','basil','chive*','tarragon','sage','thyme','rosemary','oregano','shiso','edible flower*','flower edible','flowers','pickle*','pickled']},
  {key:'veg',     label:'Vegetables',              lead:4, batchWindow:4, weekendShift:true, family:'veg',
   legend:['veg','vege','veges','veggies','vegetable','vegetables'],
   words:['veg','vege','vegetable*','carrot*','onion*','shallot*','eschalot*','leek*','celery','celeriac','fennel','beetroot*','beet*','pumpkin','squash','zucchini','eggplant','capsicum*','mushroom*','cauliflower','broccoli*','broccolini','asparagus','pea','peas','bean*','kale','spinach','cabbage','tomato*','cucumber*','radish*','corn','garlic','lettuce','greens','cos','witlof','artichoke*','parsnip*','turnip*','kohlrabi','silverbeet','chard','okra','salad']},
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
