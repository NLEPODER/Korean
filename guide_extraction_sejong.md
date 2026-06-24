# Guide d'extraction — manuels Sejong Korean → JSON

Procédure pour transformer un PDF du manuel *Sejong Korean — Vocabulary & Grammar Book* (어휘·표현과 문법) en fichier JSON exploitable par le site de révision. Le but est que chaque nouveau volume (1A, 1B, 2A, 2B…) produise un fichier structuré identique, donc directement interchangeable côté site.

---

## 1. Le format cible

Chaque volume donne un seul fichier JSON avec trois blocs : `meta`, `lessons`, `grammar`.

```json
{
  "meta": {
    "source": "Sejong Korean 1A — Vocabulary & Grammar Book",
    "publisher": "국립국어원 / King Sejong Institute",
    "level": "1A",
    "structure": "...",
    "fields": { "...": "..." }
  },
  "lessons": [
    {
      "id": 1,
      "title_kr": "안녕하세요? 저는 안나예요",
      "vocabulary": [
        { "kr": "나라", "en": "country", "example": "어느 나라 사람이에요?" }
      ]
    }
  ],
  "grammar": [
    {
      "id": 1,
      "lesson": 1,
      "pattern": "이에요/예요",
      "meaning_en": "...",
      "form_en": "...",
      "examples": ["학생이에요.", "..."],
      "practice": ["가: ... / 나: ..."]
    }
  ]
}
```

### Champs à respecter

**Vocabulaire** (`lessons[].vocabulary[]`)
- `kr` — le mot coréen exactement comme imprimé (garder les variantes du type `하나/한`, `아래/밑`)
- `en` — la traduction anglaise de la colonne ENGLISH
- `example` — la phrase d'exemple (colonne 예문), telle quelle, ponctuation comprise

**Grammaire** (`grammar[]`)
- `id` — numéro continu sur tout le volume (1, 2, 3…), pas un redémarrage par leçon
- `lesson` — numéro de la leçon à laquelle le point se rattache (permet de croiser vocab + grammaire)
- `pattern` — la forme grammaticale (titre vert de la fiche), ex. `이에요/예요`
- `meaning_en` — le bloc MEANING en anglais, reformulé en une phrase claire
- `form_en` — le bloc FORM en anglais (règle de formation)
- `examples` — la liste des phrases du bloc EXAMPLE
- `practice` — les dialogues du bloc PRACTICE, format `"가: ... / 나: ..."`

### Règles de cohérence
- Une entrée de vocabulaire = une ligne du tableau. Ne pas fusionner ni dédoublonner même si un mot revient dans une autre leçon (ex. `백` apparaît en leçon 2 *et* 6).
- Quand l'anglais du manuel est ambigu hors contexte (ex. `번`, `호` qui valent tous deux « number »), préciser entre parenthèses : `"number (room)"`. Ça évite les doublons illisibles dans les flashcards.
- Conserver l'ordre du manuel (leçon par leçon, ligne par ligne).
- 2 points de grammaire par leçon dans la série Sejong (à vérifier, mais c'est la norme jusqu'ici).

---

## 2. Le piège des numéros de page

**C'est le point le plus important.** Les numéros de page *imprimés* sur les pages du manuel ne correspondent pas aux numéros de page *du PDF*.

Sur 1A par exemple :
- La page imprimée « 6 » (première page de vocabulaire) = page **8** du PDF
- Les pages de garde, sommaire et intercalaires créent un décalage d'environ **+2**

**À faire systématiquement au début :** repérer une page connue (le sommaire / 차례 donne les pages imprimées de début de chaque partie) et calculer le décalage réel pour ce volume précis. Le décalage peut changer d'un volume à l'autre.

Astuce : le pied de page de chaque fiche de grammaire indique la page du *Student Book* (ex. « Student Book 1A p.38 ») — c'est une référence externe, pas la page du présent PDF. Ne pas la confondre.

---

## 3. Procédure pas à pas

1. **Charger le PDF** et vérifier qu'il a une couche texte extractible.
   ```bash
   pdffonts fichier.pdf      # des polices listées = texte extractible
   pdfinfo fichier.pdf       # nombre de pages
   ```
   Si aucune police n'est listée → le PDF est scanné, il faut passer par l'OCR (voir le skill `pdf-reading`).

2. **Localiser les sections.** Dans la série Sejong, la structure est toujours :
   - 1부 어휘와 표현 (Vocabulary) — les tableaux de vocabulaire, une section `01`…`10` par leçon
   - 2부 문법 (Grammar) — les fiches de grammaire, 2 par leçon
   - 부록 (Annexes) — les index ; **à ignorer**, c'est une reprise du vocabulaire déjà extrait

3. **Calculer le décalage de page** (voir section 2).

4. **Extraire le vocabulaire**, leçon par leçon. Chaque tableau a trois colonnes : 한국어 / ENGLISH / 예문. Une ligne → un objet `{kr, en, example}`.

5. **Extraire la grammaire**, fiche par fiche. Chaque fiche a quatre blocs : MEANING (의미), FORM (형태), EXAMPLE (예문), PRACTICE (활용). Bien associer chaque fiche à sa leçon via `lesson`.

6. **Vérifier** (voir section 4) puis livrer le fichier dans `outputs/`.

---

## 4. Contrôles de qualité avant livraison

Petit script à lancer pour valider la structure et compter les entrées :

```python
import json

with open("sejong_korean_XX_data.json", encoding="utf-8") as f:
    data = json.load(f)

# 1. JSON valide (si on arrive ici, c'est bon)
print("JSON valide ✓")

# 2. Comptages
print("Leçons:", len(data["lessons"]))
print("Vocabulaire total:", sum(len(l["vocabulary"]) for l in data["lessons"]))
print("Points de grammaire:", len(data["grammar"]))

# 3. Champs obligatoires présents partout
for l in data["lessons"]:
    for v in l["vocabulary"]:
        assert {"kr", "en", "example"} <= v.keys(), f"Champ manquant: {v}"
for g in data["grammar"]:
    assert {"id", "lesson", "pattern", "meaning_en", "form_en",
            "examples", "practice"} <= g.keys(), f"Champ manquant: {g['pattern']}"
print("Tous les champs requis sont présents ✓")

# 4. Cohérence des liens grammaire → leçon
lesson_ids = {l["id"] for l in data["lessons"]}
for g in data["grammar"]:
    assert g["lesson"] in lesson_ids, f"Grammaire {g['pattern']} pointe vers une leçon inexistante"
print("Liens grammaire→leçon cohérents ✓")
```

Vérifications manuelles complémentaires :
- Le nombre de mots par leçon correspond-il au nombre de lignes des tableaux ?
- Les caractères coréens s'affichent-ils correctement (pas de `\uXXXX` ni de caractères cassés) ?
- Les exemples se terminent-ils par la bonne ponctuation (`.` `?`) ?
- Les `id` de grammaire sont-ils continus de 1 à N sans trou ni doublon ?

---

## 5. Convention de nommage

Un fichier par volume, nommé de façon prévisible pour le site :

```
sejong_korean_1A_data.json
sejong_korean_1B_data.json
sejong_korean_2A_data.json
```

Penser à mettre à jour `meta.level` et `meta.source` à chaque volume.

---

## 6. Notes spécifiques par volume (à compléter au fil de l'eau)

| Volume | Décalage page imprimée → PDF | Nb leçons | Particularités |
|--------|------------------------------|-----------|----------------|
| 1A     | +2 (impr. 6 = PDF 8)         | 10        | RAS — sert de modèle de référence |
| 1B     | *à mesurer*                  | *à voir*  | |
| 2A     | *à mesurer*                  | *à voir*  | |

> Compléter ce tableau à chaque nouvelle extraction : c'est ce qui fait gagner le plus de temps la fois suivante.
