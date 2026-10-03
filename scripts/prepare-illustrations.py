#!/usr/bin/env python3
"""Prepare attributed illustration jobs from the public exercise catalog.

This script only reads public/catalog.json and writes review artifacts under
work/. It does not execute catalog-generation code or contact image services.
"""

from __future__ import annotations

import json
import re
import hashlib
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "public" / "catalog.json"
JOBS_PATH = ROOT / "work" / "illustration-jobs.json"
AUDIT_PATH = ROOT / "work" / "illustration-data-audit.json"
RESOLUTIONS_PATH = ROOT / "work" / "illustration-review-resolutions.json"

PLACEHOLDER_PATTERNS = (
    re.compile(r"\bview the video\b", re.I),
    re.compile(r"\bsee the video\b", re.I),
    re.compile(r"\bwatch the video\b", re.I),
)

# Only literal qualifiers present in the catalog name are copied into this
# field. Keeping them verbatim avoids normalizing away meaningful variants.
VARIANT_PATTERNS = (
    r"\b(?:single|one)[- ](?:arm|hand|leg|foot|side)\b",
    r"\b(?:one[- ]hand|one[- ]legged|single[- ]leg)\b",
    r"\b(?:left|right|alternating|unilateral|bilateral)\b",
    r"\b(?:assisted|negative|eccentric|isometric|weighted|unweighted)\b",
    r"\b(?:incline|decline|flat|flat[- ]bench|low[- ]incline|high[- ]incline)\b",
    r"\b(?:wide[- ]grip|close[- ]grip|narrow[- ]grip|neutral[- ]grip|parallel[- ]grip|reverse[- ]grip|underhand|overhand|supinated|pronated)\b",
    r"\b(?:behind[- ]the[- ]neck|chest[- ]supported|feet[- ]elevated|legs[- ]up|kneeling|half[- ]kneeling|seated|standing|lying|supine|prone)\b",
    r"\b(?:with|on) (?:a )?(?:band|bench|machine|ball|box|cable|rope|bar|barbell|dumbbells?|kettlebell|plates?)\b",
    r"\b(?:rotating|rotation|twist|tempo|pause|deficit|partial|full[- ]range)\b",
    r"\b(?:[vV]\.? ?\d+|version ?\d+|\d+[- ](?:arm|leg|point))\b",
)
VARIANT_RE = re.compile("|".join(f"(?:{p})" for p in VARIANT_PATTERNS), re.I)

# Names without any recognizable action/root remain reviewable even if their
# prose is long. This is a conservative vocabulary, not an exercise ontology.
KNOWN_MOVEMENT_RE = re.compile(
    r"\b(?:squat|lunge|deadlift|hinge|row|press|push[- ]?up|pull[- ]?up|"
    r"chin[- ]?up|pulldown|pull[- ]?down|curl|raise|fly|dip|crunch|sit[- ]?up|"
    r"plank|bridge|thrust|extension|flexion|rotation|rotate|twist|stretch|"
    r"abduction|adduction|kickback|kick[- ]?back|calf raise|heel raise|hang|"
    r"hold|carry|walk|run|jog|swim|cycle|bike|jump|skip|hop|step[- ]?up|"
    r"step[- ]?down|climb|crawl|throw|swing|roll|mobility|breath|breathing|"
    r"balance|pose|stance|press|shrug|extension|roller|kick|march|wrist|ankle|"
    r"neck|hip|shoulder|back|chest|abdominal|core|leg|arm|calf|toe|finger|"
    r"forearm|quad|hamstring|bicep|tricep|glute|lat|trap|deltoid|oblique)\b",
    re.I,
)
MECHANICS_RE = re.compile(
    r"\b(?:stand|sit|lie|lay|kneel|hang|hold|place|position|grip|grasp|"
    r"extend|bend|flex|rotate|turn|twist|pull|push|press|curl|raise|lift|"
    r"lower|move|bring|reach|step|walk|run|jump|squat|lunge|hinge|lean|"
    r"swing|roll|kick|cross|brace|contract|straighten|return|start|begin|"
    r"keep|maintain|exhale|inhale|reach|balance|drive|descend|ascend|"
    r"swim|pedal|cycle|climb|extend|retract|abduct|adduct|flex|rotate)\b",
    re.I,
)
EXPLICIT_GEAR = {
    "barbell": {"barbell"},
    "dumbbell": {"dumbbell"},
    "dumbbells": {"dumbbell"},
    "kettlebell": {"kettlebell"},
    "band": {"band"},
    "cable": {"cable"},
    "smith": {"smith"},
    "ez-bar": {"ez_bar"},
    "ez bar": {"ez_bar"},
    "trap bar": {"trap_bar"},
    "medicine ball": {"medicine_ball"},
    "foam roller": {"foam_roller"},
    "ab wheel": {"ab_wheel"},
    "pull-up bar": {"pullup_bar"},
    "pull up bar": {"pullup_bar"},
    "dip bars": {"dip_bars"},
    "parallel bars": {"dip_bars"},
    "bench": {"bench", "preacher_bench"},
    "box": {"box"},
}
OPPOSING_QUALIFIERS = (
    (r"\bwide(?:[- ]grip)?\b", r"\bnarrow|close(?:[- ]grip)?\b", "wide_vs_narrow_grip"),
    (r"\bnarrow|close(?:[- ]grip)?\b", r"\bwide(?:[- ]grip)?\b", "narrow_vs_wide_grip"),
    (r"\bincline\b", r"\bdecline\b", "incline_vs_decline"),
    (r"\bdecline\b", r"\bincline\b", "decline_vs_incline"),
    (r"\bunderhand|supinated\b", r"\boverhand|pronated\b", "underhand_vs_overhand_grip"),
    (r"\boverhand|pronated\b", r"\bunderhand|supinated\b", "overhand_vs_underhand_grip"),
)


def instruction_text(exercise: dict) -> str:
    original = exercise.get("originalInstructions")
    if not isinstance(original, dict):
        return ""
    text = original.get("text", "")
    return text.strip() if isinstance(text, str) else ""


def review_reasons(exercise: dict) -> list[str]:
    text = instruction_text(exercise)
    reasons: list[str] = []
    if not text:
        reasons.append("missing_source_instructions")
    if text and any(p.search(text) for p in PLACEHOLDER_PATTERNS):
        reasons.append("video_placeholder_without_written_mechanics")
    # Short entries often name equipment or a broad motion only, which cannot
    # establish two distinct, exercise-specific positions reliably.
    if text and len(text) < 45:
        reasons.append("source_instructions_too_brief_for_two_panels")
    # A sentence that only gives duration/distance/intensity may identify the
    # activity without grounding the body position or action to depict.
    if text and re.fullmatch(
        r"\s*(?:\d+\s*(?:m|meters?|minutes?|seconds?|reps?)\b.*|"
        r"(?:hold|perform|do|repeat)\s+(?:for|as long as|the exercise|a timed).*?)\s*",
        text,
        re.I | re.S,
    ):
        reasons.append("instructions_name_duration_or_generic_action_only")
    if text and not MECHANICS_RE.search(text):
        reasons.append("source_describes_target_or_activity_without_body_mechanics")
    if exercise.get("needsReview"):
        reasons.append("catalog_needs_review")
    gear = set(exercise.get("equipment", []))
    if "unknown" in gear or "unknown" in exercise.get("equipment", []):
        reasons.append("unknown_equipment")
    if exercise.get("movement") == "other" and not KNOWN_MOVEMENT_RE.search(exercise["name"]):
        reasons.append("obscure_or_unresolved_movement_name")

    name = exercise["name"].casefold()
    for gear_term, accepted_gear in EXPLICIT_GEAR.items():
        if re.search(rf"\b{re.escape(gear_term)}\b", name) and not (gear & accepted_gear):
            reasons.append(f"name_gear_mismatch:{gear_term.replace(' ', '_')}")
    if text:
        for gear_term, accepted_gear in EXPLICIT_GEAR.items():
            if re.search(rf"\b{re.escape(gear_term)}\b", text, re.I) and not (gear & accepted_gear):
                reasons.append(f"instruction_gear_mismatch:{gear_term.replace(' ', '_')}")
        for name_pattern, text_pattern, reason in OPPOSING_QUALIFIERS:
            if re.search(name_pattern, name, re.I) and re.search(text_pattern, text, re.I):
                reasons.append(f"qualifier_contradiction:{reason}")
        if re.search(r"\b(?:single|one)[- ](?:arm|hand)\b", name, re.I) and re.search(r"\b(?:both arms|both hands|with both hands)\b", text, re.I):
            reasons.append("qualifier_contradiction:unilateral_vs_bilateral_arms")
        if re.search(r"\b(?:single|one)[- ](?:leg|foot)\b", name, re.I) and re.search(r"\b(?:both legs|both feet)\b", text, re.I):
            reasons.append("qualifier_contradiction:unilateral_vs_bilateral_legs")
        if re.search(r"\bassisted\b", name, re.I) and re.search(r"\bunassisted\b", text, re.I):
            reasons.append("qualifier_contradiction:assisted_vs_unassisted")
    # Keep output deterministic and avoid duplicate reasons from overlapping
    # gear aliases.
    reasons = list(dict.fromkeys(reasons))
    return reasons


def source_records(exercise: dict) -> list[dict]:
    return [
        {
            "source": item.get("source", ""),
            "sourceId": item.get("sourceId", ""),
            "name": item.get("name", ""),
            "url": item.get("url", ""),
            "license": item.get("license", ""),
            "author": item.get("author", ""),
        }
        for item in exercise.get("sources", [])
    ]


def make_job(exercise: dict, equipment_labels: dict) -> dict:
    original = exercise.get("originalInstructions")
    original = original if isinstance(original, dict) else None
    text = instruction_text(exercise)
    reasons = review_reasons(exercise)
    qualifiers = list(dict.fromkeys(m.group(0) for m in VARIANT_RE.finditer(exercise["name"])))
    gear = exercise.get("equipment", [])
    review = bool(reasons)

    source_text = text if text else None
    prompt = (
        f'Create one original, clean educational exercise illustration for "{exercise["name"]}". '
        "Show two side-by-side panels: setup/preparation on the left and the supported action position on the right. "
        f"Use only this gear: {', '.join(gear) if gear else 'none specified'}. "
        "Preserve every name qualifier and the exact movement distinction; do not substitute a generic family pose. "
        "Use a plain background, a consistent fully clothed adult figure, and no labels, logos, or decorative text. "
        "Do not impose the rigid rule that knees must never pass toes; use a neutral spine and natural knee tracking only where supported by the source. "
        f"Source instructions (preserve their supported mechanics): {source_text if source_text else '[none provided]'}."
    )
    if review:
        prompt += (
            " Source mechanics are insufficient: do not invent a detailed movement sequence; "
            "hold this job for human/model review and depict only details explicitly established by its name and source record."
        )

    return {
        "exerciseId": exercise["id"],
        "name": exercise["name"],
        "gear": [
            {"id": item, "label": equipment_labels.get(item, item)} for item in gear
        ],
        "sourceOriginalInstructions": original,
        "sourceText": source_text,
        "attribution": {
            "exerciseSources": source_records(exercise),
            "instructionSource": (
                {
                    "source": original.get("source", ""),
                    "license": original.get("license", ""),
                    "url": original.get("url", ""),
                }
                if original
                else None
            ),
        },
        "variantConstraints": {
            "exactName": exercise["name"],
            "nameQualifiers": qualifiers,
            "mustRemainDistinctFromOtherVariants": True,
            "gearIds": list(gear),
        },
        "generationPrompt": prompt,
        "status": "pending",
        "preparationReadiness": "needs_review" if review else "ready",
        "humanReviewed": False,
        "imageGenerated": False,
        "reviewReasons": reasons,
    }


def choose_edge_cases(exercises_by_id: dict[str, dict]) -> list[dict]:
    # Deliberately cover different review failure modes and potentially
    # misleading variant/equipment combinations observed in this catalog.
    picks = [
        ("ex_48ae3663ca3c65", "Abdominal Stabilization", "No written instructions; abstract exercise name does not ground body positions.", "wger", "56"),
        ("ex_89823f2ad3154f", "Ankle Roll", "Instructions point to a video and provide no written mechanics.", "wger", "1864"),
        ("ex_b495c65d7fb828", "Around The World", "Ambiguous name with no instructions; several unrelated movements use this name.", "liftosaur", "aroundTheWorld_dumbbell"),
        ("ex_0d9b92d6e4a7c6", "Assisted Squat", "Assisted variant has no instructions identifying the assistance method or setup.", "liftosaur", "assistedSquat_bodyweight"),
        ("ex_e0a9dc766f137d", "Behind The Neck Press", "Behind-the-neck path is a safety- and angle-sensitive named variation with no instructions.", "liftosaur", "behindTheNeckPress_barbell"),
        ("ex_196ea831ea1a86", "Bench Press", "Bench press record lists kettlebell and bench; source mechanics are absent, so implement details are unclear.", "liftosaur", "benchPress_kettlebell"),
        ("ex_2c4a83f4b63f07", "Cable Twist", "Same broad name occurs with different gear combinations; movement direction and stance need review.", "liftosaur", "cableTwist_barbell"),
        ("ex_07bdd0292dbc38", "Schwimmen", "Distance/time statement identifies a swim workout but not a stroke or two-panel action.", "wger", "1574"),
        ("ex_22aab1ae4b0afe", "Arch Hang", "Arch hang has no instructions and the exact body shape is technically specific.", "liftosaur", "archHang_bodyweight"),
        ("ex_ca314ab409fd48", "Dumbbells on Scott Machine", "Name and gear do not clarify the machine configuration or arm path.", "wger", "208"),
        ("ex_c343adc4008e3c", "Pendular hack", "Obscure machine name and short instruction do not establish setup or movement path.", "wger", "1521"),
        ("ex_7b4f9aab00b483", "weighted round arm", "Obscure weighted movement name; insufficient source detail to infer the action.", "dataset", "0844"),
        ("ex_161197cd72debc", "Wall-Hold Rotation", "Water-based wall hold has ambiguous body orientation and movement in the short source text.", "wger", "2483"),
        ("ex_b00cb8f7de8681", "Kneeling Pulldown", "Kneeling pulldown lacks instructions; knee position and band/cable setup are unresolved.", "liftosaur", "kneelingPulldown_band"),
        ("ex_b25e8b3c45d161", "L Hold", "Source says to hold an L position but does not specify support, grip, or leg position.", "wger", "382"),
    ]
    result = []
    for exercise_id, expected_name, reason, source_name, source_id in picks:
        exercise = exercises_by_id.get(exercise_id)
        if exercise is not None and (
            exercise["name"] != expected_name
            or not any(
                source.get("source") == source_name and source.get("sourceId") == source_id
                for source in exercise.get("sources", [])
            )
        ):
            exercise = None
        if exercise is None:
            # Catalog IDs are hashes of the grouping key and can move after
            # data repair. Fall back only to the retained exact name plus
            # source identity; never silently substitute a namesake.
            matches = [
                item for item in exercises_by_id.values()
                if item["name"] == expected_name
                and any(
                    source.get("source") == source_name
                    and source.get("sourceId") == source_id
                    for source in item.get("sources", [])
                )
            ]
            if len(matches) != 1:
                raise ValueError(
                    f"Cannot uniquely resolve audit edge case {expected_name!r} "
                    f"by stored name/source identity {source_name}:{source_id}; found {len(matches)}"
                )
            exercise = matches[0]
        original = exercise.get("originalInstructions") or None
        result.append(
            {
                "exerciseId": exercise_id,
                "name": exercise["name"],
                "reviewReason": reason,
                "sourceOriginalInstructions": original,
                "sourceAttribution": source_records(exercise),
            }
        )
    return result


def normalized_exact_name(name: str) -> str:
    """Normalize punctuation/case only; retain every meaningful qualifier."""
    return re.sub(r"[^a-z0-9]+", " ", name.casefold()).strip()


def prepare_missing_instruction_resolutions(exercises: list[dict]) -> dict:
    """Find only exact-name, exact-gear evidence for missing instruction rows."""
    by_exact_name_and_gear: dict[tuple[str, tuple[str, ...]], list[dict]] = {}
    for exercise in exercises:
        key = (
            normalized_exact_name(exercise["name"]),
            tuple(sorted(exercise.get("equipment", []))),
        )
        by_exact_name_and_gear.setdefault(key, []).append(exercise)

    rows = []
    for exercise in exercises:
        if instruction_text(exercise):
            continue
        key = (
            normalized_exact_name(exercise["name"]),
            tuple(sorted(exercise.get("equipment", []))),
        )
        supported_by = []
        for candidate in by_exact_name_and_gear.get(key, []):
            if candidate["id"] == exercise["id"] or not instruction_text(candidate):
                continue
            # The candidate must itself have usable instruction grounding.
            if review_reasons(candidate):
                continue
            supported_by.append(
                {
                    "exerciseId": candidate["id"],
                    "exactName": candidate["name"],
                    "gearIds": list(candidate.get("equipment", [])),
                    "sourceOriginalInstructions": candidate.get("originalInstructions"),
                    "sourceAttribution": source_records(candidate),
                    "compatibilityBasis": "punctuation/case-normalized exact name and identical gear ID set",
                }
            )
        rows.append(
            {
                "exerciseId": exercise["id"],
                "name": exercise["name"],
                "gearIds": list(exercise.get("equipment", [])),
                "resolution": "supported_by_exact_match" if supported_by else "no_safe_exact_match_found",
                "supportedBy": supported_by,
                "borrowingPolicy": (
                    "Evidence is advisory and attributed to the candidate record. Do not merge or replace the missing source field. "
                    "Only punctuation/case-normalized exact exercise names and identical gear sets qualify; angle, grip, assistance, "
                    "laterality, and weight qualifiers remain part of the exact name."
                ),
            }
        )
    return {
        "schemaVersion": 1,
        "generatedFrom": "public/catalog.json",
        "matchingPolicy": "Exact normalized name (case/punctuation only) plus identical gear IDs; variants and qualifiers are never stripped.",
        "missingInstructionCount": len(rows),
        "supportedCount": sum(row["resolution"] == "supported_by_exact_match" for row in rows),
        "noSafeMatchCount": sum(row["resolution"] == "no_safe_exact_match_found" for row in rows),
        "jobs": rows,
    }


def main() -> None:
    data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    exercises = data["exercises"]
    equipment_labels = data.get("equipment", {})
    jobs = [make_job(exercise, equipment_labels) for exercise in exercises]
    reviews_path = ROOT / "work" / "illustration-reviews.json"
    reviews = json.loads(reviews_path.read_text()) if reviews_path.exists() else {}
    approved = 0
    for job in jobs:
        review = reviews.get(job["exerciseId"], {})
        if review.get("status") != "approved":
            continue
        image = (ROOT / review["imagePath"]).resolve()
        if not image.is_relative_to((ROOT / "public" / "illustrations").resolve()) or not image.is_file():
            continue
        if hashlib.sha256(image.read_bytes()).hexdigest() != review.get("sha256"):
            continue
        job.update(status="approved", visualReviewed=True, imagePath=review["imagePath"], reviewer=review["reviewer"])
        approved += 1
    pending = len(jobs) - approved
    status_counts = Counter(job["preparationReadiness"] for job in jobs)
    reason_counts = Counter(reason for job in jobs for reason in job["reviewReasons"])
    with_text = sum(bool(instruction_text(exercise)) for exercise in exercises)
    instruction_sources = Counter(
        (exercise.get("originalInstructions") or {}).get("source", "missing")
        for exercise in exercises
        if instruction_text(exercise)
    )
    edge_cases = choose_edge_cases({exercise["id"]: exercise for exercise in exercises})
    resolutions = prepare_missing_instruction_resolutions(exercises)

    JOBS_PATH.parent.mkdir(parents=True, exist_ok=True)
    JOBS_PATH.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "generatedFrom": "public/catalog.json",
                "jobCount": len(jobs),
                "pendingCount": pending,
                "approvedCount": approved,
                "preparationReadyCount": status_counts["ready"],
                "needsReviewCount": status_counts["needs_review"],
                "jobs": jobs,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    audit = {
        "schemaVersion": 1,
        "generatedFrom": "public/catalog.json",
        "catalogExerciseCount": len(exercises),
        "originRecordCount": data.get("meta", {}).get("inputTotal"),
        "originSourceCounts": data.get("meta", {}).get("inputCounts", {}),
        "instructionAvailability": {
            "withNonemptyOriginalInstructions": with_text,
            "missingOriginalInstructions": len(exercises) - with_text,
            "nonemptyInstructionSourceCounts": dict(sorted(instruction_sources.items())),
        },
        "jobReadiness": {
            "pendingJobs": pending,
            "visuallyApprovedJobs": approved,
            "preparationReady": status_counts["ready"],
            "needsReview": status_counts["needs_review"],
            "reviewReasonCounts": dict(sorted(reason_counts.items())),
            "classificationNote": (
                "Jobs remain pending unless a matching image hash has recorded visual approval. Preparation readiness is an automated gate only, never a human-reviewed or image-approved state. "
                "Needs review includes catalog review flags, unknown or contradictory gear/qualifiers, "
                "unclear movement names, absent/placeholder/brief instructions, and descriptions without mechanics. "
                "Visual approvals record the AI reviewer separately; humanReviewed remains false unless a human reviews the image."
            ),
        },
        "missingInstructionResolution": {
            "supportedByExactNameAndCompatibleGear": resolutions["supportedCount"],
            "noSafeExactMatchFound": resolutions["noSafeMatchCount"],
            "policy": resolutions["matchingPolicy"],
        },
        "edgeCasesForHumanOrModelReview": edge_cases,
    }
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    RESOLUTIONS_PATH.write_text(
        json.dumps(resolutions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"catalogExercises": len(jobs), "pendingJobs": pending, "approvedJobs": approved, "preparationReady": status_counts["ready"], "needsReview": status_counts["needs_review"], "instructionsPresent": with_text, "instructionsMissing": len(exercises) - with_text, "missingInstructionExactGearMatches": resolutions["supportedCount"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
