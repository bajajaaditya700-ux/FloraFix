export interface DiseaseInfo {
  name: string;
  symptoms: string[];
  causes: string[];
  treatments: string[];
}

export const COMMON_DISEASES: DiseaseInfo[] = [
  {
    name: "Powdery Mildew",
    symptoms: ["White, flour-like spots on leaves", "Curled or distorted leaves", "Yellowing of leaves"],
    causes: ["High humidity", "Poor air circulation", "Low light levels"],
    treatments: ["Remove infected leaves", "Apply neem oil or sulfur-based fungicide", "Improve air circulation"]
  },
  {
    name: "Leaf Spot",
    symptoms: ["Brown or black spots with yellow halos", "Premature leaf drop", "Spots may merge into large dead areas"],
    causes: ["Fungal or bacterial pathogens", "Excessive moisture on leaves", "Poor drainage"],
    treatments: ["Avoid overhead watering", "Remove and destroy infected leaves", "Apply copper-based fungicide"]
  },
  {
    name: "Root Rot",
    symptoms: ["Yellowing, wilting leaves", "Stunted growth", "Mushy, brown or black roots"],
    causes: ["Overwatering", "Poorly draining soil", "Fungal pathogens like Phytophthora"],
    treatments: ["Improve drainage", "Reduce watering frequency", "Repot in fresh, well-draining soil", "Apply root rot treatment"]
  },
  {
    name: "Aphids",
    symptoms: ["Tiny green, black, or white insects on stems/leaves", "Sticky residue (honeydew)", "Distorted or yellowing new growth"],
    causes: ["Introduction of infested plants", "Lack of natural predators"],
    treatments: ["Spray with water to dislodge", "Apply insecticidal soap or neem oil", "Introduce ladybugs"]
  },
  {
    name: "Spider Mites",
    symptoms: ["Fine webbing on undersides of leaves", "Tiny yellow or white stippling on leaves", "Leaves turning bronze or yellow"],
    causes: ["Hot, dry conditions", "Dusty environments"],
    treatments: ["Increase humidity", "Wipe leaves with a damp cloth", "Apply miticide or neem oil"]
  },
  {
    name: "Rust",
    symptoms: ["Orange, yellow, or brown pustules on leaf undersides", "Yellow spots on leaf tops", "Premature leaf drop"],
    causes: ["High humidity", "Prolonged leaf wetness", "Fungal spores"],
    treatments: ["Remove infected leaves", "Avoid overhead watering", "Apply copper-based fungicide", "Improve air circulation"]
  },
  {
    name: "Anthracnose",
    symptoms: ["Small, water-soaked spots on leaves or fruit", "Sunken, dark lesions", "Pinkish spore masses in wet weather"],
    causes: ["Fungal pathogens", "Warm, wet weather", "Poor sanitation"],
    treatments: ["Prune affected branches", "Remove fallen debris", "Apply chlorothalonil or copper fungicide"]
  },
  {
    name: "Mealybugs",
    symptoms: ["White, cottony masses on stems and leaf axils", "Sticky honeydew", "Stunted growth and leaf yellowing"],
    causes: ["Introduction of infested plants", "Warm, sheltered environments"],
    treatments: ["Dab with alcohol-soaked cotton swab", "Spray with insecticidal soap", "Apply neem oil"]
  },
  {
    name: "Whiteflies",
    symptoms: ["Tiny white insects that fly when disturbed", "Yellowing or silvering of leaves", "Sticky honeydew and sooty mold"],
    causes: ["Warm weather", "Lack of natural predators", "Infested new plants"],
    treatments: ["Use yellow sticky traps", "Spray with insecticidal soap", "Introduce parasitic wasps (Encarsia formosa)"]
  },
  {
    name: "Downy Mildew",
    symptoms: ["Yellow or pale green spots on upper leaf surfaces", "Purple or gray fuzzy growth on leaf undersides", "Leaves turning brown and dying"],
    causes: ["Cool, wet weather", "High humidity", "Poor air circulation"],
    treatments: ["Reduce humidity", "Improve air circulation", "Apply fungicide containing mancozeb or copper"]
  },
  {
    name: "Bacterial Wilt",
    symptoms: ["Sudden wilting of leaves and stems", "Sticky, milky sap when stems are cut", "Plant collapses quickly"],
    causes: ["Bacterial pathogens (Ralstonia solanacearum)", "Contaminated soil or water", "Insects like cucumber beetles"],
    treatments: ["Remove and destroy infected plants", "Control insect vectors", "Use resistant varieties", "Avoid planting in infected soil"]
  },
  {
    name: "Gray Mold (Botrytis)",
    symptoms: ["Gray, fuzzy mold on flowers, leaves, or fruit", "Brown, water-soaked spots", "Bud rot"],
    causes: ["High humidity", "Cool temperatures", "Poor air circulation", "Dead plant debris"],
    treatments: ["Remove infected parts", "Improve air circulation", "Reduce humidity", "Apply fungicide like chlorothalonil"]
  },
  {
    name: "Mosaic Virus",
    symptoms: ["Mottled green and yellow patterns on leaves", "Stunted growth", "Distorted leaves and fruit"],
    causes: ["Viruses spread by aphids or contaminated tools", "Infected seeds"],
    treatments: ["Remove and destroy infected plants", "Control aphid populations", "Disinfect gardening tools", "Use virus-free seeds"]
  },
  {
    name: "Scale Insects",
    symptoms: ["Small, bumpy brown or white shells on stems", "Yellowing leaves", "Sticky honeydew"],
    causes: ["Introduction of infested plants", "Lack of natural predators"],
    treatments: ["Scrape off with a soft brush", "Apply horticultural oil or neem oil", "Prune heavily infested branches"]
  },
  {
    name: "Thrips",
    symptoms: ["Silver or gray streaks on leaves", "Tiny black specks (fecal matter)", "Distorted flowers and new growth"],
    causes: ["Warm, dry weather", "Introduction of infested plants"],
    treatments: ["Use blue sticky traps", "Spray with insecticidal soap", "Apply neem oil", "Introduce predatory mites"]
  }
];
