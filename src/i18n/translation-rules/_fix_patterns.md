# Per-language substitution patterns

Reference patterns for fixing register / brand violations that slip through. When the audit reports violations, these patterns are tested-safe regex substitutions. Use cautiously — verify with dry-run before applying.

Pair this with [_glossary.json](_glossary.json) for context (which register each language uses).

## How to use

A one-shot substitution script can iterate the relevant maps and apply via `polib`. After applying, re-run the audit and `npx lingui compile` to verify.

## Substitution maps

### Serbian (sr) — informal `tvoj*` → formal `vaš*`

Possessive forms only — pronoun/verb conversion is NOT safe (needs adjective gender/number agreement).

```
\btvoja\b      -> vaša
\btvoje\b      -> vaše
\btvojih\b     -> vaših
\btvojim\b     -> vašim
\btvojom\b     -> vašom
\btvojem\b     -> vašem
\btvojeg\b     -> vašeg
\btvojoj\b     -> vašoj
\btvog\b       -> vašeg
\btvom\b       -> vašem
\btvoj\b       -> vaš
\bTvoja\b      -> Vaša
\bTvoje\b      -> Vaše
\bTvog\b       -> Vašeg
\bTvom\b       -> Vašem
\bTvoj\b       -> Vaš
 te je          ->  vas je
 te             ->  vas
```

**Do NOT** auto-convert `si → ste` or `ti → vi` standalone — requires rewriting whole sentences with adjective agreement.

### Slovak (sk) — informal `tvoj*` → formal `vaš*`

```
\btvoja\b      -> vaša
\btvoje\b      -> vaše
\btvojom\b     -> vaším
\btvojho\b     -> vášho
\btvojej\b     -> vašej
\btvojich\b    -> vašich
\btvojím\b     -> vaším
\btvoj\b       -> váš
\bTvoja\b      -> Vaša
\bTvoje\b      -> Vaše
\bTvoj\b       -> Váš
```

### Ukrainian (uk) — informal → formal pronouns

```
 тебе  -> вас
 тобі  -> вам
 ти    -> ви
```

### French (fr) — informal possessive → formal

```
 ton  -> votre
 ta   -> votre
 tes  -> vos
```

### German (de) — formal Sie/Ihr → informal du/dein

Whole-phrase patterns (avoid bare `Sie` — could be 3rd plural):

```
\bGeben Sie\b    -> Gib
\bSind Sie\b     -> Bist du
\bHaben Sie\b    -> Hast du
\bMöchten Sie\b  -> Möchtest du
\bKönnen Sie\b   -> Kannst du
\bWollen Sie\b   -> Willst du
\bSie können\b   -> du kannst
\bSie haben\b    -> du hast
\bSie sind\b     -> du bist
^Sie können\b    -> Du kannst
^Sie haben\b     -> Du hast
^Sie sind\b      -> Du bist
\bIhren\b        -> deinen
\bIhrem\b        -> deinem
\bIhre\b         -> deine
```

`Ihr` standalone is ambiguous (could be plural "her") — skip.

### Dutch (nl) — formal uw → informal je

```
\buw\b   -> je
\bUw\b   -> Je
```

`u` pronoun: only convert at sentence start (`^U ` → `Je `).

### Korean (ko) — honorific `귀하` → standard `당신`

```
귀하의   -> 당신의
귀하를   -> 당신을
귀하가   -> 당신이
귀하에게 -> 당신에게
귀하     -> 당신
```

### Simplified Chinese (zh-CN) — informal `你` → formal `您`

Verb/possessive compounds only (bare `你` is too risky — could be part of other words).

```
你已     -> 您已
你的     -> 您的
你是     -> 您是
你可以   -> 您可以
你能     -> 您能
你将     -> 您将
你会     -> 您会
你不     -> 您不
你需要   -> 您需要
你想     -> 您想
你在     -> 您在
你有     -> 您有
你和     -> 您和
你与     -> 您与
```

### Traditional Chinese (zh-TW) — same logic

```
你已     -> 您已
你的     -> 您的
你是     -> 您是
你可以   -> 您可以
你能     -> 您能
你將     -> 您將
你會     -> 您會
你不     -> 您不
你需要   -> 您需要
你想     -> 您想
你在     -> 您在
你有     -> 您有
你和     -> 您和
你與     -> 您與
```

### Indonesian (id) — informal `Kamu` → formal `Anda`

```
\bKamu memiliki\b   -> Anda memiliki
\bKamu sudah\b      -> Anda sudah
\bKamu telah\b      -> Anda telah
\bKamu sedang\b     -> Anda sedang
\bKamu akan\b       -> Anda akan
\bKamu tidak\b      -> Anda tidak
\bKamu dapat\b      -> Anda dapat
\bKamu bisa\b       -> Anda bisa
\bKamu harus\b      -> Anda harus
\bKamu diundang\b   -> Anda diundang
\bKamu \b           -> Anda 
\bkamu\b            -> Anda
```

### Hebrew (he) — plural `שלכם` → singular `שלך`

```
שלכם  -> שלך
```

### Greek (el) — formal verbs → informal (whole-phrase only)

Greek register conversion needs adjective agreement — use full phrase patterns:

```
Είστε σίγουροι ότι θέλετε να διαγράψετε  -> Είσαι σίγουρος ότι θέλεις να διαγράψεις
Είστε σίγουρες ότι θέλετε να διαγράψετε  -> Είσαι σίγουρη ότι θέλεις να διαγράψεις
Είστε σίγουροι                            -> Είσαι σίγουρος
Είστε σίγουρες                            -> Είσαι σίγουρη
θέλετε να διαγράψετε                      -> θέλεις να διαγράψεις
Έχετε ήδη                                 -> Έχεις ήδη
Στέλνετε μηνύματα                         -> Στέλνεις μηνύματα
Παρακαλώ περιμένετε                       -> Παρακαλώ περίμενε
 τα φίλτρα σας                            ->  τα φίλτρα σου
 δική σας                                 ->  δική σου
```

### Norwegian (no) — hyphenated compounds → fused

```
konto-adresse    -> kontoadresse
konto-nøkkel     -> kontonøkkel
Konto-adresse    -> Kontoadresse
Konto-nøkkel     -> Kontonøkkel
konto-           -> konto
```

### Romanian (ro) — formal `dumneavoastră` → informal (per-noun agreement)

```
filtrele dumneavoastră      -> filtrele tale     (N.pl)
dispozitivul dumneavoastră  -> dispozitivul tău  (M.sg)
```

Each instance needs adjective agreement matching the noun gender/number. NOT safe to do blanket substitution.

### Vietnamese (vi) — brand term `khóa truy cập` → `passkey`

```
khóa truy cập của bạn  -> passkey của bạn
khóa truy cập          -> passkey
Khóa truy cập          -> Passkey
```

## Patterns that look safe but AREN'T

- Serbian: `si → ste`, `ti → vi` (need adjective rewriting)
- German: bare `\bSie\b` (could be 3rd plural)
- Greek: bare `Στέλνετε` standalone (could be 3rd plural depending on context)
- Dutch: bare `\bu\b` (very common 1-letter sequence, even with boundaries)
- Chinese: bare `你` (could be part of words like 你好 — though brand list helps)
- Indonesian: `kamu` as substring (could be `kamus` = dictionary)

When in doubt, scope by surrounding context (sentence start, before specific verbs, after specific articles).
