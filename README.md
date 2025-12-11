# Anilyzer Data Exporter
Anilyzer Data Export extracts and exports your (or anyone else's) AniList data into a compatible format for [Aniylzer](https://github.com/whoswhip/anilyzer)
> Do not expect much from this codebase, it's my first time building something CLI related in typescript and ever using GraphQL


## Running 

```bash
git clone https://github.com/whoswhip/anilyzer-data-exporter
cd anilyzer-data-exporter
npm install
```

### Production?
```bash
npm run build
npm start -- --username <anilist username>
```
If that doesn't work try running it directly:
#### Option A:
After building run
```bash
node build/index.js --username <anilist username>
```
#### Option B:
```bash
npx ts-node src/index.ts --username <anilist username
```
## Authentication
If your profile is private or you want to extract private lists/activity then get your token at https://anilist.co/api/v2/oauth/authorize?client_id=32860&response_type=token.
Then just append your command with `--token <token>`