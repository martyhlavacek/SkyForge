# Claude Adversarial Review Request — SkyForge Epoch 18.3

Review the complete v0.10.3 application at the bound Git commit and artifact
checksum supplied with this package. This is a real rebase of the verified
Epoch 18.2 archive, not a standalone implementation kit.

Prioritize:

1. MP3 import validation, content-addressed identity, and deduplication.
2. Per-level assignment persistence and missing-track behavior.
3. Preview cleanup and object-URL lifecycle.
4. AudioManager/MusicDirector unlock, loop, volume, offset, fade, pause,
   resume, restart, transition, and shutdown behavior.
5. Music Pack round-trip integrity and absence of absolute source paths.
6. Production reachability: used tracks included, unused tracks excluded,
   corrupt or missing referenced tracks rejected.
7. Path traversal, malformed base64, MIME confusion, oversized files, and
   malicious package inputs.
8. Whether automated claims in `EPOCH_18_3_VERIFICATION_REPORT.md` are
   reproducible.

Do not grant release acceptance without browser playback tests using a real MP3
fixture and a fresh-clone build.

