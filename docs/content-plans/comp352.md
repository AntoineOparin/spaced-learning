# COMP 352 · Data Structures & Algorithms — content plan

Deck file: `src/content/decks/comp352.json` (deck id `comp352-core`, course key `comp352`).

## Course summary

COMP 352 (Concordia, Fall 2026; coordinator Dr. Aiman Hanna, sections by Popa, Mellah, Pankratov) follows Goodrich–Tamassia–Goldwasser, *Data Structures and Algorithms in Java*, 6th ed., with Java 8+ for programming assignments and pseudocode for written ones. The term runs: introduction and algorithm analysis (ch. 4, weeks 1–2), recursion (ch. 5, week 2), arrays/stacks/queues (ch. 3 & 6, week 3), lists (ch. 3 & 7, week 4), trees (ch. 8, weeks 5–6), priority queues and heaps (ch. 9, weeks 6–7), maps and hash tables (ch. 10, weeks 8–9), search trees and sorting (ch. 11–12, weeks 9–10), graphs (ch. 14, weeks 10–12). Grading is midterm 30% (Sat Oct 31) + final 60% + two AI-supported research reports 10%, with mandatory assignments (up to 20% deduction) and a 5% AI.S bonus. Exams mix multiple choice with negative marking, detailed-answer questions, and true/false with short justification, so the deck weights definitions, Big-O bounds and proofs, loop/recursion analysis, operation costs per structure and "which structure when" decisions.

## Outline

Ten top-level topics in course order, each with 2–5 leaf subtopics. "Source" names the slides used; **ahead** = written from textbook knowledge because no lecture slides exist yet (items carry the `ahead` tag so the student can activate them as lectures arrive).

| Top-level topic | Subtopic (key) | Source | Items |
|---|---|---|---|
| **Algorithm Analysis** (39) | Algorithms, Pseudocode & Design (`analysis-intro`) | Slides 01.1 (week 1) | 5 |
| | Worst Case & Counting Operations (`analysis-worstcase`) | Slides 01.2 p.2–8 | 6 |
| | Big-O, Ω, Θ: Definitions & Proofs (`analysis-bigo`) | Slides 01.2 p.9–16; MidtermPrep p.2 | 11 |
| | Growth Rates & Shorthand Rules (`analysis-rules`) | Slides 01.2 p.12–19; MidtermPrep p.2–3; 1 item general (log base) | 9 |
| | Analysing Loops & Code (`analysis-loops`) | MidtermPrep p.4–7 (loop exercises) | 8 |
| **Recursion** (28) | Structure & Types (`recursion-basics`) | Slides 02.1.1, 02.1.2 p.2–6, 02.1.3 p.2–5 | 8 |
| | Classic Recursive Algorithms (`recursion-examples`) | Slides 02.1.1 p.10–12, 02.1.2 p.7–19, 02.1.3 p.11–12, 03.1.3 p.7–8 | 12 |
| | Analysing & Removing Recursion (`recursion-analysis`) | Slides 02.1.2 p.17, 02.1.3 p.5–10; 2 items general (stack depth, common recurrences) | 8 |
| **Arrays, ADTs, Stacks & Queues** (39) | Memory Model & Arrays (`arrays-memory`) | Slides 03.1.1, 03.1.2 | 7 |
| | Abstract Data Types & Interfaces (`arrays-adt`) | Slides 03.1.3, 03.1.4 p.7 | 5 |
| | Data Structure Principles & Java Collections (`arrays-principles`) | Slides 03.1.4; CPP_STL_to_Java_Collections | 13 |
| | Stacks (`arrays-stacks`) | Slides 03.1.4 p.10; MidtermPrep p.9–11; 2 items **ahead** (array stack, reverse with stack) | 7 |
| | Queues & Deques (`arrays-queues`) | Slides 03.1.4 p.10–11; MidtermPrep p.12; 1 item **ahead** (deque) | 7 |
| **Lists** (16) | Singly Linked Lists (`lists-singly`) | **ahead** (ch. 3.2) | 5 |
| | Doubly & Circularly Linked Lists (`lists-doubly`) | **ahead** (ch. 3.3–3.4) | 4 |
| | Array Lists, Amortization & Positional Lists (`lists-arraylist`) | MidtermPrep p.13 (amortized growth), Slides 03.1.4 p.13; rest **ahead** (ch. 7) | 7 |
| **Trees** (24) | Tree Terminology (`trees-terminology`) | MidtermPrep p.14; 2 items **ahead** | 7 |
| | Binary Trees & Properties (`trees-binary`) | MidtermPrep p.15; 4 items **ahead** | 7 |
| | Traversals (`trees-traversal`) | MidtermPrep p.16–19; 2 items **ahead** | 7 |
| | Tree Representations (`trees-impl`) | **ahead** (ch. 8.3) | 3 |
| **Priority Queues & Heaps** (14) | Priority Queue ADT (`heaps-pq`) | **ahead** (ch. 9.1–9.2) | 4 |
| | Heaps (`heaps-heap`) | **ahead** (ch. 9.3) | 6 |
| | Heap-Sort & Adaptable PQs (`heaps-sort`) | **ahead** (ch. 9.4) | 4 |
| **Maps & Hash Tables** (14) | Map ADT (`hashing-map`) | **ahead** (ch. 10.1) | 4 |
| | Hash Functions (`hashing-functions`) | **ahead** (ch. 10.2) | 4 |
| | Collisions & Load Factor (`hashing-collisions`) | **ahead** (ch. 10.2); cost row from Slides 03.1.4 p.13 | 6 |
| **Search Trees** (12) | Binary Search Trees (`searchtrees-bst`) | **ahead** (ch. 11.1) | 6 |
| | AVL Trees (`searchtrees-avl`) | **ahead** (ch. 11.2–11.3) | 6 |
| **Sorting** (15) | Merge-Sort (`sorting-mergesort`) | **ahead** (ch. 12.1) | 5 |
| | Quick-Sort (`sorting-quicksort`) | **ahead** (ch. 12.2) | 5 |
| | Lower Bound, Bucket & Radix Sort (`sorting-bounds`) | **ahead** (ch. 12.3–12.4) | 5 |
| **Graphs** (20) | Graph Terminology (`graphs-basics`) | **ahead** (ch. 14.1) | 5 |
| | Graph Data Structures (`graphs-structures`) | **ahead** (ch. 14.2) | 4 |
| | DFS & BFS (`graphs-traversal`) | **ahead** (ch. 14.3) | 5 |
| | Topological Sort, Shortest Paths & MST (`graphs-paths`) | **ahead** (ch. 14.5–14.7) | 6 |

Totals: 221 items, 45 topics (10 parents, 35 leaves), 76 cloze (34%), 176 with explanations, 102 tagged `ahead`. Checker (`DECK=src/content/decks/comp352.json npx vitest run test/deck-file.test.ts`): 4/4 tests pass.

## Conventions chosen

- **Big-O definition.** The course's own slide (01.2 p.9) writes "$c > 0$, $n_0 \ge 0$, for all $n \ge n_0$"; the textbook examples reused on p.14–16 write $n_0 \ge 1$; the midterm-prep slide writes $n_0 > 0$ and $n > n_0$. Items use $c > 0$, $n_0 \ge 1$ (the form in every worked example) and the explanation notes the variants. $\Omega$ and $\Theta$ follow MidtermPrep p.2.
- **Operation counts.** `arrayMax` is given as the slides' "worst case ≈ $8n - 3$" (01.2 p.8), not the textbook's count; the item says so.
- **Cost table.** Operation costs for `array`, `ArrayList`, `LinkedList`, `HashMap/HashSet`, `TreeMap/TreeSet`, `ArrayDeque` are copied from Slides 03.1.4 p.13 exactly, including the "amortized at the end" and "at the ends" qualifiers and the "average case; hashing assumes a good spread" caveat.
- **Java names.** Stack/queue operations use the course's `push/pop` and `offer/poll` (03.1.4 p.10); heap items name `java.util.PriorityQueue`; STL ↔ Java mapping follows the CPP_STL_to_Java_Collections handout.
- **Recursion vocabulary.** "Linear / tail / binary recursion", "the two caveats", "recursion pipeline" and "estimate work per call × number of calls, then prove by induction" are the slides' phrasing (02.1.2 p.3, 02.1.3 p.8–9).
- **Loop analysis.** The MidtermPrep loop snippets (p.4–7) were turned into items on the *patterns* they illustrate (constant step vs multiplicative step, triangular sums, unreachable `break`, "correct but not tight" answers), not copied as questions.
- **Sources** cite `Slides <deck> p.<n>` using the PDF page numbers; MidtermPrep cites `Slides MidtermPrep p.<n>`.
- **Keys** are prefixed by a short form of the subtopic (`bigo-`, `recex-`, `principles-`, `heap-`, …); topic keys are `<unit>-<subtopic>`.
- Items the assignments hint at (space complexity including the system stack, stack depth vs call count, iterative vs recursive array reversal, tail-recursive Fibonacci) were written as general items; no assignment question was reproduced.

## Verification against page images

Every item with a `source` was checked against the rendered page PNGs for the pages that carry notation, code or tables: 01.2 p.2, 3, 8–14, 16, 17, 19; 02.1.1 p.11–12; 02.1.2 p.7, 11–13, 15–16, 18–19; 02.1.3 p.7, 10, 12; 03.1.1 p.6; 03.1.2 p.5; 03.1.3 p.7–8; 03.1.4 p.4, 11, 13; MidtermPrep p.2–7, 9–16, 18–19. Text-only pages (01.1 all; 01.2 p.4–6, 18, 20; 02.1.x prose pages; 03.1.3 p.4–6, 10; 03.1.4 p.2–3, 5–10, 12, 14; CPP_STL handout) were taken from the extracted text, which matched the images wherever both were compared. One correction came out of this pass: the Java `binarySearch` listing is on the ADT slides (03.1.3 p.7–8, where `int[]`, `==` and `<` are circled), so that item now cites those pages alongside 02.1.1 p.11.

## Items I was unsure about

- `loops-break-constant` / `loops-unreachable-break`: the MidtermPrep loop snippets with `if (j == 1000000) break;` are given without answers. I used the strict mathematics (a reachable break at a constant makes the inner loop $O(1)$, so the nest is $O(n)$; an unreachable break, e.g. an odd target with `j += 2`, leaves it $O(n^2)$). If the instructor's intended answer is "ignore constants, still $O(n^2)$", these two items need rewording.
- `loops-correct-not-tight`: the `k = k + 2` pseudocode on MidtermPrep p.7. I reasoned that `k` takes values $\equiv 2 \pmod 3$ so the `break` never fires, the loop is $\Theta(n^3)$, and the only correct option is $\Omega(n^2 \log n)$. No answer key was available.
- `rules-transitivity` explanation says the slide's second "prove that $h(n)$ is not $O(f(n))$" exercise (01.2 p.17) is false in general ($f = g = h$). That is mathematically certain, but the slide phrases it as something to prove.
- `treeterm-ancestor-descendant`: the slide lists ancestors as parent, grandparent, …; the textbook also counts a node as its own ancestor. The item notes both; depth follows the slide ("number of ancestors", root depth 0).
- `memory-ram-model`: Slides 03.1.1 p.8 claim "int takes 64 bits (8 bytes) on modern architecture"; this is not true of Java `int` (32 bits), so it was left out rather than contradicted.
- The MidtermPrep slides (p.14–19) preview trees and heaps before the lectures; tree items that come from them are cited and not tagged `ahead`, while the rest of the Trees unit is `ahead`.

## Subtopics written from general knowledge (`ahead`)

Entire units: Lists (all three subtopics, except the amortized-growth items from MidtermPrep p.13), Priority Queues & Heaps, Maps & Hash Tables, Search Trees, Sorting, Graphs; plus `trees-impl`, parts of `trees-terminology`, `trees-binary`, `trees-traversal`, and three stack/queue items (array stack, reversing with a stack, deque). All follow Goodrich–Tamassia–Goldwasser 6th ed. conventions (0-based level numbering for heaps, external placeholder nodes in BSTs, load-factor thresholds 0.9 / 0.5, MAD compression, Prim–Jarník and Kruskal) and should be re-checked against the lecture slides when they are posted.
