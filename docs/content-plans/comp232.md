# COMP 232 · Mathematics for Computer Science — content plan

Deck: `src/content/decks/comp232.json` (deck id `comp232-core`, course key `comp232`). 230 items, 10 top-level topics, 33 leaf subtopics, 88 cloze / 142 basic, 158 with explanations, 150 with slide sources, 60 tagged `ahead`.

## Course summary

COMP 232 (Concordia, Fall 2026, coordinator L. Narayanan; slides by B. Lovitz) is a first discrete-mathematics course following Rosen, *Discrete Mathematics and its Applications*, 9th ed. The first five weeks build formal reasoning: propositional logic and named equivalences (§1.1–1.3), predicates and nested quantifiers (§1.4–1.5), rules of inference including the quantified rules and the classic fallacies (§1.6), and the proof methods the course names "direct, indirect, contradiction, cases, induction" (§1.7–1.8). It then turns to the basic abstractions: sets and set identities (§2.1–2.2), functions and cardinality (§2.3, 2.5), elements of number theory and gcd (§4.1, 4.3), induction, strong induction and recursive definitions (§5.1–5.3), and relations, their closures, equivalence relations and partial orderings (§9.1, 9.3–9.6). Assessment is dominated by the final (55%) and a common midterm on October 25 covering roughly weeks 1–6; assignments ask for complete truth tables, named-law algebraic proofs, quantifier translations and negations, and rules-of-inference derivations with every step named — which is what this deck drills.

## Outline and item plan

| Top-level topic | Subtopic (key) | Week / sections | Source | Items |
|---|---|---|---|---|
| Propositional Logic (`logic`) | Propositions & Connectives (`logic-basics`) | W1, §1.1–1.2 | slides | 15 |
| | Converse, Contrapositive & Inverse (`logic-conditional`) | W1, §1.1 | slides | 6 |
| | Logical Equivalences (`logic-equiv`) | W1, §1.3 | slides | 22 |
| | Tautology, Contradiction & Contingency (`logic-classify`) | W1, §1.3 | slides | 4 |
| Predicates & Quantifiers (`pred`) | Predicates, Domains & Quantifiers (`pred-basics`) | W2, §1.4 | slides | 11 |
| | Negating Quantifiers (`pred-negation`) | W2, §1.4–1.5 | slides | 8 |
| | Nested Quantifiers & Translation (`pred-nested`) | W2, §1.5 | slides | 8 |
| Rules of Inference (`infer`) | Arguments & Validity (`infer-args`) | W3, §1.6 | slides | 5 |
| | Propositional Rules of Inference (`infer-rules`) | W3, §1.6 | slides | 13 |
| | Fallacies (`infer-fallacies`) | W3, §1.6 | slides | 4 |
| | Rules for Quantified Statements (`infer-quant`) | W3, §1.6 | slides | 9 |
| Introduction to Proofs (`proof`) | Terminology (`proof-terms`) | W4, §1.7 | slides | 5 |
| | Proof Methods (`proof-methods`) | W4, §1.7–1.8 | slides (+2 Rosen) | 16 |
| | Strategy & Classic Proofs (`proof-strategy`) | W4, §1.8 | slides | 6 |
| Sets (`sets`) | Sets, Subsets & Cardinality (`sets-basics`) | W5, §2.1 | slides | 8 |
| | Set Operations, Power Set & Product (`sets-ops`) | W5, §2.1–2.2 | slides | 10 |
| | Set Identities (`sets-identities`) | W5, §2.2 | slides | 15 |
| | Proving Set Identities & Bit Strings (`sets-proofs`) | W5, §2.2 | slides | 5 |
| Functions & Cardinality (`func`) | Functions, Floor & Ceiling, Composition (`func-basics`) | W6, §2.3 | **ahead** | 4 |
| | One-to-One, Onto & Bijections (`func-props`) | W6, §2.3 (+W4 Ex. 7) | **ahead** | 6 |
| | Cardinality of Sets (`func-card`) | W6, §2.5 | **ahead** | 3 |
| Elements of Number Theory (`numth`) | Divisibility & Division Algorithm (`numth-div`) | W7, §4.1 | **ahead** | 4 |
| | Modular Arithmetic (`numth-mod`) | W7, §4.1 | **ahead** | 3 |
| | Primes (`numth-primes`) | W8, §4.3 | **ahead** | 3 |
| | GCD, LCM & Euclidean Algorithm (`numth-gcd`) | W8, §4.3 | **ahead** | 4 |
| Induction & Recursion (`induct`) | Mathematical Induction (`induct-basic`) | W9, §5.1 | **ahead** | 5 |
| | Strong Induction & Well-Ordering (`induct-strong`) | W9, §5.2 | **ahead** | 3 |
| | Recursive Definitions & Structural Induction (`induct-recursive`) | W10, §5.3 | **ahead** | 3 |
| Relations (`rel`) | Relations & Their Properties (`rel-basics`) | W10, §9.1 | **ahead** | 6 |
| | Representing Relations (`rel-represent`) | W10, §9.3 | **ahead** | 3 |
| | Closures of Relations (`rel-closures`) | W11, §9.4 | **ahead** | 4 |
| Equivalence Relations & Partial Orderings (`order`) | Equivalence Relations (`order-equiv`) | W12, §9.5 | **ahead** | 4 |
| | Partial Orderings (`order-poset`) | W12, §9.6 | **ahead** | 5 |

The outline (Rosen chapters 1, 2, 4, 5, 9) contains **no counting chapter** and skips §2.4 (sequences/sums) and §4.2, so those units from the brief were not created. The weight is deliberately on weeks 1–5 (170 items), which is what the midterm covers and where the course-specific phrasing lives.

## Conventions chosen

- Connectives exactly as the slides: `\neg`, `\land`, `\lor`, `\oplus`, `\to` (conditional), `\leftrightarrow` (biconditional), `\equiv` for logical equivalence, `T`/`F` for the truth constants, `\therefore` in argument forms. Truth tables are described with T/F (the slides allow t/f, 1/0 too).
- Law names follow the W1 table: identity, domination, idempotent, double negation, commutative, associative, distributive, de Morgan, plus negation laws and absorption laws (W1 p.54). "Implication law" is my label for `p → q ≡ ¬p ∨ q`; the slides just call it "Example 1". Exportation and the two "common conclusion / common hypothesis" equivalences are Rosen Table 7 (no slide source given).
- Quantifiers: `\forall x\,P(x)` with a thin space; domain restriction written with brackets as on the slides (`\forall x\,[P(x) \to Q(x)]`). "Universe of discourse" and "domain" are used interchangeably, as the slides do. Number sets `\mathbb{Z}, \mathbb{Z}^+, \mathbb{N}, \mathbb{Q}, \mathbb{R}` with the course's `\mathbb{N} = \{0, 1, 2, \dots\}`.
- Rules of inference use the slides' names: modus ponens, modus tollens, hypothetical syllogism, disjunctive syllogism, addition, simplification, conjunction, resolution, contradiction rule, proof by cases rule; universal/existential instantiation/generalization, universal modus ponens/tollens. Fallacies are "converse error" and "inverse error" (Rosen's names given in parentheses).
- Proof methods use the course's list (direct, indirect, contradiction, cases, induction). **"Indirect proof" means proof of the contrapositive** (Rosen: "proof by contraposition"); the deck says so explicitly and separates it from proof by contradiction.
- Sets: set-builder `\{x \mid P(x)\}` (the slides also use `\{x : P(x)\}`); difference `A - B`; complement `\overline{A}`; proper subset `\subset` (as on W5 p.4, with `\subseteq` allowing equality); power set `\mathcal{P}(A)`; `|A|` for cardinality. Set-identity names follow the W5 table (identity, domination, idempotent, **complement** for double complement, commutative, associative, distributive, De Morgan); `A \cup \overline{A} = U` etc. are the slides' unnamed "other useful identities" (Rosen: complement laws).
- Number theory: `a \mid b`, `a \bmod m`, `a \equiv b \pmod m`, `\gcd`, `\operatorname{lcm}`; `\textbf{div}`.
- Item keys are `<subtopic>-<slug>`; `reverse: true` only on name ↔ law/rule cards (30 items). `source` cites **PDF page numbers** of the week files (e.g. "W3 p.28, §1.6"), not the slide-footer numbers, which differ because of animation builds. Page ranges cover the build-up of one slide.

## Verification against the rendered page images

The PDFs could not be rendered by the Read tool, so the first draft used text extraction, in which the logic symbols were font-mapped to wrong glyphs (e.g. `∧`/`∨` came out as arrows and the W1 equivalence table rows were scrambled). After the coordinator rendered every page to PNG, I opened the page image for **every distinct cited page or the final page of every cited build-up range** (103 images: W1 ×23, W2 ×20, W3 ×15, W4 ×33, W5 ×17) and compared each sourced item against it. All 150 sourced items match the slides; two items were reworded as a result:

- `sets-identities-complementation` — the W5 table labels the double-complement row "complement", not "complementation"; prompt now uses the course's label with Rosen's in parentheses.
- `sets-identities-complement-laws` — `A ∪ Ā = U`, `A ∩ Ā = ∅` are unnamed on the slides; prompt now says so.

Slide oddities noticed while verifying (not reproduced in the deck):
- W1 p.55 annotates `p ≡ p ∧ T` as "Domination:" although it is the identity law (the proof steps below it are labelled correctly). The deck uses the correct name.
- W1 p.9 defines "equivalent" as "two propositions with the same truth value"; the precise definition (same truth table / `p ↔ q` a tautology) on p.40 is the one used.
- W2 p.5–8 claim that `P(5)` is "not a proposition" when `P` has not been defined; omitted as too idiosyncratic to test.

## Items I was unsure about

- `logic-basics-xor` / `logic-basics-biconditional-dnf`: the slide's handwritten annotations show `¬(a ⊕ b) ↔ (b ↔ a)` as a tautology; the deck states the equivalent `p ⊕ q ≡ ¬(p ↔ q)`. Correct, but not literally the slide's form.
- `infer-fallacies-*`: the course uses "converse error" / "inverse error"; Rosen's "fallacy of affirming the conclusion / denying the hypothesis" are added in parentheses in case the exam uses either.
- `proof-methods-vacuous`, `proof-methods-trivial`, `proof-methods-circular`, `proof-methods-disproof`: vacuous/trivial proofs and circular reasoning are Rosen §1.7 material not (yet) on the slides; kept because the brief asked for the vacuous-vs-trivial confusable, tagged without a source.
- `pred-basics-number-sets`: the slides explicitly warn that the definition of `\mathbb{N}` may vary ("watch for defs"); the card states the slide's `{0, 1, 2, …}` and repeats the warning.
- `numth-div-negative` (`−11 div 3 = −4`, `−11 mod 3 = 1`): standard Rosen convention (non-negative remainder); confirm against the week-7 slides when they appear.
- `induct-basic-principle` states the inductive step as `∀k ≥ 1 [P(k) → P(k+1)]` with basis 1; Rosen's text also allows basis `b`. Noted in the explanation.

## Subtopics written from general (Rosen) knowledge rather than the slides

All 33 items under `func`, `numth`, `induct`, `rel` and `order` (weeks 6–12, 60 items) are tagged `ahead`; no slides exist yet. Two of them cite W4 (one-to-one definition and the case-split proof of Example 7; the division algorithm as used in Example 9) because the W4 slides previewed that material. Within the slide-covered units, these individual items are Rosen-based and carry no `source`: `logic-basics-rows`, `logic-equiv-de-morgan-mistake`, `logic-equiv-negated-conditional`, `logic-equiv-or-as-conditional`, `logic-equiv-exportation`, `logic-equiv-common-conclusion`, `logic-equiv-disprove`, `pred-negation-conditional`, `pred-negation-mistake`, `pred-nested-same-type-commute`, `pred-nested-at-least-two`, `pred-nested-no-distribute` (slide-sourced claim, Rosen counterexample), `infer-fallacies-mt-vs-inverse`, `infer-fallacies-mp-vs-converse`, `infer-quant-ei-before-ui`, `proof-methods-vacuous`, `proof-methods-trivial`, `proof-methods-circular`, `proof-strategy-euclid-mistake`, `sets-basics-empty-subset`, `sets-basics-in-vs-subset`, `sets-basics-empty-vs-set-of-empty`, `sets-ops-power-set-size`, `sets-ops-power-set-empty`.

When the week-6+ slides arrive: re-check names and notation of the `ahead` units against them, update `source` fields, and drop the `ahead` tag.

## Validation

`DECK=src/content/decks/comp232.json npx vitest run test/deck-file.test.ts` — 4/4 tests pass (schema, topic tree with 3–40 items per leaf and empty parents, KaTeX rendering of every field, editor quality warnings).
