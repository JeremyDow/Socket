# Oracle Adapter Boundary

Oracle is a **separate application** with its own repository and governance.

Socket may:

- open or connect to Oracle as an external app
- prepare and propose intake material for operator review
- surface Oracle status through read-only adapter calls (future)

Socket may **not**:

- silently create Oracle authority
- perform Oracle lifecycle transitions
- issue Oracle Decisions or Council actions
- promote vault artifacts or durable judgments without Oracle's own gates
- copy Oracle implementation code into Socket

Oracle lifecycle transitions, Decisions, Council actions, vault promotion, and
durable judgment remain governed entirely by Oracle Core and Oracle Vault.

This folder defines the adapter contract only. No Oracle runtime code belongs here.