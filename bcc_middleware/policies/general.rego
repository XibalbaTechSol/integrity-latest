package integrity.general

import rego.v1

# Xibalba Integrity Protocol -- GENERAL baseline policy gate.
#
# Worked example for docs/guides/multi-domain-guardrails-design.md: the
# mandatory, always-on bundle every agent's commitment is evaluated against,
# regardless of which regulated vertical (if any) it also belongs to -- the
# "floor everyone hits" (design doc §2.0). Not wired into bcc_middleware yet
# (see the design doc's §2.3 for the proposed evaluate_domains() plumbing);
# this file stands on its own today as a real, `opa test`-runnable bundle
# evaluable via `POST /v1/data/integrity/general` against any OPA server that
# loads this `policies/` directory, same as `integrity.bcc`.
#
# *** SAME SCHEMA CONSTRAINT AS bcc.rego ***
# The BCC Commitment schema (§4.2) never carries raw payload pre-execution --
# only agent_id, intent_type, intended_state_hash, nonce, timestamp (plus the
# healthcare-only covered_entity_address/agent_public_key/signature fields).
# So, like bcc.rego, this bundle can only reason structurally over those
# fields, plus defense-in-depth regex over the one free-text field an
# attacker fully controls: intent_type.

default allow := false

allow if {
	count(violation) == 0
}

# ---------------------------------------------------------------------------
# 1. Prompt-injection / control-token pattern rejection
# ---------------------------------------------------------------------------
# intent_type is attacker-controlled free text (same threat model bcc.rego's
# §3 documents for its own suspicious_patterns check). This is the general-
# domain analog: patterns that look like an attempt to smuggle a system-
# prompt override or role-token spoof into a label field that should only
# ever contain a short intent name. This is NOT a substitute for real
# prompt-injection defense inside an agent's own LLM context -- it is a
# structural check on the one field this gate ever sees, same scope
# limitation bcc.rego's header calls out for its own regex rules.
injection_patterns := {
	"ignore previous instructions": "possible system-prompt override attempt",
	"ignore all prior instructions": "possible system-prompt override attempt",
	"disregard all prior": "possible system-prompt override attempt",
	"disregard previous": "possible system-prompt override attempt",
	"you are now": "possible role-hijack/jailbreak attempt",
	"system prompt": "possible attempt to reference/override the system prompt",
	"<|im_start|>": "possible chat-control-token injection",
	"<|im_end|>": "possible chat-control-token injection",
	"[system]": "possible role-token spoofing",
}

violation contains msg if {
	some pattern, explanation in injection_patterns
	contains(lower(input.intent_type), pattern)
	msg := sprintf(
		"GENERAL_PROMPT_INJECTION_PATTERN: intent_type matches '%v' (%v)",
		[pattern, explanation],
	)
}

# ---------------------------------------------------------------------------
# 2. Structural nonce sanity (defense-in-depth over bcc_middleware's runtime
#    replay check, same "second, independent layer" principle bcc.rego uses
#    for its own regex checks on top of Python-side logic)
# ---------------------------------------------------------------------------
# nonce_store.py enforces true monotonic-per-agent replay protection at
# runtime (it has the state history this stateless policy doesn't). What
# this rule catches is a class nonce_store.py structurally can't: a nonce of
# exactly 0 used as a sentinel/placeholder value rather than a real
# monotonic counter -- a shape a naive or malicious client integration might
# send on its very first-ever request, before nonce_store.py has any prior
# value to compare against.
violation contains msg if {
	input.nonce == 0
	msg := "GENERAL_NONCE_SENTINEL: nonce is 0, which is never a valid monotonic replay-protection value"
}

# ---------------------------------------------------------------------------
# 3. Empty/whitespace-only intent_type
# ---------------------------------------------------------------------------
# pydantic's min_length=1 (schemas.py) blocks a fully empty string, but not
# a whitespace-only one ("   ") -- that would pass schema validation and
# then match none of clinical_intent_types/finance_intent_types/etc,
# silently taking the "ordinary, ungated" path through every domain bundle.
# Reject it outright as a structurally meaningless intent label.
violation contains msg if {
	trim_space(input.intent_type) == ""
	msg := "GENERAL_EMPTY_INTENT_TYPE: intent_type is empty or whitespace-only"
}
