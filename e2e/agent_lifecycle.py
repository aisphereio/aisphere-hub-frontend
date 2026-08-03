"""Hub UI E2E: create an Agent, compose its Skill/Tool/Prompt, then chat with it."""

from __future__ import annotations

import os
import re
import time
from pathlib import Path

from playwright.sync_api import Page, expect, sync_playwright


BASE_URL = os.getenv("E2E_BASE_URL", "https://hub.weagent.cc:30723")
STORAGE_STATE = os.getenv("E2E_STORAGE_STATE", "")
SKILL_NAME = os.getenv("E2E_SKILL", "sandbox-workspace-tools")
TOOL_NAME = os.getenv("E2E_TOOL", "workspace.write")


def choose_tool(page: Page) -> str:
    page.get_by_test_id("add-agent-tool").click()
    trigger = page.get_by_test_id("agent-tool-name-empty")
    trigger.click()
    option = page.get_by_role("option", name=re.compile(re.escape(TOOL_NAME), re.IGNORECASE))
    if option.count() == 0:
        options = page.get_by_role("option")
        expect(options.first).to_be_visible()
        selected = options.first.inner_text()
        options.first.click()
        return selected
    option.first.click()
    return TOOL_NAME


def run() -> None:
    stamp = time.strftime("%Y%m%d%H%M%S")
    agent_id = f"e2e-agent-{stamp}"
    prompt = "你是 E2E 验证助手。先理解用户意图，再使用已授权工具完成工作，并清楚说明结果。"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context_args = {}
        if STORAGE_STATE:
            context_args["storage_state"] = STORAGE_STATE
        context = browser.new_context(**context_args)
        page = context.new_page()
        try:
            page.goto(BASE_URL, wait_until="networkidle")
            if "/login" in page.url or page.get_by_text(re.compile("Sign in|登录", re.IGNORECASE)).count() > 0:
                raise RuntimeError("Hub requires authentication; set E2E_STORAGE_STATE to a logged-in Playwright state file")

            page.get_by_text("Agents", exact=True).first.click()
            page.get_by_test_id("new-agent").click()
            expect(page.get_by_text("Create Agent", exact=True)).to_be_visible()

            page.get_by_test_id("agent-id").fill(agent_id)
            page.get_by_test_id("agent-display-name").fill("E2E Agent")
            page.get_by_test_id("agent-description").fill("Created by the Hub Agent lifecycle E2E")
            page.get_by_test_id("skill-option-sandbox-workspace-tools").click()
            page.get_by_test_id("agent-system-prompt").fill(prompt)
            selected_tool = choose_tool(page)

            page.get_by_test_id("create-agent-submit").click()
            expect(page.get_by_text(agent_id, exact=True).first).to_be_visible(timeout=30_000)

            page.get_by_text("Playground", exact=True).click()
            page.get_by_test_id("new-agent-session").click()
            expect(page.get_by_test_id("agent-playground")).to_be_visible()
            page.get_by_test_id("playground-input").fill("请确认你已加载 E2E Skill，并调用工具完成一次验证。")
            page.get_by_test_id("playground-send").click()
            expect(page.get_by_test_id("playground-message").nth(1)).to_be_visible(timeout=120_000)

            messages = page.get_by_test_id("playground-message")
            expect(messages).to_have_count(2, timeout=120_000)
            assistant_text = messages.nth(1).inner_text()
            assert assistant_text.strip(), "Agent returned an empty response"

            first_session_id = page.get_by_test_id("agent-session-id").inner_text()
            page.get_by_test_id("new-agent-session").click()
            session_items = page.get_by_test_id("agent-session-item")
            expect(session_items).to_have_count(2, timeout=30_000)
            second_session_id = page.get_by_test_id("agent-session-id").inner_text()
            assert second_session_id and second_session_id != first_session_id, "Creating a session must create a new Runtime context"
            session_items.first.click()
            expect(page.get_by_test_id("agent-session-id")).to_have_text(first_session_id, timeout=10_000)
            expect(page.get_by_test_id("playground-message")).to_have_count(0)
            print(f"PASS agent={agent_id} skill={SKILL_NAME} tool={selected_tool}")
            print(f"sessions={first_session_id},{second_session_id}")
            print(f"assistant={assistant_text[:500]}")
        finally:
            screenshot = Path(os.getenv("E2E_ARTIFACT_DIR", "e2e-artifacts"))
            screenshot.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(screenshot / f"{agent_id}.png"), full_page=True)
            context.close()
            browser.close()


if __name__ == "__main__":
    run()
