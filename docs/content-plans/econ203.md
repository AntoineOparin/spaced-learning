# ECON 203 · Introduction to Macroeconomics — content plan

Deck: `src/content/decks/econ203.json` (`econ203-core`, version 1). Course key `econ203`.

## Course summary

ECON 203 (Concordia, Fall 2026, coordinated across sections; Desjardins and Kim for CC/RM1) is a one-term introduction to macroeconomics built on Ragan, *Macroeconomics*, 18th Canadian edition. It covers Chapters 4–16 and 19 in order: the key macro variables (output gap, unemployment, inflation, interest and exchange rates), national income accounting (GDP from the expenditure and income sides, real vs nominal, the deflator), the Keynesian aggregate-expenditure model with and without government and trade (consumption/saving functions, the simple multiplier $1/(1-z)$ with $z = MPC(1-t) - m$), the AD/AS model and the adjustment of factor prices that anchors output to $Y^*$, long-run growth (saving–investment, the Neoclassical model), money and fractional-reserve banking, Bank of Canada monetary policy and the transmission mechanism, inflation/disinflation, the NAIRU, government debt, and exchange rates with the balance of payments. Assessment is 8 MyLab labs (20%), a multiple-choice midterm on Chapters 4–10 (30%, Nov 8) and a cumulative multiple-choice final on Chapters 4–16 and 19 (50%); the outline stresses algebra, definitions, interpretation and multi-part questions, which is why the deck leans on formulas, directions of effects and confusable pairs.

## Outline

| Top-level topic | Subtopic (leaf) | Source | Items |
|---|---|---|---|
| What Macroeconomics Is About (Ch. 4) | Output, Output Gap & Business Cycle | Ch. 4 slides 3–7, 25–26 | 6 |
| | Employment, Unemployment & Productivity | Ch. 4 slides 8–12 (+ participation rate from general knowledge) | 6 |
| | Inflation & Interest Rates | Ch. 4 slides 14–18 (+ inflation-rate formula, general) | 7 |
| | Exchange Rates & Trade Flows | Ch. 4 slides 20–23 | 3 |
| Measuring National Income (Ch. 5) | Value Added & Double Counting | Ch. 5 slides 3–5 | 4 |
| | GDP from the Expenditure Side | Ch. 5 slides 6–12 | 6 |
| | GDP from the Income Side | Ch. 5 slides 13–15 | 4 |
| | Real vs Nominal GDP & the Deflator | Ch. 5 slides 17–20 (+ growth-rate formula, general) | 8 |
| | Omissions & Living Standards | Ch. 5 slides 21–23 (+ GDP vs GNP, general) | 3 |
| The Simplest Short-Run Macro Model (Ch. 6) | Consumption & Saving Functions | Ch. 6 slides 3–14 | 11 |
| | Investment & the AE Function | Ch. 6 slides 15–19 | 5 |
| | Equilibrium Income & the Simple Multiplier | Ch. 6 slides 20–27 | 8 |
| Adding Government & Trade (Ch. 7) | Government: Net Taxes & Budget Balance | Ch. 7 slides 3–6, 12 | 5 |
| | The Net Export Function | Ch. 7 slides 7–11 | 6 |
| | Multiplier with Taxes & Imports; Fiscal Policy | Ch. 7 slides 12–21 | 9 |
| Real GDP & the Price Level in the Short Run (Ch. 8) | The Aggregate Demand Curve | Ch. 8 slides 3–10 | 6 |
| | The Aggregate Supply Curve | Ch. 8 slides 11–13 | 4 |
| | Macro Equilibrium & AD/AS Shocks | Ch. 8 slides 14–22 | 6 |
| From the Short Run to the Long Run (Ch. 9) | Three Macroeconomic States | Ch. 9 slides 3–5 | 3 |
| | Factor-Price Adjustment & the Phillips Curve | Ch. 9 slides 7–11 | 5 |
| | Shocks & Long-Run Equilibrium | Ch. 9 slides 12–16 | 6 |
| | Fiscal Stabilization Policy | Ch. 9 slides 17–24 | 8 |
| Long-Run Economic Growth (Ch. 10) | Nature & Sources of Growth | Ch. 10 slides 4–8 (+ rule of 70, general) | 5 |
| | Saving, Investment & the Financial-Capital Market | Ch. 10 slides 11–14 | 6 |
| | The Neoclassical Growth Model | Ch. 10 slides 17–23 | 8 |
| | Endogenous Growth & Limits to Growth | Ch. 10 slides 24–29 | 4 |
| Money, Banking & Interest Rates (Ch. 11–12) **ahead** | Nature & Measures of Money | Ragan Ch. 11, general knowledge | 5 |
| | Fractional-Reserve Banking & Money Creation | Ragan Ch. 11, general knowledge | 6 |
| | Money Demand, Bonds & Interest Rates | Ragan Ch. 12, general knowledge | 5 |
| | The Monetary Transmission Mechanism | Ragan Ch. 12, general knowledge | 4 |
| Monetary Policy, Inflation & Unemployment (Ch. 13–15) **ahead** | Monetary Policy in Canada | Ragan Ch. 13, general knowledge | 6 |
| | Inflation & Disinflation | Ragan Ch. 14, general knowledge | 8 |
| | Unemployment Fluctuations & the NAIRU | Ragan Ch. 15, general knowledge | 7 |
| Government Debt & the Open Economy (Ch. 16, 19) **ahead** | Government Debt & Deficits | Ragan Ch. 16, general knowledge | 6 |
| | The Balance of Payments | Ragan Ch. 19, general knowledge | 3 |
| | Exchange-Rate Determination | Ragan Ch. 19, general knowledge | 6 |

Totals: 208 items, 10 top-level topics, 36 leaves; 77 cloze (37%), 131 basic (4 with `reverse`); 157 items with an explanation; 144 cite a slide; 56 tagged `ahead`.

Validation: `DECK=src/content/decks/econ203.json npx vitest run test/deck-file.test.ts` — all 4 tests pass.

Verification against slide images: every one of the 122 slide pages cited by the 144 sourced items was opened as a rendered PNG and compared with the item (formula, definition, numbers, direction of effect). See "Verified against the slide images" below for what changed.

## Conventions chosen

- **Variable names** follow the slides, including their own inconsistencies: $Y$ actual national income, $Y^*$ potential output, $Y_D$ disposable income, $C, I, G, X$; actual (as opposed to desired) values carry a subscript $a$ ($C_a, I_a, G_a, NX_a$). **Imports** are written $IM$ on the Ch. 4–6 slides and in every figure/table (Fig. 7-1, 7-2, 7-3), but $M$ on the Ch. 7 formula slides ($M = mY$, $NX = X - M$, $AE = C + I + G + X - M$); items cite whichever their slide uses and the import item says so. $T$ net tax revenue, $t$ net tax rate, $BB = T - G$ budget balance, $m$ marginal propensity to import, $c$ the MPC when it appears inside a formula (Ch. 7 and 9 slides), $z$ marginal propensity to spend out of national income, $sm$ the simple multiplier, $A$ autonomous expenditure, $S_{PVT}$ / $S_{GOV}$ / $NS$ private, public and national saving, $F_\theta$ the production function with $\theta$ = technology. Ahead chapters (no slides): $v$ target reserve ratio, $c$ cash-drain ratio (clashes with $c$ = MPC only across chapters), $u$ unemployment rate, $u^*$ NAIRU, $\pi$ inflation, $i$ nominal and $r$ real interest rate, $D$ government debt, $d$ debt-to-GDP ratio.
- **GDP identity**: $GDP = C_a + I_a + G_a + NX_a$ exactly as slide 5-10 writes it (Table 5-1 labels net exports $X - IM$); the income side is factor incomes + indirect taxes net of subsidies + depreciation (+ statistical discrepancy).
- **Output gap** $= Y - Y^*$ (negative = recessionary, positive = inflationary).
- **Unemployment rate** $u = U / LF \times 100$ with $LF = E + U$ (Ch. 4 slide 8). The **participation rate** ($LF$ / working-age population aged 15+) is not on the Ch. 4 slides; it is written from general knowledge because the brief asks for it and Ragan uses it in Ch. 15.
- **Price indexes**: GDP deflator $=$ nominal / real $\times 100$ (Ch. 5 slide 17); real GDP $=$ nominal / deflator $\times 100$; inflation $= (P_t - P_{t-1}) / P_{t-1} \times 100$ (general; the slides only define it in words). The deck follows the slides in distinguishing the deflator (prices of Canadian *production*) from the CPI (prices consumers *buy*).
- **Real interest rate** $=$ nominal $-$ inflation (Ch. 4 slide 18, no Fisher cross-term).
- **Exchange rate** is the Ragan/course definition: *Canadian dollars per unit of foreign currency*, so an **appreciation of the C\$ is a fall in the exchange rate**. Every exchange-rate item in the deck (Ch. 4, Ch. 7, Ch. 19) uses this direction; it is the single most error-prone convention in the course.
- **Keynesian model**: $APC = C/Y_D$, $MPC = \Delta C / \Delta Y_D$, $APC + APS = 1$, $MPC + MPS = 1$; equilibrium $AE = Y$; simple multiplier $sm = \Delta Y / \Delta A = 1/(1 - z)$ with $z = c$ in the closed no-government model and $z = (1 - t)c - m$ with government and trade (slides 7-13, 7-16, 7-21, 9-22); $T = tY$, $Y_D = (1 - t)Y$, $BB = T - G$; $NX = X - mY$. Worked numbers are the slides' own: $C = 30 + 0.8Y$, $I = 75$, $AE = 105 + 0.8Y$, $Y_0 = 525$ (Ch. 6); $t = 0.1$ turns $C = 30 + 0.8Y_D$ into $30 + 0.72Y$, and Figure 7-3 has $I = 75$, $G = 51$, $NX = 72 - 0.1Y$, $AE = 228 + 0.62Y$, $Y = 600$; the Canadian calibration on slide 7-16 is $c = 0.80$, $t = 0.25$, $m = 0.35$, so $z = 0.25$ and $sm = 1.3$. The simple multiplier is also the *horizontal* shift of AD (Ch. 8).
- **AD/AS**: AD slopes down for two reasons (real-wealth effect on $C$, relative-price effect on $NX$); a price change *shifts AE* but *moves along AD*; AD shocks move $P$ and $Y$ together, AS shocks move them oppositely; shocks are named positive/negative by their effect on $Y$.
- **Long-run growth**: $S_{PVT} = Y^* - T - C$, $S_{GOV} = T - G$, $NS = Y^* - C - G$ (slide 10-12); production function $GDP = F_\theta(L, K, H)$ with $\theta$ = technology (slide 10-17).
- **Money (ahead)**: money multiplier $1/v$ without cash drain, $1/(v + c)$ with it; $MV = PY$; primary deficit $= G - T$, total deficit $= G + iD - T$, $\Delta d = (r - g)d + $ primary-deficit ratio.
- **Markup**: `\$` for money, `\%` inside math, `\dfrac` for displayed fractions, cloze deletions placed inside `\dfrac{...}{{{c1::...}}}` where the formula itself is the thing to recall.

## Verified against the slide images

The slide PDFs embed their equation font without a usable encoding, so the first draft reconstructed every formula from the surrounding prose plus the Ragan textbook. A second pass then opened every cited slide as a rendered image (all 122 pages cited by the 144 sourced items) and compared each item with it. Every direction of effect, definition and number in the first draft was confirmed; the corrections were all notation or now-legible numbers:

- `gdp-expenditure-identity`: slide 5-10 writes $GDP = C_a + I_a + G_a + NX_a$ (actual-value subscripts), now used verbatim.
- `ae-investment-ae-function-example`, `ae-equilibrium-solve-example`: slide 6-18 writes $C = 30 + 0.8Y$ (not $Y_D$) and slide 6-22 / Table 6-1 confirm $Y_0 = 525$.
- `ae-equilibrium-multiplier-def`, `-formula`, `open-multiplier-g-change`: the slides name the simple multiplier $sm$ ($sm = \Delta Y/\Delta A = 1/(1 - z)$, "equilibrium income increases by $\Delta G$ times $sm$").
- `open-government-budget-balance`: $BB = T - G$.
- `open-trade-mpi`, `open-trade-nx-function`, `open-multiplier-ae-function`, `open-multiplier-z-formula`, `open-multiplier-comparative`, `adjust-fiscal-automatic-stabilizers`: Ch. 7 and Ch. 9 formula slides write imports as $M$ and the MPC as $c$: $M = mY$, $NX = X - M$, $AE = C + I + G + X - M$, $z = (1 - t)c - m$. Items switched to that notation; the Ch. 4–6 slides and all figures still use $IM$, which the import item points out.
- `open-multiplier-z-example` (rewritten) and `open-multiplier-smaller-why`: slide 7-16's Canadian calibration is now legible, $c = 0.80$, $t = 0.25$, $m = 0.35 \Rightarrow z = 0.25 \Rightarrow sm = 1/(1 - 0.25) = 1.3$. The earlier guessed example ($m = 0.1$, $sm \approx 2.6$) was replaced.
- `open-multiplier-figure-example` (new): Figure 7-3's table shows $C = 30 + 0.72Y$, $I = 75$, $G = 51$, $X - IM = 72 - 0.1Y$, $AE = 228 + 0.62Y$, equilibrium \$600 billion, so the full example can now be quoted with a source.
- `growth-saving-private/public/national`: $S_{PVT}$, $S_{GOV}$, $NS$ as on slide 10-12.
- `growth-neoclassical-production-function`: $GDP = F_\theta(L, K, H)$ with $\theta$ = technology (slide 10-17), not $F_T$.
- `macro-fx-exchange-rate-def`: the slide's wording ("amount of one currency needed to purchase one unit of another") is quoted, with the C\$-per-foreign-unit direction fixed by the slide's own appreciation/depreciation definition.
- `ae-consumption-example-apc` now also cites Figure 6-3 (slide 6-12), which plots exactly $C = 270$, $S = 30$ at $Y_D = 300$.

Slide typos found (the deck keeps the economically correct statement): slide 4-8 says "If $Y > Y^*$, there is positive cyclical unemployment" (should be $Y < Y^*$); slide 9-8 is titled "Output Above Potential, $Y < Y^*$" while its bullets describe output below potential; slide 7-13's last line reads "$AE$ = autonomous expenditure $- zY$" (should be $+ zY$); slide 4-6 lists the cycle phases as trough, recession, recovery, peak, while its figure runs trough → recovery → peak → recession (the deck follows the figure).

The 8 un-sourced items in slide-covered chapters (`macro-labour-participation-rate`, `macro-inflation-rate-formula`, `macro-inflation-real-rate-direction`, `gdp-expenditure-imports-sign`, `gdp-real-which-grew`, `gdp-real-growth-rate`, `gdp-omissions-gdp-vs-gnp`, `growth-basics-rule-of-70`) were checked too: none of them is stated on any slide, so they stay un-sourced (general knowledge that exams routinely test).

## Items still unverifiable (no slides yet) or otherwise uncertain

- `policy-boc-bank-rate` (bank rate at the top of the operating band): true under both the corridor and floor systems the Bank has used, but the band mechanics are described loosely on purpose. Verify against the Ch. 13 slides when they arrive.
- `policy-boc-lags` (18–24 months): Ragan's figure; the slides may quote a different range.
- `money-nature-m1-m2`: Ragan's official aggregates are M1+, M1++, M2, M2+, M2++; the item deliberately says "roughly" and only tests the narrow-vs-broad idea.
- `money-nature-boc-functions` explanation (seven-year Governor term, Crown corporation): institutional detail from general knowledge.
- `debt-deficits-ratio-dynamics`: the $\Delta d = (r - g)d + x$ form is Ragan's; the slides may present it with nominal rather than real rates.
- `policy-nairu-raises`, `policy-nairu-why-wages-sticky`: standard Ragan Ch. 15 lists; wording may differ from the slides.
- The 8 un-sourced general-knowledge items listed above.

No place was found where the slides contradict the textbook; the slides are a condensed copy of Ragan's chapter text.

## Subtopics written from general knowledge (tagged `ahead`)

No slides exist yet for these; items follow Ragan 18th ed. and should be re-checked against the slides when they are posted. The student can leave these topics inactive until the lectures reach them.

- `money-nature`, `money-banking`, `money-interest`, `money-transmission` (Ch. 11–12)
- `policy-boc`, `policy-inflation`, `policy-nairu` (Ch. 13–15)
- `debt-deficits`, `fx-bop`, `fx-exchange` (Ch. 16, 19)

Ch. 9's fiscal-policy subtopic and the Ch. 4 labour/inflation subtopics also contain a handful of general-knowledge items (listed above), but those chapters have slides, so they are not tagged `ahead`.
