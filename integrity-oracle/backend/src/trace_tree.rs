//! Reconstructs the nested parent-child span tree for one trace_id — the core
//! LangSmith-style "run tree" view, applied to the real OTLP spans already landing in
//! `otel_spans` (see `otlp.rs`). `db::get_otel_spans_for_trace` returns a flat,
//! start-time-ordered list; this module is the pure, unit-testable logic that turns
//! that into a tree, consumed by `handlers::get_trace_tree`.
//!
//! Reminder inherited from `otlp.rs`'s module doc: `otel_spans` is unauthenticated
//! input (no signature envelope, unlike `telemetry_events`) — this module treats the
//! data as adversarial-shaped, not just malformed-by-accident, hence the cycle/depth
//! defenses below rather than trusting well-formed parent chains.

use std::collections::{HashMap, HashSet};

use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::db::OtelSpanRow;

/// Hard recursion cap. A cycle among non-root spans can never be reached from a true
/// root (a root has `parent_span_id == None` by definition, so no cycle can pass
/// through one) — so cycles are structurally excluded from the walk below, not just
/// defended against. This cap is a second, independent guard against a pathologically
/// deep-but-acyclic chain (an attacker could grow one via repeated OTLP exports, since
/// `otel_spans` ingestion is unauthenticated) causing unbounded recursion.
const MAX_TREE_DEPTH: usize = 500;

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SpanTreeNode {
    pub id: Uuid,
    pub agent_id: String,
    pub span_id: String,
    pub name: String,
    pub kind: String,
    pub status_code: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    /// Always >= 0: `end_time` before `start_time` (a malformed/adversarial span) is
    /// clamped to 0 rather than surfacing a negative duration to callers.
    pub duration_ms: i64,
    pub attributes: serde_json::Value,
    /// `no_recursion`: `SpanTreeNode` is self-referential (a node's children are more
    /// nodes) — without this, utoipa's schema builder recurses into its own field
    /// type with no cycle-breaking and stack-overflows at `gen_openapi` runtime. This
    /// only affects generated OpenAPI *documentation* depth, not actual serialization
    /// (`Vec<SpanTreeNode>` still holds real, arbitrarily-nested data at runtime) or
    /// the `MAX_TREE_DEPTH` recursion guard in `build_tree`, which is unrelated and
    /// still fully enforced.
    #[schema(no_recursion)]
    pub children: Vec<SpanTreeNode>,
}

pub struct TreeResult {
    pub roots: Vec<SpanTreeNode>,
    /// True if any branch was cut off at `MAX_TREE_DEPTH` — an honest signal to the
    /// caller that the tree shown is not the complete picture, per this repo's
    /// "no silent mocks" rule (truncation must be visible, not silent).
    pub truncated: bool,
}

/// Builds one or more root trees from a flat, order-agnostic list of spans belonging
/// to the same trace. Does not assume input order: a parent span is not guaranteed to
/// precede its children in the input (clock skew across a batched export is real), so
/// this indexes first rather than doing a single top-down pass. A span whose claimed
/// `parent_span_id` doesn't correspond to any span in this same list is treated as a
/// root — the true parent may simply be outside whatever slice was queried.
pub fn build_tree(spans: Vec<OtelSpanRow>) -> TreeResult {
    let span_ids: HashSet<String> = spans.iter().map(|s| s.span_id.clone()).collect();
    let mut children_by_parent: HashMap<Option<String>, Vec<OtelSpanRow>> = HashMap::new();

    for span in spans {
        let effective_parent = match &span.parent_span_id {
            Some(p) if span_ids.contains(p.as_str()) => Some(p.clone()),
            _ => None,
        };
        children_by_parent.entry(effective_parent).or_default().push(span);
    }

    let mut truncated = false;

    fn build_node(span: OtelSpanRow, children_by_parent: &mut HashMap<Option<String>, Vec<OtelSpanRow>>, depth: usize, truncated: &mut bool) -> SpanTreeNode {
        let duration_ms = (span.end_time - span.start_time).num_milliseconds().max(0);

        let children = if depth >= MAX_TREE_DEPTH {
            if children_by_parent.contains_key(&Some(span.span_id.clone())) {
                *truncated = true;
            }
            Vec::new()
        } else {
            let child_spans = children_by_parent.remove(&Some(span.span_id.clone())).unwrap_or_default();
            let mut children: Vec<SpanTreeNode> = child_spans.into_iter().map(|c| build_node(c, children_by_parent, depth + 1, truncated)).collect();
            children.sort_by_key(|c| c.start_time);
            children
        };

        SpanTreeNode {
            id: span.id,
            agent_id: span.agent_id,
            span_id: span.span_id,
            name: span.name,
            kind: span.kind,
            status_code: span.status_code,
            start_time: span.start_time,
            end_time: span.end_time,
            duration_ms,
            attributes: span.attributes,
            children,
        }
    }

    let roots = children_by_parent.remove(&None).unwrap_or_default();
    let mut result: Vec<SpanTreeNode> = roots.into_iter().map(|r| build_node(r, &mut children_by_parent, 0, &mut truncated)).collect();
    result.sort_by_key(|r| r.start_time);

    TreeResult { roots: result, truncated }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn span(span_id: &str, parent: Option<&str>, name: &str, start_offset_secs: i64) -> OtelSpanRow {
        let base = Utc::now();
        OtelSpanRow {
            id: Uuid::new_v4(),
            agent_id: "did:integrity:test".to_string(),
            trace_id: "trace-1".to_string(),
            span_id: span_id.to_string(),
            parent_span_id: parent.map(String::from),
            name: name.to_string(),
            kind: "SPAN_KIND_INTERNAL".to_string(),
            status_code: "STATUS_CODE_OK".to_string(),
            start_time: base + chrono::Duration::seconds(start_offset_secs),
            end_time: base + chrono::Duration::seconds(start_offset_secs + 1),
            attributes: json!({}),
            created_at: base,
        }
    }

    #[test]
    fn single_root_no_children() {
        let result = build_tree(vec![span("a", None, "root", 0)]);
        assert_eq!(result.roots.len(), 1);
        assert_eq!(result.roots[0].span_id, "a");
        assert!(result.roots[0].children.is_empty());
        assert!(!result.truncated);
    }

    #[test]
    fn parent_child_nesting() {
        let spans = vec![span("a", None, "root", 0), span("b", Some("a"), "child", 1), span("c", Some("b"), "grandchild", 2)];
        let result = build_tree(spans);
        assert_eq!(result.roots.len(), 1);
        assert_eq!(result.roots[0].span_id, "a");
        assert_eq!(result.roots[0].children.len(), 1);
        assert_eq!(result.roots[0].children[0].span_id, "b");
        assert_eq!(result.roots[0].children[0].children.len(), 1);
        assert_eq!(result.roots[0].children[0].children[0].span_id, "c");
    }

    #[test]
    fn out_of_order_input_still_nests_correctly() {
        // Child appears before its parent in the input slice — must not matter.
        let spans = vec![span("b", Some("a"), "child", 1), span("a", None, "root", 0)];
        let result = build_tree(spans);
        assert_eq!(result.roots.len(), 1);
        assert_eq!(result.roots[0].children.len(), 1);
        assert_eq!(result.roots[0].children[0].span_id, "b");
    }

    #[test]
    fn multiple_roots_both_surface() {
        let spans = vec![span("a", None, "root-1", 0), span("b", None, "root-2", 1)];
        let result = build_tree(spans);
        assert_eq!(result.roots.len(), 2);
    }

    #[test]
    fn dangling_parent_reference_treated_as_root() {
        // "parent" doesn't exist in this slice — must not panic, must surface as a root.
        let spans = vec![span("a", Some("does-not-exist"), "orphan", 0)];
        let result = build_tree(spans);
        assert_eq!(result.roots.len(), 1);
        assert_eq!(result.roots[0].span_id, "a");
    }

    #[test]
    fn two_cycle_is_safely_excluded_not_infinite_looped() {
        // a's parent is b, b's parent is a: neither can be a root (both have a
        // non-dangling parent), so neither is ever visited — safely dropped, no panic,
        // no infinite recursion.
        let spans = vec![span("a", Some("b"), "a", 0), span("b", Some("a"), "b", 1)];
        let result = build_tree(spans);
        assert!(result.roots.is_empty());
        assert!(!result.truncated);
    }

    #[test]
    fn empty_input_is_empty_output() {
        let result = build_tree(vec![]);
        assert!(result.roots.is_empty());
        assert!(!result.truncated);
    }

    #[test]
    fn children_sorted_by_start_time_regardless_of_input_order() {
        let spans = vec![span("a", None, "root", 0), span("c", Some("a"), "third", 3), span("b", Some("a"), "second", 1)];
        let result = build_tree(spans);
        let children = &result.roots[0].children;
        assert_eq!(children[0].span_id, "b");
        assert_eq!(children[1].span_id, "c");
    }

    #[test]
    fn deep_chain_beyond_max_depth_is_truncated_not_crashed() {
        let mut spans = Vec::new();
        spans.push(span("s0", None, "root", 0));
        for i in 1..=(MAX_TREE_DEPTH + 10) {
            spans.push(span(&format!("s{i}"), Some(&format!("s{}", i - 1)), "link", i as i64));
        }
        let result = build_tree(spans);
        assert_eq!(result.roots.len(), 1);
        assert!(result.truncated, "a chain deeper than MAX_TREE_DEPTH must set truncated=true");
    }
}
