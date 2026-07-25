# Epoch 17.6.1 — Portable Install Hotfix

## Defect

The initial Epoch 17.6 archive was generated in a controlled build environment whose npm cache recorded absolute tarball URLs for an internal OpenAI Artifactory mirror. Those URLs were embedded in `package-lock.json`. External users therefore received `ETIMEDOUT` while `npm ci` attempted to contact an inaccessible internal host.

## Correction

All 81 affected `resolved` fields now use `https://registry.npmjs.org/`. Dependency versions, integrity hashes, package metadata, source code, assets, and compiled examples are unchanged.

## Install

```sh
node --version
npm ci --no-audit --no-fund --progress=false
npm run dev
```

Node 22 is recommended. The project also supports Node `^20.19.0`.

## Verification

- Internal registry reference scan: pass
- Lockfile parse: pass
- `package.json` / lockfile version synchronization: pass
- Clean offline `npm ci` using cached packages: pass
- Application code delta from Epoch 17.6: none
