#!/bin/bash
# Permission Semantic Tests
# Usage: ssh root@36.137.200.194 'bash -s' < scripts/permission-semantic-test.sh

set -uo pipefail
NAMESPACE="aisphere"
IAM_POD=$(kubectl get pods -n $NAMESPACE -l app=aisphere-iam -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
ADMIN="496333c7-7acc-4717-8596-056544fc0a68"
BASE="http://127.0.0.1:18080"
PASS=0
FAIL=0
SUFFIX=$(date +%s)
GRP_AUTH="test-auth-group-$SUFFIX"
GRP_PERM="test-perm-group-$SUFFIX"

iam_admin() {
  kubectl exec -n "$NAMESPACE" "$IAM_POD" -c iam -- wget -q -O- --timeout=10 \
    --header="X-Aisphere-Auth-Verified: true" \
    --header="X-Aisphere-Subject: $ADMIN" \
    --header="X-Aisphere-Subject-Type: user" \
    --header="X-Aisphere-Org-Id: aisphere" \
    "$@" 2>/dev/null || true
}

iam_user() {
    local user="$1"; shift
    kubectl exec -n "$NAMESPACE" "$IAM_POD" -c iam -- wget -q -O- --timeout=10 \
      --header="X-Aisphere-Auth-Verified: true" \
      --header="X-Aisphere-Subject: $user" \
      --header="X-Aisphere-Subject-Type: user" \
      --header="X-Aisphere-Org-Id: aisphere" \
      "$@" 2>/dev/null || true
}

check() { local name="$1" result="$2"; if [ "$result" = "0" ]; then echo "  ❌ $name"; FAIL=$((FAIL+1)); else echo "  ✅ $name"; PASS=$((PASS+1)); fi; }

echo "=========================================="
echo "  IAM Permission Semantic Tests"
echo "=========================================="
echo ""

# 清理之前的测试数据
iam_admin --header="Content-Type: application/json" \
  --post-data='{"filter":{"resource_type":"zone","resource_id":"aisphere","relation":"group_manager","subject_type":"user","subject_id":"test-grp-user"}}' \
  "$BASE/v1/iam/authz/relationships:delete" > /dev/null 2>&1 || true
iam_admin --header="Content-Type: application/json" \
  --post-data='{"filter":{"resource_type":"zone","resource_id":"aisphere","relation":"member","subject_type":"user","subject_id":"test-grp-user"}}' \
  "$BASE/v1/iam/authz/relationships:delete" > /dev/null 2>&1 || true
sleep 2

# ─────────────────────────────────────────────
# 1. Group 权限测试
# ─────────────────────────────────────────────
echo "--- 1. Group Permission Tests ---"

# 1a. 给 test-grp-user 分配 zone#member（只有 view_zone，没有 create_groups）
iam_admin --header="Content-Type: application/json" \
  --post-data='{"relationships":[{"resource":{"type":"zone","id":"aisphere"},"relation":"member","subject":{"type":"user","id":"test-grp-user"}}]}' \
  $BASE/v1/iam/authz/relationships > /dev/null 2>&1

# 1b. 尝试创建 group（应该失败 — 没有 create_groups 权限）
CREATE1=$(iam_user "test-grp-user" --header="Content-Type: application/json" \
  --post-data='{"org_id":"aisphere","group":{"name":"test-unauth-'$SUFFIX'","displayName":"Test","type":"folder"}}' \
  $BASE/v1/iam/groups)
if [ -z "$CREATE1" ]; then
  echo "  ✅ Cannot create group without permission (403)"
  PASS=$((PASS + 1))
else
  echo "  ❌ Was able to create group without permission"
  FAIL=$((FAIL + 1))
fi

# 1c. 授予 group_manager 权限
iam_admin --header="Content-Type: application/json" \
  --post-data='{"relationships":[{"resource":{"type":"zone","id":"aisphere"},"relation":"group_manager","subject":{"type":"user","id":"test-grp-user"}}]}' \
  "$BASE/v1/iam/authz/relationships" > /dev/null 2>&1
sleep 5

# 1d. 现在可以创建 group（带重试）
for i in 1 2 3 4 5; do
  CREATE2=$(iam_user "test-grp-user" --header="Content-Type: application/json" \
    --post-data='{"org_id":"aisphere","group":{"name":"'$GRP_AUTH'","displayName":"Test Auth Group","type":"folder"}}' \
    $BASE/v1/iam/groups)
  if echo "$CREATE2" | grep -q '"name"'; then
    echo "  ✅ Can create group after grant"
    PASS=$((PASS + 1))
    break
  fi
  sleep 2
done
if ! echo "$CREATE2" | grep -q '"name"'; then
  echo "  ❌ Cannot create group after grant"
  FAIL=$((FAIL + 1))
fi

# 1e. 撤销 group_manager 权限
iam_admin --header="Content-Type: application/json" \
  --post-data='{"filter":{"resource_type":"group","resource_id":"aisphere","relation":"group_manager","subject_type":"user","subject_id":"test-grp-user"}}' \
  "$BASE/v1/iam/authz/relationships:delete" > /dev/null 2>&1
sleep 5

# 1f. 验证不能再创建 group（带重试）
for i in 1 2 3 4 5; do
  CREATE3=$(iam_user "test-grp-user" --header="Content-Type: application/json" \
    --post-data='{"org_id":"aisphere","group":{"name":"test-unauth2-'$SUFFIX'","displayName":"Test2","type":"folder"}}' \
    $BASE/v1/iam/groups)
  if [ -z "$CREATE3" ]; then
    echo "  ✅ Cannot create group after revoke (403)"
    PASS=$((PASS + 1))
    break
  fi
  sleep 2
done
if [ -n "$CREATE3" ]; then
  echo "  ❌ Could still create group after revoke"
  FAIL=$((FAIL + 1))
fi

# ─────────────────────────────────────────────
# 2. Grant 授权测试（通过 SpiceDB 直接写关系）
# ─────────────────────────────────────────────
echo ""
echo "--- 2. Grant Access Tests ---"

# 2a. 给 test-grant-user 基础权限
iam_admin --header="Content-Type: application/json" \
  --post-data='{"relationships":[{"resource":{"type":"zone","id":"aisphere"},"relation":"member","subject":{"type":"user","id":"test-grant-user"}}]}' \
  "$BASE/v1/iam/authz/relationships" > /dev/null 2>&1
sleep 1

# 2b. 验证没有 edit 权限
CHK_G1=$(iam_user "test-grant-user" --header="Content-Type: application/json" \
  --post-data='{"subject":{"type":"user","id":"test-grant-user"},"resource":{"type":"skill","id":"test-resource"},"permission":"edit"}' \
  $BASE/v1/iam/authz/permissions:check)
CHK_G1_ALLOWED=$(echo "$CHK_G1" | grep -c '"allowed":true')
if [ "$CHK_G1_ALLOWED" = "0" ]; then
  echo "  ✅ No edit before grant"
  PASS=$((PASS + 1))
else
  echo "  ❌ Had edit before grant"
  FAIL=$((FAIL + 1))
fi

# 2c. 直接写 owner 关系（模拟 GrantAccess）
iam_admin --header="Content-Type: application/json" \
  --post-data='{"relationships":[{"resource":{"type":"skill","id":"test-resource"},"relation":"owner","subject":{"type":"user","id":"test-grant-user"}}]}' \
  "$BASE/v1/iam/authz/relationships" > /dev/null 2>&1
sleep 5

# 2d. 验证有 edit 权限（带重试）
for i in 1 2 3 4 5; do
  CHK_G2=$(iam_user "test-grant-user" --header="Content-Type: application/json" \
    --post-data='{"subject":{"type":"user","id":"test-grant-user"},"resource":{"type":"skill","id":"test-resource"},"permission":"edit"}' \
    $BASE/v1/iam/authz/permissions:check)
  if echo "$CHK_G2" | grep -q '"allowed":true'; then
    echo "  ✅ Has edit after grant"
    PASS=$((PASS + 1))
    break
  fi
  sleep 2
done
if ! echo "$CHK_G2" | grep -q '"allowed":true'; then
  echo "  ❌ No edit after grant"
  FAIL=$((FAIL + 1))
fi

# 2e. 删除 owner 关系（模拟 RevokeAccess）
iam_admin --header="Content-Type: application/json" \
  --post-data='{"filter":{"resource_type":"skill","resource_id":"test-resource","relation":"owner","subject_type":"user","subject_id":"test-grant-user"}}' \
  "$BASE/v1/iam/authz/relationships:delete" > /dev/null 2>&1
sleep 5

# 2f. 验证没有 edit 权限
CHK_G3=$(iam_user "test-grant-user" --header="Content-Type: application/json" \
  --post-data='{"subject":{"type":"user","id":"test-grant-user"},"resource":{"type":"skill","id":"test-resource"},"permission":"edit"}' \
  $BASE/v1/iam/authz/permissions:check)
CHK_G3_ALLOWED=$(echo "$CHK_G3" | grep -c '"allowed":true')
if [ "$CHK_G3_ALLOWED" = "0" ]; then
  echo "  ✅ No edit after revoke"
  PASS=$((PASS + 1))
else
  echo "  ❌ Still had edit after revoke"
  FAIL=$((FAIL + 1))
fi

# ─────────────────────────────────────────────
# 3. Group Membership 权限测试
# ─────────────────────────────────────────────
echo ""
echo "--- 3. Group Membership Tests ---"

# 3a. 创建测试 group
iam_admin --header="Content-Type: application/json" \
  --post-data='{"org_id":"aisphere","group":{"name":"'$GRP_PERM'","displayName":"Test Perm Group","type":"group"}}' \
  $BASE/v1/iam/groups > /dev/null 2>&1
sleep 1

# 3b. 给 test-mem-user 基础权限
iam_admin --header="Content-Type: application/json" \
  --post-data='{"relationships":[{"resource":{"type":"zone","id":"aisphere"},"relation":"member","subject":{"type":"user","id":"test-mem-user"}}]}' \
  "$BASE/v1/iam/authz/relationships" > /dev/null 2>&1
sleep 1

# 3c. 没有 manage_members 权限，不能分配成员
ASSIGN1=$(iam_user "test-mem-user" --header="Content-Type: application/json" \
  --post-data='{"org_id":"aisphere"}' \
  "$BASE/v1/iam/groups/$GRP_PERM/users/test-user-1" 2>&1)
if [ -z "$ASSIGN1" ]; then
  echo "  ✅ Cannot assign member without manage_members (403)"
  PASS=$((PASS + 1))
else
  echo "  ❌ Could assign member without manage_members"
  FAIL=$((FAIL + 1))
fi

# 3d. 授予 group#manager 权限
iam_admin --header="Content-Type: application/json" \
  --post-data='{"relationships":[{"resource":{"type":"group","id":"aisphere/'$GRP_PERM'"},"relation":"manager","subject":{"type":"user","id":"test-mem-user"}}]}' \
  "$BASE/v1/iam/authz/relationships" > /dev/null 2>&1
sleep 5

# 3e. 现在可以分配成员（带重试）
for i in 1 2 3 4 5; do
  ASSIGN2=$(iam_user "test-mem-user" --header="Content-Type: application/json" \
    --post-data='{"org_id":"aisphere"}' \
    "$BASE/v1/iam/groups/$GRP_PERM/users/test-user-1" 2>&1)
  if [ -n "$ASSIGN2" ]; then
    echo "  ✅ Can assign member after grant"
    PASS=$((PASS + 1))
    break
  fi
  sleep 2
done
if [ -z "$ASSIGN2" ]; then
  echo "  ❌ Cannot assign member after grant"
  FAIL=$((FAIL + 1))
fi

# 3f. 撤销 manager 权限
iam_admin --header="Content-Type: application/json" \
  --post-data='{"filter":{"resource_type":"group","resource_id":"aisphere/'$GRP_PERM'","relation":"manager","subject_type":"user","subject_id":"test-mem-user"}}' \
  "$BASE/v1/iam/authz/relationships:delete" > /dev/null 2>&1
sleep 5

# 3g. 不能再分配成员
ASSIGN3=$(iam_user "test-mem-user" --header="Content-Type: application/json" \
  --post-data='{"org_id":"aisphere"}' \
  "$BASE/v1/iam/groups/$GRP_PERM/users/test-user-2" 2>&1)
if [ -z "$ASSIGN3" ]; then
  echo "  ✅ Cannot assign member after revoke (403)"
  PASS=$((PASS + 1))
else
  echo "  ❌ Could still assign member after revoke"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "=========================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "=========================================="
exit $FAIL