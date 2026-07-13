-- Persist the DID Document accepted by POST /v1/agent/register (§4.1).
-- Previously accepted and silently dropped: handlers.rs's RegisterAgentRequest
-- had a `did_document` field that was never written to a column and never
-- returned by GET /v1/agent/{id}, despite a comment claiming it was "stored
-- verbatim in the response for now." This closes that gap.
ALTER TABLE agents ADD COLUMN did_document JSONB;
