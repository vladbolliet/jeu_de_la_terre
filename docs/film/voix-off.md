# Film d'introduction — voix off

Film joué sur l'écran projeté au lancement de la partie, avant l'écran « La Terre aujourd'hui » (stats en direct). Il raconte 1900 → aujourd'hui ; le jeu commence ensuite à la date du jour.

**La voix off est la référence : la vidéo se monte sur elle, jamais l'inverse.** On enregistre d'abord la voix, d'une traite et à son rythme naturel ; ensuite chaque plan dure exactement le temps de son paragraphe, et les sous-titres sont calés sur l'audio. Durée du film = durée de la voix (≈ 2 min 30 pour ~350 mots).

Film final : `apps/screen/public/film/intro.mp4` (1920×1080, H.264 + AAC, sous-titres incrustés). Tant qu'il n'existe pas, l'écran passe directement aux chiffres du jour. Régler `INTRO_S` (défaut 180 s) sur la durée du film + ~30 s de chiffres.

## 1. Générer la voix (ElevenLabs)

- Coller **tout** le bloc « Texte à lire » d'un coup. Aucune balise, aucun silence forcé : les paragraphes sont séparés par une ligne vide, ce qui donne une respiration naturelle.
- Modèle **Eleven Multilingual v2** (le plus régulier en français pour de la narration). Voix grave et posée, style documentaire. Réglages de départ : stabilité 50 %, similarité 75 %, style 0, vitesse 1,0.
- Le texte est écrit pour l'oreille : nombres et années en toutes lettres, pas de « CO2 » (dit « dioxyde de carbone »), pas de deux-points ni de points de suspension, phrases courtes. Ne pas le « corriger » vers les chiffres : c'est ce qui faisait buter la voix.
- Réécouter en entier. Si un paragraphe est mal lu, le régénérer seul (même voix, mêmes réglages) et le remplacer au montage ; le reste ne bouge pas.
- Mots à surveiller à l'écoute : « Callendar », « Meadows », « Giec », « Kyoto ». Si l'un est mal prononcé, l'écrire comme il se prononce (ex. « Jiek ») uniquement dans le texte collé.
- Exporter en MP3 → `docs/film/audio/voix-off.mp3`.

### Texte à lire

```
En mille neuf cent, le monde se met à brûler du charbon. Les usines tournent jour et nuit, les trains traversent les continents. On appelle ça le progrès.

En mille neuf cent huit, Ford lance une voiture que tout le monde peut acheter. Le pétrole devient le sang de l'économie. Et dans l'air, sans bruit, le dioxyde de carbone s'accumule.

En mille neuf cent trente-huit, un ingénieur anglais, Guy Callendar, fait le lien. En brûlant du charbon et du pétrole, l'humanité réchauffe la planète. Personne ne l'écoute.

Après la guerre, tout s'accélère. Les voitures, les avions, le plastique, la consommation de masse. En quelques décennies, nous brûlons plus d'énergie que dans toute l'histoire humaine.

En mille neuf cent cinquante-huit, au sommet d'un volcan à Hawaï, un scientifique commence à mesurer le dioxyde de carbone dans l'air. Depuis ce jour, la courbe n'a jamais cessé de monter.

En mille neuf cent soixante-douze, le rapport Meadows lance un avertissement. Une croissance infinie est impossible dans un monde fini. Le monde lit le rapport, et continue comme avant.

À la fin des années soixante-dix, les chercheurs des compagnies pétrolières prévoient eux-mêmes le réchauffement, avec précision. Leurs dirigeants choisissent de semer le doute.

En mille neuf cent quatre-vingt-huit, les Nations unies créent un groupe d'experts sur le climat, le Giec. Aux États-Unis, devant le Congrès, le climatologue James Hansen l'affirme. Le réchauffement a commencé.

Rio, en mille neuf cent quatre-vingt-douze. Kyoto, en mille neuf cent quatre-vingt-dix-sept. Les sommets se succèdent, les promesses aussi. Mais les émissions continuent d'augmenter.

Puis les premières factures arrivent. En deux mille trois, une canicule tue plus de soixante-dix mille personnes en Europe. En deux mille cinq, l'ouragan Katrina noie la Nouvelle-Orléans.

En deux mille quinze, à Paris, cent quatre-vingt-quinze pays s'engagent à limiter le réchauffement bien en dessous de deux degrés, et si possible à un degré et demi. C'est un espoir.

Mais les flammes ne négocient pas. En deux mille dix-neuf, les mégafeux d'Australie tuent ou déplacent près de trois milliards d'animaux. En deux mille vingt-deux, un tiers du Pakistan se retrouve sous les eaux.

En deux mille vingt-quatre, pour la première fois, la planète dépasse un degré et demi de réchauffement sur une année entière. C'est la limite que nous nous étions fixée.

Rien de tout cela n'était une fatalité. Chaque tonne de carbone vient d'une décision. Construire, investir, voter, consommer, se taire, ou agir.

Aujourd'hui, c'est à vous de décider. Chacun d'entre vous a un rôle à jouer. Le monde de deux mille cent sera celui que vous aurez choisi.
```

## 2. Monter la vidéo sur la voix

1. Dans le logiciel de montage (CapCut, DaVinci Resolve…), poser **d'abord** `voix-off.mp3` sur la timeline. Elle n'est ni coupée ni accélérée.
2. Mettre un marqueur au début de chaque paragraphe (15 marqueurs). Le plan d'un paragraphe (colonne « Visuel ») va de son marqueur au suivant : s'il manque d'images, ralentir ou enchaîner plusieurs archives, mais ne jamais toucher à la voix.
3. Sous-titres : les générer automatiquement à partir de l'audio (CapCut « Sous-titres automatiques », DaVinci « Créer des sous-titres à partir de l'audio »), puis corriger le texte avec la colonne « Sous-titre » ci-dessous (chiffres, « CO₂ »). Deux lignes max, ~42 caractères par ligne.
4. Musique éventuelle sous la voix, ~20 dB plus bas. Quelques secondes de fin sur la Terre vue de l'espace.
5. Exporter en `apps/screen/public/film/intro.mp4`, puis mettre `INTRO_S` à la durée du film + ~30 s.

## Plans et sous-titres

Le sous-titre dit exactement la même chose que la voix, écrit pour l'œil (chiffres, CO₂).

| N°  | Sous-titre                                                                                                                                                                                | Visuel proposé                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 01  | En 1900, le monde se met à brûler du charbon. Les usines tournent jour et nuit, les trains traversent les continents. On appelle ça le progrès.                                           | Archives : usines, cheminées, locomotives à vapeur                  |
| 02  | En 1908, Ford lance une voiture que tout le monde peut acheter. Le pétrole devient le sang de l'économie. Et dans l'air, sans bruit, le CO₂ s'accumule.                                   | Chaîne de montage Ford, puits de pétrole                            |
| 03  | En 1938, un ingénieur anglais, Guy Callendar, fait le lien. En brûlant du charbon et du pétrole, l'humanité réchauffe la planète. Personne ne l'écoute.                                   | Coupures de presse, portrait de Callendar                           |
| 04  | Après la guerre, tout s'accélère. Les voitures, les avions, le plastique, la consommation de masse. En quelques décennies, nous brûlons plus d'énergie que dans toute l'histoire humaine. | Années 50-60 : autoroutes, supermarchés, aéroports                  |
| 05  | En 1958, au sommet d'un volcan à Hawaï, un scientifique commence à mesurer le CO₂ dans l'air. Depuis ce jour, la courbe n'a jamais cessé de monter.                                       | Observatoire de Mauna Loa, courbe de Keeling animée                 |
| 06  | En 1972, le rapport Meadows lance un avertissement. Une croissance infinie est impossible dans un monde fini. Le monde lit le rapport, et continue comme avant.                           | Couverture du rapport, embouteillages                               |
| 07  | À la fin des années 70, les chercheurs des compagnies pétrolières prévoient eux-mêmes le réchauffement, avec précision. Leurs dirigeants choisissent de semer le doute.                   | Raffineries, publicités pétrolières d'époque                        |
| 08  | En 1988, les Nations unies créent un groupe d'experts sur le climat, le GIEC. Aux États-Unis, devant le Congrès, le climatologue James Hansen l'affirme. Le réchauffement a commencé.     | Audition de Hansen, logo du GIEC                                    |
| 09  | Rio, en 1992. Kyoto, en 1997. Les sommets se succèdent, les promesses aussi. Mais les émissions continuent d'augmenter.                                                                   | Photos de famille des sommets, courbe des émissions                 |
| 10  | Puis les premières factures arrivent. En 2003, une canicule tue plus de 70 000 personnes en Europe. En 2005, l'ouragan Katrina noie la Nouvelle-Orléans.                                  | Thermomètres, Katrina vue du satellite, rues inondées               |
| 11  | En 2015, à Paris, 195 pays s'engagent à limiter le réchauffement bien en dessous de 2 °C, et si possible à 1,5 °C. C'est un espoir.                                                       | COP21, applaudissements                                             |
| 12  | Mais les flammes ne négocient pas. En 2019, les mégafeux d'Australie tuent ou déplacent près de 3 milliards d'animaux. En 2022, un tiers du Pakistan se retrouve sous les eaux.           | Feux australiens, Pakistan inondé vu du satellite                   |
| 13  | En 2024, pour la première fois, la planète dépasse 1,5 °C de réchauffement sur une année entière. C'est la limite que nous nous étions fixée.                                             | Carte des anomalies de température (NASA)                           |
| 14  | Rien de tout cela n'était une fatalité. Chaque tonne de carbone vient d'une décision. Construire, investir, voter, consommer, se taire, ou agir.                                          | Foules, villes, marches pour le climat                              |
| 15  | Aujourd'hui, c'est à vous de décider. Chacun d'entre vous a un rôle à jouer. Le monde de 2100 sera celui que vous aurez choisi.                                                           | Terre vue de l'espace → fondu vers l'écran « La Terre aujourd'hui » |

## Sources des faits cités

- Guy Callendar, 1938 : _The artificial production of carbon dioxide and its influence on temperature_, Q. J. Royal Meteorological Society.
- Ford T lancée en 1908.
- Courbe de Keeling, Mauna Loa, mesures depuis mars 1958 (NOAA / Scripps).
- Rapport Meadows, _The Limits to Growth_, Club de Rome, 1972.
- Exxon : Supran, Rahmstorf & Oreskes, _Assessing ExxonMobil's global warming projections_, Science, 2023.
- GIEC créé en 1988 (OMM + PNUE) ; audition de James Hansen au Sénat américain, 23 juin 1988.
- Canicule 2003 : plus de 70 000 décès en Europe (Robine et al., 2008).
- Accord de Paris, COP21, 2015.
- Feux australiens 2019-2020 : ~3 milliards d'animaux tués ou déplacés (WWF Australie, 2020).
- Pakistan 2022 : environ un tiers du pays inondé (ONU / NASA).
- 2024, première année civile au-dessus de +1,5 °C (Copernicus, janvier 2025).
