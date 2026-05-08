## why use execSync for git command Running

`execFileSync` is used on purpose; `execSync` would be a weaker choice here.

**`execSync(command)`** runs the string through a shell (`sh -c` on Unix). To pass the remote you would build one string, e.g. `` execSync(`git remote add origin ${gitRemote}`, { cwd: dir }) ``. Then anything in `gitRemote` that the shell treats specially (spaces, `$()`, backticks, `;`, etc.) can change or break the command or become **command injection**. You would have to quote/escape by hand and still stay shell-dependent.

**`execFileSync('git', ['remote', 'add', 'origin', gitRemote], opts)`** starts `git` directly with a fixed argv list: **no shell**, no string parsing. `gitRemote` is always exactly one argument to `git`, which matches how Git expects the URL and avoids shell metacharacter issues.

So: same “run git with these args” behavior, but **clearer, safer, and more predictable** when `gitRemote` comes from config or the network. The rest of `gitSyncUp` uses `execFileSync` for the same reasons.