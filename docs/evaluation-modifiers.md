# Evaluation modifier defaults

`BillSubmissionForm` supports `qme`, `ame`, `psych_qme`, and `psych_ame` evaluation types. The selector combines evaluator role with psychiatric or psychological evaluation status:

| Evaluation type | ML201, ML202, ML203 | ML200 and MLPRR |
| --- | --- | --- |
| QME | 95 | 95 |
| AME | 94 | None |
| Psych QME | 95, 96 | 95 |
| Psych AME | 94, 96 | None |

Switching evaluation type replaces modifiers 94, 95, and 96 while preserving other selected modifiers. Psychiatric multipliers do not apply to missed appointments or record-review lines. The initial selection considers both the rendering provider's specialty and `isAme` flag. Both psychiatric modes seed `Z04.6` only when no diagnosis was supplied.

These defaults follow [California 8 CCR section 9795](https://www.dir.ca.gov/t8/9795.html). Modifier 96 applies when psychiatric or psychological evaluation is the primary focus. The user should select the mode appropriate to the actual evaluation.
