# Examples

Runnable examples for the refactored stack:

- Awareness card lifecycle to private transitions;
- deterministic application-level conflict resolution before a linear commit;
- structural commitment throughput and public ABI footprint.

Run from the repository root:

```bash
pnpm build
pnpm --filter @erc-awar/examples demo
```

The benchmark measures local commitment construction, not model quality,
retrieval accuracy, chain gas, or end-to-end latency.
