# Film d'introduction — voix off

Film de ~2 min 30 joué sur l'écran projeté au lancement de la partie, avant l'écran « La Terre aujourd'hui » (stats en direct). Il raconte 1900 → aujourd'hui ; le jeu commence ensuite à la date du jour.

~360 mots ≈ 2 min 30 à débit normal. Un segment = un sous-titre (ou deux s'il est long) = un plan.

Film final : `apps/screen/public/film/intro.mp4` (1920×1080, H.264 + AAC, sous-titres incrustés). Tant qu'il n'existe pas, l'écran passe directement aux chiffres du jour. Si le film dépasse 2 min 30, augmenter `INTRO_S` (défaut 180 s = film + ~30 s de chiffres).

## Pour ElevenLabs

- **Un seul fichier** : coller le bloc « Texte à coller » ci-dessous d'un coup, exporter en MP3 et le déposer dans `docs/film/audio/voix-off.mp3`.
- Les `<break time="1.5s" />` mettent un silence entre les segments : au montage, le fichier est découpé sur ces silences. Ils marchent avec les modèles Multilingual v2 / Flash / Turbo. Avec Eleven v3 (qui ne les comprend pas), les remplacer par une ligne vide et « … ».
- Voix grave et posée, style documentaire, stabilité élevée.
- Si la voix bute sur « CO2 », écrire « C O 2 » dans ElevenLabs ; le sous-titre gardera « CO₂ ».

### Texte à coller

```
1900. Le monde se met à brûler du charbon. Les usines tournent jour et nuit, les trains traversent les continents. On appelle ça le progrès.
<break time="1.5s" />
En 1908, la Ford T sort des usines. Le pétrole devient le sang de l'économie. Et dans l'air, sans bruit, le CO2 s'accumule.
<break time="1.5s" />
En 1938, un ingénieur britannique, Guy Callendar, fait le lien : en brûlant charbon et pétrole, l'humanité réchauffe la planète. Personne ne l'écoute.
<break time="1.5s" />
Après la guerre, tout s'accélère. Voitures, avions, plastique, consommation de masse. En quelques décennies, nous brûlons plus d'énergie que dans toute l'histoire humaine.
<break time="1.5s" />
En 1958, au sommet d'un volcan à Hawaï, un scientifique commence à mesurer le CO2 de l'air : 315 parties par million. Depuis, la courbe n'a jamais cessé de monter.
<break time="1.5s" />
En 1972, le rapport Meadows prévient : une croissance infinie est impossible dans un monde fini. Le monde lit le rapport… et continue.
<break time="1.5s" />
À la fin des années 1970, les scientifiques des compagnies pétrolières prévoient eux-mêmes le réchauffement, avec précision. Leurs dirigeants choisissent de semer le doute.
<break time="1.5s" />
1988. Les Nations unies créent le GIEC. Devant le Congrès américain, le climatologue James Hansen l'affirme : le réchauffement a commencé.
<break time="1.5s" />
Rio, 1992. Kyoto, 1997. Les sommets se succèdent, les promesses aussi. Les émissions, elles, continuent d'augmenter.
<break time="1.5s" />
Puis les premières factures arrivent. En 2003, une canicule tue plus de 70 000 personnes en Europe. En 2005, l'ouragan Katrina noie La Nouvelle-Orléans.
<break time="1.5s" />
En 2015, à Paris, 195 pays s'engagent à limiter le réchauffement bien en dessous de 2 degrés, et si possible à 1,5. Un espoir.
<break time="1.5s" />
Mais les flammes ne négocient pas. En Australie, les mégafeux de 2019 tuent ou déplacent près de trois milliards d'animaux. En 2022, un tiers du Pakistan se retrouve sous les eaux.
<break time="1.5s" />
2024 devient la première année où la planète dépasse 1,5 degré de réchauffement. La limite que nous nous étions fixée.
<break time="1.5s" />
Rien de tout cela n'était une fatalité. Chaque tonne de CO2 est le résultat d'une décision : construire, investir, voter, consommer, se taire… ou agir.
<break time="1.5s" />
Aujourd'hui, c'est à vous de décider. Chacun d'entre vous a un rôle à jouer : le monde de 2100 sera celui que vous aurez choisi.
```

## Texte

| N°  | Texte (voix off = sous-titre)                                                                                                                                                        | Visuel proposé                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 01  | 1900. Le monde se met à brûler du charbon. Les usines tournent jour et nuit, les trains traversent les continents. On appelle ça le progrès.                                         | Archives : usines, cheminées, locomotives à vapeur                  |
| 02  | En 1908, la Ford T sort des usines. Le pétrole devient le sang de l'économie. Et dans l'air, sans bruit, le CO₂ s'accumule.                                                          | Chaîne de montage Ford, puits de pétrole                            |
| 03  | En 1938, un ingénieur britannique, Guy Callendar, fait le lien : en brûlant charbon et pétrole, l'humanité réchauffe la planète. Personne ne l'écoute.                               | Coupures de presse, portrait de Callendar                           |
| 04  | Après la guerre, tout s'accélère. Voitures, avions, plastique, consommation de masse. En quelques décennies, nous brûlons plus d'énergie que dans toute l'histoire humaine.          | Années 50-60 : autoroutes, supermarchés, aéroports                  |
| 05  | En 1958, au sommet d'un volcan à Hawaï, un scientifique commence à mesurer le CO₂ de l'air : 315 parties par million. Depuis, la courbe n'a jamais cessé de monter.                  | Observatoire de Mauna Loa, courbe de Keeling animée                 |
| 06  | En 1972, le rapport Meadows prévient : une croissance infinie est impossible dans un monde fini. Le monde lit le rapport… et continue.                                               | Couverture du rapport, embouteillages                               |
| 07  | À la fin des années 1970, les scientifiques des compagnies pétrolières prévoient eux-mêmes le réchauffement, avec précision. Leurs dirigeants choisissent de semer le doute.         | Raffineries, publicités pétrolières d'époque                        |
| 08  | 1988. Les Nations unies créent le GIEC. Devant le Congrès américain, le climatologue James Hansen l'affirme : le réchauffement a commencé.                                           | Audition de Hansen, logo du GIEC                                    |
| 09  | Rio, 1992. Kyoto, 1997. Les sommets se succèdent, les promesses aussi. Les émissions, elles, continuent d'augmenter.                                                                 | Photos de famille des sommets, courbe des émissions                 |
| 10  | Puis les premières factures arrivent. En 2003, une canicule tue plus de 70 000 personnes en Europe. En 2005, l'ouragan Katrina noie La Nouvelle-Orléans.                             | Thermomètres, Katrina vue du satellite, rues inondées               |
| 11  | En 2015, à Paris, 195 pays s'engagent à limiter le réchauffement bien en dessous de 2 degrés, et si possible à 1,5. Un espoir.                                                       | COP21, applaudissements                                             |
| 12  | Mais les flammes ne négocient pas. En Australie, les mégafeux de 2019 tuent ou déplacent près de trois milliards d'animaux. En 2022, un tiers du Pakistan se retrouve sous les eaux. | Feux australiens, Pakistan inondé vu du satellite                   |
| 13  | 2024 devient la première année où la planète dépasse 1,5 degré de réchauffement. La limite que nous nous étions fixée.                                                               | Carte des anomalies de température (NASA)                           |
| 14  | Rien de tout cela n'était une fatalité. Chaque tonne de CO₂ est le résultat d'une décision : construire, investir, voter, consommer, se taire… ou agir.                              | Foules, villes, marches pour le climat                              |
| 15  | Aujourd'hui, c'est à vous de décider. Chacun d'entre vous a un rôle à jouer : le monde de 2100 sera celui que vous aurez choisi.                                                     | Terre vue de l'espace → fondu vers l'écran « La Terre aujourd'hui » |

## Sources des faits cités

- Guy Callendar, 1938 : _The artificial production of carbon dioxide and its influence on temperature_, Q. J. Royal Meteorological Society.
- Courbe de Keeling, Mauna Loa, mars 1958 : ~315 ppm (NOAA / Scripps).
- Rapport Meadows, _The Limits to Growth_, Club de Rome, 1972.
- Exxon : Supran, Rahmstorf & Oreskes, _Assessing ExxonMobil's global warming projections_, Science, 2023.
- GIEC créé en 1988 (OMM + PNUE) ; audition de James Hansen au Sénat américain, 23 juin 1988.
- Canicule 2003 : plus de 70 000 décès en Europe (Robine et al., 2008).
- Accord de Paris, COP21, 2015.
- Feux australiens 2019-2020 : ~3 milliards d'animaux tués ou déplacés (WWF Australie, 2020).
- Pakistan 2022 : environ un tiers du pays inondé (ONU / NASA).
- 2024, première année civile au-dessus de +1,5 °C (Copernicus, janvier 2025).
