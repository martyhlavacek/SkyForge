# Quick Start - Tuning Designer

## Your output

```text
.sftuning
```

## Start

```bash
npm ci
npm run dev
```

Open `http://localhost:5173/studio.html` and select **Tuning**.

## Workflow

1. Import the current four-package baseline and workspace.
2. Select the smallest simulation arena that demonstrates the behaviour.
3. Click **Set A Baseline**.
4. Run and capture representative A telemetry.
5. Change one parameter group.
6. Loop or scrub the same attention point.
7. Capture B and inspect the comparison.
8. Confirm the result in a full uninterrupted level.
9. Export `.sftuning` and the review report.

## Review

Check:

- time to kill;
- projectile density;
- survivability;
- reward rate;
- difficulty scaling;
- terrain compatibility;
- frame-time impact.

## Return

- revised `.sftuning`;
- affected IDs;
- A/B summary;
- intended difficulty effect;
- dependency requests;
- unresolved comments.
