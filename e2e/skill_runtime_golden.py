"""Cross-service Skill execution smoke test for an already released Hub Skill.

The test deliberately uses public HTTP contracts only: Hub resolves the Agent,
Runtime downloads and verifies the catalog package, the model sees the Skill,
and the final Session must contain persisted user and assistant events.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request


HUB_URL = os.getenv("E2E_HUB_URL", "http://aisphere-hub.aisphere.svc.cluster.local:18001").rstrip("/")
RUNTIME_URL = os.getenv("E2E_RUNTIME_URL", "http://agentkit-runtime.agent-runtime.svc.cluster.local:8080/api").rstrip("/")
AGENT_ID = os.getenv("E2E_AGENT_ID", "close-ag-1")
AGENT_VERSION = os.getenv("E2E_AGENT_VERSION", "")
USER_ID = os.getenv("E2E_USER_ID", "496333c7-7acc-4717-8596-056544fc0a68")
ORG_ID = os.getenv("E2E_ORG_ID", "aisphere")
PROJECT_ID = os.getenv("E2E_PROJECT_ID", "default")
INTERNAL_TOKEN = os.getenv("E2E_INTERNAL_TOKEN", "")


def identity_headers() -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "X-Aisphere-Auth-Verified": "true",
        "X-Aisphere-Subject": USER_ID,
        "X-Aisphere-Subject-Type": "user",
        "X-Aisphere-Org-ID": ORG_ID,
        "X-Aisphere-Project-ID": PROJECT_ID,
        "X-Aisphere-Username": os.getenv("E2E_USERNAME", "admin"),
    }
    if INTERNAL_TOKEN:
        headers["X-Aisphere-Internal-Token"] = INTERNAL_TOKEN
    return headers


def request_json(method: str, url: str, body: object | None = None, timeout: int = 300) -> object:
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(url, data=data, method=method, headers=identity_headers())
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"{method} {url} failed ({error.code}): {error.read().decode(errors='replace')}") from error
    return json.loads(raw) if raw else {}


def assert_package(skill: dict[str, object]) -> None:
    name = str(skill.get("name") or "")
    source = str(skill.get("source") or "")
    if source == "builtin":
        return
    if source != "catalog":
        raise AssertionError(f"{name}: unknown source {source!r}")
    commit_sha = str(skill.get("commitSHA") or "")
    revision = str(skill.get("revision") or "")
    if not commit_sha or revision != commit_sha:
        raise AssertionError(f"{name}: revision must equal commitSHA")
    download_url = str(skill.get("downloadUrl") or "")
    expected_sha = str(skill.get("sha256") or "")
    if not download_url or not expected_sha:
        raise AssertionError(f"{name}: catalog package URL and SHA256 are required")
    url = urllib.parse.urljoin(HUB_URL + "/", download_url)
    request = urllib.request.Request(url, headers=identity_headers())
    with urllib.request.urlopen(request, timeout=60) as response:
        package = response.read()
    actual_sha = hashlib.sha256(package).hexdigest()
    if actual_sha != expected_sha:
        raise AssertionError(f"{name}: package digest mismatch: {actual_sha} != {expected_sha}")
    print(f"package_ok={name}@{skill.get('version')} revision={revision[:12]} bytes={len(package)}")


def main() -> None:
    stamp = int(time.time())
    session_id = f"skill-golden-{stamp}"
    resolve_body: dict[str, object] = {"runtimeId": "golden-e2e", "sessionId": session_id}
    if AGENT_VERSION:
        resolve_body["version"] = AGENT_VERSION
    snapshot = request_json("POST", f"{HUB_URL}/v1/agents/{urllib.parse.quote(AGENT_ID)}:resolve", resolve_body)
    if not isinstance(snapshot, dict):
        raise AssertionError("Hub resolve did not return an object")
    skills = snapshot.get("skills") or []
    if not skills:
        raise AssertionError("resolved Agent has no Skills")
    for skill in skills:
        assert_package(skill)

    state = {"agent_id": AGENT_ID, "session_source": "skill-golden-e2e", "project_id": PROJECT_ID}
    request_json("POST", f"{RUNTIME_URL}/apps/{AGENT_ID}/users/{USER_ID}/sessions/{session_id}", {"state": state})
    run_body: dict[str, object] = {
        "appName": AGENT_ID,
        "userId": USER_ID,
        "sessionId": session_id,
        "newMessage": {
            "role": "user",
            "parts": [{"text": "Skill Golden E2E: 用一句话确认你已读取当前 Agent 绑定的 Skill 上下文。"}],
        },
    }
    if AGENT_VERSION:
        run_body["version"] = AGENT_VERSION
    run_events = request_json("POST", f"{RUNTIME_URL}/run", run_body)
    session = request_json("GET", f"{RUNTIME_URL}/apps/{AGENT_ID}/users/{USER_ID}/sessions/{session_id}")
    if not isinstance(session, dict):
        raise AssertionError("Runtime Session did not return an object")
    events = session.get("events") or []
    authors = [event.get("author") for event in events]
    if not events or "user" not in authors or not any(author and author != "user" for author in authors):
        raise AssertionError(f"real conversation was not persisted: authors={authors}")
    print(f"PASS session={session_id} resolve_skills={len(skills)} run_events={len(run_events)} persisted_events={len(events)} authors={authors}")


if __name__ == "__main__":
    main()
