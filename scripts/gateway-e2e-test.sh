#!/bin/bash
# End-to-end integration tests through Envoy Gateway
#
# Tests the full request path through the deployed IAM service
# with trusted headers simulating Envoy Gateway authentication.
#
# Usage:
#   ssh root@36.137.200.194 'bash -s' < scripts/gateway-e2e-test.sh

set -euo pipefail

NAMESPACE="aisphere"
IAM_POD=$(kubectl get pods -n $NAMESPACE -l app=aisphere-iam -o jsonpath='{.items[0].metadata.name}')
AUTH="X-Aisphere-Auth-Verified: true"
SUBJ="X-Aisphere-Subject: 496333c7-7acc-4717-8596-056544fc0a68"
TYPE="X-Aisphere-Subject-Type: user"
ORG="X-Aisphere-Org-Id: aisphere"
BASE="http://127.0.0.1:18080"
PASS=0
FAIL=0

exec_curl() {
  kubectl exec -n "$NAMESPACE" "$IAM_POD" -c iam -- wget -q -O- --timeout=10 "$@" 2>/dev/null || echo ""
}

check() { local name="$1" result="$2"; if [ "$result" = "0" ]; then echo "  ❌ $name"; FAIL=$((FAIL+1)); else echo "  ✅ $name"; PASS=$((PASS+1)); fi; }

echo "=========================================="
echo "  IAM Gateway E2E Tests"
echo "  (via Envoy Gateway trusted headers)"
echo "=========================================="
echo ""

# 1. Service Health
echo "--- 1. Service Health ---"
check "Health endpoint" $(exec_curl $BASE/healthz | grep -c '"status":"ok"')
check "Ready endpoint" $(exec_curl $BASE/readyz | grep -c '"status":"ready"')

# 2. Authz Admin: Schema
echo ""
echo "--- 2. Authz Admin: Schema ---"
check "Get authorization schema" $(exec_curl --header="$AUTH" --header="$SUBJ" --header="$TYPE" --header="$ORG" $BASE/v1/iam/authz/schema | grep -c '"text"')

# 3. Authz Admin: Permission Check
echo ""
echo "--- 3. Authz Admin: Permission Check ---"
check "Admin can view_zone" $(exec_curl --header="Content-Type: application/json" --header="$AUTH" --header="$SUBJ" --header="$TYPE" --header="$ORG" --post-data='{"subject":{"type":"user","id":"496333c7-7acc-4717-8596-056544fc0a68"},"resource":{"type":"zone","id":"aisphere"},"permission":"view_zone"}' $BASE/v1/iam/authz/permissions:check | grep -c '"allowed":true')

# 4. Authz Admin: Relationship CRUD
echo ""
echo "--- 4. Authz Admin: Relationships ---"
check "Write relationship" $(exec_curl --header="Content-Type: application/json" --header="$AUTH" --header="$SUBJ" --header="$TYPE" --header="$ORG" --post-data='{"relationships":[{"resource":{"type":"zone","id":"aisphere"},"relation":"member","subject":{"type":"user","id":"test-e2e-user"}}]}' $BASE/v1/iam/authz/relationships | grep -c '"written":1')
check "Verify grant" $(exec_curl --header="Content-Type: application/json" --header="$AUTH" --header="$SUBJ" --header="$TYPE" --header="$ORG" --post-data='{"subject":{"type":"user","id":"test-e2e-user"},"resource":{"type":"zone","id":"aisphere"},"permission":"view_zone"}' $BASE/v1/iam/authz/permissions:check | grep -c '"allowed":true')
check "Delete relationship" $(exec_curl --header="Content-Type: application/json" --header="$AUTH" --header="$SUBJ" --header="$TYPE" --header="$ORG" --post-data='{"filter":{"resource_type":"zone","resource_id":"aisphere","relation":"member","subject_type":"user","subject_id":"test-e2e-user"}}' $BASE/v1/iam/authz/relationships:delete | grep -c '"consistency_token"')
check "Deny after revoke" $(exec_curl --header="Content-Type: application/json" --header="$AUTH" --header="$SUBJ" --header="$TYPE" --header="$ORG" --post-data='{"subject":{"type":"user","id":"test-e2e-user"},"resource":{"type":"zone","id":"aisphere"},"permission":"view_zone"}' $BASE/v1/iam/authz/permissions:check | grep -c '"effect":"no_match"')

# 5. IAM Directory
echo ""
echo "--- 5. IAM Directory ---"
check "List users" $(exec_curl --header="$AUTH" --header="$SUBJ" --header="$TYPE" --header="$ORG" $BASE/v1/iam/orgs/aisphere/users | grep -c '"users"')
check "List groups" $(exec_curl --header="$AUTH" --header="$SUBJ" --header="$TYPE" --header="$ORG" $BASE/v1/iam/orgs/aisphere/groups | grep -c '"groups"')

# 6. IAM Control Plane
echo ""
echo "--- 6. IAM Control Plane ---"
check "List role templates" $(exec_curl --header="$AUTH" --header="$SUBJ" --header="$TYPE" --header="$ORG" $BASE/v1/iam/control-plane/role-templates | grep -c '"role_templates"')
check "List capabilities" $(exec_curl --header="$AUTH" --header="$SUBJ" --header="$TYPE" --header="$ORG" $BASE/v1/iam/control-plane/capabilities | grep -c '"capabilities"')

# 7. Negative Tests
echo ""
echo "--- 7. Negative Tests ---"
NOAUTH=$(exec_curl --header="Content-Type: application/json" --post-data='{"subject":{"type":"user","id":"unknown"},"resource":{"type":"zone","id":"aisphere"},"permission":"view_zone"}' $BASE/v1/iam/authz/permissions:check)
if [ -z "$NOAUTH" ] || echo "$NOAUTH" | grep -q '"effect":"no_match"'; then
  echo "  ✅ No-auth user correctly denied"
  PASS=$((PASS + 1))
else
  echo "  ❌ No-auth user was allowed"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "=========================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "=========================================="
exit $FAIL