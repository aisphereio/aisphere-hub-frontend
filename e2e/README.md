# Hub Agent lifecycle E2E

This suite verifies the user-facing Agent lifecycle:

1. Open the Hub console.
2. Create a uniquely named Agent.
3. Select the built-in `sandbox-workspace-tools` Skill.
4. Bind a Tool from the Tool catalog.
5. Assemble a system Prompt into `root_agent.yaml:instruction`.
6. Save the Agent version.
7. Open the Agent Playground.
8. Create a Runtime session, send a message, and assert an assistant response.

The test uses a logged-in browser state because the test environment is protected by Casdoor OIDC. Create a Playwright storage state once, then point `E2E_STORAGE_STATE` at it. Never commit that file.

```powershell
python -m pip install -r e2e/requirements.txt
$env:E2E_BASE_URL = 'https://hub.weagent.cc:30723'
$env:E2E_STORAGE_STATE = 'C:\secure\hub-e2e-storage.json'
$env:E2E_TOOL = 'workspace.write'
python e2e/agent_lifecycle.py
```

The test leaves the uniquely named Agent in Hub so the generated version and runtime trace can be inspected. Use `E2E_ARTIFACT_DIR` to change the screenshot output directory.

## Runtime proxy

The Playground calls the same-origin Next route `/api/agent-runtime/*`. The Next server forwards it to `AGENT_RUNTIME_URL`, whose cluster default is:

```text
http://agentkit-runtime.agent-runtime.svc.cluster.local:8080
```

For local development, set `AGENT_RUNTIME_URL` to the reachable Runtime URL before starting Next.
