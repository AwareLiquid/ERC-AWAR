# ADR-0004: Core, Extensions, Experimental, and Adapters

- Status: Accepted
- Date: 2026-07-14

## Context

The prototype combined a state primitive with memory taxonomies, deletion claims,
market settlement, REC language, and Awareness product behavior. This increased
the review surface and created unnecessary dependencies.

## Decision

Core contains only Space authorization, ExperienceDelta hashing, state-machine
rules, signatures, and events. Deletion attestations are extensions. Markets and
REC work are experimental. Awareness taxonomies and payload construction live in
an adapter.

## Consequences

The ERC remains small and independently implementable. Product features can
evolve without changing the protocol. Extensions must publish their own trust and
security assumptions.
