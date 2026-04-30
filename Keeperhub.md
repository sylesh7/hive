---
title: "AI Tools"
description: "AI-powered tools for building and managing KeeperHub workflows."
---

# AI Tools

AI-powered tools that help you build, configure, and manage blockchain automations faster.

- [Overview](/ai-tools/overview) -- How AI tools integrate with KeeperHub
- [Claude Code Plugin](/ai-tools/claude-code-plugin) -- Use Claude Code for workflow development
- [MCP Server](/ai-tools/mcp-server) -- KeeperHub MCP server for AI-assisted automation
- [Agentic Wallets](/ai-tools/agentic-wallet) -- Install an x402 wallet (KeeperHub agentic wallet, agentcash, or Coinbase wallet skills) so your agent can pay for KeeperHub workflows

---
title: "Overview"
description: "Use AI agents and developer tools to build and manage KeeperHub workflows programmatically."
---

# AI Tools

KeeperHub provides two integration surfaces for AI-assisted and programmatic workflow management:

| Tool | What it does | Best for |
|------|-------------|----------|
| [Claude Code Plugin](/ai-tools/claude-code-plugin) | Skills and commands for building workflows from your terminal | Developers using Claude Code as their IDE |
| [MCP Server](/ai-tools/mcp-server) | Model Context Protocol server with 19 tools for full workflow CRUD | AI agents, custom integrations, remote automation |

Both connect to the same KeeperHub API and require an organization-scoped API key (prefix: `kh_`).

## Quick Start

**Claude Code users:** Install the plugin and run `/keeperhub:login` to get started. The plugin auto-installs the MCP server and configures authentication.

**AI agent builders:** Run the MCP server directly via Docker or Node.js and point your agent framework at it. See [MCP Server](/ai-tools/mcp-server) for setup.

## Getting Your API Key

1. Log in at [app.keeperhub.com](https://app.keeperhub.com)
2. Click your avatar, then "API Keys", then the "Organisation" tab
3. Click "New API Key" and name it (e.g., "Claude Code Plugin")
4. Copy the key immediately -- it is only shown once

The key must be organization-scoped (starts with `kh_`). User-scoped keys (`wfb_` prefix) are not supported.

---
title: "Claude Code Plugin"
description: "Build and manage KeeperHub workflows directly from Claude Code with skills, commands, and MCP tools."
---

# Claude Code Plugin

[GitHub](https://github.com/KeeperHub/claude-plugins/tree/main/plugins/keeperhub)

The KeeperHub plugin for Claude Code lets you create workflows, browse templates, debug executions, and explore plugins without leaving your terminal.

## Installation

There are two ways to connect Claude Code to KeeperHub:

### Option A: Remote MCP (no install needed)

Connect directly to KeeperHub's hosted MCP server. No CLI or plugin installation required.

```bash
claude mcp add --transport http keeperhub https://app.keeperhub.com/mcp
```

Then run `/mcp` inside Claude Code to authorize via browser. That's it.

### Option B: Plugin with local CLI

Install the plugin for skills, slash commands, and a local MCP server.

**1. Install the `kh` CLI**

```bash
brew install keeperhub/tap/kh
```

See [CLI installation options](https://github.com/KeeperHub/cli#install) for other platforms.

**2. Install the plugin**

```bash
/plugin marketplace add KeeperHub/claude-plugins
/plugin install keeperhub@keeperhub-plugins
/keeperhub:login
```

Restart Claude Code after setup for MCP tools to become available.

### Requirements

- KeeperHub account at [app.keeperhub.com](https://app.keeperhub.com)
- Option A: just a browser (for OAuth)
- Option B: the `kh` CLI ([install instructions](https://github.com/KeeperHub/cli#install))

## Commands

### `/keeperhub:login`

Setup guide for connecting to KeeperHub MCP. Walks you through running `/mcp` to authorize via browser, or setting up `KH_API_KEY` for headless/CI environments.

### `/keeperhub:status`

Check MCP connection status and authentication.

```
KeeperHub Status
----------------
MCP Server:   app.keeperhub.com/mcp (remote)
Connection:   Connected
Auth method:  OAuth
```

## Skills

Skills activate automatically based on what you ask Claude to do. No slash commands needed; just describe what you want.

### workflow-builder

**Activates when you say:** "create a workflow", "monitor my wallet", "set up automation", "when X happens do Y", "alert me when..."

Walks through building a workflow step by step:
1. Identifies the trigger (what starts it)
2. Discovers available actions via `list_action_schemas`
3. Adds actions one at a time with your input
4. Creates the workflow and offers to test it

**Example prompts:**
- "Create a workflow that checks my vault health every 15 minutes and sends a Telegram alert if collateral drops below 150%"
- "Monitor 0xABC... for large transfers and notify Discord"
- "Set up a weekly reward distribution to stakers"

### template-browser

**Activates when you say:** "show me templates", "find a workflow for...", "deploy a template", "what pre-built workflows exist"

Searches the template library, shows details, and deploys templates to your account with optional customization.

### execution-monitor

**Activates when you say:** "why did my workflow fail", "check execution status", "run my workflow", "show logs"

Triggers workflows, polls for completion, and debugs failures by analyzing execution logs. Identifies the failing step, explains the error, and offers to fix the workflow.

### plugin-explorer

**Activates when you say:** "what plugins are available", "how do I use web3", "show integrations", "what actions can I use"

Lists available plugins and their actions, shows configured integrations, and validates plugin configurations.

## Configuration

The plugin connects to KeeperHub's remote MCP server at `app.keeperhub.com/mcp`. Authentication is handled via OAuth (browser) when you run `/mcp`, or via the `KH_API_KEY` environment variable for headless environments.

| Variable | Description |
|----------|-------------|
| `KH_API_KEY` | API key for headless/CI environments (`kh_` prefix, organization-scoped) |

## Security

- OAuth tokens are managed by Claude Code (automatic refresh)
- API keys (`KH_API_KEY`) are only used in headless environments
- All communication is over HTTPS
- OAuth scopes restrict tool access (mcp:read, mcp:write, mcp:admin)

---
title: "MCP Server"
description: "Model Context Protocol server for AI agents to build and manage KeeperHub workflows programmatically."
---

# MCP Server

The KeeperHub MCP server exposes tools over the Model Context Protocol, enabling AI agents to create, execute, and monitor blockchain automation workflows.

## Connect to KeeperHub MCP

### Remote (recommended)

Connect directly to KeeperHub's hosted MCP server. No local process or CLI installation needed.

```bash
claude mcp add --transport http keeperhub https://app.keeperhub.com/mcp
```

Then run `/mcp` inside Claude Code to complete the OAuth authorization via browser. KeeperHub will ask you to approve access, and the token is stored automatically.

For headless or CI environments where browser auth is not available, pass an API key:

```bash
claude mcp add --transport http keeperhub https://app.keeperhub.com/mcp \
  --header "Authorization: Bearer kh_your_key_here"
```

### Via Claude Code Plugin

Install the [Claude Code Plugin](/ai-tools/claude-code-plugin) for additional skills and slash commands on top of the MCP tools. The plugin connects to the same remote endpoint.

### Local via kh CLI (deprecated)

The [`kh` CLI](https://github.com/KeeperHub/cli) can run a local MCP server over stdio via `kh serve --mcp`. This is deprecated in favor of the remote endpoint above and will be removed in a future release.

## Authentication

The MCP endpoint supports two authentication methods:

**OAuth 2.1 (browser-based):** When you add the remote MCP server, Claude Code discovers the OAuth metadata at `/.well-known/oauth-authorization-server` and opens a browser for authorization. Tokens are managed automatically (1-hour access tokens, 30-day refresh tokens).

**API keys (headless):** Pass an organization API key (`kh_` prefix) as a Bearer token. Create one at [app.keeperhub.com](https://app.keeperhub.com) under Settings > API Keys > Organisation tab.

## Organization Scoping

Each MCP connection is scoped to a single organization. The org is determined by your authentication method:

- **OAuth:** The org active in your browser session when you approve the authorization request.
- **API key:** The org the key was created in (visible on the API Keys page).

All tools operate within this org -- listing workflows, creating workflows, executing, and viewing integrations. There is no way to access another org's resources from the same connection.

### Switching Organizations

To work with a different org, re-authenticate:

**OAuth (Claude Code):** Switch your active org at [app.keeperhub.com](https://app.keeperhub.com) using the org switcher, then reconnect the MCP server. In Claude Code, remove and re-add the server:

```bash
claude mcp remove keeperhub
claude mcp add --transport http keeperhub https://app.keeperhub.com/mcp
```

Complete the OAuth flow again -- the new active org will be captured.

**API key:** Create a separate API key in the target org and update the MCP server configuration with the new key.

### Working with Multiple Organizations

If you regularly work across multiple orgs, add a separate MCP server entry for each:

```json
{
  "mcpServers": {
    "keeperhub-acme": {
      "type": "http",
      "url": "https://app.keeperhub.com/mcp",
      "headers": { "Authorization": "Bearer kh_acme_key" }
    },
    "keeperhub-personal": {
      "type": "http",
      "url": "https://app.keeperhub.com/mcp",
      "headers": { "Authorization": "Bearer kh_personal_key" }
    }
  }
}
```

Each server entry has its own tool namespace, so the AI agent can distinguish which org to target based on the server name.

## Tools Reference

### Workflow Management

| Tool | Description |
|------|-------------|
| `list_workflows` | List all workflows in the organization. Accepts `limit` and `offset` for pagination. |
| `get_workflow` | Get full workflow configuration by ID including nodes and edges. |
| `create_workflow` | Create a workflow with explicit nodes and edges. Call `list_action_schemas` first to get valid action types. |
| `update_workflow` | Update a workflow's name, description, nodes, edges, or enabled state. Pass `enabled: false` to halt schedule, event, block, or webhook triggers without deleting the workflow. |
| `delete_workflow` | Permanently delete a workflow and stop all its executions. Use `force: true` to delete workflows with execution history (cascades to all runs and logs). |

### Execution

| Tool | Description |
|------|-------------|
| `execute_workflow` | Manually trigger a workflow. Returns an execution ID for status polling. |
| `get_execution_status` | Check whether an execution is pending, running, completed, or failed. |
| `get_execution_logs` | Get detailed logs including transaction hashes, API responses, and errors. |

### AI Generation

| Tool | Description |
|------|-------------|
| `ai_generate_workflow` | Generate a workflow from a natural language prompt. Optionally modifies an existing workflow. |

### Action Schemas

| Tool | Description |
|------|-------------|
| `list_action_schemas` | List available action types and their configuration fields. Filter by category: `web3`, `discord`, `sendgrid`, `webhook`, `system`. |

### Plugins

| Tool | Description |
|------|-------------|
| `search_plugins` | Search plugins by name or category (`web3`, `messaging`, `integration`, `notification`). |
| `get_plugin` | Get full plugin documentation with optional examples and config field details. |
| `validate_plugin_config` | Validate an action configuration against its schema. Returns errors and suggestions. |

### Templates

| Tool | Description |
|------|-------------|
| `search_templates` | Search pre-built workflow templates by query, category, or difficulty. |
| `get_template` | Get template metadata and setup guide. |
| `deploy_template` | Deploy a template to your account with optional node customizations. |

### Integrations

| Tool | Description |
|------|-------------|
| `list_integrations` | List configured integrations. Filter by type (`web3`, `discord`, `sendgrid`, etc.). |
| `get_wallet_integration` | Get the wallet integration ID needed for write operations (transfers, contract calls). |

### Documentation

| Tool | Description |
|------|-------------|
| `tools_documentation` | Get documentation for any MCP tool. Use without arguments for a full tool list. |

## Resources

The server exposes two MCP resources:

| URI | Description |
|-----|-------------|
| `keeperhub://workflows` | List of all workflows |
| `keeperhub://workflows/{id}` | Full workflow configuration |

## Creating a Workflow

A typical workflow creation flow:

1. **Discover actions** -- call `list_action_schemas` with a category to see available action types and their required fields
2. **Build nodes** -- construct trigger and action nodes with the correct `actionType` values
3. **Connect nodes** -- define edges from trigger to actions in execution order
4. **Create** -- call `create_workflow` with nodes and edges (auto-layouts positions)
5. **Test** -- call `execute_workflow` and poll `get_execution_status`

### Node Structure

```json
{
  "id": "check-balance",
  "type": "action",
  "data": {
    "label": "Check Balance",
    "description": "Check wallet ETH balance",
    "type": "action",
    "config": {
      "actionType": "web3/check-balance",
      "network": "11155111",
      "address": "0x..."
    },
    "status": "idle"
  }
}
```

Trigger nodes use `type: "trigger"` with a `triggerType` in the config (`Manual`, `Schedule`, `Webhook`, `Event`).

### Edge Structure

Edges connect nodes and define execution flow:

```json
{
  "id": "edge-1",
  "source": "trigger-1",
  "target": "check-balance"
}
```

For **Condition nodes** and **For Each nodes**, edges require a `sourceHandle` field:

```json
{
  "id": "edge-2",
  "source": "condition-1",
  "target": "send-alert",
  "sourceHandle": "true"
}
```

| Source Node Type | sourceHandle Values |
|------------------|---------------------|
| Condition | `"true"` or `"false"` |
| For Each | `"loop"` or `"done"` |
| Other nodes | Omit field |

### Condition Nodes

Condition nodes have dual output paths with `true` and `false` source handles. Connect downstream nodes to the appropriate handle to create if/else logic in a single Condition node.

Conditions support these operators: `==` (soft equals), `===` (equals), `!=` (soft not equals), `!==` (not equals), `>`, `>=`, `<`, `<=`, `contains`, `startsWith`, `endsWith`, `matchesRegex`, `isEmpty`, `isNotEmpty`, `exists`, `doesNotExist`.

Conditions reference previous node outputs using template syntax: `{{@nodeId:Label.field}}`.

## Web3 Action Reference

### Read Actions (no wallet required)

| Action | Required Fields |
|--------|----------------|
| `web3/check-balance` | `network`, `address` |
| `web3/check-token-balance` | `network`, `address`, `tokenAddress` |
| `web3/read-contract` | `network`, `contractAddress`, `functionName` |

### Write Actions (require wallet integration)

| Action | Required Fields |
|--------|----------------|
| `web3/transfer-funds` | `network`, `toAddress`, `amount`, `walletId` |
| `web3/transfer-token` | `network`, `toAddress`, `tokenAddress`, `amount`, `walletId` |
| `web3/write-contract` | `network`, `contractAddress`, `functionName`, `walletId` |

Get the `walletId` by calling `get_wallet_integration`.

The `network` field accepts chain IDs as strings: `"1"` (Ethereum mainnet), `"11155111"` (Sepolia), `"8453"` (Base), `"42161"` (Arbitrum), `"137"` (Polygon).

## Error Handling

All tools return errors in this format:

```json
{
  "content": [{ "type": "text", "text": "Error: <message>" }],
  "isError": true
}
```

| Code | Meaning |
|------|---------|
| 401 | Invalid or missing API key |
| 404 | Workflow or execution not found |
| 400 | Invalid parameters |
| 500 | Server error |

---
title: "Agentic Wallets"
description: "Install an x402/MPP wallet in your AI agent to pay for KeeperHub workflows or any x402/MPP service. Covers the first-party KeeperHub agentic wallet plus the main third-party options."
---

# Agentic Wallets

KeeperHub paid workflows settle via [x402](https://docs.cdp.coinbase.com/x402) on Base USDC or MPP on Tempo USDC.e: each call carries a USDC payment, and the server returns a result only after the payment is verified. To call a paid workflow, your agent needs an x402/MPP wallet.

This page covers the first-party **KeeperHub agentic wallet** (skill + npm package, server-side Turnkey custody) and the main third-party alternatives. Every wallet listed works with KeeperHub and with any other x402/MPP-compliant service.

## KeeperHub agentic wallet

A skill + npm package from KeeperHub. Custody is server-side in a per-wallet [Turnkey sub-organisation](https://docs.turnkey.com/concepts/sub-organizations), so no private key lands on disk. A `PreToolUse` hook gates every signing call against a three-tier (auto / ask / block) policy sourced from `~/.keeperhub/safety.json`.

### Install

Two steps: register the skill + safety hook, then provision a wallet. Run the commands yourself, or have your agent do it for you.

**Manual:**

```bash
npx -p @keeperhub/wallet keeperhub-wallet skill install
npx -p @keeperhub/wallet keeperhub-wallet add
```

**Have your agent do it:** paste this prompt:

> Install the KeeperHub agentic wallet: run `npx -p @keeperhub/wallet keeperhub-wallet skill install` to register the skill and safety hook, then `npx -p @keeperhub/wallet keeperhub-wallet add` to provision a new wallet. Report the subOrgId and wallet address when done.

The install step writes the skill file into every detected agent skill directory (Claude Code, Cursor, Cline, Windsurf, OpenCode) and registers the `keeperhub-wallet-hook` `PreToolUse` safety hook in `~/.claude/settings.json`. The `add` step provisions a fresh Turnkey sub-organisation and writes `~/.keeperhub/wallet.json` (mode `0600`). The file contains only your sub-org identifier, your EVM wallet address, and an HMAC shared secret used to authenticate signing requests against KeeperHub — **no private key**. The signing key material is generated inside [Turnkey's secure enclave](https://docs.turnkey.com/concepts/overview#the-system-level-threat-model-we-solve) and never leaves it; nothing in `wallet.json` alone is enough to sign a transaction.

Restart your agent session once after this so it picks up the newly installed skill.

### First payment

The wallet handles payment; the agent still needs a way to discover and call KeeperHub workflows. That comes from the [KeeperHub MCP server](/ai-tools/mcp-server), which exposes the `search_workflows` and `call_workflow` meta-tools to your agent. You can install the MCP server on its own (see the [MCP server](/ai-tools/mcp-server) page) or bundled with the [KeeperHub Claude Code plugin](/ai-tools/claude-code-plugin), which wires both the MCP server and (soon) the wallet skill in one step.

With MCP + wallet both installed, ask your agent in plain language:

> Use KeeperHub to check the ETH balance of `0xC300B53616532FDB0116bcE916c9307377362B51`.

> Run the KeeperHub `mcp-test` workflow for `0xC300...`.

The agent discovers available workflows at runtime through the KeeperHub meta-tools (`search_workflows` + `call_workflow`) and picks the best match. When a paid workflow returns a `402`, the wallet intercepts the challenge, signs through the server-side proxy (x402 on Base USDC or MPP on Tempo USDC.e), and the call retries transparently. Most KeeperHub paid workflows accept both protocols; today the wallet pays via x402 by default and uses MPP when the workflow is MPP-only. If the amount exceeds your `auto_approve_max_usd` the safety hook surfaces an inline permission prompt before any payment is authorised.

### Safety hooks

Every wallet signing call is gated by a `PreToolUse` hook that reads thresholds from `~/.keeperhub/safety.json` (never from the transaction payload):

| Tier  | Behaviour                                                                 |
|-------|---------------------------------------------------------------------------|
| auto  | Amount at or below `auto_approve_max_usd` signs without prompting.        |
| ask   | Amount above `auto_approve_max_usd` and at or below `block_threshold_usd` returns `{decision: "ask"}` so Claude Code surfaces an inline prompt in the agent chat. |
| block | Amount above `block_threshold_usd`, or a contract not in `allowlisted_contracts`, is denied without calling `/sign`. |

The hook reads only the payment-challenge fields `amount`, `unit`, and the asset contract address from the tool payload. Forged fields like `trust-level hint` or `admin-override` are ignored by design.

### Server-side hard limits

Beyond the client-side hook, a set of Turnkey-enforced policies apply to every wallet and cannot be bypassed by editing `safety.json` or changing the agent's hook. They are created per sub-organisation at provision time and enforced by Turnkey itself on every signing activity:

- **Contract allowlist.** Signing is denied on any call whose target contract is not Base USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) or Tempo USDC.e (`0x20C000000000000000000000B9537D11c60E8b50`). On the EIP-712 (x402) signing path the same restriction is applied against the typed-data domain's verifying contract.
- **Per-transfer cap.** `transfer()` or `transferFrom()` of more than 100 USDC is denied. The same 100 USDC ceiling applies to EIP-3009 `TransferWithAuthorization` typed-data signing.
- **Approval cap.** `approve()` above 100 USDC is denied. Anything over the same 100 USDC per-transfer ceiling is rejected.
- **Chain allowlist.** EIP-712 signing is denied for any `domain.chainId` outside Base (8453), Tempo mainnet (4217), and Tempo testnet (42431).
- **Daily spend cap.** Aggregate signed payments per wallet are bounded at **200 USDC per UTC day** by default. Requests that would exceed the cap return `429 DAILY_CAP_EXCEEDED` with a `Retry-After` header counting down to the next UTC midnight. The cap protects against a compromised HMAC secret being used to drain the wallet faster than an operator can notice and rotate. If a legitimate workflow needs a higher cap, contact KeeperHub support.

These are defence-in-depth: even if an attacker bypassed the client-side hook entirely, Turnkey rejects the signature. They are also **not user-configurable today**. If you have a legitimate need to sign transfers above 100 USDC or to interact with contracts outside the USDC allowlist, contact KeeperHub support — a sub-organisation with a different policy set is possible but requires an operator action. Self-serve higher-cap configuration is on the roadmap.

### Default safety config

When `~/.keeperhub/safety.json` is absent the hook applies these defaults:

```json
{
  "auto_approve_max_usd": 5,
  "block_threshold_usd": 100,
  "allowlisted_contracts": [
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x20C000000000000000000000B9537D11c60E8b50"
  ]
}
```

The two allowlisted addresses are the only tokens the client-side hook will authorise out of the box:

- `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` — **Base USDC**. Canonical Circle USDC contract on Base mainnet (chain id 8453). Used by x402 challenges from KeeperHub and any other x402-compliant service.
- `0x20C000000000000000000000B9537D11c60E8b50` — **Tempo USDC.e**. USDC bridge token on Tempo mainnet (chain id 4217). Used by MPP challenges from KeeperHub paid workflows that settle on Tempo.

`allowlisted_contracts` in `safety.json` is a client-side first-pass filter — the hook rejects signing calls whose target contract is not in this list. You can **narrow** it further (for example, remove Tempo USDC.e if your agent only pays on Base). You cannot **widen** it: adding a third contract here has no effect because the [server-side hard limits](#server-side-hard-limits) still restrict every signature to Base USDC + Tempo USDC.e. For access to other contracts, contact KeeperHub support so a sub-organisation with a different server-side allowlist can be provisioned.

## Alternatives

### agentcash

`agentcash` is a CLI + skill bundle from [agentcash.dev](https://agentcash.dev). It maintains a local USDC wallet and signs x402 payments on the agent's behalf.

```bash
npx agentcash add https://app.keeperhub.com
```

This walks KeeperHub's `/openapi.json`, generates a `keeperhub` skill file, and symlinks it into every detected agent skill directory. After install, agents can call `search_workflows` and `call_workflow` as first-class tools; payment is routed through the agentcash wallet automatically.

Supported agents (17 at time of writing): Claude Code, Cursor, Cline, Windsurf, Continue, Roo Code, Kilo Code, Goose, Trae, Junie, Crush, Kiro CLI, Qwen Code, OpenHands, Gemini CLI, Codex, GitHub Copilot.

> **Testing only. Do not custody real funds.**
> agentcash stores the wallet key as an **unencrypted plaintext file** at `~/.agentcash/wallet.json`. There is no passphrase, no keychain integration, and no seed-phrase backup: if the file is deleted, lost, or read by any process running as your user, the funds are gone or stolen. This is appropriate for development and automation experiments with small balances (a few dollars of USDC for test calls); it is not a production wallet.
>
> KeeperHub does not operate agentcash and is not responsible for funds stored in an agentcash wallet. Use it at your own risk and do not top it up beyond what you are willing to lose.

### Coinbase agentic wallet skills

Coinbase publishes a bundle of 9 general-purpose x402 skills that work with any x402-compliant service, KeeperHub included:

```bash
npx skills add coinbase/agentic-wallet-skills
```

This installs skills including `authenticate-wallet`, `fund`, `pay-for-service`, `search-for-service`, `send-usdc`, `trade`, `query-onchain-data`, and `x402`. The wallet is managed through Coinbase Developer Platform; payment flows route through the CDP infrastructure.

Full documentation and security risk ratings: https://skills.sh/coinbase/agentic-wallet-skills

## Comparison

| Feature                 | KeeperHub Agentic Wallet                               | agentcash                                           | Coinbase agentic-wallet-skills                                     |
|-------------------------|--------------------------------------------------------|-----------------------------------------------------|--------------------------------------------------------------------|
| Key custody             | Server-side Turnkey enclave; agent holds HMAC secret   | Plaintext JSON on disk (`~/.agentcash/wallet.json`) | Coinbase Developer Platform (CDP) managed or self-custody variants |
| Private key on disk     | Never                                                  | Yes (unencrypted)                                   | Depends on variant                                                 |
| Payment protocols       | x402 (Base USDC) + MPP (Tempo USDC.e)                  | x402                                                | x402 (Coinbase ecosystem)                                          |
| PreToolUse safety hook  | Three-tier auto/ask/block built-in                     | Not bundled                                         | Not bundled                                                        |
| Onboarding              | Zero-registration, under 60 seconds                    | Zero-registration                                   | Requires CDP account for the managed variant                       |
| Install                 | `npx -p @keeperhub/wallet keeperhub-wallet skill install`                  | `npx agentcash add https://app.keeperhub.com`       | `npx skills add coinbase/agentic-wallet-skills`                    |

## Choosing a wallet

All three wallets call any x402-compliant service, KeeperHub included. The choice comes down to custody and ecosystem fit rather than anything KeeperHub-specific.

The KeeperHub agentic wallet is a managed service: KeeperHub runs the Turnkey sub-organisation and proxies signing. You trust KeeperHub to honour the [server-side hard limits](#server-side-hard-limits) and the `PreToolUse` hook decision. In return you get no-plaintext-key storage, a three-tier safety hook out of the box, and zero-registration onboarding.

agentcash is fully self-custodial, with plaintext key material at rest. It fits development and automation experiments with small balances; it is not a production wallet for funds you care about.

Coinbase agentic wallet skills assume the CDP ecosystem for the managed variant. A good fit if you already run on CDP; otherwise it introduces Coinbase platform lock-in.

Nothing stops you installing multiple wallets side by side; they do not conflict.

## What KeeperHub exposes to the agent

Whichever wallet you install, the agent calls KeeperHub through two meta-tools (described in its OpenAPI at `/openapi.json`):

- `search_workflows` — find workflows by category, tag, or free text. Returns slug, description, inputSchema, and price for each match.
- `call_workflow` — execute a listed workflow by slug. For read workflows the call executes and returns the result; for write workflows it returns unsigned calldata `{to, data, value}` for the caller to submit.

The meta-tool pattern keeps the agent's tool list small regardless of how many workflows are listed: the agent discovers available workflows at runtime instead of registering one tool per workflow.

## Paying for calls

Paid workflows settle in USDC on Base (via x402) or USDC.e on Tempo (via MPP). Most workflows cost under `$0.05` per call. See [Marketplace](/workflows/marketplace) for the creator-side view of the same settlement.

## Known limitations

- Signing is supported on Base (8453), Tempo mainnet (4217), and Tempo testnet (42431) today. Solana, Arbitrum, Optimism and other chains are not yet supported.
- Ask-tier approvals are surfaced inline via the agent's permission prompt. A browser-based review flow for larger amounts is on the roadmap.
- Workflow discovery via the skill is scoped to KeeperHub's registry. The wallet auto-pays any x402 or MPP 402 challenge you direct it at, but discovering third-party x402 services from the agent is on the roadmap.

## FAQ

### Who controls my wallet?

KeeperHub does, today. Each wallet is a [Turnkey sub-organisation](https://docs.turnkey.com/concepts/sub-organizations) where KeeperHub holds the only root user — a server-side API key inside a Turnkey enclave. Your agent does not hold a private key. When your agent needs to pay, it sends a signed request to KeeperHub, KeeperHub checks it against the safety policy engine, and Turnkey produces the signature.

This is a custodial model. You are trusting KeeperHub to honour the policy limits on every signing call. In exchange you get zero-registration onboarding, no private keys on disk, and no seed phrase to back up.

### What stops KeeperHub signing whatever it wants?

A set of Turnkey policies, applied per sub-organisation at provision time and enforced by Turnkey itself (not by application code). Full list above under [Server-side hard limits](#server-side-hard-limits). Briefly: signing only against the Base USDC / Tempo USDC.e contracts, no `approve()` above 100 USDC, no `transfer()` or `transferFrom()` above 100 USDC, and EIP-712 signing restricted to allowlisted chain ids and verifying contracts.

If KeeperHub's operator key is compromised, the attacker is still bound by these policies. They cannot drain funds to an arbitrary address or approve an arbitrary contract to spend your balance.

### What happens if I lose `wallet.json`?

Today, the wallet is not recoverable. `wallet.json` holds the HMAC secret that authenticates your agent against KeeperHub; without it there is no way to re-authenticate to the same sub-org. Running `npx -p @keeperhub/wallet keeperhub-wallet add` again creates a brand new sub-org with a brand new address. Any funds in the old wallet stay there but are unreachable.

Back up `wallet.json` the same way you would back up an SSH key. A passkey-backed recovery path is on the roadmap.

### Can I move the wallet to another machine?

Yes. `wallet.json` is the wallet from your agent's perspective. Copy it to another machine (under `~/.keeperhub/wallet.json`, mode `0600`) and that machine speaks for the same wallet. Treat it like any other long-lived credential.

### Does KeeperHub have access to my funds?

KeeperHub can produce signatures for your wallet, but only within the limits of the [server-side hard limits](#server-side-hard-limits). KeeperHub never sees a private key — the key material lives inside Turnkey's secure enclave, and Turnkey is the one that produces signatures after KeeperHub's API key passes the policy engine.

### Why don't I have a passkey or 2FA option?

Passkey-backed sub-orgs are a more secure option Turnkey supports natively, and it's on the roadmap as an opt-in enrolment. The default today is convenience-first — onboard in under a minute, no ceremony — because that's what unblocks trying an agent-paid workflow. Users who want a break-glass signing authority and a recovery path will get a `--with-passkey` provisioning mode in a future release.

### Can I change the safety thresholds or the allowed contracts?

You can edit `~/.keeperhub/safety.json` (mode `0644`) to raise or lower `auto_approve_max_usd` and `block_threshold_usd`, or to narrow `allowlisted_contracts` (for example, drop Tempo USDC.e if your agent only pays on Base). The hook picks up changes on its next invocation.

Raising thresholds raises your exposure. Widening the contract allowlist past the server-side default (Base USDC + Tempo USDC.e) has no effect on its own — the [server-side hard limits](#server-side-hard-limits) still block signatures against any other contract. If you need access to a different contract, contact KeeperHub support.

### How are signing decisions actually enforced?

Two layers, and they're independent:

1. **Client-side hook**, running inside your agent (Claude Code, etc.). Reads `~/.keeperhub/safety.json`, classifies the amount, and either allows, asks you inline, or denies the call before it ever hits the network. This is what keeps your agent from being manipulated into calling `/sign` for amounts you didn't authorise.
2. **Server-side Turnkey policies**, enforced inside Turnkey for every signing activity. See [Server-side hard limits](#server-side-hard-limits) for the full list. They are the hard floor — a misconfigured hook or a compromised agent still cannot sign outside them.

Either layer alone isn't enough. The hook stops an agent from asking for a bad signature; the policies stop any signature from being produced outside the rules.

### What's the difference between my wallet and my KeeperHub creator wallet?

Two different things:

- The **agentic wallet** is what your agent uses to pay for workflows. It's provisioned per agent install, custodial via Turnkey, not tied to a KeeperHub account.
- A **creator wallet** is what a workflow author sets up to receive payouts. It lives on your KeeperHub account, is managed through the dashboard, and is a separate Turnkey sub-org with a different setup.

Installing an agentic wallet does not touch or affect your creator wallet, and vice versa.

### Can I delete my wallet?

Not through the CLI today. If you've stopped using a wallet and want the sub-org cleaned up, get in touch via the KeeperHub support channel with your `subOrgId` (from `npx -p @keeperhub/wallet keeperhub-wallet info`) and the operator team can remove it.

### What do I actually pay? Do I need ETH for gas?

No ETH, no gas out of your wallet for normal agentic wallet use.

- **x402 on Base.** You sign an EIP-3009 `TransferWithAuthorization` — a pre-signed authorisation that lets the x402 facilitator move USDC on your behalf. The facilitator submits the on-chain transaction and pays the gas. Your wallet only debits the USDC amount.
- **MPP on Tempo.** You sign an authorisation for the MPP facilitator to settle the USDC.e transfer for you. The facilitator pays the Tempo network fees. Your wallet only debits the USDC.e amount.

So for a `$0.05` paid workflow, `$0.05` of USDC (or USDC.e) leaves your wallet — nothing else.

If in future you use the wallet to sign a direct on-chain transaction outside the agentic workflow pattern (e.g. a manual ERC-20 transfer), you'd need native gas for that chain the same way any wallet would.

## Links

- npm: [`@keeperhub/wallet`](https://www.npmjs.com/package/@keeperhub/wallet)
- Skills registry: [`keeperhub/agentic-wallet-skills`](https://skills.sh/keeperhub/agentic-wallet-skills)
- Source: [`KeeperHub/agentic-wallet`](https://github.com/KeeperHub/agentic-wallet).





---
title: "API Overview"
description: "KeeperHub REST API reference - authentication, endpoints, rate limits, and SDKs."
---

# API Overview

The KeeperHub API allows you to programmatically manage workflows, integrations, and executions.

## Base URL

```
https://app.keeperhub.com/api
```

## Authentication

API requests require authentication. Two methods are supported, but their accepted scope differs:

- **Session**: Browser-based authentication via Better Auth. Accepted on every endpoint.
- **API Key** (`kh_`): For programmatic access to organization-scoped endpoints (workflows, integrations, billing, organization management). Not accepted on user-account, wallet write, OAuth-account-bound, or per-user endpoints.

See [Authentication](/api/authentication) for the full scope.

## Response Format

All responses are returned as JSON with the following structure:

### Success Response
```json
{
  "data": { ... }
}
```

### Error Response
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## Rate Limits

API requests are subject to rate limiting. Current limits:
- 100 requests per minute for authenticated users
- 10 requests per minute for unauthenticated requests

## Available Endpoints

| Resource | Description |
|----------|-------------|
| [Workflows](/api/workflows) | Create, read, update, delete workflows |
| [Executions](/api/executions) | Monitor workflow execution status and logs |
| [Direct Execution](/api/direct-execution) | Execute blockchain transactions without workflows |
| [Analytics](/api/analytics) | Workflow performance metrics and gas usage tracking |
| [Integrations](/api/integrations) | Manage notification and service integrations |
| [Projects](/api/projects) | Organize workflows into projects |
| [Tags](/api/tags) | Label and categorize workflows |
| [Chains](/api/chains) | List supported blockchain networks |
| [User](/api/user) | User profile, preferences, and address book |
| [Organizations](/api/organizations) | Organization membership management |
| [API Keys](/api/api-keys) | Manage API keys for programmatic access |

## SDKs

Official SDKs are planned for future release. In the meantime, you can interact with the API directly using any HTTP client or library such as `fetch`, `axios`, or `requests`.


---
title: "Authentication"
description: "KeeperHub API authentication methods - session auth and API keys."
---

# Authentication

The KeeperHub API supports two authentication methods. They are not interchangeable: their accepted scopes differ. See [Endpoint scope](#endpoint-scope) for the rules.

## Session Authentication

For browser-based applications, authentication is handled via Better Auth session cookies. Users authenticate through the standard login flow at `app.keeperhub.com`.

## API Key Authentication

For programmatic access, use API keys in the `Authorization` header:

```bash
curl -H "Authorization: Bearer kh_your_api_key" \
  https://app.keeperhub.com/api/workflows
```

### Key Types

KeeperHub has two types of API keys:

| Prefix | Scope | Created in | Used for |
|--------|-------|------------|----------|
| `kh_` | Organization | Settings > API Keys > Organisation | REST API, MCP server, Claude Code plugin |
| `wfb_` | User | Settings > API Keys | Webhook triggers |

### Creating API Keys

1. Navigate to Settings in the KeeperHub dashboard
2. Select "API Keys"
3. For organization keys (`kh_`), switch to the Organisation tab
4. Click "Create New Key"
5. Copy the key immediately. It will only be shown once.

### Key Security

- Keys are hashed with SHA256 before storage
- Only the key prefix is stored for identification
- Revoke keys immediately if compromised

## Endpoint scope

Session authentication is accepted everywhere. API keys (`kh_`) are accepted only on **organization-scoped** endpoints, the ones whose action and result depend on the caller's organization rather than on the individual user behind the key. Wallets, billing, and spending caps are all attached to the organization, so a key that authorizes on-chain spend or billable usage is necessarily organization-scoped.

### Accepted on API keys

Endpoints whose semantics are organization-scoped accept `kh_` keys:

- Workflow CRUD and execution: `/api/workflows`, `/api/executions`, `/api/execute`
- Integrations: `/api/integrations`
- Projects, tags, public tags, supported chains
- Organization-scoped billing and analytics
- Organization management (e.g. renaming an organization)
- Organization API keys (`GET /api/keys`, `DELETE /api/keys/{keyId}`); creation requires session
- Address book entries (organization-scoped)

### Session-only

Endpoints that act on a user account, hold credential material, or sit on a human approval boundary require session authentication. API keys are rejected with `401`:

- **User-account operations**: profile mutation (`PATCH /api/user`), password change, account deactivation, forgot-password
- **Per-user preferences**: RPC preferences
- **Wallet write operations**: provisioning, deletion, withdrawal, fee estimation, switching the active signing wallet, retrieving or refreshing the user share, and private-key export
- **Authentication primitives**: creating organization API keys (`POST /api/keys`), creating/listing/deleting personal webhook keys (`/api/api-keys/*`), AI Gateway OAuth flows
- **Human-in-the-loop wallet approvals**: agentic-wallet linking and approve/reject endpoints
- **Per-user state**: workflow drafts, workflow ratings, leaving an organization

If you have a use case for session-only behavior over an API key, open an issue describing it. The boundary is deliberate: it keeps a leaked API key from escalating into account control or wallet drainage.

### Webhook keys

Workflow webhook triggers (`POST /api/workflows/{workflowId}/webhook`) accept only user-scoped (`wfb_`) keys. The route reads the `Authorization` header directly; session cookies are not consulted, and `kh_` keys are rejected with `401`. The `wfb_` key must belong to the same user that owns the target workflow; a key created by another member of the same organization is rejected with `403`. Webhook executions are attributed to the individual triggering user rather than to the organization, which is why the user-binding is enforced.

## Deactivated accounts

Deactivating a user account from the dashboard immediately revokes the credentials that user holds, across every supported auth method:

- **Sessions** are deleted server-side. The user is signed out everywhere they were logged in.
- **Organization API keys** (`kh_`) the user created are soft-revoked (`revokedAt` is stamped). Subsequent requests with those keys return `401`.
- **MCP OAuth tokens** for the user are rejected at the next request, even if their TTL has not yet elapsed.

There is currently no reactivation flow. If a deactivated user wants to come back, they sign up again and provision new credentials.

## Webhook Authentication

For webhook triggers, use a user-scoped key (`wfb_`) with the workflow-specific webhook URL:

```bash
POST /api/workflows/{workflowId}/webhook
Authorization: Bearer wfb_your_api_key
```


---
title: "Workflows API"
description: "KeeperHub Workflows API - create, read, update, delete, and execute workflows."
---

# Workflows API

Manage workflows programmatically.

## List Workflows

```http
GET /api/workflows
```

Returns all workflows for the authenticated user (session) or organization (API key).

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | string | Optional. Filter workflows by project ID |
| `tagId` | string | Optional. Filter workflows by tag ID |

### Example

```http
GET /api/workflows?projectId=proj_123&tagId=tag_456
```

### Response

```json
[
  {
    "id": "wf_123",
    "name": "My Workflow",
    "description": "Monitors ETH balance",
    "visibility": "private",
    "nodes": [],
    "edges": [],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

## Get Workflow

```http
GET /api/workflows/{workflowId}
```

Returns a single workflow by ID.

### Response

```json
{
  "id": "wf_123",
  "name": "My Workflow",
  "description": "Monitors ETH balance",
  "visibility": "private",
  "nodes": [...],
  "edges": [...],
  "publicTags": [
    {
      "id": "tag_1",
      "name": "DeFi",
      "slug": "defi"
    }
  ],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "isOwner": true
}
```

Public workflows include a `publicTags` array showing all assigned tags.

## Create Workflow

```http
POST /api/workflows/create
```

### Request Body

```json
{
  "name": "New Workflow",
  "description": "Optional description",
  "projectId": "proj_123"
}
```

The `projectId` field is optional. If provided, the workflow is assigned to the specified [project](/api/projects).

### Response

Returns the created workflow with a default trigger node and an empty action node connected to it.

## Update Workflow

```http
PATCH /api/workflows/{workflowId}
```

### Request Body

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "projectId": "proj_123",
  "tagId": "tag_456",
  "nodes": [...],
  "edges": [...],
  "visibility": "private"
}
```

The `tagId` field assigns the workflow to an organization tag for categorization.

## Delete Workflow

```http
DELETE /api/workflows/{workflowId}
```

Returns `409 Conflict` if the workflow has execution history. Use the `force` query parameter to cascade delete all runs and logs:

```http
DELETE /api/workflows/{workflowId}?force=true
```

## Execute Workflow

```http
POST /api/workflow/{workflowId}/execute
```

Manually trigger a workflow execution.

### Response

```json
{
  "executionId": "exec_123",
  "runId": "run_abc123",
  "status": "pending"
}
```

The `runId` identifies the workflow execution run and is stored in the workflow execution record.

## Webhook Trigger

```http
POST /api/workflows/{workflowId}/webhook
```

Trigger a workflow via webhook. Requires API key authentication.

## Duplicate Workflow

```http
POST /api/workflows/{workflowId}/duplicate
```

Creates a copy of an existing workflow.

## Download Workflow

```http
GET /api/workflows/{workflowId}/download
```

Download workflow definition as JSON.

## Generate Code

```http
GET /api/workflows/{workflowId}/code
```

Generate SDK code for the workflow.

## Claim Workflow

```http
POST /api/workflows/{workflowId}/claim
```

Claim an anonymous workflow into the authenticated user's organization. Only the original creator of the anonymous workflow can claim it.

## Publish Workflow (Go Live)

```http
PUT /api/workflows/{workflowId}/go-live
```

Publish a workflow to make it publicly visible with metadata and tags.

### Request Body

```json
{
  "name": "Public Workflow Name",
  "publicTagIds": ["tag_1", "tag_2"]
}
```

The `name` is required. `publicTagIds` is an array of public tag IDs to associate with the workflow (maximum 5 tags).

## List Public Workflows

```http
GET /api/workflows/public
```

Returns all public workflows with optional filtering.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `featured` | boolean | Optional. Filter for featured workflows (`?featured=true`) |
| `featuredProtocol` | string | Optional. Filter for protocol-featured workflows (e.g., `?featuredProtocol=sky`) |
| `tag` | string | Optional. Filter by public tag slug (e.g., "defi", "nft") |

### Response

```json
[
  {
    "id": "wf_123",
    "name": "Public Workflow",
    "description": "Description",
    "nodes": [...],
    "edges": [...],
    "publicTags": [
      {
        "id": "tag_1",
        "name": "DeFi",
        "slug": "defi"
      }
    ],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

## Workflow Taxonomy

```http
GET /api/workflows/taxonomy
```

Returns distinct categories and protocols from all public workflows. Useful for building filter UIs.

### Response

```json
{
  "categories": ["defi", "nft"],
  "protocols": ["uniswap", "aave-v3"]
}
```

## Update Featured Status (Internal)

```http
POST /api/hub/featured
```

Mark a workflow as featured in the hub. Requires internal service authentication (`hub` service). Accepts optional `category`, `protocol`, and `featuredOrder` fields alongside the `workflowId`.


---
title: "Executions API"
description: "KeeperHub Executions API - monitor workflow execution status and retrieve logs."
---

# Executions API

Monitor and manage workflow executions.

## List Executions

```http
GET /api/workflows/{workflowId}/executions
```

Returns execution history for a workflow.

### Response

```json
{
  "data": [
    {
      "id": "exec_123",
      "workflowId": "wf_456",
      "status": "success",
      "input": {...},
      "output": {...},
      "createdAt": "2024-01-01T00:00:00Z",
      "completedAt": "2024-01-01T00:00:05Z"
    }
  ]
}
```

## Get Execution Status

```http
GET /api/workflows/executions/{executionId}/status
```

Returns real-time execution status with progress tracking.

### Response

```json
{
  "status": "running",
  "nodeStatuses": [
    { "nodeId": "node_1", "status": "success" },
    { "nodeId": "node_2", "status": "running" }
  ],
  "progress": {
    "totalSteps": 3,
    "completedSteps": 1,
    "runningSteps": 1,
    "currentNodeId": "node_2",
    "percentage": 33
  }
}
```

### Status Values

| Status | Description |
|--------|-------------|
| `pending` | Execution queued |
| `running` | Currently executing |
| `success` | Completed successfully |
| `error` | Failed with error |
| `cancelled` | Manually cancelled |

## Get Execution Logs

```http
GET /api/workflows/executions/{executionId}/logs
```

Returns detailed logs for each node in the execution.

### Response

```json
{
  "data": [
    {
      "nodeId": "node_1",
      "nodeName": "Check Balance",
      "nodeType": "trigger",
      "status": "success",
      "input": {...},
      "output": {...},
      "duration": 1234,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Event Trigger Outputs**: When a workflow is triggered by a blockchain event, the trigger node's `output` object automatically includes block explorer links:
- `transactionLink` - Direct link to the transaction in the block explorer (when the event contains a transaction hash)
- `addressLink` - Direct link to the address in the block explorer (when the event contains an address)

These links are generated using the network's configured block explorer and are available in addition to the standard event data fields.

## Delete Executions

```http
DELETE /api/workflows/{workflowId}/executions
```

Bulk delete execution history for a workflow.


---
title: "Direct Execution API"
description: "KeeperHub Direct Execution API - execute blockchain transactions without workflows."
---

# Direct Execution API

The Direct Execution API allows you to execute blockchain transactions directly without creating workflows. All endpoints require API key authentication and are subject to rate limiting and spending caps.

## Authentication

All direct execution endpoints require an API key passed in the `X-API-Key` header:

```http
X-API-Key: keeper_...
```

See [API Keys](/api/api-keys) for details on creating and managing API keys.

## Rate Limits

Direct execution requests are limited to 60 requests per minute per API key. When rate limited, the API returns a `429` status with a `Retry-After` header indicating seconds to wait.

## Spending Caps

Organizations can configure daily spending caps in wei. If the cap is exceeded, execution requests return a `422` status with error code `SPENDING_CAP_EXCEEDED`.

## Transfer Funds

```http
POST /api/execute/transfer
```

Transfer native tokens (ETH, MATIC, etc.) or ERC-20 tokens directly.

### Request Body

```json
{
  "network": "ethereum",
  "recipientAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "amount": "0.1",
  "tokenAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "gasLimitMultiplier": "1.2"
}
```

**Parameters:**

- `network` (required): Blockchain network name (e.g., `ethereum`, `base`, `polygon`)
- `recipientAddress` (required): Destination wallet address
- `amount` (required): Amount in human-readable units (e.g., "0.1" for 0.1 ETH or tokens)
- `tokenAddress` (optional): ERC-20 token contract address. Omit for native token transfers.
- `tokenConfig` (optional): JSON string with token metadata for non-standard tokens: `{"decimals":18,"symbol":"USDC"}`
- `gasLimitMultiplier` (optional): Gas limit multiplier (e.g., "1.5" for 50% buffer)

### Response

```json
{
  "executionId": "direct_123",
  "status": "completed"
}
```

The execution runs synchronously. Status will be `completed` or `failed` when the request returns.

## Call Smart Contract

```http
POST /api/execute/contract-call
```

Call any smart contract function. Automatically detects read vs write operations.

### Request Body

```json
{
  "contractAddress": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  "network": "ethereum",
  "functionName": "balanceOf",
  "functionArgs": "[\"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\"]",
  "abi": "[{...}]",
  "value": "0",
  "gasLimitMultiplier": "1.2"
}
```

**Parameters:**

- `contractAddress` (required): Smart contract address
- `network` (required): Blockchain network name
- `functionName` (required): Name of the function to call
- `functionArgs` (optional): JSON array string of function arguments (e.g., `"[\"0x...\", \"1000\"]"`)
- `abi` (optional): Contract ABI as JSON string. Auto-fetched from block explorer if omitted.
- `value` (optional): ETH value to send with the call in wei (for payable functions)
- `gasLimitMultiplier` (optional): Gas limit multiplier

### Response

**Read Function (view/pure):**

```json
{
  "result": "1500000000000000000"
}
```

Read functions return immediately with the result value.

**Write Function:**

```json
{
  "executionId": "direct_123",
  "status": "completed"
}
```

Write functions execute synchronously and return execution status.

## Check and Execute

```http
POST /api/execute/check-and-execute
```

Read a contract value, evaluate a condition, and conditionally execute a write operation.

### Request Body

```json
{
  "contractAddress": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  "network": "ethereum",
  "functionName": "balanceOf",
  "functionArgs": "[\"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\"]",
  "abi": "[{...}]",
  "condition": {
    "operator": "gt",
    "value": "1000000000000000000"
  },
  "action": {
    "contractAddress": "0x...",
    "functionName": "transfer",
    "functionArgs": "[\"0x...\", \"500000000000000000\"]",
    "abi": "[{...}]",
    "gasLimitMultiplier": "1.2"
  }
}
```

**Condition Operators:**

- `eq`: Equal to
- `neq`: Not equal to
- `gt`: Greater than
- `lt`: Less than
- `gte`: Greater than or equal to
- `lte`: Less than or equal to

### Response

**Condition Not Met:**

```json
{
  "executed": false,
  "condition": {
    "met": false,
    "observedValue": "500000000000000000",
    "targetValue": "1000000000000000000",
    "operator": "gt"
  }
}
```

**Condition Met and Action Executed:**

```json
{
  "executed": true,
  "executionId": "direct_123",
  "status": "completed",
  "condition": {
    "met": true,
    "observedValue": "1500000000000000000",
    "targetValue": "1000000000000000000",
    "operator": "gt"
  }
}
```

## Get Execution Status

```http
GET /api/execute/{executionId}/status
```

Check the status of a direct execution.

### Response

```json
{
  "executionId": "direct_123",
  "status": "completed",
  "type": "transfer",
  "transactionHash": "0x...",
  "transactionLink": "https://etherscan.io/tx/0x...",
  "gasUsedWei": "21000000000000",
  "result": {...},
  "error": null,
  "createdAt": "2024-01-01T00:00:00Z",
  "completedAt": "2024-01-01T00:00:15Z"
}
```

**Status Values:**

- `pending`: Queued for execution
- `running`: Currently executing
- `completed`: Successfully completed
- `failed`: Execution failed

## Error Responses

Direct execution endpoints return detailed error information:

```json
{
  "error": "Missing required field",
  "field": "network",
  "details": "network is required and must be a non-empty string"
}
```

**Common Error Codes:**

- `401`: Invalid or missing API key
- `422`: Wallet not configured (see [Wallet Management](/wallet-management/para))
- `429`: Rate limit exceeded
- `400`: Invalid request parameters


---
title: "Analytics API"
description: "KeeperHub Analytics API - monitor workflow performance, gas usage, and execution trends."
---

# Analytics API

The Analytics API provides insights into workflow and direct execution performance, gas usage, and execution trends across your organization.

## Get Analytics Summary

```http
GET /api/analytics/summary
```

Returns aggregated analytics for the organization including run counts, success rates, and gas usage.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `range` | string | Time range: `24h`, `7d`, `30d`, `90d`, `custom` (default: `30d`) |
| `customStart` | string | ISO timestamp for custom range start |
| `customEnd` | string | ISO timestamp for custom range end |

### Response

```json
{
  "totalRuns": 1250,
  "successfulRuns": 1180,
  "failedRuns": 70,
  "successRate": 94.4,
  "totalGasUsedWei": "15000000000000000",
  "avgExecutionTimeMs": 2340
}
```

**Field Definitions**

| Field | Type | Description |
|-------|------|-------------|
| `totalRuns` | number | Combined count of workflow executions and direct executions |
| `successfulRuns` | number | Number of executions that completed successfully |
| `failedRuns` | number | Number of executions that failed |
| `successRate` | number | Percentage of successful executions (0-100) |
| `totalGasUsedWei` | string | Total gas consumed in wei across both workflow executions and direct executions |
| `avgExecutionTimeMs` | number | Average execution duration in milliseconds |

## Get Time Series Data

```http
GET /api/analytics/time-series
```

Returns time-bucketed run counts for charting execution volume over time.

### Query Parameters

Same as summary endpoint.

### Response

```json
{
  "buckets": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "runCount": 42,
      "successCount": 40,
      "failedCount": 2
    }
  ]
}
```

## Get Network Breakdown

```http
GET /api/analytics/networks
```

Returns execution counts and gas usage grouped by blockchain network. Gas totals include both workflow executions and direct executions on each network.

### Query Parameters

Same as summary endpoint.

### Response

```json
{
  "networks": [
    {
      "network": "ethereum",
      "runCount": 520,
      "gasUsedWei": "8000000000000000"
    },
    {
      "network": "base",
      "runCount": 380,
      "gasUsedWei": "2500000000000000"
    }
  ]
}
```

## List Runs

```http
GET /api/analytics/runs
```

Returns a unified list of both workflow executions and direct executions with pagination.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `range` | string | Time range filter (same as summary) |
| `customStart` | string | ISO timestamp for custom range start |
| `customEnd` | string | ISO timestamp for custom range end |
| `status` | string | Filter by status: `pending`, `running`, `success`, `error` |
| `source` | string | Filter by source: `workflow`, `direct` |
| `limit` | number | Results per page (default: 50) |
| `cursor` | string | Pagination cursor from previous response |

### Response

```json
{
  "runs": [
    {
      "id": "exec_123",
      "source": "workflow",
      "workflowId": "wf_456",
      "workflowName": "Monitor ETH Balance",
      "status": "success",
      "createdAt": "2024-01-01T00:00:00Z",
      "completedAt": "2024-01-01T00:00:05Z",
      "durationMs": 5000
    },
    {
      "id": "direct_789",
      "source": "direct",
      "type": "transfer",
      "network": "ethereum",
      "status": "success",
      "transactionHash": "0x...",
      "gasUsedWei": "21000000000000",
      "createdAt": "2024-01-01T00:01:00Z",
      "completedAt": "2024-01-01T00:01:15Z"
    }
  ],
  "nextCursor": "cursor_abc123"
}
```

## Get Run Step Logs

```http
GET /api/analytics/runs/{executionId}/steps
```

Returns detailed step-by-step logs for a specific execution.

### Response

```json
{
  "steps": [
    {
      "nodeId": "node_1",
      "nodeName": "Trigger",
      "status": "success",
      "input": {...},
      "output": {...},
      "durationMs": 120,
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Get Spend Cap Data

```http
GET /api/analytics/spend-cap
```

Returns current spending status against configured daily spending caps.

### Response

```json
{
  "dailyCapWei": "100000000000000000",
  "spentTodayWei": "25000000000000000",
  "remainingWei": "75000000000000000",
  "percentUsed": 25.0
}
```

## Stream Analytics (SSE)

```http
GET /api/analytics/stream
```

Server-Sent Events endpoint for real-time analytics updates.

### Query Parameters

Same as summary endpoint.

### Event Format

```
data: {"type":"summary","data":{...}}

data: {"type":"summary","data":{...}}
```

The stream sends updated summary data every 2 seconds when changes are detected, with automatic reconnection and heartbeat support.

---
title: "Integrations API"
description: "KeeperHub Integrations API - manage notification providers and service connections."
---

# Integrations API

Manage integrations for notifications and external services.

## Supported Integration Types

| Type | Description |
|------|-------------|
| `discord` | Discord webhook notifications |
| `slack` | Slack workspace integration |
| `telegram` | Telegram bot messaging |
| `sendgrid` | Email via SendGrid |
| `resend` | Email via Resend |
| `safe` | Safe multisig API integration |
| `webhook` | Custom HTTP webhooks |
| `web3` | Web3 wallet connections |
| `ai-gateway` | AI service integrations |

## List Integrations

```http
GET /api/integrations
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by integration type |

### Response

```json
{
  "data": [
    {
      "id": "int_123",
      "name": "My Discord",
      "type": "discord",
      "isManaged": false,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

Note: Integration config is excluded from list responses for security.

## Get Integration

```http
GET /api/integrations/{integrationId}
```

Returns full integration details including configuration.

## Create Integration

```http
POST /api/integrations
```

### Request Body

```json
{
  "name": "My Slack Integration",
  "type": "slack",
  "config": {
    "webhookUrl": "https://hooks.slack.com/..."
  }
}
```

## Update Integration

```http
PUT /api/integrations/{integrationId}
```

### Request Body

```json
{
  "name": "Updated Name",
  "config": {
    "webhookUrl": "https://new-webhook-url..."
  }
}
```

## Delete Integration

```http
DELETE /api/integrations/{integrationId}
```

## Test Integration

```http
POST /api/integrations/{integrationId}/test
```

Tests the integration credentials and connectivity.

### Request Body (Optional)

```json
{
  "configOverrides": {
    "webhookUrl": "https://test-webhook-url..."
  }
}
```

The `configOverrides` field allows testing with temporary configuration values without modifying the saved integration.

### Response

```json
{
  "status": "success",
  "message": "Integration test successful"
}
```

---
title: "Projects API"
description: "KeeperHub Projects API - organize workflows into projects with custom colors."
---

# Projects API

Organize workflows into projects for better management.

## List Projects

```http
GET /api/projects
```

Returns all projects for the current organization, including workflow counts.

### Response

```json
[
  {
    "id": "proj_123",
    "name": "DeFi Monitoring",
    "description": "All DeFi-related workflows",
    "color": "#4A90D9",
    "organizationId": "org_456",
    "workflowCount": 5,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

## Create Project

```http
POST /api/projects
```

### Request Body

```json
{
  "name": "My Project",
  "description": "Optional description",
  "color": "#7B61FF"
}
```

The `color` field is optional. If omitted, a color is automatically assigned from a default palette.

### Response

Returns the created project with `status: 201`.

## Update Project

```http
PATCH /api/projects/{projectId}
```

### Request Body

All fields are optional. Only provided fields are updated.

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "color": "#E06C75"
}
```

## Delete Project

```http
DELETE /api/projects/{projectId}
```

Deletes the project. Workflows assigned to this project are not deleted but become unassigned.

---
title: "Tags API"
description: "KeeperHub Tags API - organize workflows with custom tags and public tags."
---

# Tags API

Manage workflow organization tags.

## Organization Tags

Organization tags are private labels for categorizing workflows within your organization.

### List Organization Tags

```http
GET /api/tags
```

Returns all tags for the current organization, including workflow counts.

#### Response

```json
[
  {
    "id": "tag_123",
    "name": "Production",
    "color": "#4A90D9",
    "organizationId": "org_456",
    "userId": "user_789",
    "workflowCount": 12,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

### Create Organization Tag

```http
POST /api/tags
```

#### Request Body

```json
{
  "name": "My Tag",
  "color": "#7B61FF"
}
```

Both fields are required.

### Update Organization Tag

```http
PATCH /api/tags/{tagId}
```

#### Request Body

```json
{
  "name": "Updated Name",
  "color": "#E06C75"
}
```

Both fields are optional. Only provided fields are updated.

### Delete Organization Tag

```http
DELETE /api/tags/{tagId}
```

Deletes the tag. Workflows assigned to this tag become untagged.

## Public Tags

Public tags are system-wide labels used for categorizing public workflows in the hub.

### List Public Tags

```http
GET /api/public-tags
```

Returns all public tags with workflow counts.

#### Response

```json
[
  {
    "id": "tag_1",
    "name": "DeFi",
    "slug": "defi",
    "workflowCount": 42,
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

### Create Public Tag

```http
POST /api/public-tags
```

Creates a new public tag. Requires authentication.

#### Request Body

```json
{
  "name": "NFT"
}
```

The slug is automatically generated from the name (e.g., "NFT" becomes "nft").

---
title: "Chains API"
description: "KeeperHub Chains API - list supported blockchain networks and fetch contract ABIs."
---

# Chains API

Access supported blockchain networks and contract information.

## List Chains

```http
GET /api/chains
```

Returns all supported blockchain networks.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `includeDisabled` | boolean | Include disabled chains (default: false) |

### Response

```json
{
  "data": [
    {
      "id": "chain_1",
      "chainId": 1,
      "name": "Ethereum Mainnet",
      "symbol": "ETH",
      "chainType": "evm",
      "defaultPrimaryRpc": "https://...",
      "defaultFallbackRpc": "https://...",
      "explorerUrl": "https://etherscan.io",
      "explorerApiUrl": "https://api.etherscan.io",
      "isTestnet": false,
      "isEnabled": true
    },
    {
      "id": "chain_2",
      "chainId": 11155111,
      "name": "Sepolia",
      "symbol": "ETH",
      "chainType": "evm",
      "isTestnet": true,
      "isEnabled": true
    }
  ]
}
```

### Chain Types

| Type | Description |
|------|-------------|
| `evm` | Ethereum Virtual Machine compatible |
| `solana` | Solana network |

## Fetch Contract ABI

```http
GET /api/chains/{chainId}/abi?address={contractAddress}
```

Fetches the ABI for a verified contract from the block explorer.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | Contract address (required) |

### Response

```json
{
  "abi": [
    {
      "type": "function",
      "name": "balanceOf",
      "inputs": [{"name": "account", "type": "address"}],
      "outputs": [{"name": "", "type": "uint256"}]
    }
  ]
}
```

## Alternative ABI Fetch

```http
GET /api/web3/fetch-abi?address={address}&chainId={chainId}
```

Alternative endpoint for fetching contract ABIs.

---
title: "User API"
description: "KeeperHub User API - manage user profile, wallet, and RPC preferences."
---

# User API

Manage user profile and preferences.

> **Authentication.** Profile and wallet read operations in this section accept either a session cookie or an organization API key (`kh_`). Mutating operations require **session authentication** and reject API keys with `401`: profile mutation, password change, forgot-password, account deactivation, RPC preferences, and every wallet write operation (withdraw, share, refresh-share, export-key, active wallet switch, fee estimation). Address book entries are organization-scoped and accept either method. See [Authentication](/api/authentication#endpoint-scope) for the full scope rules.

## Get User Profile

```http
GET /api/user
```

### Response

```json
{
  "id": "user_123",
  "name": "John Doe",
  "email": "john@example.com",
  "image": "https://...",
  "isAnonymous": false,
  "providerId": "google",
  "walletAddress": "0x..."
}
```

## Update User Profile

```http
PATCH /api/user
```

Note: OAuth users cannot update email or name.

### Request Body

```json
{
  "name": "New Name"
}
```

## Get User Wallet

```http
GET /api/user/wallet
```

Returns the user's Para wallet information.

### Response

```json
{
  "address": "0x...",
  "balances": {
    "1": "1.5",
    "11155111": "0.1"
  }
}
```

## RPC Preferences

Manage custom RPC endpoints per chain.

### List RPC Preferences

```http
GET /api/user/rpc-preferences
```

### Response

```json
{
  "data": [
    {
      "chainId": 1,
      "primaryRpc": "https://custom-rpc.example.com",
      "fallbackRpc": "https://fallback.example.com"
    }
  ]
}
```

### Set RPC Preferences

```http
POST /api/user/rpc-preferences
```

### Request Body

```json
{
  "chainId": 1,
  "primaryRpc": "https://custom-rpc.example.com",
  "fallbackRpc": "https://fallback.example.com"
}
```

### Get Chain RPC Preference

```http
GET /api/user/rpc-preferences/{chainId}
```

### Update Chain RPC Preference

```http
PUT /api/user/rpc-preferences/{chainId}
```

### Delete Chain RPC Preference

```http
DELETE /api/user/rpc-preferences/{chainId}
```

Reverts to default RPC endpoints for the chain.

## Change Password

```http
POST /api/user/password
```

Change the password for a credential-based account. Requires the current password and a new password (minimum 8 characters). Not available for OAuth-only accounts.

### Request Body

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

## Forgot Password

```http
POST /api/user/forgot-password
```

Handles password reset via OTP. Supports two actions controlled by the `action` field in the request body.

**Request OTP** (default when `action` is omitted or set to `"request"`):

```json
{
  "email": "user@example.com"
}
```

**Reset password** (`action: "reset"`):

```json
{
  "action": "reset",
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "new-password"
}
```

The OTP expires after 5 minutes. OAuth-only accounts receive a notification email instead of a reset code.

## Deactivate Account

```http
POST /api/user/delete
```

Soft-deletes the authenticated user account. Requires a confirmation string in the request body. Invalidates all active sessions on success. Not available for anonymous users.

### Request Body

```json
{
  "confirmation": "DEACTIVATE"
}
```

## Address Book

Manage saved Ethereum addresses scoped to the active organization. All address book endpoints require an active organization context.

### List Address Book Entries

```http
GET /api/address-book
```

Returns all address book entries for the active organization, ordered by creation date (newest first).

### Create Address Book Entry

```http
POST /api/address-book
```

#### Request Body

```json
{
  "label": "Treasury Wallet",
  "address": "0x..."
}
```

The address must be a valid Ethereum address.

### Update Address Book Entry

```http
PATCH /api/address-book/{entryId}
```

Update the label or address of an existing entry. Both fields are optional.

### Delete Address Book Entry

```http
DELETE /api/address-book/{entryId}
```

Removes the entry from the organization address book.

---
title: "Organizations API"
description: "KeeperHub Organizations API - manage organization membership."
---

# Organizations API

Manage organization membership programmatically.

## Leave Organization

```http
POST /api/organizations/{organizationId}/leave
```

Remove yourself from an organization. If you are the sole owner, you must transfer ownership by providing `newOwnerMemberId` in the request body. The new owner must be an accepted member of the organization.

### Request Body

```json
{
  "newOwnerMemberId": "member_456"
}
```

The `newOwnerMemberId` field is only required when you are the last remaining owner.

---
title: "API Keys"
description: "KeeperHub API Keys - create and manage API keys for programmatic access."
---

# API Keys

Manage API keys for programmatic access to the KeeperHub API.

## Key Types

KeeperHub has two distinct key systems, managed at different endpoints. They are not interchangeable.

| Prefix | Scope | Managed at | Used for |
|--------|-------|------------|----------|
| `kh_` | Organization | `/api/keys` | REST API, MCP server, Claude Code plugin |
| `wfb_` | User | `/api/api-keys` | Webhook triggers |

For typical programmatic API access use organization (`kh_`) keys.

## Organization Keys (`kh_`)

Issued per-organization. Create them from Settings > API Keys > Organisation in the dashboard, or via the endpoints below.

### List Organization Keys

```http
GET /api/keys
```

Accepts session or API-key authentication. Returns non-revoked keys for the active organization.

#### Response

```json
[
  {
    "id": "key_123",
    "name": "Production Key",
    "keyPrefix": "kh_abc",
    "createdAt": "2024-01-01T00:00:00Z",
    "lastUsedAt": "2024-01-15T12:00:00Z",
    "createdByName": "Jane Doe",
    "expiresAt": null
  }
]
```

The full key is never returned after creation.

### Create Organization Key

```http
POST /api/keys
```

**Session authentication required.** Cannot be invoked with an API key. Otherwise a leaked key could mint additional keys for the same organization.

#### Request Body

```json
{
  "name": "My API Key",
  "expiresAt": "2025-01-01T00:00:00Z"
}
```

`expiresAt` is optional. Omit for a non-expiring key.

#### Response

```json
{
  "id": "key_123",
  "name": "My API Key",
  "key": "kh_full_api_key_here",
  "keyPrefix": "kh_full_",
  "createdAt": "2024-01-01T00:00:00Z",
  "expiresAt": null
}
```

Copy the `key` value immediately. It is only shown once.

### Revoke Organization Key

```http
DELETE /api/keys/{keyId}
```

Soft-revokes the key. Subsequent requests with that key return `401`.

#### Response

```json
{
  "success": true
}
```

## User Keys (`wfb_`)

Issued per-user. Intended for webhook triggers, not for general REST API access.

### List User Keys

```http
GET /api/api-keys
```

Session authentication required.

### Create User Key

```http
POST /api/api-keys
```

Session authentication required.

#### Request Body

```json
{
  "name": "My Webhook Key"
}
```

### Delete User Key

```http
DELETE /api/api-keys/{keyId}
```

Session authentication required. Revokes the key. This action cannot be undone.

## Security Notes

- Keys are hashed with SHA256 before storage; only the prefix is kept for identification.
- Anonymous users cannot create API keys.
- Revoke compromised keys immediately.
- Store keys in environment variables, not in source code.
- Key creation and personal-key deletion require session authentication, so a leaked API key cannot mint or delete other keys.

---
title: "Error Codes"
description: "KeeperHub API error codes and troubleshooting guide."
---

# Error Codes

Reference for API error codes and how to resolve them.

## Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable description"
  }
}
```

## HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource does not exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Common Error Codes

### Authentication Errors

| Code | Description | Resolution |
|------|-------------|------------|
| `UNAUTHORIZED` | Missing authentication | Include valid session or API key |
| `INVALID_API_KEY` | API key is invalid or revoked | Generate a new API key |
| `SESSION_EXPIRED` | Session has expired | Re-authenticate |

### Validation Errors

| Code | Description | Resolution |
|------|-------------|------------|
| `INVALID_INPUT` | Request body validation failed | Check required fields |
| `INVALID_ADDRESS` | Invalid Ethereum address | Verify address format |
| `INVALID_CHAIN_ID` | Unsupported chain ID | Use supported chain |

### Resource Errors

| Code | Description | Resolution |
|------|-------------|------------|
| `NOT_FOUND` | Resource does not exist | Verify resource ID |
| `ALREADY_EXISTS` | Resource already exists | Use update instead |
| `PERMISSION_DENIED` | No access to resource | Verify ownership |

### Execution Errors

| Code | Description | Resolution |
|------|-------------|------------|
| `EXECUTION_FAILED` | Workflow execution failed | Check execution logs |
| `INSUFFICIENT_FUNDS` | Wallet lacks funds for gas | Top up Para wallet |
| `GAS_LIMIT_EXCEEDED` | Transaction exceeded gas limit | Increase gas limit |
| `CONTRACT_ERROR` | Smart contract reverted | Check contract state |

### Rate Limiting

| Code | Description | Resolution |
|------|-------------|------------|
| `RATE_LIMITED` | Too many requests | Wait and retry |

## Retry Strategy

For transient errors (5xx, rate limits), use exponential backoff:

```
Wait time = min(base * 2^attempt, max_wait)
```

Recommended:
- Base: 1 second
- Max attempts: 5
- Max wait: 30 seconds



---
title: "CLI"
description: "KeeperHub command-line interface for managing workflows, executing blockchain actions, and integrating with CI/CD pipelines."
---

# CLI

The KeeperHub CLI (`kh`) lets you manage workflows, execute blockchain actions, and monitor runs from the terminal. It is designed for scripting, CI/CD pipelines, and AI-assisted workflows via MCP.

## Install

**Homebrew (macOS/Linux):**
```
brew install keeperhub/tap/kh
```

**Go install:**
```
go install github.com/keeperhub/cli/cmd/kh@latest
```

**Binary download:** Download from [GitHub Releases](https://github.com/keeperhub/cli/releases) and add to your PATH.

## Authenticate

```
kh auth login
```

For CI/CD environments, set the `KH_API_KEY` environment variable instead.

## What's in this section

- [Quickstart](./cli/quickstart) -- install, authenticate, and run your first commands
- [Concepts](./cli/concepts) -- authentication model, output formats, configuration, MCP mode
- [Commands](./cli/commands) -- full reference for every `kh` command

---
title: "Quickstart"
description: "KeeperHub CLI Quickstart"
---

# Quickstart

## Install

**Homebrew (macOS/Linux):**
```
brew install keeperhub/tap/kh
```

**Go install:**
```
go install github.com/keeperhub/cli/cmd/kh@latest
```

**Binary download:** Download from [GitHub Releases](https://github.com/keeperhub/cli/releases) and add to your PATH.

## Authenticate

```
kh auth login
```

This opens a browser window to authenticate. Your token is stored in the OS keyring.

To authenticate non-interactively (CI/CD), set `KH_API_KEY` instead.

## Common Commands

**List workflows:**
```
kh workflow list
```

**Run a workflow and wait for completion:**
```
kh workflow run <workflow-id> --wait
```

**Check a run's status:**
```
kh run status <run-id>
```

**View run logs:**
```
kh run logs <run-id>
```

**Execute a contract call:**
```
kh execute contract-call --protocol aave --action supply --args '{"amount":"1000000"}'
```

**List available protocols:**
```
kh protocol list
```

## MCP Server Mode

KeeperHub exposes its actions as tools to AI assistants via the [Model Context Protocol](https://modelcontextprotocol.io).

**Recommended: remote HTTP endpoint (no local server required):**
```
claude mcp add --transport http keeperhub https://app.keeperhub.com/mcp
```

**Add to Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{ "mcpServers": { "keeperhub": { "type": "http", "url": "https://app.keeperhub.com/mcp" } } }
```

Restart Claude Desktop. KeeperHub tools will appear in the tool list.

**Legacy: local stdio server (deprecated):**

`kh serve --mcp` starts a local MCP stdio server. This mode is deprecated. Prefer the remote HTTP endpoint above.

## Next Steps

- [Concepts](./concepts) -- authentication, output formats, configuration
- [Command reference](./commands/kh) -- full documentation for every command

---
title: "Concepts"
description: "KeeperHub CLI Concepts"
---

# Concepts

## What is KeeperHub

KeeperHub is a Web3 automation platform. You build workflows in a visual editor that connect blockchain protocols (Aave, Uniswap, etc.) with off-chain triggers and actions. Workflows run in KeeperHub's managed execution environment.

## CLI vs Web UI

| Task | Use |
|------|-----|
| Building and editing workflows | Web UI (visual editor) |
| Running workflows in CI/CD | CLI (`kh workflow run`) |
| Scripting protocol calls | CLI (`kh execute contract-call`) |
| Monitoring run status | Either |
| AI-assisted workflow creation | CLI in MCP mode |

## Authentication Model

The CLI supports three authentication methods, checked in this order:

1. **API key** (`KH_API_KEY` environment variable) -- preferred for CI/CD
2. **OS keyring token** -- stored by `kh auth login` browser flow
3. **hosts.yml token** -- fallback for environments without a keyring

Run `kh auth login` to authenticate via browser OAuth. For headless environments, create an API key in the KeeperHub web UI and set `KH_API_KEY`.

Run `kh auth status` to see which method is active and whether your token is valid.

## Output Formats

By default, most commands render a human-readable table. Use these flags for machine-readable output:

- `--json` -- emit raw JSON
- `--jq <expr>` -- filter JSON with a jq expression (implies `--json`)

Examples:
```
kh workflow list --json
kh workflow list --jq '.[].id'
kh run status <id> --json | jq '.status'
```

## Configuration

Configuration is stored in XDG-standard paths:

| File | Default path | Purpose |
|------|-------------|---------|
| `config.yml` | `~/.config/kh/config.yml` | Default host, output preferences |
| `hosts.yml` | `~/.config/kh/hosts.yml` | Per-host tokens and headers |

Override with `XDG_CONFIG_HOME`. Use `kh config list` to view current config and `kh config set` to update values.

## MCP Server Mode

MCP (Model Context Protocol) lets AI assistants discover and call tools via a standard JSON-RPC protocol. Running `kh serve --mcp` starts an MCP server that exposes KeeperHub's workflow execution and protocol actions as tools.

The server reads all available actions from `/api/mcp/schemas` on startup and registers each as an MCP tool. The AI assistant can then call these tools to execute workflows, query protocols, and manage resources on your behalf.

The server communicates over stdin/stdout. When integrated with Claude Desktop, the host application manages the process lifecycle. See [Quickstart](./quickstart) for setup instructions.

## kh

KeeperHub CLI

### Options

```
  -h, --help          help for kh
  -H, --host string   KeeperHub host (default: app.keeperhub.com)
      --jq string     Filter JSON output with a jq expression
      --json          Output as JSON
      --no-color      Disable color output
  -y, --yes           Skip confirmation prompts
```

### SEE ALSO

* [kh action](kh_action.md)	 - Browse available actions
* [kh auth](kh_auth.md)	 - Authenticate with KeeperHub
* [kh billing](kh_billing.md)	 - View billing and usage
* [kh completion](kh_completion.md)	 - Generate shell completion scripts
* [kh config](kh_config.md)	 - Manage CLI configuration
* [kh doctor](kh_doctor.md)	 - Check CLI health
* [kh execute](kh_execute.md)	 - Execute direct blockchain actions
* [kh org](kh_org.md)	 - Manage organizations
* [kh project](kh_project.md)	 - Manage projects
* [kh protocol](kh_protocol.md)	 - Browse blockchain protocols
* [kh run](kh_run.md)	 - Monitor workflow runs
* [kh serve](kh_serve.md)	 - Start a server
* [kh tag](kh_tag.md)	 - Manage tags
* [kh template](kh_template.md)	 - Manage workflow templates
* [kh update](kh_update.md)	 - Update kh to the latest version
* [kh version](kh_version.md)	 - Show CLI version
* [kh wallet](kh_wallet.md)	 - Manage wallets
* [kh workflow](kh_workflow.md)	 - Manage workflows

