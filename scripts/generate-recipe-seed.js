#!/usr/bin/env node
/**
 * Generates supabase/seeds/recipes-250.sql (202 additional recipes with dish_type)
 * Run: node scripts/generate-recipe-seed.js
 */
const fs = require('fs');
const path = require('path');

function pgArr(arr) {
  if (!arr || arr.length === 0) return "ARRAY[]::TEXT[]";
  return "ARRAY[" + arr.map(s => `'${s.replace(/'/g, "''")}'`).join(', ') + ']';
}

// dish_type: 'soup' | 'meat' | 'vegetable' | 'other'
function row(name, sourceUrl, cuisine, avgRating, ratingCount, cookTime, servings, ingredients, dietaryTags, mealType, dishType) {
  const dt = dishType || 'other';
  return `  ('${name.replace(/'/g, "''")}', '${sourceUrl}', '${cuisine}', ${avgRating}, ${ratingCount}, ${cookTime}, ${servings}, ${pgArr(ingredients)}, ${pgArr(dietaryTags)}, ${pgArr(mealType)}, '${dt}')`;
}

const recipes = [
  // ────────────────────────────────────────────────
  // MADE WITH LAU — madewithlau.com (23 new)
  // ────────────────────────────────────────────────
  row('Wonton Soup','https://www.madewithlau.com/recipes/wonton-soup','Cantonese',4.8,12400,45,4,['pork','shrimp','wonton wrappers','ginger','sesame oil','soy sauce','chicken broth','bok choy'],[],['lunch','dinner'],'soup'),
  row('Congee (Jook)','https://www.madewithlau.com/recipes/congee','Cantonese',4.7,9600,60,4,['jasmine rice','chicken broth','ginger','spring onion','white pepper','sesame oil','century egg'],['Gluten-Free'],['breakfast','lunch','dinner'],'soup'),
  row('Lo Mein','https://www.madewithlau.com/recipes/lo-mein','Cantonese',4.8,10200,20,3,['lo mein noodles','bok choy','carrot','mushrooms','soy sauce','oyster sauce','sesame oil','garlic'],[],['lunch','dinner'],'other'),
  row('Hong Shao Rou (Red Braised Pork)','https://www.madewithlau.com/recipes/hong-shao-rou','Cantonese',4.9,13800,90,4,['pork belly','soy sauce','dark soy sauce','Shaoxing wine','rock sugar','star anise','garlic','ginger'],[],['lunch','dinner'],'meat'),
  row('Chinese Broccoli with Oyster Sauce','https://www.madewithlau.com/recipes/chinese-broccoli','Cantonese',4.6,7200,10,4,['Chinese broccoli','oyster sauce','garlic','sesame oil','soy sauce'],['Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Cantonese Steamed Fish','https://www.madewithlau.com/recipes/steamed-fish','Cantonese',4.8,11500,20,4,['whole fish','soy sauce','sesame oil','ginger','spring onion','coriander','vegetable oil'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Salt and Pepper Shrimp','https://www.madewithlau.com/recipes/salt-pepper-shrimp','Cantonese',4.8,9400,20,3,['prawns','salt','white pepper','garlic','spring onion','chilli','oil'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Braised Pork Ribs','https://www.madewithlau.com/recipes/braised-pork-ribs','Cantonese',4.7,8600,50,4,['pork ribs','soy sauce','oyster sauce','hoisin sauce','garlic','ginger','sugar','Shaoxing wine'],[],['lunch','dinner'],'meat'),
  row('Chinese Steamed Eggs','https://www.madewithlau.com/recipes/steamed-eggs','Cantonese',4.7,8100,20,2,['eggs','chicken broth','soy sauce','sesame oil','spring onion'],['Vegetarian','Gluten-Free'],['breakfast','lunch','dinner'],'vegetable'),
  row('Oyster Sauce Beef','https://www.madewithlau.com/recipes/oyster-sauce-beef','Cantonese',4.8,10700,20,3,['beef sirloin','oyster sauce','soy sauce','sesame oil','garlic','ginger','baking soda','spring onion','broccoli'],[],['lunch','dinner'],'meat'),
  row('Crispy Roast Pork (Siu Yuk)','https://www.madewithlau.com/recipes/siu-yuk','Cantonese',4.9,16400,90,6,['pork belly','salt','white vinegar','five spice','garlic','ginger'],[],['lunch','dinner'],'meat'),
  row('Char Siu Bao (Steamed Pork Buns)','https://www.madewithlau.com/recipes/char-siu-bao','Cantonese',4.8,12200,90,12,['flour','yeast','sugar','milk','char siu pork','oyster sauce','soy sauce','sesame oil'],[],['breakfast','lunch'],'other'),
  row('Guotie (Pan-Fried Dumplings)','https://www.madewithlau.com/recipes/pan-fried-dumplings','Cantonese',4.8,11300,40,4,['minced pork','cabbage','ginger','sesame oil','soy sauce','Shaoxing wine','dumpling wrappers','garlic'],[],['lunch','dinner'],'other'),
  row('Egg Drop Soup','https://www.madewithlau.com/recipes/egg-drop-soup','Cantonese',4.6,7800,15,4,['chicken broth','eggs','cornstarch','sesame oil','white pepper','spring onion','salt'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'soup'),
  row('Chinese BBQ Pork Ribs','https://www.madewithlau.com/recipes/bbq-pork-ribs','Cantonese',4.8,9900,75,4,['pork ribs','hoisin sauce','soy sauce','honey','garlic','five spice','ginger'],[],['lunch','dinner'],'meat'),
  row('Bok Choy Stir-Fry','https://www.madewithlau.com/recipes/bok-choy-stir-fry','Cantonese',4.5,6500,10,3,['baby bok choy','garlic','sesame oil','soy sauce','oyster sauce'],['Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Scallion Ginger Chicken','https://www.madewithlau.com/recipes/scallion-ginger-chicken','Cantonese',4.9,14100,30,4,['whole chicken','ginger','spring onion','sesame oil','salt','vegetable oil'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Chinese Cabbage Soup','https://www.madewithlau.com/recipes/chinese-cabbage-soup','Cantonese',4.5,5900,25,4,['napa cabbage','pork belly','dried shrimp','ginger','chicken broth','sesame oil'],['Gluten-Free'],['lunch','dinner'],'soup'),
  row('Cold Sesame Noodles','https://www.madewithlau.com/recipes/sesame-noodles','Cantonese',4.7,8400,20,3,['egg noodles','sesame paste','soy sauce','rice vinegar','chilli oil','garlic','spring onion','cucumber'],['Vegan'],['lunch','dinner'],'other'),
  row('Shrimp Fried Rice','https://www.madewithlau.com/recipes/shrimp-fried-rice','Cantonese',4.8,11800,20,3,['jasmine rice','prawns','egg','peas','carrot','spring onion','soy sauce','sesame oil'],['Gluten-Free'],['lunch','dinner'],'other'),
  row('Lo Bak Go (Turnip Cake)','https://www.madewithlau.com/recipes/lo-bak-go','Cantonese',4.7,8800,60,8,['turnip','rice flour','dried shrimp','Chinese sausage','soy sauce','sesame oil','white pepper'],[],['breakfast','lunch'],'other'),
  row('Steamed Spare Ribs with Black Bean','https://www.madewithlau.com/recipes/steamed-pork-ribs','Cantonese',4.7,9100,30,4,['pork spare ribs','fermented black beans','garlic','ginger','soy sauce','sesame oil','chilli'],['Gluten-Free'],['lunch','dinner'],'meat'),
  row('Hong Kong Milk Tea Pork Chop Bun','https://www.madewithlau.com/recipes/pork-chop-bun','Cantonese',4.6,7400,30,4,['pork chops','bread roll','egg','soy sauce','Worcestershire sauce','sugar','white pepper'],[],['breakfast','lunch'],'other'),

  // ────────────────────────────────────────────────
  // THE MEDITERRANEAN DISH — themediterraneandish.com (30 new)
  // ────────────────────────────────────────────────
  row('Easy Greek Salad','https://www.themediterraneandish.com/greek-salad-recipe/','Mediterranean',4.8,15200,10,6,['cucumber','tomatoes','red onion','Kalamata olives','feta','oregano','olive oil','red wine vinegar'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Classic Shakshuka','https://www.themediterraneandish.com/shakshuka-recipe/','Mediterranean',4.9,18600,25,4,['eggs','tinned tomatoes','bell pepper','onion','garlic','cumin','paprika','fresh parsley'],['Vegetarian','Gluten-Free'],['breakfast','lunch','dinner'],'vegetable'),
  row('Chicken Shawarma','https://www.themediterraneandish.com/chicken-shawarma-recipe/','Mediterranean',4.9,22400,30,6,['chicken thighs','yogurt','lemon','garlic','cumin','coriander','paprika','turmeric','cinnamon'],['Gluten-Free'],['lunch','dinner'],'meat'),
  row('Baba Ganoush','https://www.themediterraneandish.com/baba-ganoush/','Mediterranean',4.8,13700,45,8,['aubergine','tahini','garlic','lemon juice','olive oil','paprika','parsley'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Tabbouleh','https://www.themediterraneandish.com/tabbouleh-recipe/','Mediterranean',4.7,11400,20,6,['bulgur wheat','fresh parsley','fresh mint','tomatoes','spring onion','lemon juice','olive oil'],['Vegetarian','Vegan'],['lunch','dinner'],'vegetable'),
  row('Easy Hummus','https://www.themediterraneandish.com/easy-hummus-recipe/','Mediterranean',4.9,24800,10,8,['tinned chickpeas','tahini','garlic','lemon juice','olive oil','cumin','ice water'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Mediterranean Grilled Salmon','https://www.themediterraneandish.com/mediterranean-salmon-recipe/','Mediterranean',4.8,14100,20,4,['salmon fillets','lemon','garlic','olive oil','fresh dill','capers','olives'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Lemon Herb Roasted Chicken','https://www.themediterraneandish.com/baked-chicken-recipe/','Mediterranean',4.8,16300,50,6,['whole chicken','lemon','garlic','fresh rosemary','fresh thyme','olive oil','paprika'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Mediterranean Pasta Salad','https://www.themediterraneandish.com/mediterranean-pasta-salad/','Mediterranean',4.7,12600,20,6,['pasta','cucumber','tomatoes','olives','feta','sun-dried tomatoes','fresh basil','Italian dressing'],['Vegetarian'],['lunch','dinner'],'vegetable'),
  row('Turkish Red Lentil Soup','https://www.themediterraneandish.com/turkish-lentil-soup/','Mediterranean',4.8,13900,30,6,['red lentils','carrot','onion','tomato paste','cumin','paprika','olive oil','lemon juice'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'soup'),
  row('Moroccan Chicken Tagine','https://www.themediterraneandish.com/moroccan-chicken-tagine-recipe/','Mediterranean',4.8,14700,60,6,['chicken thighs','preserved lemon','olives','onion','garlic','ginger','cumin','coriander','saffron'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Spanakopita (Greek Spinach Pie)','https://www.themediterraneandish.com/spanakopita-recipe/','Mediterranean',4.8,13100,60,12,['phyllo dough','spinach','feta','onion','eggs','olive oil','fresh dill','nutmeg'],['Vegetarian'],['lunch','dinner'],'vegetable'),
  row('Avgolemono Soup (Greek Lemon Soup)','https://www.themediterraneandish.com/avgolemono-soup-recipe/','Mediterranean',4.8,11800,30,6,['chicken broth','orzo','eggs','lemon juice','cooked chicken','fresh dill'],['Gluten-Free'],['lunch','dinner'],'soup'),
  row('Kofta (Grilled Beef Kebab)','https://www.themediterraneandish.com/ground-beef-kebab/','Mediterranean',4.8,12500,20,6,['minced beef','onion','parsley','garlic','cumin','coriander','paprika','allspice'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Mediterranean Chicken Kebab','https://www.themediterraneandish.com/chicken-kebab-recipe/','Mediterranean',4.7,10900,25,4,['chicken breast','yogurt','lemon','garlic','olive oil','cumin','paprika','fresh coriander'],['Gluten-Free'],['lunch','dinner'],'meat'),
  row('Stuffed Grape Leaves (Dolmades)','https://www.themediterraneandish.com/stuffed-grape-leaves-dolmades/','Mediterranean',4.7,9600,60,8,['grape leaves','rice','onion','fresh dill','fresh mint','pine nuts','olive oil','lemon'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Greek Moussaka','https://www.themediterraneandish.com/easy-moussaka-recipe/','Mediterranean',4.8,13200,90,8,['minced lamb','aubergine','potato','tinned tomatoes','cinnamon','bechamel sauce','parmesan'],[],['lunch','dinner'],'meat'),
  row('Za\'atar Roasted Chicken','https://www.themediterraneandish.com/zaatar-chicken/','Mediterranean',4.8,11600,40,4,['chicken pieces','za\'atar','olive oil','lemon','garlic','sumac'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Mediterranean Baked Fish','https://www.themediterraneandish.com/easy-baked-fish/','Mediterranean',4.7,10400,25,4,['white fish fillets','cherry tomatoes','olives','capers','lemon','garlic','olive oil','herbs'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('White Bean Salad','https://www.themediterraneandish.com/white-bean-salad/','Mediterranean',4.6,8700,15,6,['cannellini beans','cucumber','tomatoes','red onion','parsley','olive oil','lemon juice','cumin'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Roasted Eggplant','https://www.themediterraneandish.com/best-roasted-eggplant/','Mediterranean',4.7,9800,30,4,['aubergine','garlic','cumin','coriander','olive oil','parsley','lemon'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Mediterranean Stuffed Peppers','https://www.themediterraneandish.com/stuffed-peppers-recipe/','Mediterranean',4.7,10100,50,6,['bell peppers','rice','minced beef','tomatoes','onion','garlic','cumin','feta'],['Gluten-Free'],['lunch','dinner'],'meat'),
  row('Pasta e Fagioli','https://www.themediterraneandish.com/pasta-e-fagioli-recipe/','Mediterranean',4.7,9200,40,6,['pasta','cannellini beans','tinned tomatoes','pancetta','onion','garlic','rosemary','Parmesan'],['Dairy-Free'],['lunch','dinner'],'soup'),
  row('Italian Wedding Soup','https://www.themediterraneandish.com/italian-wedding-soup/','Mediterranean',4.7,10300,40,8,['minced pork','minced beef','breadcrumbs','egg','orzo','spinach','chicken broth','Parmesan'],[],['lunch','dinner'],'soup'),
  row('Mediterranean Quinoa Salad','https://www.themediterraneandish.com/mediterranean-quinoa-salad/','Mediterranean',4.7,9500,20,6,['quinoa','cucumber','tomatoes','olives','feta','chickpeas','fresh herbs','lemon dressing'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Easy Pita Bread','https://www.themediterraneandish.com/pita-bread-recipe/','Mediterranean',4.7,11200,60,8,['flour','yeast','salt','sugar','olive oil','warm water'],['Vegetarian','Vegan'],['breakfast','lunch','dinner'],'other'),
  row('Harissa Paste','https://www.themediterraneandish.com/harissa/','Mediterranean',4.8,9700,30,16,['dried chillies','garlic','cumin','coriander','caraway seeds','olive oil','lemon'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'other'),
  row('Greek Lemon Potatoes','https://www.themediterraneandish.com/greek-lemon-potatoes/','Mediterranean',4.8,14300,55,6,['potatoes','lemon juice','garlic','olive oil','oregano','chicken broth'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Roasted Red Pepper Hummus','https://www.themediterraneandish.com/roasted-red-pepper-hummus/','Mediterranean',4.8,12100,15,8,['chickpeas','roasted red peppers','tahini','garlic','lemon','olive oil','cumin','smoked paprika'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Mediterranean Chicken Orzo','https://www.themediterraneandish.com/greek-chicken-orzo/','Mediterranean',4.8,11700,35,6,['chicken thighs','orzo','tomatoes','spinach','garlic','lemon','Parmesan','herbs'],[],['lunch','dinner'],'meat'),

  // ────────────────────────────────────────────────
  // MAANGCHI — maangchi.com (29 new)
  // ────────────────────────────────────────────────
  row('Japchae (Glass Noodle Stir-Fry)','https://www.maangchi.com/recipe/japchae','Korean',4.9,21700,45,4,['glass noodles','beef','spinach','mushrooms','carrot','soy sauce','sesame oil','garlic','sugar'],['Gluten-Free'],['lunch','dinner'],'other'),
  row('Sundubu Jjigae (Soft Tofu Stew)','https://www.maangchi.com/recipe/sundubu-jjigae','Korean',4.9,18300,20,2,['soft silken tofu','pork','kimchi','gochugaru','egg','sesame oil','garlic','spring onion'],['Gluten-Free'],['lunch','dinner'],'soup'),
  row('Doenjang Jjigae (Soybean Paste Stew)','https://www.maangchi.com/recipe/doenjang-jjigae','Korean',4.8,15600,25,2,['doenjang','soft tofu','zucchini','potato','onion','mushrooms','chilli','garlic'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'soup'),
  row('Tteokbokki (Spicy Rice Cakes)','https://www.maangchi.com/recipe/tteokbokki','Korean',4.9,24500,20,4,['rice cakes','fish cakes','gochujang','gochugaru','soy sauce','sugar','spring onion','sesame seeds'],['Dairy-Free'],['lunch','dinner'],'other'),
  row('Bibimbap','https://www.maangchi.com/recipe/bibimbap','Korean',4.9,23100,45,4,['steamed rice','beef','spinach','bean sprouts','carrot','mushrooms','courgette','egg','gochujang','sesame oil'],['Gluten-Free'],['lunch','dinner'],'other'),
  row('Dakgalbi (Spicy Stir-fried Chicken)','https://www.maangchi.com/recipe/dakgalbi','Korean',4.8,12800,30,4,['chicken','gochujang','gochugaru','soy sauce','garlic','ginger','sesame oil','cabbage','spring onion'],['Gluten-Free'],['lunch','dinner'],'meat'),
  row('Samgyeopsal (Grilled Pork Belly)','https://www.maangchi.com/recipe/samgyeopsal','Korean',4.8,14200,20,4,['pork belly','sesame oil','salt','garlic','green chilli','perilla leaves','ssam sauce'],['Gluten-Free','Dairy-Free'],['dinner'],'meat'),
  row('Dakgangjeong (Crispy Korean Fried Chicken)','https://www.maangchi.com/recipe/dakgangjeong','Korean',4.9,19600,40,4,['chicken wings','potato starch','garlic','soy sauce','honey','gochujang','ginger','sesame seeds'],[],['lunch','dinner'],'meat'),
  row('Kimbap (Korean Rice Rolls)','https://www.maangchi.com/recipe/kimbap','Korean',4.8,15900,60,4,['cooked rice','nori sheets','beef','spinach','carrot','pickled radish','egg','sesame oil','sesame seeds'],[],['breakfast','lunch'],'other'),
  row('Pajeon (Korean Scallion Pancakes)','https://www.maangchi.com/recipe/pajeon','Korean',4.8,13400,20,4,['spring onions','eggs','flour','soy sauce','sesame oil','spring onion','chilli'],['Vegetarian'],['breakfast','lunch','dinner'],'other'),
  row('Kongnamul (Seasoned Bean Sprouts)','https://www.maangchi.com/recipe/kongnamul','Korean',4.6,8200,15,4,['bean sprouts','sesame oil','garlic','salt','spring onion','gochugaru'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Sigeumchi Namul (Spinach Salad)','https://www.maangchi.com/recipe/sigeumchi-namul','Korean',4.6,7900,10,4,['spinach','garlic','soy sauce','sesame oil','sesame seeds','spring onion'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Oi Muchim (Spicy Cucumber Salad)','https://www.maangchi.com/recipe/oi-muchim','Korean',4.7,9100,10,4,['cucumber','gochugaru','garlic','sesame oil','soy sauce','vinegar','spring onion'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Gamja Jorim (Braised Potatoes)','https://www.maangchi.com/recipe/gamja-jorim','Korean',4.7,10300,25,4,['potatoes','soy sauce','sugar','garlic','sesame oil','sesame seeds','spring onion'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Dakbokkeum (Braised Spicy Chicken)','https://www.maangchi.com/recipe/dakbokkeum','Korean',4.8,11700,35,4,['chicken pieces','gochujang','soy sauce','garlic','ginger','potato','onion','spring onion'],['Gluten-Free'],['lunch','dinner'],'meat'),
  row('Haemul Pajeon (Seafood Pancake)','https://www.maangchi.com/recipe/haemul-pajeon','Korean',4.8,12600,25,4,['spring onions','squid','prawns','egg','flour','soy sauce','sesame oil'],['Dairy-Free'],['breakfast','lunch','dinner'],'other'),
  row('Budae Jjigae (Korean Army Stew)','https://www.maangchi.com/recipe/budae-jjigae','Korean',4.8,13500,30,4,['Spam','hot dogs','baked beans','ramen noodles','kimchi','gochugaru','tofu','mushrooms'],['Dairy-Free'],['lunch','dinner'],'soup'),
  row('Kimchi Jeon (Kimchi Pancakes)','https://www.maangchi.com/recipe/kimchi-jeon','Korean',4.8,14100,20,4,['kimchi','flour','egg','spring onion','sesame oil'],['Vegetarian'],['breakfast','lunch','dinner'],'other'),
  row('Tteok-guk (Rice Cake Soup)','https://www.maangchi.com/recipe/tteok-guk','Korean',4.8,11200,30,4,['sliced rice cakes','beef broth','beef','egg','spring onion','sesame oil','garlic'],['Gluten-Free'],['breakfast','lunch','dinner'],'soup'),
  row('Miyeok Guk (Korean Seaweed Soup)','https://www.maangchi.com/recipe/miyeok-guk','Korean',4.7,9800,30,4,['dried miyeok seaweed','beef','garlic','sesame oil','soy sauce','salt'],['Gluten-Free','Dairy-Free'],['breakfast','lunch','dinner'],'soup'),
  row('Mulnaengmyeon (Cold Noodles in Broth)','https://www.maangchi.com/recipe/naengmyeon','Korean',4.7,8900,60,4,['buckwheat noodles','beef broth','Asian pear','cucumber','pickled radish','hard-boiled egg','mustard'],['Dairy-Free'],['lunch','dinner'],'other'),
  row('Yukgaejang (Spicy Beef Brisket Soup)','https://www.maangchi.com/recipe/yukgaejang','Korean',4.8,11100,90,6,['beef brisket','fernbrake','bean sprouts','spring onion','gochugaru','garlic','sesame oil'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'soup'),
  row('Galbitang (Beef Short Rib Soup)','https://www.maangchi.com/recipe/galbitang','Korean',4.8,10600,180,4,['beef short ribs','radish','garlic','spring onion','soy sauce','sesame seeds','ginkgo nuts'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'soup'),
  row('Haemul Jeongol (Seafood Hot Pot)','https://www.maangchi.com/recipe/haemul-jeongol','Korean',4.8,9400,30,4,['prawns','squid','clams','enoki mushrooms','tofu','zucchini','gochugaru','garlic','soy sauce'],['Gluten-Free','Dairy-Free'],['dinner'],'soup'),
  row('Oi Sobagi (Stuffed Cucumber Kimchi)','https://www.maangchi.com/recipe/oi-sobagi','Korean',4.7,8300,20,16,['cucumber','gochugaru','garlic','garlic chives','spring onion','fish sauce','sesame seeds'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'vegetable'),
  row('Doenjang Jjigae with Seafood','https://www.maangchi.com/recipe/haemul-doenjang-jjigae','Korean',4.8,9700,25,2,['doenjang','prawns','clams','soft tofu','zucchini','onion','chilli','garlic'],['Gluten-Free'],['lunch','dinner'],'soup'),
  row('Japchae with Shrimp','https://www.maangchi.com/recipe/haemul-japchae','Korean',4.8,8600,45,4,['glass noodles','prawns','spinach','carrot','mushrooms','soy sauce','sesame oil','garlic'],['Gluten-Free'],['lunch','dinner'],'other'),
  row('Japgokbap (Multi-grain Rice)','https://www.maangchi.com/recipe/japgokbap','Korean',4.5,5800,60,4,['short-grain rice','black beans','soybeans','red beans','sweet rice','barley'],['Vegetarian','Vegan','Gluten-Free'],['breakfast','lunch','dinner'],'other'),
  row('Yangnyeom Chicken (Sweet & Spicy Chicken)','https://www.maangchi.com/recipe/yangnyeomchicken','Korean',4.9,17400,40,4,['chicken wings','potato starch','garlic','soy sauce','gochujang','ketchup','honey','sesame seeds'],[],['lunch','dinner'],'meat'),

  // ────────────────────────────────────────────────
  // RED HOUSE SPICE — redhousespice.com (24 new)
  // ────────────────────────────────────────────────
  row('Dan Dan Noodles','https://redhousespice.com/dan-dan-noodles/','Sichuan',4.9,16800,30,2,['noodles','minced pork','tahini','chilli oil','soy sauce','Sichuan pepper','garlic','spring onion'],[],['lunch','dinner'],'other'),
  row('Steamed Whole Fish','https://redhousespice.com/steamed-whole-fish/','Cantonese',4.8,11200,20,4,['whole fish','ginger','spring onion','soy sauce','sesame oil','vegetable oil','coriander'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Twice Cooked Pork','https://redhousespice.com/twice-cooked-pork/','Sichuan',4.8,12700,40,3,['pork belly','doubanjiang','fermented black beans','leek','garlic','ginger','soy sauce','Shaoxing wine'],[],['lunch','dinner'],'meat'),
  row('Hot and Sour Soup','https://redhousespice.com/hot-and-sour-soup/','Chinese',4.8,14300,25,4,['tofu','mushrooms','bamboo shoots','egg','chicken broth','soy sauce','rice vinegar','white pepper','cornstarch'],['Gluten-Free'],['lunch','dinner'],'soup'),
  row('Hong Shao Rou (Red Braised Pork Belly)','https://redhousespice.com/hong-shao-rou-braised-pork-belly/','Chinese',4.9,17600,90,4,['pork belly','soy sauce','dark soy sauce','Shaoxing wine','rock sugar','star anise','cinnamon','garlic'],[],['lunch','dinner'],'meat'),
  row('Sichuan Eggplant (Yu Xiang Qie Zi)','https://redhousespice.com/sichuan-eggplant/','Sichuan',4.8,13100,25,3,['aubergine','minced pork','doubanjiang','garlic','ginger','spring onion','soy sauce','rice vinegar','sugar'],['Gluten-Free'],['lunch','dinner'],'meat'),
  row('Egg and Tomato Stir-Fry','https://redhousespice.com/egg-tomato-stir-fry/','Chinese',4.7,12900,15,3,['eggs','tomatoes','spring onion','garlic','sugar','soy sauce','sesame oil'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Chinese Smashed Cucumber Salad','https://redhousespice.com/chinese-cucumber-salad/','Chinese',4.7,10600,15,4,['cucumber','garlic','chilli oil','rice vinegar','sesame oil','soy sauce','sugar'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Wonton Soup','https://redhousespice.com/wonton-soup/','Chinese',4.8,13500,45,4,['minced pork','prawns','wonton wrappers','ginger','sesame oil','soy sauce','chicken broth','spring onion','bok choy'],[],['lunch','dinner'],'soup'),
  row('Chinese Scallion Pancakes','https://redhousespice.com/scallion-pancakes/','Chinese',4.8,12200,40,8,['flour','water','spring onion','sesame oil','salt'],['Vegetarian','Vegan'],['breakfast','lunch'],'other'),
  row('Sweet and Sour Pork','https://redhousespice.com/sweet-and-sour-pork/','Chinese',4.8,15400,35,4,['pork','pineapple','bell pepper','onion','ketchup','rice vinegar','sugar','cornstarch'],[],['lunch','dinner'],'meat'),
  row('Chinese Braised Beef Noodles','https://redhousespice.com/chinese-braised-beef-noodle-soup/','Chinese',4.9,14800,120,4,['beef shank','noodles','soy sauce','dark soy sauce','star anise','cinnamon','bean paste','garlic','ginger'],[],['lunch','dinner'],'soup'),
  row('Pork and Cabbage Dumplings','https://redhousespice.com/pork-cabbage-dumplings/','Chinese',4.8,13700,50,4,['minced pork','cabbage','ginger','spring onion','soy sauce','sesame oil','Shaoxing wine','dumpling wrappers'],[],['lunch','dinner'],'other'),
  row('Bang Bang Chicken (Sichuan Chicken Salad)','https://redhousespice.com/bang-bang-chicken/','Sichuan',4.8,11900,30,4,['poached chicken','cucumber','chilli oil','sesame paste','soy sauce','vinegar','spring onion','garlic'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Chinese Braised Spare Ribs','https://redhousespice.com/chinese-spare-ribs/','Chinese',4.7,10500,60,4,['pork spare ribs','soy sauce','dark soy sauce','Shaoxing wine','garlic','ginger','sugar','star anise'],[],['lunch','dinner'],'meat'),
  row('Stir-Fried Bok Choy','https://redhousespice.com/stir-fried-bok-choy/','Chinese',4.6,8800,10,3,['bok choy','garlic','oyster sauce','sesame oil','soy sauce'],['Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Soy Sauce Noodles','https://redhousespice.com/soy-sauce-noodles/','Chinese',4.7,11300,15,2,['fresh noodles','soy sauce','dark soy sauce','spring onion','sesame oil','garlic','sugar'],['Vegan'],['breakfast','lunch','dinner'],'other'),
  row('White Cut Chicken (Bai Qie Ji)','https://redhousespice.com/white-cut-chicken/','Cantonese',4.8,12800,30,4,['whole chicken','ginger','spring onion','sesame oil','salt','garlic','vegetable oil'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Chinese Spring Rolls','https://redhousespice.com/spring-rolls/','Chinese',4.7,10900,45,16,['spring roll wrappers','pork','cabbage','carrot','mushrooms','bean sprouts','soy sauce','sesame oil'],[],['lunch','dinner'],'other'),
  row('Rice Porridge Congee','https://redhousespice.com/congee/','Chinese',4.6,9200,60,4,['jasmine rice','chicken broth','ginger','spring onion','sesame oil','soy sauce','white pepper'],['Gluten-Free','Dairy-Free'],['breakfast'],'soup'),
  row('Three Cup Chicken','https://redhousespice.com/three-cup-chicken/','Chinese',4.8,11600,25,3,['chicken','sesame oil','soy sauce','Shaoxing wine','garlic','ginger','sugar','Thai basil'],['Gluten-Free'],['lunch','dinner'],'meat'),
  row('Dry-Fried Green Beans','https://redhousespice.com/dry-fried-green-beans/','Sichuan',4.7,9300,20,3,['green beans','minced pork','Sichuan preserved vegetables','garlic','ginger','soy sauce','sesame oil'],['Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Smacked Cucumbers in Garlicky Sauce','https://redhousespice.com/chinese-pickled-cucumbers/','Sichuan',4.7,8700,15,4,['cucumber','garlic','chilli oil','soy sauce','sesame oil','black vinegar','sugar'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Crispy Honey Garlic Chicken','https://redhousespice.com/crispy-honey-garlic-chicken/','Chinese',4.8,13400,30,4,['chicken thighs','honey','garlic','soy sauce','cornstarch','spring onion','sesame seeds'],[],['lunch','dinner'],'meat'),

  // ────────────────────────────────────────────────
  // MALAYSIAN CHINESE KITCHEN — malaysianchinesekitchen.com (24 new)
  // ────────────────────────────────────────────────
  row('Hainanese Chicken Rice','https://www.malaysianchinesekitchen.com/hainanese-chicken-rice/','Malaysian Chinese',4.9,18700,60,4,['whole chicken','jasmine rice','ginger','spring onion','sesame oil','garlic','chicken broth','pandan leaves'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Hokkien Mee','https://www.malaysianchinesekitchen.com/hokkien-mee/','Malaysian Chinese',4.8,14300,25,4,['yellow noodles','rice vermicelli','prawns','squid','pork belly','bean sprouts','dark soy sauce','garlic','lard'],[],['lunch','dinner'],'other'),
  row('Pan Mee (Flat Noodles)','https://www.malaysianchinesekitchen.com/pan-mee/','Malaysian Chinese',4.7,11200,40,4,['plain flour','minced pork','anchovies','egg','spring onion','dried shrimp','sweet potato leaves'],[],['lunch','dinner'],'soup'),
  row('Bak Kut Teh (Pork Ribs Soup)','https://www.malaysianchinesekitchen.com/bak-kut-teh/','Malaysian Chinese',4.9,16100,90,4,['pork ribs','garlic','soy sauce','dark soy sauce','five spice','white pepper','star anise','tofu puffs'],['Gluten-Free','Dairy-Free'],['breakfast','lunch','dinner'],'soup'),
  row('Prawn Noodles (Har Mee)','https://www.malaysianchinesekitchen.com/prawn-noodles-har-mee/','Malaysian Chinese',4.8,12800,60,4,['prawns','prawn shells','yellow noodles','bean sprouts','kangkung','hard-boiled egg','chilli paste','garlic'],['Gluten-Free'],['breakfast','lunch'],'soup'),
  row('Wonton Noodles (Hong Kong Style)','https://www.malaysianchinesekitchen.com/wonton-noodles/','Malaysian Chinese',4.8,13200,45,4,['wonton noodles','minced pork','prawns','wonton wrappers','lard','soy sauce','oyster sauce','spring onion'],[],['breakfast','lunch'],'other'),
  row('Claypot Rice','https://www.malaysianchinesekitchen.com/claypot-rice/','Malaysian Chinese',4.8,11600,45,4,['jasmine rice','chicken','Chinese sausage','mushrooms','soy sauce','dark soy sauce','sesame oil','ginger'],['Gluten-Free'],['lunch','dinner'],'other'),
  row('Loh Bak (Five Spice Pork Roll)','https://www.malaysianchinesekitchen.com/loh-bak-five-spice-pork-roll/','Malaysian Chinese',4.7,9400,45,8,['pork belly','beancurd skin','five spice','soy sauce','sesame oil','garlic','egg'],[],['lunch','dinner'],'meat'),
  row('Chee Cheong Fun','https://www.malaysianchinesekitchen.com/chee-cheong-fun/','Malaysian Chinese',4.7,8900,30,4,['rice flour','water','tapioca starch','soy sauce','sesame oil','spring onion','sweet sauce'],['Vegetarian'],['breakfast','lunch'],'other'),
  row('White Pepper Pork Soup','https://www.malaysianchinesekitchen.com/white-pepper-pork-soup/','Malaysian Chinese',4.7,9100,40,4,['pork ribs','white pepper','garlic','ginger','spring onion','salt','sesame oil'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'soup'),
  row('Char Kuey Teow','https://www.malaysianchinesekitchen.com/char-kuey-teow/','Malaysian Chinese',4.9,19800,15,2,['flat rice noodles','prawns','Chinese sausage','egg','bean sprouts','chives','dark soy sauce','sambal'],['Gluten-Free'],['lunch','dinner'],'other'),
  row('Cantonese Steamed Fish with Soy Sauce','https://www.malaysianchinesekitchen.com/cantonese-steamed-fish/','Malaysian Chinese',4.8,11500,20,4,['whole fish','ginger','spring onion','soy sauce','sesame oil','vegetable oil','coriander'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Stir-Fried Kangkung (Water Spinach)','https://www.malaysianchinesekitchen.com/stir-fried-kangkung/','Malaysian Chinese',4.6,7800,10,3,['water spinach','garlic','belachan','dried shrimp','soy sauce','oyster sauce'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Nyonya Curry Chicken','https://www.malaysianchinesekitchen.com/nyonya-curry-chicken/','Malaysian Chinese',4.8,12400,50,4,['chicken','coconut milk','curry leaves','lemongrass','galangal','turmeric','chilli paste','potato'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Kaya (Coconut Egg Jam)','https://www.malaysianchinesekitchen.com/kaya-coconut-egg-jam/','Malaysian Chinese',4.8,10800,30,16,['coconut milk','eggs','sugar','pandan leaves','butter'],['Vegetarian','Gluten-Free'],['breakfast'],'other'),
  row('Tau Foo Fah (Silken Tofu Pudding)','https://www.malaysianchinesekitchen.com/tau-foo-fah/','Malaysian Chinese',4.7,9600,30,6,['soybeans','gypsum powder','pandan leaves','water','brown sugar syrup'],['Vegetarian','Vegan','Gluten-Free'],['breakfast','lunch'],'other'),
  row('Steamed Pork Ribs with Black Bean','https://www.malaysianchinesekitchen.com/steamed-pork-ribs-black-bean/','Malaysian Chinese',4.7,9800,30,4,['pork spare ribs','fermented black beans','garlic','ginger','chilli','soy sauce','sesame oil','cornstarch'],['Gluten-Free'],['lunch','dinner'],'meat'),
  row('Mee Goreng','https://www.malaysianchinesekitchen.com/mee-goreng/','Malaysian Chinese',4.7,10100,20,4,['yellow noodles','prawns','tofu','bean sprouts','cabbage','egg','dark soy sauce','ketchup','chilli sauce'],[],['lunch','dinner'],'other'),
  row('Dry Curry Chicken','https://www.malaysianchinesekitchen.com/dry-curry-chicken/','Malaysian Chinese',4.8,11300,50,4,['chicken','curry leaves','lemongrass','galangal','turmeric','chilli','coconut milk','kaffir lime'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Yong Tau Foo','https://www.malaysianchinesekitchen.com/yong-tau-foo/','Malaysian Chinese',4.7,8700,60,4,['tofu','fish paste','brinjal','bitter gourd','chilli','spring onion','soy sauce'],['Gluten-Free'],['lunch','dinner'],'other'),
  row('Stir-Fried Cabbage with Salted Fish','https://www.malaysianchinesekitchen.com/stir-fried-cabbage-salted-fish/','Malaysian Chinese',4.6,7200,15,4,['cabbage','salted fish','garlic','dried shrimp','oyster sauce','sesame oil'],['Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Braised Chicken with Mushrooms','https://www.malaysianchinesekitchen.com/braised-chicken-mushrooms/','Malaysian Chinese',4.8,10900,45,4,['chicken pieces','dried shiitake mushrooms','soy sauce','dark soy sauce','oyster sauce','garlic','ginger','sesame oil'],[],['lunch','dinner'],'meat'),
  row('Tofu with Minced Pork (Pipa Tofu)','https://www.malaysianchinesekitchen.com/pipa-tofu/','Malaysian Chinese',4.7,8400,30,4,['firm tofu','minced pork','egg','mushrooms','spring onion','oyster sauce','soy sauce','sesame oil'],[],['lunch','dinner'],'meat'),
  row('Prawn Paste Chicken (Har Cheong Gai)','https://www.malaysianchinesekitchen.com/har-cheong-gai/','Malaysian Chinese',4.8,11700,30,4,['chicken wings','prawn paste','five spice','sugar','Shaoxing wine','sesame oil'],[],['lunch','dinner'],'meat'),

  // ────────────────────────────────────────────────
  // RECIPE30 — recipe30.com (20 new)
  // ────────────────────────────────────────────────
  row('Beef Bourguignon','https://recipe30.com/beef-bourguignon.html/','French',4.9,16300,180,6,['beef chuck','red wine','bacon lardons','button mushrooms','pearl onions','carrots','garlic','fresh thyme','bay leaves'],[],['dinner'],'meat'),
  row('Coq au Vin','https://recipe30.com/coq-au-vin.html/','French',4.8,14700,90,4,['chicken pieces','red wine','bacon lardons','button mushrooms','pearl onions','garlic','fresh thyme','tomato paste'],['Gluten-Free'],['dinner'],'meat'),
  row('Ratatouille','https://recipe30.com/ratatouille.html/','French',4.7,11600,60,4,['aubergine','courgette','tomatoes','bell pepper','onion','garlic','fresh basil','fresh thyme','olive oil'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('French Onion Soup','https://recipe30.com/french-onion-soup.html/','French',4.9,18200,60,4,['onions','beef broth','white wine','Gruyere cheese','baguette','butter','fresh thyme','garlic'],[],['lunch','dinner'],'soup'),
  row('Bouillabaisse','https://recipe30.com/bouillabaisse.html/','French',4.8,12400,60,6,['fish fillets','mussels','prawns','fennel','tomatoes','saffron','garlic','olive oil','baguette'],['Gluten-Free'],['dinner'],'soup'),
  row('Quiche Lorraine','https://recipe30.com/quiche-lorraine.html/','French',4.7,13800,60,8,['shortcrust pastry','bacon lardons','eggs','double cream','Gruyere cheese','nutmeg'],[],['breakfast','lunch','dinner'],'other'),
  row('Salade Niçoise','https://recipe30.com/salade-nicoise.html/','French',4.7,10900,20,4,['tuna','green beans','hard-boiled eggs','olives','tomatoes','anchovies','new potatoes','Dijon dressing'],['Gluten-Free'],['lunch'],'meat'),
  row('Duck Confit','https://recipe30.com/duck-confit.html/','French',4.9,13100,240,4,['duck legs','duck fat','garlic','fresh thyme','bay leaves','salt','black pepper'],['Gluten-Free','Dairy-Free'],['dinner'],'meat'),
  row('Sole Meunière','https://recipe30.com/sole-meuniere.html/','French',4.8,10700,15,2,['sole fillets','butter','lemon','capers','flour','fresh parsley'],[],['lunch','dinner'],'meat'),
  row('Poulet Rôti (French Roast Chicken)','https://recipe30.com/french-roast-chicken.html/','French',4.8,12900,75,4,['whole chicken','butter','garlic','fresh rosemary','fresh thyme','lemon','white wine'],['Gluten-Free'],['lunch','dinner'],'meat'),
  row('Tarte Tatin','https://recipe30.com/tarte-tatin.html/','French',4.8,11200,50,8,['puff pastry','apples','butter','sugar','vanilla'],['Vegetarian'],['dinner'],'other'),
  row('Steak au Poivre','https://recipe30.com/steak-au-poivre.html/','French',4.9,14600,25,2,['beef fillet','black peppercorns','shallots','brandy','double cream','butter'],['Gluten-Free'],['dinner'],'meat'),
  row('Moules Marinières','https://recipe30.com/moules-marinieres.html/','French',4.8,11800,20,4,['mussels','white wine','shallots','garlic','butter','double cream','fresh parsley'],['Gluten-Free'],['dinner'],'meat'),
  row('Vichyssoise','https://recipe30.com/vichyssoise.html/','French',4.6,7400,30,6,['leeks','potato','chicken broth','double cream','chives','butter'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'soup'),
  row('Mushroom Velouté','https://recipe30.com/mushroom-veloute.html/','French',4.7,8900,30,4,['button mushrooms','shallots','butter','vegetable broth','double cream','fresh thyme','garlic'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'soup'),
  row('Lyonnaise Salad','https://recipe30.com/lyonnaise-salad.html/','French',4.7,9100,20,4,['frisée lettuce','bacon lardons','poached egg','croutons','Dijon mustard vinaigrette'],['Gluten-Free'],['lunch'],'vegetable'),
  row('French Lentil Soup (Soupe aux Lentilles)','https://recipe30.com/french-lentil-soup.html/','French',4.7,10200,40,6,['Puy lentils','carrot','celery','onion','garlic','fresh thyme','bay leaves','Dijon mustard'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'soup'),
  row('Gratin Dauphinois','https://recipe30.com/gratin-dauphinois.html/','French',4.8,12700,60,6,['potatoes','double cream','garlic','Gruyere cheese','butter','nutmeg','fresh thyme'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Poulet à la Moutarde','https://recipe30.com/chicken-with-mustard.html/','French',4.8,11400,45,4,['chicken thighs','Dijon mustard','white wine','shallots','double cream','fresh tarragon','garlic'],['Gluten-Free'],['dinner'],'meat'),
  row('Crème Brûlée','https://recipe30.com/creme-brulee.html/','French',4.9,16700,60,6,['double cream','egg yolks','sugar','vanilla pod'],['Vegetarian','Gluten-Free'],['dinner'],'other'),

  // ────────────────────────────────────────────────
  // JUST ONE COOKBOOK — justonecookbook.com (33 new)
  // ────────────────────────────────────────────────
  row('Tonkatsu (Pork Cutlet)','https://www.justonecookbook.com/tonkatsu/','Japanese',4.9,19400,25,4,['pork loin','panko breadcrumbs','egg','flour','tonkatsu sauce','cabbage','steamed rice'],['Dairy-Free'],['lunch','dinner'],'meat'),
  row('Karaage (Japanese Fried Chicken)','https://www.justonecookbook.com/karaage/','Japanese',4.9,22700,30,4,['chicken thighs','soy sauce','sake','mirin','ginger','garlic','potato starch','oil'],['Dairy-Free'],['lunch','dinner'],'meat'),
  row('Tamagoyaki (Japanese Rolled Omelette)','https://www.justonecookbook.com/tamagoyaki/','Japanese',4.8,14100,15,4,['eggs','dashi','soy sauce','mirin','sugar','oil'],['Vegetarian','Gluten-Free'],['breakfast','lunch','dinner'],'vegetable'),
  row('Oyakodon (Chicken and Egg Rice Bowl)','https://www.justonecookbook.com/oyakodon/','Japanese',4.9,20200,20,4,['chicken thighs','eggs','onion','steamed rice','dashi','soy sauce','mirin','sake'],['Dairy-Free'],['lunch','dinner'],'meat'),
  row('Cold Soba Noodles (Zaru Soba)','https://www.justonecookbook.com/zaru-soba/','Japanese',4.8,13700,15,4,['soba noodles','tsuyu dipping sauce','spring onion','nori','wasabi','ginger'],['Vegan','Dairy-Free'],['lunch','dinner'],'other'),
  row('Nikujaga (Meat and Potato Stew)','https://www.justonecookbook.com/nikujaga/','Japanese',4.8,14500,35,4,['beef slices','potatoes','onion','carrot','shirataki noodles','soy sauce','mirin','sake','sugar'],['Dairy-Free'],['lunch','dinner'],'meat'),
  row('Onigiri (Japanese Rice Balls)','https://www.justonecookbook.com/onigiri/','Japanese',4.8,17300,30,8,['Japanese short-grain rice','nori','salt','tuna','umeboshi plum','salmon','sesame seeds'],['Gluten-Free','Dairy-Free'],['breakfast','lunch'],'other'),
  row('Tempura','https://www.justonecookbook.com/tempura/','Japanese',4.8,15600,30,4,['prawns','aubergine','sweet potato','flour','egg','ice water','soy sauce','dashi','mirin'],['Dairy-Free'],['lunch','dinner'],'other'),
  row('Japanese Curry (Kare Raisu)','https://www.justonecookbook.com/japanese-chicken-curry/','Japanese',4.9,24800,45,4,['chicken thighs','potatoes','carrot','onion','curry roux','apple','honey','soy sauce','steamed rice'],['Dairy-Free'],['lunch','dinner'],'meat'),
  row('Yakitori (Grilled Chicken Skewers)','https://www.justonecookbook.com/yakitori/','Japanese',4.8,14900,30,4,['chicken thighs','spring onion','soy sauce','mirin','sake','sugar','sesame seeds'],['Gluten-Free'],['dinner'],'meat'),
  row('Salmon Teriyaki','https://www.justonecookbook.com/salmon-teriyaki/','Japanese',4.8,18400,20,4,['salmon fillets','soy sauce','mirin','sake','sugar','sesame seeds','spring onion'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Spinach Ohitashi (Sesame Spinach)','https://www.justonecookbook.com/spinach-ohitashi/','Japanese',4.7,10200,15,4,['spinach','soy sauce','dashi','mirin','sesame seeds'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Japanese Potato Salad','https://www.justonecookbook.com/japanese-potato-salad/','Japanese',4.8,15300,30,4,['potatoes','carrot','cucumber','ham','egg','Japanese mayonnaise','onion'],['Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Chawanmushi (Savoury Steamed Egg Custard)','https://www.justonecookbook.com/chawanmushi/','Japanese',4.8,11700,25,4,['eggs','dashi','soy sauce','mirin','prawns','mushrooms','chicken','gingko nuts'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'other'),
  row('Tsukune (Japanese Chicken Meatballs)','https://www.justonecookbook.com/tsukune/','Japanese',4.8,12600,30,4,['minced chicken','spring onion','ginger','soy sauce','mirin','sake','egg','panko'],['Dairy-Free'],['dinner'],'meat'),
  row('Miso Ramen','https://www.justonecookbook.com/miso-ramen/','Japanese',4.9,21200,45,2,['ramen noodles','white miso','chashu pork','soft-boiled egg','corn','butter','spring onion','nori','bamboo shoots'],[],['lunch','dinner'],'soup'),
  row('Udon Noodle Soup','https://www.justonecookbook.com/kake-udon/','Japanese',4.7,12400,15,2,['udon noodles','dashi','soy sauce','mirin','spring onion','tempura flakes','nori'],['Vegan'],['lunch','dinner'],'soup'),
  row('Katsudon (Pork Cutlet Bowl)','https://www.justonecookbook.com/katsudon/','Japanese',4.9,18700,30,2,['tonkatsu','eggs','onion','dashi','soy sauce','mirin','sugar','steamed rice'],['Dairy-Free'],['lunch','dinner'],'meat'),
  row('Okonomiyaki (Japanese Savoury Pancake)','https://www.justonecookbook.com/okonomiyaki/','Japanese',4.8,16500,30,4,['cabbage','flour','eggs','dashi','pork belly','okonomiyaki sauce','Japanese mayo','bonito flakes','nori'],['Dairy-Free'],['lunch','dinner'],'other'),
  row('Agedashi Tofu','https://www.justonecookbook.com/agedashi-tofu/','Japanese',4.8,12100,25,4,['silken tofu','potato starch','dashi','soy sauce','mirin','ginger','spring onion','daikon'],['Vegetarian','Vegan'],['lunch','dinner'],'vegetable'),
  row('Miso Salmon','https://www.justonecookbook.com/miso-salmon/','Japanese',4.9,19300,25,4,['salmon fillets','white miso','mirin','sake','soy sauce','sugar','sesame seeds','spring onion'],['Gluten-Free','Dairy-Free'],['lunch','dinner'],'meat'),
  row('Ebi Fry (Fried Shrimp)','https://www.justonecookbook.com/ebi-fry/','Japanese',4.7,10400,25,4,['large prawns','panko breadcrumbs','egg','flour','tonkatsu sauce','cabbage'],['Dairy-Free'],['lunch','dinner'],'meat'),
  row('Yaki Onigiri (Grilled Rice Balls)','https://www.justonecookbook.com/yaki-onigiri/','Japanese',4.7,9800,25,4,['Japanese short-grain rice','soy sauce','mirin','butter','sesame seeds','nori'],['Vegetarian'],['breakfast','lunch'],'other'),
  row('Inari Sushi','https://www.justonecookbook.com/inari-sushi/','Japanese',4.7,10900,30,4,['Japanese short-grain rice','rice vinegar','sugar','salt','aburaage tofu pockets','sesame seeds'],['Vegetarian','Vegan'],['breakfast','lunch'],'other'),
  row('Japanese Hamburg Steak','https://www.justonecookbook.com/japanese-hamburg-steak/','Japanese',4.8,14100,30,4,['minced beef','minced pork','onion','breadcrumbs','egg','nutmeg','soy sauce','Worcestershire sauce'],[],['lunch','dinner'],'meat'),
  row('Shoyu Ramen','https://www.justonecookbook.com/shoyu-ramen/','Japanese',4.9,17800,120,2,['ramen noodles','chashu pork','soft-boiled egg','chicken broth','soy sauce','mirin','bamboo shoots','nori','spring onion'],['Dairy-Free'],['lunch','dinner'],'soup'),
  row('Gyoza (Japanese Pan-Fried Dumplings)','https://www.justonecookbook.com/gyoza-recipe/','Japanese',4.9,21500,40,4,['minced pork','cabbage','garlic','ginger','sesame oil','gyoza wrappers','soy sauce','rice vinegar'],['Dairy-Free'],['lunch','dinner'],'other'),
  row('Hiyashi Chuka (Cold Ramen Salad)','https://www.justonecookbook.com/hiyashi-chuka/','Japanese',4.7,9600,25,2,['ramen noodles','egg','ham','cucumber','tomato','sesame dressing','soy sauce','rice vinegar'],['Dairy-Free'],['lunch'],'other'),
  row('Japanese Potato Croquettes (Korokke)','https://www.justonecookbook.com/korokke/','Japanese',4.8,12700,45,8,['potatoes','minced beef','onion','panko breadcrumbs','egg','flour','Worcestershire sauce','tonkatsu sauce'],['Dairy-Free'],['lunch','dinner'],'other'),
  row('Katsu Curry','https://www.justonecookbook.com/katsu-curry/','Japanese',4.9,22900,45,4,['chicken breast','panko breadcrumbs','egg','flour','Japanese curry sauce','onion','carrot','potato','steamed rice'],['Dairy-Free'],['lunch','dinner'],'meat'),
  row('Takoyaki (Octopus Balls)','https://www.justonecookbook.com/takoyaki/','Japanese',4.8,14200,30,4,['takoyaki batter','cooked octopus','spring onion','pickled ginger','tenkasu','okonomiyaki sauce','Japanese mayo','bonito flakes'],['Dairy-Free'],['lunch','dinner'],'other'),
  row('Tonkotsu Ramen','https://www.justonecookbook.com/tonkotsu-ramen/','Japanese',4.9,21100,300,2,['ramen noodles','pork bones','chashu pork','soft-boiled egg','garlic','ginger','sesame seeds','nori','spring onion','bamboo shoots'],['Dairy-Free'],['lunch','dinner'],'soup'),
  row('Taiyaki (Fish-Shaped Cakes)','https://www.justonecookbook.com/taiyaki/','Japanese',4.7,9300,40,6,['plain flour','baking powder','eggs','milk','sugar','red bean paste','butter'],['Vegetarian'],['breakfast','lunch'],'other'),

  // ────────────────────────────────────────────────
  // LOVE AND LEMONS — loveandlemons.com (19 new)
  // ────────────────────────────────────────────────
  row('Chickpea Salad','https://www.loveandlemons.com/chickpea-salad/','Western',4.8,13900,15,4,['chickpeas','cucumber','cherry tomatoes','red onion','parsley','lemon juice','olive oil','feta'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Roasted Tomato Soup','https://www.loveandlemons.com/roasted-tomato-soup/','Western',4.8,14600,45,4,['tomatoes','garlic','onion','vegetable broth','olive oil','fresh basil','heavy cream'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'soup'),
  row('Cauliflower Tacos','https://www.loveandlemons.com/cauliflower-tacos/','Western',4.7,11200,30,4,['cauliflower','corn tortillas','black beans','avocado','slaw','chipotle sauce','lime','cilantro'],['Vegetarian','Vegan'],['lunch','dinner'],'vegetable'),
  row('Avocado Toast','https://www.loveandlemons.com/avocado-toast-recipe/','Western',4.7,16800,10,2,['sourdough bread','avocado','lemon juice','sea salt','red pepper flakes','olive oil'],['Vegetarian','Vegan','Dairy-Free'],['breakfast','lunch'],'vegetable'),
  row('Fluffy Banana Pancakes','https://www.loveandlemons.com/banana-pancakes/','Western',4.8,15100,20,8,['bananas','eggs','oat flour','baking powder','vanilla','coconut oil','maple syrup'],['Vegetarian','Gluten-Free'],['breakfast'],'other'),
  row('Black Bean Soup','https://www.loveandlemons.com/black-bean-soup/','Western',4.8,12700,35,4,['black beans','onion','garlic','cumin','smoked paprika','vegetable broth','lime juice','sour cream'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'soup'),
  row('Nourishing Quinoa Bowls','https://www.loveandlemons.com/quinoa-bowl/','Western',4.7,11500,30,4,['quinoa','roasted chickpeas','avocado','cucumber','tomatoes','feta','lemon dressing'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Sweet Potato Soup','https://www.loveandlemons.com/sweet-potato-soup/','Western',4.8,14100,35,4,['sweet potatoes','coconut milk','ginger','garlic','cumin','vegetable broth','lime'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'soup'),
  row('Butternut Squash Soup','https://www.loveandlemons.com/butternut-squash-soup/','Western',4.8,15700,45,4,['butternut squash','apple','onion','garlic','vegetable broth','coconut milk','fresh sage','cinnamon'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'soup'),
  row('Pasta Primavera','https://www.loveandlemons.com/pasta-primavera/','Western',4.7,12300,30,4,['pasta','asparagus','peas','cherry tomatoes','courgette','lemon','Parmesan','fresh basil','garlic'],['Vegetarian'],['lunch','dinner'],'vegetable'),
  row('Spinach Pasta','https://www.loveandlemons.com/spinach-pasta/','Western',4.7,11800,25,4,['pasta','baby spinach','garlic','lemon','Parmesan','olive oil','pine nuts','fresh basil'],['Vegetarian'],['lunch','dinner'],'vegetable'),
  row('Greek Pasta Salad','https://www.loveandlemons.com/greek-pasta-salad/','Western',4.7,13100,20,6,['pasta','cucumber','tomatoes','olives','feta','red onion','bell pepper','fresh herbs','lemon dressing'],['Vegetarian'],['lunch','dinner'],'vegetable'),
  row('Easy Caesar Salad','https://www.loveandlemons.com/caesar-salad-recipe/','Western',4.8,16200,20,4,['romaine lettuce','Parmesan','croutons','Caesar dressing','lemon juice','garlic','anchovies'],['Vegetarian'],['lunch','dinner'],'vegetable'),
  row('Caprese Salad','https://www.loveandlemons.com/caprese-salad/','Western',4.7,13600,10,4,['fresh mozzarella','tomatoes','fresh basil','olive oil','balsamic glaze','sea salt'],['Vegetarian','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Creamy Mushroom Pasta','https://www.loveandlemons.com/mushroom-pasta/','Western',4.8,14800,25,4,['pasta','mixed mushrooms','garlic','double cream','Parmesan','thyme','white wine','butter'],['Vegetarian'],['lunch','dinner'],'vegetable'),
  row('Tomato Basil Pasta','https://www.loveandlemons.com/tomato-pasta/','Western',4.7,13200,20,4,['pasta','cherry tomatoes','garlic','fresh basil','olive oil','Parmesan','red pepper flakes'],['Vegetarian'],['lunch','dinner'],'vegetable'),
  row('Vegetable Frittata','https://www.loveandlemons.com/vegetable-frittata/','Western',4.7,10800,25,4,['eggs','bell pepper','spinach','mushrooms','onion','feta','fresh herbs','olive oil'],['Vegetarian','Gluten-Free'],['breakfast','lunch'],'vegetable'),
  row('Roasted Vegetables','https://www.loveandlemons.com/roasted-vegetables/','Western',4.7,12400,40,4,['broccoli','cauliflower','bell pepper','red onion','courgette','olive oil','garlic','herbs'],['Vegetarian','Vegan','Gluten-Free'],['lunch','dinner'],'vegetable'),
  row('Overnight Oats','https://www.loveandlemons.com/overnight-oats-recipe/','Western',4.7,14900,10,2,['rolled oats','almond milk','chia seeds','maple syrup','vanilla','fresh berries','banana'],['Vegetarian','Vegan'],['breakfast'],'other'),
];

const lines = recipes.map((r, i) => r + (i < recipes.length - 1 ? ',' : ''));

const sql = `-- ================================================================
-- 202 additional recipes with dish_type classification
-- Run AFTER schema.sql + migration 001_add_dish_type.sql
-- ================================================================
INSERT INTO public.recipes (
  name, source_url, cuisine, avg_rating, rating_count,
  cook_time_mins, servings, ingredients_summary, dietary_tags, meal_type, dish_type
)
VALUES
${lines.join('\n')}
ON CONFLICT (source_url) DO NOTHING;
`;

const outPath = path.join(__dirname, '..', 'supabase', 'seeds', 'recipes-250.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`Written ${recipes.length} recipes to ${outPath}`);
