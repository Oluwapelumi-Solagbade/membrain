import sys
from membrain.simulate import generate_cohort
from membrain.validation import analyse
n=int(sys.argv[1]) if len(sys.argv)>1 else 600
s=analyse(generate_cohort(n, seed=7))["summary"]; o=s["overall"]
print({k:o[k] for k in ["completion_unaided","test_retest_icc","practice_effect_z"]})
for k in ["membrain","usual_care","baseline_stratified","baseline_naive","change_detection"]:
    d=o[k]; print(f"{k:20s}", {x:d[x] for x in ["tp","fp","fn","sensitivity","specificity","ppv","referrals_per_confirmed"]})
print(s["time_to_assessment_weeks"]); print(s["confounder_rule_ablation"]); print(s["workload"])
