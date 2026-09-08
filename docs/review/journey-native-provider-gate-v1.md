# Journey native provider gate v1

Temporary review note for the stacked Journey native-provider preparation branch.

Exact behaviour to verify before this slice advances:

- browser/PWA still resolves the browser provider and never claims background support;
- malformed injected native bridge fails closed to browser;
- valid Android/iOS bridge installs before React renders;
- native provider capability remains advisory until real-device proof;
- native samples still pass through the existing trusted-GPS runtime;
- manual pause remains authoritative and cannot auto-resume;
- no native bridge is allowed to mutate Journey storage or reward state directly;
- full tests, mascot asset contract, TypeScript and production build pass together on the exact combined head.

This document is evidence scaffolding only. It does not mark the Android locked-screen human gate complete.
