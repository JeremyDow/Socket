# Socket Permissions

Every tool action maps to one of three categories:

- **automatic** — safe reads and local drafting only
- **operator_approval** — durable writes, external effects, Oracle proposals
- **forbidden** — governance bypass, repository deletion, silent Oracle authority

Tools must consult `categories.js` before performing an action. Forbidden actions
must never run. Approval-required actions must stop until the operator confirms.