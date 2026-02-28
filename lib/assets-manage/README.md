## Folder Structure

.
├── README.md
├── external.ts
├── index.ts
├── meta-handler
│   ├── 1-assets-meta.ts
│   ├── 2-assets-backup.ts
│   ├── 3-assets-import.ts
│   └── index.ts
├── service
│   ├── asset-info.ts             Operation for one asset info, include generate, compare, serialize
│   ├── assets-meta.ts            Operation for AssetTree/AssetsList
│   ├── config.ts
│   ├── diff-meta.ts              Compare meta between AssetTree/AssetsList
│   ├── file-meta-handler.ts      A wrapper to update AssetTree
│   ├── index.ts
│   └── short-id.ts               Operations for short-id
└── types
    ├── asset.ts
    ├── assets-meta.ts
    ├── dir-asset.ts
    ├── index.ts
    ├── meta-handler.ts
    └── meta-meta.ts